import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events.ts';
import { stream } from '../src/core/rng.ts';
import { deserialize, serialize } from '../src/core/save.ts';
import { createInitialState, emptyInputFrame, TECH_CATEGORIES, type GameState, type InputFrame, type JobId, type StaticGrid, type Survivor } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { BUILD, BUILDINGS, BUILDING_LIST, DEFENDER_WEAPONS } from '../src/data/buildings.ts';
import { COLONY, EXPEDITION_WEAPONS } from '../src/data/colony.ts';
import { DIFFICULTY_MODS, FLAGS, GOAL_TECHS, locksOf, MOD_KEYS, RESEARCH, TECH_LIST, TECHS, type TechEffect } from '../src/data/techs.ts';
import { WEAPONS } from '../src/data/weapons.ts';
import { ZOMBIES } from '../src/data/zombies.ts';
import { buildNow, buildRadius, placementError } from '../src/sim/build/blueprints.ts';
import { workOf } from '../src/sim/build/construction.ts';
import { activeTurrets } from '../src/sim/build/defense.ts';
import { isUnlocked, maxHp } from '../src/sim/build/structures.ts';
import { foodPriceFor, wageDue } from '../src/sim/colony/economy.ts';
import { expeditionRadius, weaponAvailable } from '../src/sim/colony/expeditions.ts';
import { fighters, jobMul } from '../src/sim/colony/jobs.ts';
import { generateSurvivor, hire, signingFee } from '../src/sim/colony/survivors.ts';
import { ctxNow } from '../src/sim/colony/stock.ts';
import { createSim, type Sim } from '../src/sim/index.ts';
import { forecastInfection } from '../src/sim/research/forecast.ts';
import { researchSystem } from '../src/sim/research/index.ts';
import { colonySystem } from '../src/sim/colony/index.ts';
import { worldSystem } from '../src/sim/world/index.ts';
import { completeTech, daysLeft, eraCount, grantTech, researchHour, researchPerDay, startError, startResearch, techStatus } from '../src/sim/research/index.ts';
import { getMod, hasFlag, invalidateMods, modBuilds, modTable } from '../src/sim/research/modifiers.ts';
import { debugFulfilVictory, endingStats, victoryProgress } from '../src/sim/research/victory.ts';
import { areaOf } from '../src/sim/tactical/area.ts';
import { weaponOf } from '../src/sim/tactical/weapon.ts';
import { addZombie } from '../src/sim/tactical/zombies.ts';
import { RANGE_SPOTS } from '../src/sim/tactical/range.ts';
import { parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { decodeScenario, initWorld } from '../src/sim/world/scenario.ts';
import { beginAt, findStartCandidates } from '../src/sim/world/start.ts';
import { ja } from '../src/ui/i18n/ja.ts';
import { TREE_LAYOUT } from '../src/ui/command/research.tsx';

const DATA = new URL('../public/data/', import.meta.url);
const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
const scenario = (() => {
  const buf = readFileSync(new URL('infection_0.bin', DATA));
  return decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
})();
const DT = BALANCE.time.fixedStep;
const idle = emptyInputFrame();
const noop = (): void => {};

/** A state with a base but no world: enough for modifiers, unlocks and the research bookkeeping. */
function bare(difficulty: 0 | 1 | 2 = 1): GameState {
  const state = createInitialState(11, difficulty);
  state.world.homeCell = 0;
  return state;
}

interface Rig {
  state: GameState;
  sim: Sim;
  events: GameEvent[];
  run(minutes: number): void;
  add(job: JobId, over?: Partial<Survivor>): Survivor;
}

/** A started game on the real map; every system runs, one tick per game minute. */
function rig(seed = 7, lean = false): Rig {
  const state = createInitialState(seed, 1);
  initWorld(state, grid, scenario);
  const start = findStartCandidates(state.world.cells, grid, stream(state, 'world.start'))[0]!;
  beginAt(state, grid, start.cell);
  state.mode = 'command';
  // `lean`: only the colony, research and the world (no map, no raids) — for long runs.
  const sim = lean ? createSim({ grid, systems: [colonySystem, researchSystem, worldSystem] }) : createSim({ grid });
  const events: GameEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.tick(state, DT, idle);
  return {
    state, sim, events,
    run(minutes) {
      for (let i = 0; i < minutes; i++) sim.tick(state, 1, idle);
    },
    add(job, over = {}) {
      const s: Survivor = { ...generateSurvivor(state, 'rural', stream(state, 'test.people')), ath: 5, kno: 5, spd: 5, sta: 5, trait: 'none', wage: 4, job, ...over };
      state.colony.survivors.push(s);
      return s;
    },
  };
}

const effectsOf = (kind: TechEffect['kind']): { tech: string; e: TechEffect }[] => TECH_LIST.flatMap((t) => t.effects.filter((e) => e.kind === kind).map((e) => ({ tech: t.id, e })));

describe('tech data', () => {
  it('has unique ids, known references, symmetric branches and no cycles', () => {
    expect(new Set(TECH_LIST.map((t) => t.id)).size).toBe(TECH_LIST.length);
    expect(TECH_LIST.length).toBe(56);
    for (const t of TECH_LIST) {
      expect(t.cost, t.id).toBeGreaterThan(0);
      expect(t.id[0], t.id).toBe(t.cat);
      for (const r of [...t.req, ...(t.any ?? [])]) {
        expect(TECHS[r], `${t.id} needs unknown ${r}`).toBeDefined();
        expect(TECHS[r]!.era, `${t.id} needs a later node ${r}`).toBeLessThanOrEqual(t.era);
      }
      if (t.excludes) {
        const o = TECHS[t.excludes];
        expect(o, `${t.id} excludes unknown ${t.excludes}`).toBeDefined();
        expect(o!.excludes).toBe(t.id);
        expect([o!.cat, o!.era, o!.cost]).toEqual([t.cat, t.era, t.cost]); // the two sides cost the same
        expect(t.req).toEqual(o!.req);
      }
    }
    // No cycles: every node can be ordered after its prerequisites.
    const placed = new Set<string>();
    for (let changed = true; changed; ) {
      changed = false;
      for (const t of TECH_LIST) {
        if (placed.has(t.id) || ![...t.req, ...(t.any ?? [])].every((r) => placed.has(r))) continue;
        placed.add(t.id);
        changed = true;
      }
    }
    expect(TECH_LIST.filter((t) => !placed.has(t.id)).map((t) => t.id)).toEqual([]);
    expect([...GOAL_TECHS].sort()).toEqual(['C9', 'F9', 'S9']);
    expect(TECH_LIST.filter((t) => t.excludes).length).toBe(18); // nine branches
  });

  it('uses only modifier keys and flags that something reads, and every one of them is used', () => {
    const sources: TechEffect[] = [
      ...TECH_LIST.flatMap((t) => t.effects),
      ...DIFFICULTY_MODS.flat(),
      ...BUILDING_LIST.flatMap((b) => [...(b.mods ?? []).map((m) => ({ kind: 'modifier', ...m }) as TechEffect), ...(b.flags ?? []).map((flag) => ({ kind: 'flag', flag }) as TechEffect)]),
    ];
    const keys = new Set<string>();
    const flags = new Set<string>();
    for (const e of sources) {
      if (e.kind === 'modifier') {
        expect(MOD_KEYS[e.key], `unknown modifier ${e.key}`).toBeDefined();
        expect(Number.isFinite(e.value)).toBe(true);
        keys.add(e.key);
      } else if (e.kind === 'flag') {
        expect(FLAGS[e.flag], `unknown flag ${e.flag}`).toBeDefined();
        flags.add(e.flag);
      }
    }
    // Declared but set by nothing would be dead weight in the table.
    expect(Object.keys(MOD_KEYS).filter((k) => !keys.has(k) && !k.startsWith('job.'))).toEqual([]);
    expect(Object.keys(FLAGS).filter((f) => !flags.has(f))).toEqual([]);
  });

  it('agrees with the buildings, the gear, the jobs and the outpost tiers about what unlocks what', () => {
    const unlocks = effectsOf('unlock').map(({ tech, e }) => (e.kind === 'unlock' ? { tech, what: e.what, id: e.id } : null!));
    for (const u of unlocks.filter((x) => x.what === 'building')) {
      expect(BUILDINGS[u.id], `${u.tech} unlocks unknown building ${u.id}`).toBeDefined();
      expect(BUILDINGS[u.id]!.tech, `${u.id}`).toBe(u.tech);
    }
    for (const b of BUILDING_LIST) {
      if (b.tech) expect(unlocks.some((u) => u.what === 'building' && u.id === b.id && u.tech === b.tech), `${b.id} names ${b.tech}, which does not unlock it`).toBe(true);
      for (const id of b.techAny ?? []) expect(TECHS[id]).toBeDefined();
      // A building never belongs to an earlier era than the node that opens it.
      if (b.tech) expect(b.era, b.id).toBeGreaterThanOrEqual(TECHS[b.tech]!.era);
    }
    for (const w of [...EXPEDITION_WEAPONS, ...DEFENDER_WEAPONS]) {
      if (w.tech) expect(unlocks.some((u) => u.what === 'gear' && u.id === w.id && u.tech === w.tech), `${w.id}`).toBe(true);
    }
    for (const u of unlocks.filter((x) => x.what === 'gear')) expect(EXPEDITION_WEAPONS.some((w) => w.id === u.id && w.tech === u.tech), u.id).toBe(true);
    for (const [i, tier] of BUILD.outpost.tiers.entries()) {
      const tech = (tier as { tech?: string }).tech;
      if (tech) expect(unlocks.some((u) => u.what === 'outpostTier' && u.id === String(i + 1) && u.tech === tech)).toBe(true);
    }
    expect(unlocks.filter((u) => u.what === 'job')).toEqual([{ tech: 'S4', what: 'job', id: 'medical' }]);
  });

  it('has a name, a description and a place in the tree for every node', () => {
    const text = ja as Record<string, string>;
    for (const t of TECH_LIST) {
      expect(text[`tech.${t.id}`], t.id).toBeTruthy();
      expect(text[`tech.${t.id}.desc`], t.id).toBeTruthy();
      expect(TREE_LAYOUT[t.id], t.id).toBeDefined();
    }
    // No two nodes of a category share a slot.
    for (const cat of TECH_CATEGORIES) {
      const slots = TECH_LIST.filter((t) => t.cat === cat).map((t) => TREE_LAYOUT[t.id]!.join(','));
      expect(new Set(slots).size, cat).toBe(slots.length);
    }
    for (const id of GOAL_TECHS) expect(text[`ending.${id}`]).toBeTruthy();
  });

  it('never dead-ends: whichever side of every branch is taken, all eras open and a goal technology is reached', () => {
    const branches = TECH_LIST.filter((t) => t.excludes && t.id < t.excludes).map((t) => [t.id, t.excludes!] as const);
    expect(branches.length).toBe(9);
    const reached = new Set<string>();
    const goalsSeen = new Set<string>();
    for (let mask = 0; mask < 1 << branches.length; mask++) {
      const avoid = new Set(branches.map(([a, b], i) => ((mask >> i) & 1 ? a : b)));
      const state = bare();
      for (let progress = true; progress; ) {
        progress = false;
        for (const t of TECH_LIST) {
          if (avoid.has(t.id) || startError(state, t.id) !== null) continue;
          completeTech(state, t.id, noop);
          progress = true;
        }
      }
      const r = state.research;
      expect(r.era, `mask ${mask}`).toBe(3);
      const goals = GOAL_TECHS.filter((g) => r.done.includes(g));
      expect(goals.length, `mask ${mask}: ${r.done.join(' ')}`).toBeGreaterThan(0);
      // Everything is either taken or closed off by a choice — nothing is left hanging.
      for (const t of TECH_LIST) expect(r.done.includes(t.id) || r.locked.includes(t.id), `mask ${mask}: ${t.id}`).toBe(true);
      for (const id of r.done) reached.add(id);
      for (const g of goals) goalsSeen.add(g);
    }
    expect(TECH_LIST.filter((t) => !reached.has(t.id)).map((t) => t.id)).toEqual([]);
    expect(goalsSeen.size).toBe(3);
  });

  it('locks the other side of a branch and everything behind it', () => {
    expect(locksOf('W5a')).toEqual(['W5b']);
    expect(locksOf('F4a').sort()).toEqual(['F4b', 'F6b']);
    expect(locksOf('S5b').sort()).toEqual(['S5a', 'S6a', 'S7a', 'S9']); // engineering gives up the vaccine
    expect(locksOf('S5a').sort()).toEqual(['S5b', 'S6b', 'S7b']);
    expect(locksOf('F1')).toEqual([]);
  });
});

describe('modifiers', () => {
  it('adds first, then multiplies', () => {
    const state = bare();
    expect(getMod(state, 'build.radius', 120)).toBe(120);
    grantTech(state, ['F5', 'F8']);
    expect(buildRadius(state)).toBe(120 + 60 + 120);
    // W5b: +5 rounds; W6b on top of W5b: pierce (2 - 1 + 2), velocity x1.1.
    grantTech(state, ['W5b', 'W6b']);
    const w = weaponOf(state);
    expect(w.magSize).toBe(10);
    expect(w.pierce).toBe(3);
    expect(w.muzzleVelocity).toBeCloseTo(880, 6);
    // wage: discipline x0.75, then currency reform x0.9 — factors multiply.
    grantTech(state, ['C4b', 'C7']);
    expect(getMod(state, 'wage', 10)).toBeCloseTo(6.75, 9);
    expect(wageDue(state, { wage: 10 })).toBe(6.75); // 07e: wages are kept to 0.01
    // An addition is applied before any factor on the same key.
    const table = modTable(state);
    table.add['wage'] = 2;
    expect(getMod(state, 'wage', 10)).toBeCloseTo((10 + 2) * 0.675, 9);
  });

  it('caches the table and rebuilds it when the techs, the buildings or the difficulty change', () => {
    const state = bare();
    getMod(state, 'wall.hp', 150);
    const n = modBuilds();
    for (let i = 0; i < 100; i++) {
      getMod(state, 'wall.hp', 150);
      hasFlag(state, 'militia');
    }
    expect(modBuilds()).toBe(n);
    const before = modTable(state);

    completeTech(state, 'F1', noop);
    expect(modTable(state)).not.toBe(before);
    expect(modBuilds()).toBe(n + 1);

    // A building with a modifier: the power plant.
    expect(getMod(state, 'job.research', 1)).toBe(1);
    buildNow(state, 'powerPlant', 100, 100, 0);
    expect(getMod(state, 'job.research', 1)).toBeCloseTo(1.2, 9);
    state.build.structures.pop();
    state.build.gridRev++;
    expect(getMod(state, 'job.research', 1)).toBe(1);

    // Difficulty is part of the table.
    expect(getMod(state, 'weapon.sway', 1)).toBe(1);
    state.difficulty = 2;
    expect(getMod(state, 'weapon.sway', 1)).toBe(1.25);
    expect(getMod(state, 'raid.hordeMax', BUILD.raid.hordeMax)).toBeCloseTo(500, 6);
    state.difficulty = 0;
    expect(getMod(state, 'raid.hordeMax', BUILD.raid.hordeMax)).toBeCloseTo(160, 6);

    // In-place edits nobody could notice need the explicit call.
    state.difficulty = 1;
    getMod(state, 'heal.rest', 1);
    state.research.done[0] = 'S1';
    expect(getMod(state, 'heal.rest', 1)).toBe(1);
    invalidateMods(state);
    expect(getMod(state, 'heal.rest', 1)).toBe(2);
  });

  it('carries tech effects into the systems that own the numbers', () => {
    const state = bare();
    const person = generateSurvivor(state, 'rural', stream(state, 't'));
    person.wage = 6;
    // structures
    expect(maxHp(state, BUILDINGS.palisade!)).toBe(150);
    expect(workOf(state, BUILDINGS.moat!)).toBe(40);
    grantTech(state, ['F4a']);
    expect(workOf(state, BUILDINGS.moat!)).toBeCloseTo(24, 9);
    expect(hasFlag(state, 'moat.slow')).toBe(true);
    const other = bare();
    grantTech(other, ['F4b', 'F9']);
    expect(maxHp(other, BUILDINGS.palisade!)).toBeCloseTo(150 * 1.25 * 1.5, 6);
    expect(maxHp(other, BUILDINGS.gateWood!)).toBeCloseTo(90 * 1.25 * 1.5, 6);
    expect(maxHp(other, BUILDINGS.tower!)).toBeCloseTo(400 * 1.5, 6);
    expect(maxHp(other, BUILDINGS.hut!)).toBe(200);
    // colony
    expect(signingFee(person, state)).toBe(30);
    expect(jobMul(state, 'crafting')).toBe(1);
    expect(expeditionRadius(state)).toBe(COLONY.expedition.radius);
    grantTech(state, ['C2', 'S5b', 'A6a']);
    expect(signingFee(person, state)).toBe(21);
    expect(jobMul(state, 'crafting')).toBeCloseTo(1.3 * 1.1, 9);
    expect(jobMul(state, 'farming')).toBeCloseTo(1.1, 9);
    expect(expeditionRadius(state)).toBe(COLONY.expedition.radius + 2);
    state.world.outposts.push({ id: 999, cell: 5, tier: 2, ammo: 0, garrison: [], defense: 0 });
    expect(expeditionRadius(state)).toBe(COLONY.expedition.radius + 2 + RESEARCH.outpostReach);
    // food price: trade lowers it, food security caps it
    const B = COLONY.economy.foodBasePrice;
    expect(foodPriceFor(0, state)).toBeCloseTo(B * 1.6, 9);
    const trader = bare();
    grantTech(trader, ['C4a', 'A8']);
    expect(foodPriceFor(0, trader)).toBeCloseTo(B * 1.2 * 0.8, 9);
  });

  it('gates the population until there is an administration', () => {
    const r = rig();
    const c = ctxNow(r.state, grid, noop);
    for (let i = 0; i < RESEARCH.popCap; i++) r.add('idle');
    const cand = generateSurvivor(r.state, 'rural', stream(r.state, 't'));
    r.state.colony.candidates.push(cand);
    r.state.colony.stock.ears = 1000;
    expect(hire(c, cand.id)).toBe('popCap');
    grantTech(r.state, ['C5']);
    expect(hire(c, cand.id)).toBeNull();
  });
});

describe('unlocks', () => {
  it('a new game can build the palisade, then earthworks, then steel walls as research comes in', () => {
    const r = rig();
    const { state } = r;
    const map = areaOf(state)!.map;
    const at = (def: string): string | null => placementError(state, map, def, BUILD.start.hq[0] - 8, BUILD.start.hq[1] - 8, 0);
    expect(state.flags.unlockAll).toBeUndefined();
    expect(BUILDING_LIST.filter((b) => isUnlocked(b.id, state) && !b.fixed).map((b) => b.id).sort()).toEqual(['gateWood', 'palisade', 'tent']);
    expect(at('palisade')).toBeNull();
    expect(at('earthwork')).toBe('locked');
    expect(at('steelWall')).toBe('locked');
    expect(at('capitol')).toBe('locked');

    // Research F1 the ordinary way: a researcher, the command, and time.
    r.add('research', { kno: 8, spd: 8 });
    state.colony.stock.food = 60;
    state.colony.stock.ears = 500;
    r.sim.dispatch({ type: 'startResearch', id: 'F3' }); // needs F1 first
    r.sim.dispatch({ type: 'startResearch', id: 'F1' });
    r.run(60);
    expect(r.events.some((e) => e.type === 'commandRejected' && e.command === 'startResearch' && e.reason === 'techEra')).toBe(true);
    expect(state.research.active.F?.id).toBe('F1');
    expect(daysLeft(state, 'F')).toBeGreaterThan(1);
    expect(daysLeft(state, 'F')).toBeLessThan(6);
    // (finish it by hand rather than waiting days)
    state.research.active.F!.rp = TECHS.F1!.cost - 1;
    r.run(24 * 60);
    expect(state.research.done).toContain('F1');
    expect(r.events.some((e) => e.type === 'techCompleted' && e.id === 'F1')).toBe(true);
    expect(at('earthwork')).toBeNull();
    expect(at('moat')).toBeNull();
    expect(at('steelWall')).toBe('locked');

    // F3 belongs to the settled era: six nodes of the survival era open it.
    expect(startError(state, 'F3')).toBe('techEra');
    grantTech(state, ['W1', 'A1', 'S1', 'C1', 'F2']);
    expect(eraCount(state, 0)).toBe(6);
    expect(state.research.era).toBe(1);
    expect(startError(state, 'F3')).toBeNull();
    grantTech(state, ['F3']);
    expect(at('steelWall')).toBeNull();
    expect(at('concreteWall')).toBe('locked');
  });

  it('gates gear and jobs', () => {
    const r = rig();
    const { state } = r;
    expect(EXPEDITION_WEAPONS.filter((w) => weaponAvailable(state, w)).map((w) => w.id)).toEqual(['unarmed']);
    grantTech(state, ['W3']);
    expect(EXPEDITION_WEAPONS.filter((w) => weaponAvailable(state, w)).map((w) => w.id)).toEqual(['unarmed', 'melee', 'bow']);
    const s = r.add('idle');
    r.sim.dispatch({ type: 'assignJob', survivor: s.id, job: 'medical' });
    r.run(1);
    expect(s.job).toBe('idle');
    grantTech(state, ['S4']);
    r.sim.dispatch({ type: 'assignJob', survivor: s.id, job: 'medical' });
    r.run(1);
    expect(s.job).toBe('medical');
    // The debug override opens everything without granting any bonus.
    const dbg = bare();
    dbg.flags.unlockAll = true;
    expect(isUnlocked('concreteWall', dbg)).toBe(true);
    expect(getMod(dbg, 'build.radius', 120)).toBe(120);
  });
});

describe('research progress', () => {
  function withPoints(state: GameState, points: number): void {
    state.colony.work.research = points;
    researchHour(state, noop);
  }

  it('splits the points by the allocation and passes idle shares on', () => {
    const state = bare();
    expect(startResearch(state, 'F1')).toBeNull();
    expect(startResearch(state, 'W1')).toBeNull();
    state.research.allocation = { F: 60, W: 20, A: 10, S: 5, C: 5 };
    withPoints(state, 80);
    // A, S and C have nothing in progress: F and W share everything 60 : 20.
    expect(state.research.active.F!.rp).toBeCloseTo(60, 9);
    expect(state.research.active.W!.rp).toBeCloseTo(20, 9);
    expect(state.colony.work.research).toBe(0);
    // With nothing in progress the points wait.
    const idleState = bare();
    idleState.colony.work.research = 50;
    researchHour(idleState, noop);
    expect(idleState.colony.work.research).toBe(50);
    // An allocation of zero for the only active category still gets the points.
    const one = bare();
    startResearch(one, 'S1');
    one.research.allocation = { F: 100, W: 0, A: 0, S: 0, C: 0 };
    withPoints(one, 30);
    expect(one.research.active.S!.rp).toBeCloseTo(30, 9);
  });

  it('completes a node, returns the surplus, and keeps work on a node the player switched away from', () => {
    const state = bare();
    const events: GameEvent[] = [];
    startResearch(state, 'F1');
    state.research.allocation = { F: 100, W: 0, A: 0, S: 0, C: 0 };
    state.colony.work.research = 100;
    researchHour(state, (e) => events.push(e));
    expect(state.research.active.F!.rp).toBe(100);
    // Switch to nothing else possible in F yet; switch in W instead.
    startResearch(state, 'W1');
    state.research.allocation = { F: 0, W: 100, A: 0, S: 0, C: 0 };
    withPoints(state, 40);
    expect(state.research.active.W!.rp).toBe(40);
    state.research.allocation = { F: 100, W: 0, A: 0, S: 0, C: 0 };
    state.colony.work.research = 200;
    researchHour(state, (e) => events.push(e));
    expect(state.research.done).toEqual(['F1']);
    expect(state.research.active.F).toBeUndefined();
    expect(state.colony.work.research).toBeCloseTo(100 + 200 - TECHS.F1!.cost, 9); // the surplus is kept
    expect(events.filter((e) => e.type === 'techCompleted').length).toBe(1);

    // Two nodes of one category: the shelved one keeps its points.
    startResearch(state, 'F2');
    state.colony.work.research = 0;
    withPoints(state, 70);
    grantTech(state, ['W1', 'A1', 'S1', 'C1', 'C2']);
    expect(state.research.era).toBe(1);
    startResearch(state, 'F3');
    expect(state.research.active.F!.id).toBe('F3');
    expect(state.research.progress).toEqual({ F2: 70 });
    startResearch(state, 'F2');
    expect(state.research.active.F).toEqual({ id: 'F2', rp: 70 });
    expect(techStatus(state, 'F2')).toBe('active');
    expect(techStatus(state, 'F3')).toBe('available');
    expect(techStatus(state, 'F5')).toBe('unavailable');
  });

  it('handles the commands and rejects what cannot be', () => {
    const r = rig();
    const reasons = (): string[] => r.events.filter((e) => e.type === 'commandRejected').map((e) => (e.type === 'commandRejected' ? e.reason : ''));
    r.sim.dispatch({ type: 'startResearch', id: 'nope' });
    r.sim.dispatch({ type: 'startResearch', id: 'F9' });
    r.sim.dispatch({ type: 'setAllocation', allocation: { F: -1, W: 0, A: 0, S: 0, C: 0 } });
    r.sim.dispatch({ type: 'setAllocation', allocation: { F: 0, W: 0, A: 0, S: 0, C: 0 } });
    r.sim.dispatch({ type: 'setAllocation', allocation: { F: 3, W: 1, A: 0, S: 0, C: 0 } });
    r.run(1);
    expect(reasons()).toEqual(['unknownTech', 'techEra', 'badAllocation', 'badAllocation']);
    expect(r.state.research.allocation).toEqual({ F: 75, W: 25, A: 0, S: 0, C: 0 });
    const sum = TECH_CATEGORIES.reduce((n, c) => n + r.state.research.allocation[c], 0);
    expect(sum).toBeCloseTo(100, 9);
  });

  it('closes the other side of an exclusive branch for good', () => {
    const state = bare();
    grantTech(state, ['W4']);
    state.research.era = 1;
    startResearch(state, 'W5b');
    state.research.active.W!.rp = 300;
    // Change of mind while it is still in progress: allowed, and the work is kept.
    expect(startResearch(state, 'W5a')).toBeNull();
    expect(state.research.progress).toEqual({ W5b: 300 });
    state.research.allocation = { F: 0, W: 100, A: 0, S: 0, C: 0 };
    state.colony.work.research = TECHS.W5a!.cost;
    researchHour(state, noop);
    expect(state.research.done).toContain('W5a');
    expect(state.research.locked).toEqual(['W5b']);
    expect(state.research.progress).toEqual({}); // what was put into the lost side is gone
    expect(techStatus(state, 'W5b')).toBe('locked');
    expect(startResearch(state, 'W5b')).toBe('techLocked');
    grantTech(state, ['W5b']);
    expect(state.research.done).not.toContain('W5b');
    // The science branch takes its whole route with it.
    grantTech(state, ['S5b']);
    expect([...state.research.locked].sort()).toEqual(['S5a', 'S6a', 'S7a', 'S9', 'W5b']);
    // ... and survives a save.
    const back = deserialize(serialize(state));
    expect(back.research.locked).toEqual(state.research.locked);
    expect(startResearch(back, 'S5a')).toBe('techLocked');
  });
});

describe('W5: the player\'s rifle', () => {
  const input = (over: Partial<InputFrame> = {}): InputFrame => ({ ...emptyInputFrame(), ...over });

  function range(tech: string | null) {
    const state = createInitialState(5, 1);
    state.flags.range = true;
    const sim = createSim({ grid: null });
    const events: GameEvent[] = [];
    sim.events.onAny((e) => events.push(e));
    sim.tick(state, DT, input());
    const area = areaOf(state)!;
    state.tactical!.zombies.length = 0;
    area.dynamic.clear();
    state.tactical!.rangeT = RANGE_SPOTS.map(() => -1e9);
    if (tech) grantTech(state, [tech]);
    const aim = state.player.aim;
    state.flags.noSway = true;
    aim.scopeT = 1;
    const run = (seconds: number, frame = input({ scope: true })): void => {
      for (let i = 0; i < Math.round(seconds / DT); i++) sim.tick(state, DT, frame);
    };
    /** Pull the trigger as fast as a finger can for `seconds`; returns the shots that left the barrel. */
    const hammer = (seconds: number): number => {
      state.player.weapon.mag = weaponOf(state).magSize;
      const before = state.player.stats.shots;
      for (let i = 0; i < Math.round(seconds / DT); i++) sim.tick(state, DT, input({ scope: true, fire: i % 6 < 3 }));
      return state.player.stats.shots - before;
    };
    return { state, sim, area, events, run, hammer };
  }

  it('the two sides are different rifles, and the base rifle is neither', () => {
    const base = weaponOf(range(null).state);
    expect(base).toEqual(WEAPONS.rifle);
    const big = weaponOf(range('W5a').state);
    const semi = weaponOf(range('W5b').state);
    expect([big.damageMul, big.pierce, big.boltTime, big.magSize, big.ammoPerShot]).toEqual([2, 4, expect.closeTo(1.8, 6), 5, 2]);
    expect(big.muzzleVelocity).toBeCloseTo(880, 6);
    expect([semi.damageMul, semi.pierce, semi.magSize, semi.maxRange, semi.ammoPerShot]).toEqual([1, 1, 10, 700, 1]);
    expect(semi.boltTime).toBeCloseTo(0.35, 6);
    expect(semi.torsoMul).toBeCloseTo(0.85, 6);
    // What that means against the dead (data/zombies.ts): one torso hit, one brute head.
    expect(ZOMBIES.walker.torso * big.damageMul).toBeGreaterThanOrEqual(ZOMBIES.walker.hp);
    expect(ZOMBIES.brute.head * big.damageMul).toBeGreaterThanOrEqual(ZOMBIES.brute.hp);
    expect(ZOMBIES.walker.torso * base.damageMul).toBeLessThan(ZOMBIES.walker.hp);
    expect(ZOMBIES.runner.torso * semi.torsoMul).toBeLessThan(ZOMBIES.runner.hp);
  });

  it('semi-automatic fires several times in the time the bolt action fires once; large calibre is slower still', () => {
    const shots = (tech: string | null): number => range(tech).hammer(3);
    const bolt = shots(null);
    const semi = shots('W5b');
    const big = shots('W5a');
    expect(bolt).toBe(3); // 0, 1.2, 2.4 s
    expect(big).toBe(2); // 0, 1.8 s
    expect(semi).toBeGreaterThanOrEqual(8);
  });

  it('large calibre drops a walker with one body shot and goes through a file of four; semi-automatic stops in the first', () => {
    const lineUp = (tech: string | null) => {
      const r = range(tech);
      const p = r.state.player;
      // Four walkers in a file straight ahead (north), 30 m out, 1.5 m apart, backs turned.
      for (let i = 0; i < 4; i++) {
        const z = addZombie(r.state, r.area, 'walker', p.pos[0], p.pos[2] - 30 - i * 1.5, 0)!;
        z.dummy = 1;
      }
      p.yaw = 0;
      // Aim at the chest of the first one.
      p.pitch = Math.atan2(1.25 - p.eye, 30);
      r.run(0.05);
      r.sim.tick(r.state, DT, input({ scope: true, fire: true }));
      r.run(0.4);
      const hits = r.events.filter((e) => e.type === 'bulletHit' && e.zombie !== null);
      const kills = r.events.filter((e) => e.type === 'zombieKilled').length;
      return { hits: hits.length, kills, parts: hits.map((e) => (e.type === 'bulletHit' ? e.part : null)) };
    };
    const base = lineUp(null);
    const big = lineUp('W5a');
    const semi = lineUp('W5b');
    expect(base.parts[0]).toBe('torso');
    expect(base).toMatchObject({ hits: 2, kills: 0 }); // 55, then 33: nobody falls
    expect(big.hits).toBe(4);
    expect(big.kills).toBe(1); // 110 kills the first; 66, 40, 24 wound the rest
    expect(semi).toMatchObject({ hits: 1, kills: 0 });
  });

  it('large-calibre rounds cost three of the stock each', () => {
    const r = range('W5a');
    const p = r.state.player;
    p.weapon.mag = 0;
    p.inv.ammo = 10;
    r.sim.tick(r.state, DT, input({ reload: true }));
    r.run(3.2);
    expect(p.weapon.mag).toBe(3);
    expect(p.inv.ammo).toBe(1);
  });
});

describe('tech behaviour', () => {
  it('militia: with F7b everyone at home fights in a raid, at half strength', () => {
    const r = rig();
    const guard = r.add('defense');
    const farmer = r.add('farming');
    const away = r.add('idle');
    away.location = { kind: 'outpost', id: 1 };
    expect(fighters(r.state, true).map((f) => f.survivor.id)).toEqual([guard.id]);
    grantTech(r.state, ['F7b']);
    expect(fighters(r.state, false).map((f) => f.survivor.id)).toEqual([guard.id]);
    const all = fighters(r.state, true);
    expect(all.map((f) => f.survivor.id)).toEqual([guard.id, farmer.id]);
    expect(all[1]!.power).toBeCloseTo(all[0]!.power * RESEARCH.militiaShare, 6);
    expect(r.state.research.locked).toContain('F7a');
  });

  it('turrets fire only with the technology and fuel', () => {
    const r = rig();
    buildNow(r.state, 'turret', BUILD.start.hq[0] - 5, BUILD.start.hq[1] - 5, 0);
    r.state.colony.stock.fuel = 0;
    expect(activeTurrets(r.state).length).toBe(0);
    grantTech(r.state, ['F7a']);
    expect(activeTurrets(r.state).length).toBe(0); // no fuel
    r.state.colony.stock.fuel = 5;
    expect(activeTurrets(r.state).length).toBe(1);
  });

  it('daily effects: trade income, school lessons, the vaccine clearing held cells', () => {
    const r = rig();
    const { state } = r;
    state.world.cells.Z[state.world.homeCell!] = 0; // no night visitors
    const pupil = r.add('research', { kno: 4 });
    state.colony.stock.food = 60;
    grantTech(state, ['C4a', 'S9', 'S8']);
    buildNow(state, 'market', BUILD.start.hq[0] - 8, BUILD.start.hq[1] - 8, 0);
    buildNow(state, 'school', BUILD.start.hq[0] - 8, BUILD.start.hq[1] + 8, 0);
    state.world.outposts.push({ id: state.nextId++, cell: state.world.homeCell! + 1, tier: 1, ammo: 0, garrison: [pupil.id + 1000], defense: 100 });
    state.world.cells.Z[state.world.homeCell! + 1] = 1000;
    // Run to a midnight that is a school day.
    state.time.day = RESEARCH.schoolDays * 4 - 1;
    state.time.minute = 23 * 60 + 30;
    state.colony.lastMinute = -1;
    const earsBefore = state.colony.stock.ears;
    r.run(45);
    expect(pupil.kno).toBe(5);
    expect(state.colony.log.some((l) => l.text === 'log.dailyIncome')).toBe(true);
    expect(state.colony.stock.ears).toBeGreaterThanOrEqual(earsBefore + RESEARCH.tradeEars);
    expect(state.world.cells.Z[state.world.homeCell! + 1]).toBeLessThanOrEqual(950 + 60); // -5 %, give or take the day's drift
  });

  it('forecast: seven days ahead on a copy — the game\'s cells and its random series stay as they were', () => {
    const r = rig();
    const { state } = r;
    r.run(1);
    const zBefore = [...state.world.cells.Z];
    const streams = JSON.stringify(state.rngStreams);
    const rng = JSON.stringify(state.rng);
    const f = forecastInfection(state, grid);
    expect(f.forDay).toBe(state.time.day + RESEARCH.forecastDays);
    expect(f.Z.length).toBe(zBefore.length);
    expect(f.Z.some((z, i) => z !== zBefore[i])).toBe(true);
    expect(state.world.cells.Z).toEqual(zBefore);
    expect(JSON.stringify(state.rngStreams)).toBe(streams);
    expect(JSON.stringify(state.rng)).toBe(rng);
    expect(forecastInfection(state, grid)).toBe(f); // cached for the day
    const t0 = performance.now();
    state.time.day += 1;
    forecastInfection(state, grid);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe('victory', () => {
  it('declares the nation once everything is in place and the capitol stands; the goal technology names the ending', () => {
    const r = rig();
    const { state } = r;
    state.world.cells.Z[state.world.homeCell!] = 0;
    let p = victoryProgress(state, grid);
    expect(p.ready).toBe(false);
    expect(p.canBuild).toBe(false);
    expect(p.regions).toBe(1);

    debugFulfilVictory(state, grid, 'S9', false);
    p = victoryProgress(state, grid);
    expect(p).toMatchObject({ ready: true, capitol: false, canBuild: true, goal: 'S9', population: 60, outposts: 6 });
    expect(p.regions).toBeGreaterThanOrEqual(3);
    r.run(61);
    expect(state.research.victory).toBeUndefined(); // no capitol yet

    buildNow(state, 'capitol', BUILD.start.hq[0] - 6, BUILD.start.hq[1] + 6, 0);
    r.run(61);
    expect(state.research.victory).toMatchObject({ tech: 'S9' });
    expect(r.events.filter((e) => e.type === 'victory').length).toBe(1);
    const stats = endingStats(state);
    expect(stats.survivors).toBe(60);
    expect(stats.headshotRate).toBe(0);
    // The game goes on; the ending is acknowledged once and not declared twice.
    r.sim.dispatch({ type: 'dismissEnding' });
    r.run(120);
    expect(state.flags.endingSeen).toBe(true);
    expect(r.events.filter((e) => e.type === 'victory').length).toBe(1);
    const back = deserialize(serialize(state));
    expect(back.research.victory).toEqual(state.research.victory);
  });

  it('does not count too few people, outposts or regions', () => {
    const r = rig();
    const { state } = r;
    debugFulfilVictory(state, grid, 'F9');
    state.colony.survivors.pop();
    expect(victoryProgress(state, grid).met.population).toBe(false);
    r.run(61);
    expect(state.research.victory).toBeUndefined();
    r.add('idle');
    // All outposts in the home region: enough of them, too few regions.
    const home = grid.cells[state.world.homeCell!]!.region;
    const same = grid.landIds.filter((c) => grid.cells[c]!.region === home && c !== state.world.homeCell);
    state.world.outposts.forEach((o, i) => (o.cell = same[i]!));
    const p = victoryProgress(state, grid);
    expect(p.met.outposts).toBe(true);
    expect(p.met.regions).toBe(false);
    expect(p.ready).toBe(false);
  });
});

describe('pacing', () => {
  // 09: the costs are now set for a colony that grows (tests/balance: the solid bot reaches the eras around
  // days 15 / 45 / 90 with 2 -> 14 researchers, a laboratory and a school). Four researchers who never get
  // help are quick through the first era and slow after it; this pins that curve down.
  it('four researchers on an even allocation: the settled era in about ten days, the rebuilding era in about seventy', () => {
    const r = rig(3, true);
    const { state } = r;
    for (let i = 0; i < 4; i++) r.add('research', { kno: 6, spd: 5, sta: 5 });
    const startDay = state.time.day;
    const eraDay: number[] = [];
    r.sim.events.on('eraAdvanced', (e) => {
      eraDay[e.era] = state.time.day - startDay + state.time.minute / 1440;
    });
    // A bot that always has something in progress in every category: the cheapest open node, 'a' sides first.
    const pick = (): void => {
      for (const cat of TECH_CATEGORIES) {
        if (state.research.active[cat]) continue;
        const open = TECH_LIST.filter((t) => t.cat === cat && startError(state, t.id) === null).sort((a, b) => a.era - b.era || a.cost - b.cost || a.id.localeCompare(b.id));
        if (open[0]) r.sim.dispatch({ type: 'startResearch', id: open[0].id });
      }
    };
    const perDay = researchPerDay(state);
    for (let day = 0; day < 130 && state.research.era < 3; day++) {
      // Keep them fed, paid and housed; the test is about research, not about the economy.
      state.colony.stock.food = 50;
      state.colony.stock.ears = 500;
      state.world.hordeMeter = 0;
      for (const s of state.colony.survivors) s.morale = 60;
      for (let h = 0; h < 24; h++) {
        pick();
        r.run(60);
      }
    }
    console.log(`[pacing] ${perDay.toFixed(0)} RP/day; eras reached on day ${eraDay.slice(1).map((d) => d?.toFixed(1)).join(' / ')}; nodes ${state.research.done.length}`);
    expect(perDay).toBeGreaterThan(150);
    expect(perDay).toBeLessThan(280);
    expect(eraDay[1]).toBeGreaterThan(7);
    expect(eraDay[1]).toBeLessThan(14);
    expect(eraDay[2]).toBeGreaterThan(55);
    expect(eraDay[2]).toBeLessThan(85);
    expect(state.research.era).toBe(2); // the revival era needs more heads than four
  }, 120_000);
});
