import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events.ts';
import { seedRng, stream } from '../src/core/rng.ts';
import { deserialize, serialize } from '../src/core/save.ts';
import { createInitialState, emptyInputFrame, type GameState, type JobId, type StaticGrid, type Structure, type Survivor } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { BUILD, BUILDINGS } from '../src/data/buildings.ts';
import { buildNow, foundBase, placementError } from '../src/sim/build/blueprints.ts';
import { construct } from '../src/sim/build/construction.ts';
import { computeField, FIELD_UNREACHED, fieldStats, raidField, tileOf } from '../src/sim/build/flowfield.ts';
import { breachRoute, hordeThreshold, playerPresent, resolveAway } from '../src/sim/build/raids.ts';
import { centreOf, hqOf, isBuilt, isRuin, overlayOf, TILES } from '../src/sim/build/structures.ts';
import { farmPlots, facilityFactor, housingBeds } from '../src/sim/colony/jobs.ts';
import { ctxNow } from '../src/sim/colony/stock.ts';
import { generateSurvivor } from '../src/sim/colony/survivors.ts';
import { createSim, type Sim } from '../src/sim/index.ts';
import { areaOf } from '../src/sim/tactical/area.ts';
import { addZombie } from '../src/sim/tactical/zombies.ts';
import { activeCap } from '../src/sim/world/derive.ts';
import { cellDistance, parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { foundError, outpostAt, outpostPrefab, outpostsDay } from '../src/sim/world/outposts.ts';
import { createInfectionCells } from '../src/sim/world/infection.ts';
import { decodeScenario, initWorld } from '../src/sim/world/scenario.ts';
import { beginAt, findStartCandidates } from '../src/sim/world/start.ts';
import { findRoute } from '../src/sim/world/travel.ts';

const DATA = new URL('../public/data/', import.meta.url);
const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
const loadScenario = (n: number) => {
  const buf = readFileSync(new URL(`infection_${n}.bin`, DATA));
  return decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
};
const scenario = loadScenario(0);
const DT = BALANCE.time.fixedStep;
const idle = emptyInputFrame();

/** Centre tile of the headquarters a new base gets. */
const HQX = BUILD.start.hq[0] + 1;
const HQY = BUILD.start.hq[1] + 1;

/** A base without a world: just the structures (flow-field tests need nothing else). */
function bare(): GameState {
  const state = createInitialState(3, 1);
  state.world.homeCell = 0;
  foundBase(state);
  noFarm(state);
  return state;
}

/** Take the first field away (it lies where the test rings run). */
function noFarm(state: GameState): void {
  state.build.structures = state.build.structures.filter((s) => s.def !== 'farm');
  state.build.gridRev++;
}

/** Tiles of a square ring of half-size r around the headquarters, clockwise from the north-west corner. */
function ringTiles(r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = -r; x < r; x++) out.push([HQX + x, HQY - r]);
  for (let y = -r; y < r; y++) out.push([HQX + r, HQY + y]);
  for (let x = r; x > -r; x--) out.push([HQX + x, HQY + r]);
  for (let y = r; y > -r; y--) out.push([HQX - r, HQY + y]);
  return out;
}

function ring(state: GameState, def: string, r: number, skip: (x: number, y: number) => boolean = () => false): Structure[] {
  const out: Structure[] = [];
  for (const [x, y] of ringTiles(r)) {
    if (skip(x, y)) continue;
    out.push(buildNow(state, def, x, y));
  }
  return out;
}

/** Tiles walked from (tx, ty) to the goal along the field. */
function walk(state: GameState, tx: number, ty: number): number[] {
  const field = raidField(state, null);
  const path: number[] = [];
  let t = ty * TILES + tx;
  expect(field.dist[t]).not.toBe(FIELD_UNREACHED);
  for (let i = 0; i < 2000 && t >= 0; i++) {
    path.push(t);
    t = field.next[t]!;
  }
  return path;
}

const STARTS: [number, number][] = [[HQX, HQY - 50], [HQX + 50, HQY], [HQX, HQY + 50], [HQX - 50, HQY], [HQX + 40, HQY - 40], [HQX - 40, HQY + 40], [HQX + 45, HQY + 30], [HQX - 30, HQY - 45]];

describe('flow field', () => {
  it('a moat ring with one opening sends every zombie through the opening', () => {
    const state = bare();
    const gap = [HQX, HQY + 12] as const;
    const moats = ring(state, 'moat', 12, (x, y) => x === gap[0] && y === gap[1]);
    const moatTiles = new Set(moats.map((m) => m.ty * TILES + m.tx));
    for (const [sx, sy] of STARTS) {
      const path = walk(state, sx, sy);
      expect(path).toContain(gap[1] * TILES + gap[0]);
      expect(path.some((t) => moatTiles.has(t))).toBe(false);
      // It ends at the headquarters.
      const hq = hqOf(state)!;
      const last = path[path.length - 1]!;
      expect(Math.abs((last % TILES) - (hq.tx + 1))).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.floor(last / TILES) - (hq.ty + 1))).toBeLessThanOrEqual(1);
    }
  });

  it('a closed ring is broken at its weakest wall', () => {
    const state = bare();
    const walls = ring(state, 'concreteWall', 8);
    const weak = walls.find((w) => w.tx === HQX - 8 && w.ty === HQY + 2)!;
    weak.hp = 10;
    state.build.gridRev++;
    for (const [sx, sy] of STARTS) {
      const crossed = walk(state, sx, sy).filter((t) => walls.some((w) => w.ty * TILES + w.tx === t));
      expect(crossed).toEqual([weak.ty * TILES + weak.tx]);
    }
    // With equal walls each column breaks the wall in front of it instead.
    weak.hp = BUILDINGS.concreteWall!.hp;
    state.build.gridRev++;
    const north = walk(state, HQX, HQY - 50).filter((t) => walls.some((w) => w.ty * TILES + w.tx === t));
    expect(north).toEqual([(HQY - 8) * TILES + HQX]);
  });

  it('a moat is crossed where bodies have filled it', () => {
    const state = bare();
    const moats = ring(state, 'moat', 10);
    const full = moats.find((m) => m.tx === HQX + 10 && m.ty === HQY - 3)!;
    // Closed and empty: the nearest stretch gets filled with bodies (the field still leads through it).
    const before = walk(state, HQX, HQY + 50).filter((t) => moats.some((m) => m.ty * TILES + m.tx === t));
    expect(before).toEqual([(HQY + 10) * TILES + HQX]);
    full.corpsesInMoat = BUILD.moatFill;
    state.build.gridRev++;
    for (const [sx, sy] of STARTS) {
      const crossed = walk(state, sx, sy).filter((t) => moats.some((m) => m.ty * TILES + m.tx === t));
      expect(crossed).toEqual([full.ty * TILES + full.tx]);
    }
    // A water moat cannot be filled: closed, it shuts the dead out for good.
    const wet = bare();
    ring(wet, 'waterMoat', 10);
    expect(raidField(wet, null).dist[(HQY + 50) * TILES + HQX]).toBe(FIELD_UNREACHED);
  });

  it('is recomputed only when the structures change, in under 5 ms', () => {
    const state = bare();
    ring(state, 'palisade', 14);
    ring(state, 'moat', 18, (x) => x === HQX);
    const n0 = fieldStats.computed;
    const a = raidField(state, null);
    expect(raidField(state, null)).toBe(a);
    expect(fieldStats.computed).toBe(n0 + 1);
    state.build.structures.find((s) => s.def === 'palisade')!.hp = 0;
    state.build.gridRev++;
    raidField(state, null);
    expect(fieldStats.computed).toBe(n0 + 2);
    const ov = overlayOf(state, null);
    const goals = [{ tile: HQY * TILES + HQX, bias: 0 }];
    const times: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      computeField(ov.cost, goals);
      times.push(performance.now() - t0);
    }
    times.sort((x, y) => x - y);
    expect(times[7]!).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------------------------

interface Rig {
  state: GameState;
  sim: Sim;
  events: GameEvent[];
  run(seconds: number, until?: () => boolean): void;
  add(job: JobId, over?: Partial<Survivor>): Survivor;
}

/** A started game with every system and the real home map. The player cannot be hurt and stands out of the way. */
function rig(seed = 7): Rig {
  const state = createInitialState(seed, 1);
  initWorld(state, grid, scenario);
  const start = findStartCandidates(state.world.cells, grid, stream(state, 'world.start'))[0]!;
  beginAt(state, grid, start.cell);
  state.mode = 'command';
  const sim = createSim({ grid });
  const events: GameEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.tick(state, DT, idle);
  // No ordinary zombies wandering about: only what a test brings in.
  state.world.cells.Z[start.cell] = 0;
  state.tactical!.zombies.length = 0;
  areaOf(state)!.dynamic.clear();
  state.player.hp = 1e9;
  return {
    state, sim, events,
    run(seconds, until) {
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        sim.tick(state, DT, idle);
        if (until?.()) return;
      }
    },
    add(job, over = {}) {
      const s: Survivor = { ...generateSurvivor(state, 'rural', stream(state, 'test.people')), ath: 5, kno: 5, spd: 5, sta: 5, trait: 'none', wage: 4, job, ...over };
      const [x, z] = centreOf(hqOf(state)!);
      s.pos = [x, z + 9];
      state.colony.survivors.push(s);
      return s;
    },
  };
}

/** Put the player where nothing will notice them (and clear the ground the test rings need). */
function hide(state: GameState): void {
  noFarm(state);
  state.player.pos = [40, 0, 40];
  state.player.stance = 'prone';
}

function startHorde(r: Rig, size: number, dir: number): void {
  const t = r.state.time;
  r.state.world.cells.Z[r.state.world.homeCell!] = size + 50;
  r.state.world.pendingHorde = { arrivesDay: t.day, arrivesMinute: t.minute, size, dir, warned: true };
  // (the regular spawner would add wanderers from the cell's Z; keep it quiet)
  r.state.tactical!.spawnT = 1e9;
}

describe('construction', () => {
  it('builders bring the materials, do the work, and the building takes effect', () => {
    const r = rig();
    const { state, sim } = r;
    const c = state.colony;
    expect(hqOf(state)).toBeTruthy();
    expect(farmPlots(state)).toBe(1);
    expect(housingBeds(state)).toBe(4);
    expect(facilityFactor(state, 'crafting')).toBe(0.5);
    c.stock.wood = 9;
    c.stock.food = 50;
    c.stock.ears = 500;
    for (let i = 0; i < 3; i++) sim.dispatch({ type: 'placeBlueprint', def: 'palisade', tx: HQX - 6 + i, ty: HQY + 8, rot: 0 });
    sim.dispatch({ type: 'placeBlueprint', def: 'palisade', tx: HQX, ty: HQY, rot: 0 }); // on the headquarters
    sim.dispatch({ type: 'placeBlueprint', def: 'tent', tx: HQX + 80, ty: HQY, rot: 0 }); // far outside
    const rejected: string[] = [];
    sim.events.on('commandRejected', (e) => rejected.push(e.reason));
    r.run(1);
    expect(rejected).toEqual(['occupied', 'tooFar']);
    const walls = state.build.structures.filter((s) => s.def === 'palisade');
    expect(walls.length).toBe(3);
    expect(walls.every((w) => w.progress === 0)).toBe(true);
    // Hand the builders' output over directly: 9 wood is enough for two fences and a quarter of the third.
    const ctx = ctxNow(state, grid, () => {});
    const left = construct(ctx, 100);
    expect(walls.map((w) => w.progress)).toEqual([1, 1, expect.closeTo(0.25, 6)]);
    expect(walls[0]!.hp).toBe(150);
    expect(c.stock.wood).toBe(0);
    expect(left).toBeCloseTo(100 - 6 - 6 - 1.5, 6);
    // Cancelling returns what was delivered; pulling down a finished fence returns half.
    sim.dispatch({ type: 'cancelStructure', id: walls[2]!.id });
    sim.dispatch({ type: 'cancelStructure', id: walls[1]!.id });
    sim.dispatch({ type: 'cancelStructure', id: hqOf(state)!.id });
    r.run(1);
    expect(c.stock.wood).toBe(1 + 2);
    expect(state.build.structures.filter((s) => s.def === 'palisade').length).toBe(1);
    expect(hqOf(state)).toBeTruthy();
    expect(rejected).toEqual(['occupied', 'tooFar', 'fixed']);

    // Repairs take half the lost share of the materials and 0.02 work per point.
    walls[0]!.hp = 50;
    c.stock.wood = 10;
    const used = 10 - construct(ctx, 10);
    expect(walls[0]!.hp).toBe(150);
    expect(used).toBeCloseTo(100 * BUILD.repairWork, 6);
    expect(c.stock.wood).toBeCloseTo(10 - 4 * 0.5 * (100 / 150), 6);

    // Buildings change what the colony can do.
    c.stock.wood = 200;
    c.stock.metal = 100;
    for (const [def, x] of [['tent', 8], ['storehouse', 10], ['workshop', 13], ['moat', 16]] as const) sim.dispatch({ type: 'placeBlueprint', def, tx: HQX + x, ty: HQY + 8, rot: 0 });
    r.run(1);
    construct(ctx, 500);
    expect(housingBeds(state)).toBe(6);
    expect(c.capacity.wood).toBe(500);
    expect(facilityFactor(state, 'crafting')).toBe(1);
    // A real builder gets there too, hour by hour.
    sim.dispatch({ type: 'placeBlueprint', def: 'tower', tx: HQX - 8, ty: HQY + 8, rot: 0 });
    r.add('construction', { ath: 8 });
    state.time.minute = 6 * 60;
    r.run(14 * 60);
    const tower = state.build.structures.find((s) => s.def === 'tower')!;
    expect(tower.progress).toBeGreaterThan(0.5);
    expect(r.events.some((e) => e.type === 'structureBuilt')).toBe(true);
    // The save keeps all of it.
    const copy = deserialize(serialize(state));
    expect(copy.build).toEqual(JSON.parse(JSON.stringify(state.build)));
  });

  it('placement respects what is already on the ground outside the levelled site', () => {
    const r = rig();
    const map = areaOf(r.state)!.map;
    expect(placementError(r.state, map, 'tent', HQX + 5, HQY + 5, 0)).toBeNull();
    expect(placementError(r.state, map, 'hq', HQX + 5, HQY + 5, 0)).toBe('unknownBuilding');
    expect(placementError(r.state, map, 'capitol', HQX - 1, HQY - 1, 0)).toBe('occupied');
    // Every tile the generator marked unwalkable (buildings, rocks, steep ground) is refused.
    let blocked = 0;
    for (let t = 0; t < TILES * TILES && blocked < 5; t += 37) {
      if (map.walk[t]) continue;
      const e = placementError(r.state, map, 'palisade', t % TILES, Math.floor(t / TILES), 0);
      expect(['blocked', 'tooFar', 'outside']).toContain(e);
      blocked++;
    }
  });
});

describe('raids', () => {
  it('the horde meter runs over, the horde is announced and arrives; what it took is spent', () => {
    const r = rig();
    const { state } = r;
    hide(state);
    state.time.minute = 8 * 60;
    state.world.hordeMeter = hordeThreshold(state) + 30;
    expect(hordeThreshold(state)).toBe(64);
    r.run(61);
    const ph = state.world.pendingHorde!;
    expect(ph.size).toBe(94);
    expect(state.world.hordeMeter).toBe(0);
    // Nobody on a tower: the warning comes an hour ahead.
    expect(ph.warned).toBeFalsy();
    r.run(5 * 60 - 30);
    expect(r.events.some((e) => e.type === 'hordeWarning')).toBe(false);
    r.run(62);
    expect(r.events.some((e) => e.type === 'hordeWarning')).toBe(true);
    state.world.cells.Z[state.world.homeCell!] = 200;
    state.tactical!.spawnT = 1e9;
    r.run(60, () => state.build.raid !== null);
    expect(state.build.raid!.kind).toBe('horde');
    expect(state.flags.colonyAlarm).toBe(true);
    r.run(30);
    const raiders = state.tactical!.zombies.filter((z) => z.raid);
    expect(raiders.length).toBeGreaterThan(40);
    // Waves: never more than the cap on the map at once.
    expect(raiders.length).toBeLessThanOrEqual(BUILD.raid.maxActive);
    // They come from the announced side.
    const [cx, cz] = centreOf(hqOf(state)!);
    const mean = raiders.reduce((a, z) => [a[0]! + z.pos[0] - cx, a[1]! + z.pos[2] - cz], [0, 0]);
    const bearing = Math.atan2(mean[0]!, -mean[1]!);
    expect(Math.abs(Math.atan2(Math.sin(bearing - ph.dir), Math.cos(bearing - ph.dir)))).toBeLessThan(0.5);
  });

  it('with a manned tower the horde is known six hours ahead', () => {
    const r = rig();
    const { state } = r;
    hide(state);
    buildNow(state, 'tower', HQX + 6, HQY);
    r.add('defense');
    state.time.minute = 8 * 60;
    state.world.hordeMeter = 500;
    r.run(62);
    expect(state.world.pendingHorde!.warned).toBe(true);
    expect(state.world.pendingHorde!.size).toBe(BUILD.raid.hordeMax[1]);
    expect(state.world.hordeMeter).toBe(350);
  });

  it('a moat with one opening makes them queue up there, and none gets across elsewhere', () => {
    const r = rig();
    const { state } = r;
    hide(state);
    const gap = [HQX, HQY + 9] as const;
    const moats = ring(state, 'moat', 9, (x, y) => x === gap[0] && y === gap[1]);
    const moatTiles = new Set(moats.map((m) => m.ty * TILES + m.tx));
    startHorde(r, 30, 0); // from the north: the opening is on the far side
    let inMoat = 0;
    let through = 0;
    const seen = new Set<number>();
    r.run(520, () => {
      for (const z of state.tactical!.zombies) {
        if (z.state === 'down') continue;
        const t = tileOf(z.pos[0], z.pos[2]);
        if (moatTiles.has(t)) inMoat++;
        if (t === gap[1] * TILES + gap[0] && !seen.has(z.id)) {
          seen.add(z.id);
          through++;
        }
      }
      return through >= 12;
    });
    expect(inMoat).toBe(0);
    expect(through).toBeGreaterThanOrEqual(12);
    expect(moats.every((m) => (m.corpsesInMoat ?? 0) === 0)).toBe(true);
  });

  it('an undefended fence is broken down, the headquarters falls, and the game is lost', () => {
    const r = rig();
    const { state } = r;
    hide(state);
    const fence = ring(state, 'palisade', 7);
    startHorde(r, 70, 1.2);
    r.run(1500, () => state.flags.defeat === true);
    expect(state.flags.defeat).toBe(true);
    expect(fence.some(isRuin)).toBe(true);
    const order = r.events.filter((e) => e.type === 'structureDestroyed').map((e) => (e as { def: string }).def);
    expect(order[0]).toBe('palisade');
    expect(order[order.length - 1]).toBe('hq');
    expect(r.events.filter((e) => e.type === 'defeat').map((e) => (e as { reason: string }).reason)).toEqual(['hqDestroyed']);
  });

  it('defenders on towers thin a night raid out; the ears are gathered in the morning', () => {
    const r = rig();
    const { state } = r;
    hide(state);
    ring(state, 'palisade', 8);
    for (const [x, y] of [[HQX - 7, HQY - 7], [HQX + 7, HQY - 7], [HQX + 7, HQY + 7], [HQX - 7, HQY + 7]] as const) buildNow(state, 'tower', x, y);
    for (let i = 0; i < 4; i++) r.add('defense', { wage: 0 }); // (no wages at 06:00 to muddy the ear count)
    for (let i = 0; i < 8; i++) r.add('farming'); // a full-sized settlement draws the full share
    state.colony.stock.ammo = 300;
    state.colony.stock.food = 50;
    state.world.cells.Z[state.world.homeCell!] = 300;
    state.tactical!.spawnT = 1e9;
    state.time.minute = 21 * 60 + 58;
    r.run(4, () => state.build.raid !== null);
    const size = state.build.raid!.size;
    expect(state.build.raid!.kind).toBe('night');
    expect(size).toBeGreaterThanOrEqual(8);
    expect(size).toBe(Math.round(activeCap(300) * BUILD.raid.nightShare));
    const ears0 = state.colony.stock.ears;
    r.run(600, () => state.build.raid === null);
    expect(state.build.raid).toBeNull();
    const report = state.build.lastRaid!;
    expect(report.repelled).toBe(true);
    expect(report.killed).toBe(size);
    expect(state.colony.stock.ammo).toBeLessThan(300);
    expect(state.flags.colonyAlarm).toBeUndefined();
    // One rifle puts a walker down every 8 seconds or so: four of them need more than a few seconds for this.
    const shots = r.events.filter((e) => e.type === 'defenderFired').length;
    expect(shots).toBeGreaterThan(size);
    // 06:00: seven tenths of the ears lying within 30 m of the walls; the bodies further out are the player's to visit.
    r.run(3); // (the last one is still falling)
    const corpses = state.tactical!.corpses;
    expect(corpses.length).toBe(size);
    const [hx, hz] = centreOf(hqOf(state)!);
    corpses.forEach((c, i) => (c.pos = i % 2 === 0 ? [hx + 40, c.pos[1], hz + i] : [hx + 150, c.pos[1], hz + i]));
    const nearWalls = Math.ceil(size / 2);
    state.time.minute = 5 * 60 + 59;
    r.run(2);
    expect(state.colony.stock.ears - ears0).toBe(Math.floor(nearWalls * 2 * 0.7));
    expect(corpses.filter((c) => c.ears > 0).length).toBe(size - nearWalls);
  });

  it('fought in numbers while the player is away, a raid ends about as it would have with the player watching', () => {
    const setup = (): Rig => {
      const r = rig(21);
      hide(r.state);
      ring(r.state, 'palisade', 8, (x, y) => x === HQX && y === HQY + 8);
      buildNow(r.state, 'gateWood', HQX, HQY + 8);
      for (const [x, y] of [[HQX - 7, HQY - 7], [HQX + 7, HQY - 7], [HQX + 7, HQY + 7]] as const) buildNow(r.state, 'tower', x, y);
      for (let i = 0; i < 3; i++) r.add('defense');
      r.state.colony.stock.ammo = 400;
      return r;
    };
    // Watching (without firing a shot).
    const here = setup();
    startHorde(here, 45, 0.3);
    here.run(5, () => here.state.build.raid !== null);
    here.run(1500, () => here.state.build.raid === null || here.state.flags.defeat === true);
    const seen = here.state.build.lastRaid!;
    // Away: the same base, the same horde.
    const away = setup();
    away.state.world.cells.Z[away.state.world.homeCell!] = 95;
    const result = resolveAway(away.state, { emit: () => {}, grid }, 'horde', 45, 0.3, 0);
    const told = away.state.build.lastRaid!;
    expect(told.away).toBe(true);
    expect(seen.away).toBe(false);
    expect(result.repelled).toBe(seen.repelled);
    expect(result.killed).toBeGreaterThanOrEqual(seen.killed * 0.6);
    expect(result.killed).toBeLessThanOrEqual(Math.max(seen.killed * 1.6, seen.killed + 8));
    expect(Math.abs(result.wallsLost - seen.wallsLost)).toBeLessThanOrEqual(3);
    // The dead are gone from the cell and their ears wait for the morning.
    expect(away.state.world.cells.Z[away.state.world.homeCell!]).toBe(95 - result.killed);
    expect(away.state.build.pendingEars).toBeGreaterThan(0);
    // The route the numbers follow is the one the zombies walk.
    expect(breachRoute(away.state, 0.3).route.at(-1)!.def).toBe('hq');
  });

  it('raids during the three days after the player dies are fought in numbers', () => {
    const r = rig();
    const { state } = r;
    r.add('farming');
    r.add('defense');
    state.colony.stock.food = 60;
    state.colony.stock.ears = 200;
    state.world.cells.Z[state.world.homeCell!] = 120;
    state.player.hp = 0;
    state.player.aim.deadT = 0.05;
    r.run(1);
    expect(state.time.day).toBeGreaterThanOrEqual(93);
    expect(state.flags.skipping).toBeUndefined();
    expect(state.build.raid).toBeNull();
    expect(state.build.lastRaid?.away).toBe(true);
    expect(r.events.filter((e) => e.type === 'raidStarted').length).toBeGreaterThanOrEqual(3);
    expect(playerPresent(state)).toBe(true);
  });
});

describe('outposts and sea crossings', () => {
  it('founding needs a cleared cell, ears, wood and someone to stay; supply, resupply, fast travel, and falling', () => {
    const r = rig();
    const { state, sim } = r;
    const home = state.world.homeCell!;
    const cell = grid.landIds.find((id) => cellDistance(grid, id, home) === 2 && findRoute(grid, home, id) !== null)!;
    const cells = state.world.cells;
    cells.Z[cell] = 500;
    cells.intel[cell] = 2;
    expect(foundError(state, grid, cell)).toBe('notCleared');
    cells.Z[cell] = 5;
    expect(foundError(state, grid, cell)).toBe('noEars');
    state.colony.stock.ears = 100;
    state.colony.stock.wood = 30;
    expect(foundError(state, grid, cell)).toBe('noGuard');
    const guard = r.add('defense');
    r.add('farming');
    state.colony.stock.food = 30;
    state.colony.stock.ammo = 100;
    sim.dispatch({ type: 'foundOutpost', cell });
    r.run(1);
    const o = outpostAt(state, cell)!;
    expect(o.garrison).toEqual([guard.id]);
    expect(guard.location).toEqual({ kind: 'outpost', id: o.id });
    expect(state.colony.stock.ears).toBe(60);
    expect(state.colony.stock.wood).toBe(10);
    // Daily supply: min(shortfall, 20 + 10 per tier) from the base's stock; two cells away there is no delay.
    const ctx = ctxNow(state, grid, (e) => r.events.push(e));
    outpostsDay(ctx, [0]);
    expect(o.ammo).toBe(30);
    expect(state.colony.stock.ammo).toBe(70);
    outpostsDay(ctx, [0]);
    outpostsDay(ctx, [0]);
    expect(o.ammo).toBe(60); // tier 1 holds 60
    // A small attack is beaten off, a big one overruns the place.
    cells.Z[cell] = 30;
    outpostsDay(ctx, [8]);
    expect(cells.Z[cell]).toBe(26);
    expect(outpostAt(state, cell)).toBeTruthy();
    // Fast travel there: one cell per game hour; then take ammunition.
    state.player.inv.ammo = 100;
    sim.dispatch({ type: 'travel', to: cell, fast: true });
    const t0 = state.time.day * 1440 + state.time.minute;
    r.run(400, () => state.world.travel === null && state.player.cell === cell);
    expect(state.player.cell).toBe(cell);
    expect(state.time.day * 1440 + state.time.minute - t0).toBeLessThanOrEqual(121);
    sim.dispatch({ type: 'resupply' });
    r.run(1);
    expect(state.player.inv.ammo).toBe(150);
    expect(o.ammo).toBe(10);
    // The compound stands in the operation area and collides.
    const area = areaOf(state)!;
    const prefab = outpostPrefab(area.map, o.tier)!;
    expect(prefab.boxes.length).toBeGreaterThan(6);
    const fence = prefab.boxes[0]!;
    expect(area.map.solids.some((s) => s.x0 === fence.x0 && s.z0 === fence.z0 && s.kind === 'prop')).toBe(true);
    // Ordinary travel is not "fast" to a place without an outpost.
    const rejected: string[] = [];
    sim.events.on('commandRejected', (e) => rejected.push(e.reason));
    sim.dispatch({ type: 'travel', to: grid.landIds.find((id) => cellDistance(grid, id, cell) === 1 && id !== home && !outpostAt(state, id))!, fast: true });
    r.run(1);
    expect(rejected).toEqual(['notStation']);
    // Overrun.
    outpostsDay(ctx, [500]);
    expect(outpostAt(state, cell)).toBeUndefined();
    expect(r.events.some((e) => e.type === 'outpostLost')).toBe(true);
    const back = state.colony.survivors.find((s) => s.id === guard.id);
    if (back) expect(back.location.kind).toBe('home');
    else expect(state.colony.memorial.some((m) => m.cause === 'outpost')).toBe(true);
  });

  it('every start candidate can reach at least three regions, crossings included', () => {
    const links = grid.seaLinks!;
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const l of links) {
      expect(grid.cells[l.a]).toBeTruthy();
      expect(grid.cells[l.b]).toBeTruthy();
      expect(l.minutes).toBeGreaterThan(BALANCE.world.travel.minutesPerCell);
    }
    // Components of the travel graph (land neighbours + crossings) and the regions in each.
    const comp = new Int32Array(grid.gridW * grid.gridH).fill(-1);
    const regions: Set<number>[] = [];
    for (const start of grid.landIds) {
      if (comp[start] !== -1) continue;
      const id = regions.length;
      const set = new Set<number>();
      regions.push(set);
      const stack = [start];
      comp[start] = id;
      while (stack.length > 0) {
        const c = stack.pop()!;
        set.add(grid.cells[c]!.region);
        const cx = c % grid.gridW, cy = Math.floor(c / grid.gridW);
        const push = (n: number): void => {
          if (grid.cells[n] && comp[n] === -1) {
            comp[n] = id;
            stack.push(n);
          }
        };
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (cx + dx >= 0 && cx + dx < grid.gridW && cy + dy >= 0 && cy + dy < grid.gridH) push((cy + dy) * grid.gridW + cx + dx);
        for (const l of links) if (l.a === c) push(l.b); else if (l.b === c) push(l.a);
      }
    }
    for (let n = 0; n < 3; n++) {
      const data = loadScenario(n);
      const cells = createInfectionCells(grid);
      const s = createInitialState(1, 1);
      initWorld(s, grid, data);
      void cells;
      for (let seed = 0; seed < 12; seed++) {
        for (const cand of findStartCandidates(s.world.cells, grid, seedRng(seed * 7 + n))) {
          expect(regions[comp[cand.cell]!]!.size, `${grid.prefNames[grid.cells[cand.cell]!.pref]}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
    // Honshu, Hokkaido, Shikoku and Kyushu are one network now, and a crossing takes longer than a cell.
    const cellOf = (hub: string): number => grid.hubs.find((h) => h.name.includes(hub))!.cell;
    const tokyo = cellOf('東京');
    for (const far of ['札幌', '高松空港', '博多', '那覇空港']) expect(findRoute(grid, tokyo, cellOf(far)), far).not.toBeNull();
    expect(comp[cellOf('札幌')]).toBe(comp[tokyo]);
    expect(isBuilt).toBeTypeOf('function');
    expect(addZombie).toBeTypeOf('function');
  });
});
