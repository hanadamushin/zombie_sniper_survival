import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events.ts';
import { stream } from '../src/core/rng.ts';
import { deserialize, serialize } from '../src/core/save.ts';
import { STATE_VERSION, createInitialState, emptyInputFrame, RESOURCE_IDS, type GameState, type JobId, type StaticGrid, type Survivor } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { COLONY, EXPEDITION_WEAPONS, expeditionWeapon } from '../src/data/colony.ts';
import { TRAITS } from '../src/data/traits.ts';
import { catchUp, colonySystem } from '../src/sim/colony/index.ts';
import { foodPriceFor } from '../src/sim/colony/economy.ts';
import { interactionAt } from '../src/sim/colony/encounters.ts';
import { expeditionsMinute, expeditionTargets, returnChance, sendExpedition } from '../src/sim/colony/expeditions.ts';
import { activityAt, defenders, distributeBuildWork, mealPerDay, outputPerHour, seasonFactor, takeResearchPoints, workHours } from '../src/sim/colony/jobs.ts';
import { ctxNow } from '../src/sim/colony/stock.ts';
import { generateSurvivor, signingFee, wageOf } from '../src/sim/colony/survivors.ts';
import { createSim, type Sim } from '../src/sim/index.ts';
import { areaOf } from '../src/sim/tactical/area.ts';
import { settlementAttraction, worldSystem } from '../src/sim/world/index.ts';
import { cellsWithin, parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { decodeScenario, initWorld } from '../src/sim/world/scenario.ts';
import { beginAt, findStartCandidates } from '../src/sim/world/start.ts';

const DATA = new URL('../public/data/', import.meta.url);
const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
const scenario = (() => {
  const buf = readFileSync(new URL('infection_0.bin', DATA));
  return decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
})();
const DT = BALANCE.time.fixedStep;
const DAY = 1440;
const idle = emptyInputFrame();

interface Rig {
  state: GameState;
  sim: Sim;
  events: GameEvent[];
  /** Advance by game minutes with the given step (seconds = game minutes). */
  run(minutes: number, dt?: number): void;
  add(job: JobId, over?: Partial<Survivor>): Survivor;
}

/** A started game. `full` runs every system (map, zombies, survivor movement); otherwise only colony + world. */
function rig(full = false, seed = 7): Rig {
  const state = createInitialState(seed, 1);
  state.flags.unlockAll = true; // gear and jobs are tech-gated since 07; these tests are about the colony itself
  initWorld(state, grid, scenario);
  const start = findStartCandidates(state.world.cells, grid, stream(state, 'world.start'))[0]!;
  beginAt(state, grid, start.cell);
  state.mode = 'command';
  const sim = full ? createSim({ grid }) : createSim({ grid, systems: [colonySystem, worldSystem] });
  const events: GameEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.tick(state, DT, idle);
  return {
    state, sim, events,
    run(minutes, dt = 1) {
      const steps = Math.round(minutes / dt);
      for (let i = 0; i < steps; i++) sim.tick(state, dt, idle);
    },
    add(job, over = {}) {
      const s: Survivor = { ...generateSurvivor(state, 'rural', stream(state, 'test.people')), ath: 5, kno: 5, spd: 5, sta: 5, trait: 'none', wage: 4, job, ...over };
      state.colony.survivors.push(s);
      return s;
    },
  };
}

const person = (over: Partial<Survivor> = {}): Survivor => ({
  id: 1, name: 'x', ath: 5, kno: 5, spd: 5, sta: 5, wage: 4, trait: 'none', job: 'idle', morale: 50, hp: 100, status: 'ok', weapon: 'melee',
  location: { kind: 'home' }, pos: [0, 0], task: null, unpaidDays: 0, lowMoraleDays: 0, meals: 0, missed: 0, infectedUntil: null, ...over,
});

describe('formulas (spec §4)', () => {
  it('wage: floor of 1, reference sum, top end, trait factor', () => {
    expect(wageOf(4, 'none')).toBe(1);
    expect(wageOf(14, 'none')).toBe(1); // 2 + 0.6 * -2 = 0.8 -> 1
    expect(wageOf(16, 'none')).toBe(2);
    expect(wageOf(22, 'none')).toBe(6); // 5.6
    expect(wageOf(40, 'none')).toBe(16); // 16.4
    expect(wageOf(22, 'greedy')).toBe(7); // 7.28
    expect(wageOf(22, 'frugal')).toBe(4); // 4.48
    expect(signingFee(person({ wage: 6 }))).toBe(30);
  });

  it('generated stats stay within 1..10, average near 5.5, and every trait stays within +-30 %', () => {
    const state = createInitialState(3, 1);
    const rng = stream(state, 't');
    let sum = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const s = generateSurvivor(state, 'suburb', rng);
      for (const v of [s.ath, s.kno, s.spd, s.sta]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(10);
      }
      expect(s.wage).toBe(wageOf(s.ath + s.kno + s.spd + s.sta, s.trait));
      sum += s.ath + s.kno + s.spd + s.sta;
    }
    expect(sum / N / 4).toBeGreaterThan(5.2);
    expect(sum / N / 4).toBeLessThan(5.8);
    expect(TRAITS.length).toBeGreaterThanOrEqual(12);
    for (const t of TRAITS) {
      for (const v of [t.wageMul ?? 1, t.foodMul ?? 1, ...Object.values(t.job ?? {})]) {
        expect(v).toBeGreaterThanOrEqual(0.7);
        expect(v).toBeLessThanOrEqual(1.3);
      }
    }
  });

  it('output: aptitude x speed x morale x health, zero when unfit', () => {
    expect(outputPerHour(person(), 'farming')).toBeCloseTo(5, 9); // 5 * 1.0 * 1.0 * 1.0
    expect(outputPerHour(person({ ath: 10, kno: 1 }), 'construction')).toBeCloseTo(9.1, 9);
    expect(outputPerHour(person({ kno: 8 }), 'research')).toBeCloseTo(8, 9);
    expect(outputPerHour(person({ spd: 1 }), 'farming')).toBeCloseTo(5 * 0.6, 9);
    expect(outputPerHour(person({ spd: 10 }), 'farming')).toBeCloseTo(5 * 1.5, 9);
    expect(outputPerHour(person({ morale: 0 }), 'farming')).toBeCloseTo(2.5, 9);
    expect(outputPerHour(person({ morale: 100 }), 'farming')).toBeCloseTo(7.5, 9);
    expect(outputPerHour(person({ hp: 50 }), 'farming')).toBeCloseTo(5 * 0.8, 9);
    expect(outputPerHour(person({ status: 'injured' }), 'farming')).toBe(0);
    expect(outputPerHour(person({ trait: 'farmer' }), 'farming')).toBeCloseTo(6.25, 9);
    expect(workHours(person({ sta: 1 }))).toBeCloseTo(6.6, 9);
    expect(workHours(person({ sta: 10 }))).toBeCloseTo(12, 9);
    expect(mealPerDay(person({ sta: 1 }))).toBeCloseTo(1.24, 9);
    expect(mealPerDay(person({ sta: 10 }))).toBeCloseTo(0.7, 9);
  });

  it('schedule: sleep, meals, work for the survivor’s hours', () => {
    const s = person({ job: 'farming', sta: 5 }); // 9 h: 06:00-16:00 with the lunch hour
    expect(activityAt(s, 3 * 60)).toBe('sleep');
    expect(activityAt(s, 5 * 60 + 40)).toBe('eat');
    expect(activityAt(s, 6 * 60)).toBe('work');
    expect(activityAt(s, 12 * 60 + 30)).toBe('eat');
    expect(activityAt(s, 15 * 60 + 59)).toBe('work');
    expect(activityAt(s, 16 * 60)).toBe('free');
    expect(activityAt(s, 22 * 60)).toBe('sleep');
    expect(activityAt(person({ job: 'idle' }), 9 * 60)).toBe('free');
    expect(activityAt(person({ status: 'injured' }), 9 * 60)).toBe('rest');
  });

  it('food price follows the days in stock; winter cuts the harvest', () => {
    expect(foodPriceFor(0)).toBeCloseTo(3.2, 9);
    expect(foodPriceFor(6)).toBeCloseTo(2, 9);
    expect(foodPriceFor(10)).toBeCloseTo(1.2, 9);
    expect(foodPriceFor(100)).toBeCloseTo(1.2, 9);
    expect(foodPriceFor(-50)).toBeCloseTo(5, 9);
    expect(seasonFactor(90)).toBe(1);
    expect(seasonFactor(90 + 230)).toBe(0.4); // mid-January
  });

  it('return chance: clamped to 5..99 %, better with weapons, company, and less danger', () => {
    const w = (id: string) => expeditionWeapon(id)!;
    const s = person();
    expect(returnChance(s, w('unarmed'), 2, 0.5)).toBeCloseTo(0.55 + 0.2 + 0.1 + 0.03 - 0.225, 9);
    expect(returnChance(person({ ath: 10, spd: 10 }), w('rifleArmor'), 6, 0)).toBe(0.99);
    expect(returnChance(person({ ath: 1, spd: 1 }), w('unarmed'), 2, 1)).toBeCloseTo(0.55 + 0.04 + 0.02 + 0.03 - 0.45, 9);
    expect(returnChance(person({ ath: 1, spd: 1, trait: 'x' }), { id: 'x', bonus: -1, ammo: 0, kills: 0 }, 2, 1)).toBe(0.05);
    expect(returnChance(person({ trait: 'coward' }), w('melee'), 3, 0.4) - returnChance(s, w('melee'), 3, 0.4)).toBeCloseTo(0.1, 9);
    const order = EXPEDITION_WEAPONS.map((x) => returnChance(s, x, 3, 0.6));
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
  });
});

describe('thirty days', () => {
  it('ledger explains every change of the stores', () => {
    const r = rig();
    const c = r.state.colony;
    c.stock.ears = 3000;
    c.stock.metal = 20;
    c.stock.parts = 5;
    r.add('farming');
    r.add('farming', { ath: 7 });
    r.add('scavenging');
    r.add('crafting', { kno: 7 });
    r.add('research');
    r.add('defense');
    r.add('medical');
    r.add('construction');
    r.state.player.inv.ears = 30; // handed in on the first minute
    // Start the books at midnight so that whole days are compared.
    r.run(DAY - r.state.time.minute);
    const before = { ...c.stock };
    const firstDay = r.state.time.day;
    r.run(28 * DAY);
    const days = c.ledger.filter((d) => d.day >= firstDay);
    expect(days.length).toBe(29); // 28 full days and the first minute of the next
    const ears = days.reduce((s, d) => s + d.income - d.wages - d.food - d.other, 0);
    expect(c.stock.ears - before.ears).toBeCloseTo(ears, 6);
    for (const res of RESOURCE_IDS) {
      if (res === 'ears') continue;
      const net = days.reduce((s, d) => s + (d.flow?.[res]?.[0] ?? 0) - (d.flow?.[res]?.[1] ?? 0), 0);
      expect(c.stock[res] - before[res], res).toBeCloseTo(net, 6);
      expect(c.stock[res]).toBeLessThanOrEqual(c.capacity[res] + 1e-9);
      expect(c.stock[res]).toBeGreaterThanOrEqual(0);
    }
    // The colony actually ran: wages left, food was grown and bought, things were made and found.
    const sum = (f: (d: (typeof days)[number]) => number): number => days.reduce((s, d) => s + f(d), 0);
    expect(sum((d) => d.wages)).toBeGreaterThan(28 * 6 * 3);
    expect(sum((d) => d.food)).toBeGreaterThan(50);
    expect(sum((d) => d.flow?.ammo?.[0] ?? 0)).toBeGreaterThan(100);
    expect(sum((d) => d.flow?.wood?.[0] ?? 0)).toBeGreaterThan(5);
    expect(c.work.research).toBeGreaterThan(100);
    expect(c.survivors.length).toBe(8);
    expect(c.ledger.length).toBeLessThanOrEqual(COLONY.economy.ledgerDays);
    expect(c.log.length).toBeLessThanOrEqual(COLONY.economy.logMax);
  }, 30_000);

  it('unpaid wages -> falling morale -> desertion, and the log says why', () => {
    const r = rig();
    const c = r.state.colony;
    c.stock.food = 50; // fed and housed: only the missing pay hurts
    const s = r.add('research');
    const farmer = r.add('farming'); // lives off sales, never unpaid
    const morale: number[] = [];
    for (let d = 0; d < 12 && c.survivors.includes(s); d++) {
      r.run(DAY);
      morale.push(s.morale);
    }
    expect(c.survivors.includes(s)).toBe(false);
    expect(c.survivors.includes(farmer)).toBe(true);
    for (let i = 1; i < morale.length - 1; i++) expect(morale[i]!).toBeLessThanOrEqual(morale[i - 1]!);
    expect(morale.length).toBeGreaterThanOrEqual(5);
    expect(morale.length).toBeLessThanOrEqual(9);
    const kinds = c.log.map((l) => l.text);
    expect(kinds.indexOf('log.unpaid')).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf('log.unpaid')).toBeLessThan(kinds.indexOf('log.deserted'));
    expect(c.log.find((l) => l.text === 'log.deserted')?.params?.reason).toBe('unpaid');
    expect(r.events.some((e) => e.type === 'survivorLeft' && e.reason === 'deserted')).toBe(true);
    expect(r.events.some((e) => e.type === 'wagesPaid' && e.unpaid === 1)).toBe(true);
  });

  it('a loyal survivor takes missing pay better; the able go unpaid first', () => {
    const r = rig();
    const c = r.state.colony;
    c.stock.food = 50;
    const a = r.add('defense', { trait: 'loyal', wage: 3 });
    const b = r.add('defense', { wage: 3 });
    r.run(DAY);
    expect(b.morale - a.morale).toBe(-10);
    // Enough for one wage only: the weaker one is paid.
    const strong = r.add('research', { kno: 10, wage: 5 });
    c.stock.ears = 5;
    a.unpaidDays = b.unpaidDays = 0;
    r.run(DAY);
    expect(strong.unpaidDays).toBe(1);
    expect(a.unpaidDays + b.unpaidDays).toBe(1);
  });

  it('no food: hunger, starvation, death', () => {
    const r = rig();
    const c = r.state.colony;
    c.stock.food = 0;
    c.stock.ears = 1000;
    r.add('defense');
    r.run(9 * DAY);
    expect(c.survivors.length + c.memorial.length).toBeLessThanOrEqual(1);
    expect(c.log.some((l) => l.text === 'log.noFood')).toBe(true);
    expect(c.log.some((l) => l.text === 'log.died' || l.text === 'log.deserted')).toBe(true);
  });
});

describe('time', () => {
  function day(dt: number, full = false): GameState {
    const r = rig(full, 11);
    const c = r.state.colony;
    // No zombies in the home cell: the nightly visitors (06) would otherwise cost ammunition and bring in ears.
    r.state.world.cells.Z[r.state.world.homeCell!] = 0;
    // ...and none already on the map (the first tick placed them): one wandering into the base would
    // kill the idle player and skip three days.
    if (r.state.tactical) r.state.tactical.zombies.length = 0;
    c.stock.ears = 200;
    c.stock.metal = 10;
    c.stock.parts = 3;
    for (const job of ['farming', 'farming', 'scavenging', 'crafting', 'research', 'construction', 'medical'] as JobId[]) r.add(job);
    r.run(DAY, dt);
    return r.state;
  }
  const within1 = (a: number, b: number, what: string): void => expect(Math.abs(a - b), what).toBeLessThanOrEqual(Math.max(1e-6, Math.abs(b) * 0.01));

  it('a day yields the same at x1, x10, x30, in big steps, and with the player watching', () => {
    const base = day(DT).colony;
    expect(base.market.food + base.stock.food).toBeGreaterThan(8);
    expect(base.work.research).toBeGreaterThan(30);
    const variants: [string, GameState][] = [['x10', day(DT * 10)], ['x30', day(DT * 30)], ['5 min steps', day(5)], ['watching', day(DT, true)]];
    for (const [name, v] of variants) {
      for (const res of RESOURCE_IDS) within1(v.colony.stock[res], base.stock[res], `${name} ${res}`);
      within1(v.colony.market.food, base.market.food, `${name} market`);
      within1(v.colony.work.research, base.work.research, `${name} research`);
      within1(v.colony.work.craft, base.work.craft, `${name} craft`);
    }
    // With the player at home the survivors really moved about.
    const watched = variants[3]![1];
    expect(areaOf(watched)?.map.params.isHome).toBe(true);
    const home = areaOf(watched)!.map.spawn.home;
    for (const s of watched.colony.survivors) {
      expect(s.task).not.toBeNull();
      expect(Math.hypot(s.pos[0] - home[0], s.pos[1] - home[1])).toBeLessThan(120);
    }
  }, 60_000);

  it('60 survivors cost well under 1 ms per tick', () => {
    const r = rig(true, 5);
    r.state.colony.stock.ears = 1e6;
    r.state.colony.stock.food = 60;
    const jobs: JobId[] = ['farming', 'defense', 'scavenging', 'construction', 'research', 'crafting', 'medical', 'idle'];
    for (let i = 0; i < 60; i++) r.add(jobs[i % jobs.length]!);
    r.state.time.minute = 8 * 60;
    r.run(2, DT); // settle
    const ctx = { dt: DT, input: idle, emit: () => {}, prevEvents: [], grid, warn: () => {} };
    const N = 6000; // 100 game minutes
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      colonySystem.step!(r.state, ctx);
      if (i % 60 === 59) {
        r.state.time.minute += 1;
        colonySystem.minute!(r.state, ctx);
      }
    }
    const perTick = (performance.now() - t0) / N;
    console.log(`colony: ${perTick.toFixed(4)} ms per tick with 60 survivors`);
    expect(perTick).toBeLessThan(1);
  });
});

describe('expeditions', () => {
  function party(r: Rig, n: number): number[] {
    return Array.from({ length: n }, () => r.add('scavenging').id);
  }

  it('weapons change who comes back (statistically), ammunition is charged, loot and zombies shrink', () => {
    const r = rig();
    const { state } = r;
    const targets = expeditionTargets(state, grid);
    expect(targets.length).toBeGreaterThan(5);
    const target = targets.find((t) => grid.cells[t.cell]!.land === 'rural') ?? targets[0]!;
    const cells = state.world.cells;
    cells.Z[target.cell] = 30_000; // danger 0.83
    const z0 = cells.Z[target.cell]!;
    const loot0 = cells.loot[target.cell]!;
    const rates: number[] = [];
    for (const w of EXPEDITION_WEAPONS) {
      let ok = 0;
      let total = 0;
      for (let i = 0; i < 150; i++) {
        state.colony.survivors = [];
        state.colony.candidates = [];
        state.colony.stock.ammo = 500;
        cells.Z[target.cell] = z0;
        const ids = party(r, 4);
        const c = ctxNow(state, grid, () => {});
        expect(sendExpedition(c, ids, target.cell, w.id)).toBeNull();
        expect(state.colony.stock.ammo).toBe(500 - w.ammo * 4);
        expect(state.colony.survivors.every((s) => s.status === 'away' && s.location.kind === 'expedition')).toBe(true);
        expect(settlementAttraction(state).attraction![0]!.weight).toBe(BALANCE.infection.colonistAsH * BALANCE.infection.wH); // only the player is home
        expeditionsMinute({ ...c, day: c.day + 3 });
        expect(state.world.expeditions.length).toBe(0);
        ok += state.colony.survivors.filter((s) => s.status === 'ok').length;
        total += 4;
        expect(state.colony.survivors.every((s) => s.location.kind === 'home' && s.status !== 'away')).toBe(true);
      }
      rates.push(ok / total);
      const expected = returnChance(person(), w, 4, 0.83);
      expect(Math.abs(ok / total - expected), w.id).toBeLessThan(0.07);
    }
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeGreaterThan(rates[i - 1]!);
    expect(rates[rates.length - 1]! - rates[0]!).toBeGreaterThan(0.2);
    expect(cells.loot[target.cell]!).toBeLessThan(loot0);
    expect(cells.Z[target.cell]!).toBeLessThan(z0);
    expect(state.colony.memorial.length).toBeGreaterThan(0);
  });

  it('runs on the clock: away for the journey and the search, back with a story', () => {
    const r = rig();
    const { state } = r;
    const target = expeditionTargets(state, grid)[0]!;
    state.world.cells.Z[target.cell] = 0;
    state.world.cells.H[target.cell] = 500;
    const ids = party(r, 6);
    const wood0 = state.colony.stock.wood + state.colony.stock.food;
    r.sim.dispatch({ type: 'sendExpedition', members: ids, target: target.cell, weapon: 'melee' });
    r.run(1);
    expect(state.world.expeditions.length).toBe(1);
    r.run(target.totalMinutes - 5);
    expect(state.world.expeditions.length).toBe(1);
    r.run(10);
    expect(state.world.expeditions.length).toBe(0);
    expect(r.events.some((e) => e.type === 'expeditionReturned' && e.survivors.length === 6)).toBe(true);
    expect(state.colony.stock.wood + state.colony.stock.food).toBeGreaterThan(wood0 + 5);
    const texts = state.colony.log.map((l) => l.text);
    expect(texts).toContain('log.expSent');
    expect(texts).toContain('log.expBack');
    expect(texts).toContain('log.expHaul');
    expect(texts).toContain('log.expFind');
    expect(state.world.cells.intel[target.cell]).toBe(2);
  });

  it('brings people home as candidates, and the cell loses exactly that many', () => {
    const r = rig();
    const { state } = r;
    const target = expeditionTargets(state, grid)[0]!;
    state.world.cells.Z[target.cell] = 0;
    state.world.cells.H[target.cell] = 3;
    let found = 0;
    for (let i = 0; i < 40 && found < 3; i++) {
      state.colony.survivors = [];
      const c = ctxNow(state, grid, () => {});
      sendExpedition(c, party(r, 6), target.cell, 'unarmed');
      expeditionsMinute({ ...c, day: c.day + 3 });
      found = state.colony.candidates.length;
      expect(state.world.cells.H[target.cell]).toBe(3 - found);
    }
    expect(found).toBe(3); // never more than were hiding there
    expect(state.colony.candidates.every((s) => s.fromCell === target.cell)).toBe(true);
  });

  it('rejects bad orders', () => {
    const r = rig();
    const { state } = r;
    const ids = party(r, 3);
    const home = state.world.homeCell!;
    const target = expeditionTargets(state, grid)[0]!.cell;
    const c = ctxNow(state, grid, () => {});
    expect(sendExpedition(c, ids.slice(0, 1), target, 'melee')).toBe('partySize');
    expect(sendExpedition(c, ids, home, 'melee')).toBe('tooFar');
    expect(sendExpedition(c, ids, home + 10, 'melee')).toBe('tooFar');
    expect(sendExpedition(c, ids, target, 'laser')).toBe('weapon');
    expect(sendExpedition(c, ids, target, 'rifleArmor')).toBe('noAmmo');
    state.colony.survivors[0]!.status = 'injured';
    expect(sendExpedition(c, ids, target, 'melee')).toBe('memberUnavailable');
    const sea = cellsWithin({ ...grid, cells: grid.cells.map(() => ({}) as never) }, home, 3).find((id) => !grid.cells[id]);
    if (sea !== undefined) expect(expeditionTargets(state, grid).some((t) => t.cell === sea)).toBe(false);
    for (const t of expeditionTargets(state, grid)) expect(grid.cells[t.cell]).toBeTruthy();
  });
});

describe('the player and the colony', () => {
  it('meets people at a search point, hires them, and the cell’s H drops', () => {
    const r = rig(true);
    const { state } = r;
    const t = state.tactical!;
    expect(t.hideouts!.length).toBeGreaterThan(0);
    const cell = state.player.cell;
    const h0 = state.world.cells.H[cell]!;
    const hide = t.hideouts![0]!;
    state.mode = 'tactical';
    state.player.pos = [hide.pos[0], state.player.pos[1], hide.pos[1]];
    expect(interactionAt(state)?.kind).toBe('talk');
    r.sim.tick(state, DT, { ...idle, interact: true });
    const found = state.colony.candidates.length;
    expect(found).toBeGreaterThanOrEqual(1);
    expect(state.world.cells.H[cell]).toBe(h0 - found);
    expect(hide.met).toBe(true);
    // The same door can now be searched like any other.
    expect(interactionAt(state)?.kind).toBe('search');
    const loot0 = state.world.cells.loot[cell]!;
    r.sim.tick(state, DT, { ...idle, interact: true });
    expect(state.world.cells.loot[cell]!).toBeLessThan(loot0);
    expect(interactionAt(state)).toBeNull();

    // Hiring: not without ears; with them the fee leaves and the newcomer walks in.
    const cand = state.colony.candidates[0]!;
    state.player.inv = { ammo: 10, ears: 0 };
    state.colony.stock.ears = 0;
    r.sim.dispatch({ type: 'hire', candidate: cand.id });
    r.sim.tick(state, DT, idle);
    expect(state.colony.survivors.length).toBe(0);
    expect(r.events.some((e) => e.type === 'commandRejected' && e.reason === 'noEars')).toBe(true);
    state.player.inv.ears = signingFee(cand) + 3; // paid out of the player's pocket
    r.sim.dispatch({ type: 'hire', candidate: cand.id });
    r.sim.tick(state, DT, idle);
    expect(state.colony.survivors.map((s) => s.id)).toEqual([cand.id]);
    expect(state.player.inv.ears).toBe(3);
    expect(state.colony.stock.ears).toBe(0);
    expect(settlementAttraction(state).attraction![0]!.weight).toBe(2 * BALANCE.infection.colonistAsH * BALANCE.infection.wH);
    r.sim.dispatch({ type: 'assignJob', survivor: cand.id, job: 'farming' });
    r.sim.dispatch({ type: 'dismiss', survivor: cand.id });
    r.sim.tick(state, DT, idle);
    expect(state.colony.survivors.length).toBe(0);
    expect(state.world.cells.H[cell]).toBe(h0 - found + 1);
  });

  it('never offers more candidates than the cell hides; those who wait too long go back', () => {
    const r = rig();
    const { state } = r;
    const cell = state.world.homeCell!;
    state.world.cells.H[cell] = 1;
    const c = ctxNow(state, grid, () => {});
    const { addCandidates } = colonyApi;
    expect(addCandidates(c, cell, 5, 'player').length).toBe(1);
    expect(state.world.cells.H[cell]).toBe(0);
    r.run((COLONY.encounter.waitDays + 1) * DAY);
    expect(state.colony.candidates.length).toBe(0);
    expect(state.world.cells.H[cell]).toBe(1);
  });

  it('ears are handed in at home, ammunition is drawn from the stores', () => {
    const r = rig();
    const { state } = r;
    state.player.inv = { ammo: 120, ears: 14, medicine: 2 };
    state.colony.stock.ammo = 50;
    r.run(2);
    expect(state.player.inv.ears).toBe(0);
    expect(state.colony.stock.ears).toBe(14);
    expect(state.colony.stock.medicine).toBe(3);
    expect(state.colony.ledger[state.colony.ledger.length - 1]!.income).toBe(14);
    r.sim.dispatch({ type: 'resupply' });
    r.run(1);
    expect(state.player.inv.ammo).toBe(BALANCE.player.maxAmmo);
    expect(state.colony.stock.ammo).toBe(20);
    // Away from home neither works.
    state.player.cell = expeditionTargets(state, grid)[0]!.cell;
    state.player.inv.ears = 5;
    state.player.inv.ammo = 0;
    r.sim.dispatch({ type: 'resupply' });
    r.run(2);
    expect(state.player.inv.ears).toBe(5);
    expect(state.player.inv.ammo).toBe(0);
    expect(r.events.some((e) => e.type === 'commandRejected' && e.reason === 'notHome')).toBe(true);
  });

  it('medicine and first aid cure the player at home; an untreated survivor dies after 48 h', () => {
    const r = rig();
    const { state } = r;
    state.colony.stock.food = 30;
    state.player.infectedUntil = { day: state.time.day + 2, minute: state.time.minute };
    r.run(10 * 60);
    expect(state.player.infectedUntil).not.toBeNull(); // first aid alone takes 16 hours
    r.run(8 * 60);
    expect(state.player.infectedUntil).toBeNull();
    expect(state.colony.stock.medicine).toBe(0);
    expect(state.colony.log.some((l) => l.text === 'log.playerCured')).toBe(true);
    // No medicine left for the next patient.
    const s = r.add('idle', { status: 'infected', infectedUntil: { day: state.time.day + 2, minute: state.time.minute } });
    r.run(47 * 60);
    expect(state.colony.survivors.includes(s)).toBe(true);
    r.run(2 * 60);
    expect(state.colony.survivors.includes(s)).toBe(false);
    expect(state.colony.memorial[0]).toMatchObject({ name: s.name, cause: 'infection' });
    expect(state.colony.log.some((l) => l.text === 'log.noMedicine')).toBe(true);
  });

  it('a medic gets the injured back on their feet much sooner', () => {
    const days = (medic: boolean): number => {
      const r = rig();
      r.state.colony.stock.food = 50;
      r.state.colony.stock.ears = 500;
      const s = r.add('idle', { status: 'injured', hp: 30 });
      if (medic) r.add('medical', { kno: 8 });
      let d = 0;
      while (s.status !== 'ok' && d < 20) {
        r.run(6 * 60);
        d += 0.25;
      }
      return d;
    };
    const alone = days(false);
    const cared = days(true);
    expect(cared).toBeLessThan(alone / 2);
    expect(alone).toBeLessThan(6);
  });

  it('death with a colony: three days later at the headquarters, empty-handed but armed', () => {
    const r = rig(true);
    const { state } = r;
    r.add('farming');
    const home = state.world.homeCell!;
    state.colony.stock.food = 30;
    // Die somewhere else.
    state.player.cell = expeditionTargets(state, grid)[0]!.cell;
    state.tactical = null;
    r.sim.tick(state, DT, idle);
    state.player.inv = { ammo: 77, ears: 40 };
    state.player.infectedUntil = { day: state.time.day + 1, minute: 0 };
    const t0 = state.time.day * DAY + state.time.minute;
    state.player.hp = 0;
    state.player.aim.deadT = 0.05;
    r.run(0.2, DT);
    expect(state.player.cell).toBe(home);
    expect(state.player.aim.deadT).toBe(0);
    expect(state.player.hp).toBe(BALANCE.player.hp);
    expect(state.player.inv.ears).toBe(0);
    expect(state.player.inv.ammo).toBe(COLONY.health.recoverAmmo);
    expect(state.player.infectedUntil).toBeNull();
    const passed = state.time.day * DAY + state.time.minute - t0;
    expect(passed).toBeGreaterThanOrEqual(3 * DAY);
    expect(passed).toBeLessThan(3 * DAY + 5);
    expect(state.colony.lastMinute).toBe(state.time.day * DAY + state.time.minute); // the colony lived through those days
    expect(state.colony.ledger.length).toBeGreaterThanOrEqual(3);
    expect(r.events.some((e) => e.type === 'playerRevived')).toBe(true);
    expect(areaOf(state)?.map.params.isHome).toBe(true);
    expect(state.player.pos[0]).toBe(512);
    expect(state.flags.defeat).toBeUndefined();
  });

  it('death without a colony is defeat', () => {
    const r = rig(true);
    const { state } = r;
    state.player.hp = 0;
    state.player.aim.deadT = 0.05;
    r.run(0.5, DT);
    expect(state.flags.defeat).toBe(true);
    expect(r.events.filter((e) => e.type === 'defeat').length).toBe(1);
    expect(state.player.aim.deadT).toBeGreaterThan(0);
  });
});

describe('interfaces for later sessions', () => {
  it('construction points fill blueprints by priority; research points wait to be taken; guards are listed', () => {
    const r = rig();
    const { state } = r;
    const bp = (id: number, priority: 0 | 1 | 2) => ({ id, def: 'wall', tx: 130, ty: 130, rot: 0 as const, hp: 1, progress: 0, delivered: {}, level: 1, priority });
    const first = state.build.structures.length; // (the headquarters and the first field are already there)
    state.build.structures.push(bp(1, 0), bp(2, 2));
    expect(distributeBuildWork(state, 50, () => 40)).toBe(0);
    expect(state.build.structures[first + 1]!.progress).toBe(1);
    expect(state.build.structures[first]!.progress).toBeCloseTo(0.25, 9);
    expect(distributeBuildWork(state, 100, () => 40)).toBeCloseTo(70, 9);
    r.add('research', { kno: 8 });
    r.add('defense');
    state.colony.stock.food = 20;
    state.colony.stock.ears = 100;
    r.run(DAY);
    const rp = takeResearchPoints(state);
    expect(rp).toBeGreaterThan(50);
    expect(takeResearchPoints(state)).toBe(0);
    state.time.minute = 9 * 60;
    expect(defenders(state).map((d) => d.onDuty)).toEqual([true]);
    state.time.minute = 23 * 60;
    expect(defenders(state).map((d) => d.onDuty)).toEqual([false]);
  });

  it('saves and loads, and upgrades a version 3 save', () => {
    const r = rig();
    r.add('farming');
    r.state.colony.stock.ears = 50;
    r.run(600);
    const copy = deserialize(serialize(r.state));
    expect(copy.colony).toEqual(JSON.parse(JSON.stringify(r.state.colony)));
    const old = JSON.parse(serialize(createInitialState(1, 1))) as Record<string, unknown>;
    old.version = 3;
    old.colony = { stock: {}, capacity: {}, survivors: [], candidates: [], foodPrice: 1, ledger: [], log: [] };
    const up = deserialize(JSON.stringify(old));
    expect(up.version).toBe(STATE_VERSION);
    expect(up.colony.market.food).toBe(0);
    expect(up.colony.capacity.food).toBe(COLONY.economy.baseCapacity.food);
    expect(up.colony.stock.food).toBe(6);
    catchUp(up, { grid, emit: () => {} }); // no home cell yet: nothing happens, nothing throws
  });
});

import * as colonyApi from '../src/sim/colony/survivors.ts';
