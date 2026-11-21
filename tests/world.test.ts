import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events.ts';
import { seedRng } from '../src/core/rng.ts';
import { createInitialState, emptyInputFrame, type GameState, type StaticGrid } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { createSim } from '../src/sim/index.ts';
import { worldSystem } from '../src/sim/world/index.ts';
import { activeCap, cellTactical, dangerOf, kindMix } from '../src/sim/world/derive.ts';
import { cellsWithin, parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { runScenario, stepInfection, type InfectionCells } from '../src/sim/world/infection.ts';
import { decodeScenario, dequantizeZ, encodeScenario, initWorld, quantizeZ, type ScenarioData } from '../src/sim/world/scenario.ts';
import { beginAt, evaluateStart, findStartCandidates } from '../src/sim/world/start.ts';
import { findRoute, legMinutes } from '../src/sim/world/travel.ts';
import { computeScenario } from '../tools/run-infection.ts';

const DATA = new URL('../public/data/', import.meta.url);
const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
const loadScenario = (n: number): ScenarioData => {
  const buf = readFileSync(new URL(`infection_${n}.bin`, DATA));
  return decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
};
const TOTAL = grid.landIds.reduce((s, id) => s + grid.cells[id]!.pop0, 0);
const living = (cells: InfectionCells): number => grid.landIds.reduce((s, id) => s + cells.S[id]! + cells.Z[id]! + cells.H[id]!, 0);

function newGame(scenario = 0, seed = 7): GameState {
  const state = createInitialState(seed, 1);
  initWorld(state, grid, loadScenario(scenario));
  return state;
}

describe('grid', () => {
  it('covers Japan with ~10 km cells', () => {
    expect(grid.landIds.length).toBeGreaterThan(3500);
    expect(grid.landIds.length).toBeLessThan(4300);
    // R0: the 2020 census (126.1 million; a few thousand on far islands outside the grid are left out).
    expect(TOTAL).toBeGreaterThan(125_900_000);
    expect(TOTAL).toBeLessThan(126_200_000);
    expect(grid.hubs.filter((h) => h.intl !== null)).toHaveLength(5);
  });

  it('puts the big cities and the islands where they belong', () => {
    const at = (lat: number, lon: number) => {
      const gx = Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
      const gy = Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm);
      return grid.cells[gy * grid.gridW + gx];
    };
    for (const [lat, lon] of [[35.69, 139.7], [34.69, 135.5], [35.17, 136.91]] as const) expect(at(lat, lon)?.land).toBe('urban');
    expect(at(35.69, 139.7)?.pref).toBe(13);
    expect(at(43.06, 141.35)?.region).toBe(0);
    // Okinawa main island, Sado, Awaji, Tsushima
    for (const [lat, lon] of [[26.35, 127.8], [38.0, 138.4], [34.35, 134.85], [34.4, 129.3]] as const) expect(at(lat, lon)).toBeTruthy();
    expect(at(36.3, 137.65)?.land).toBe('mountain'); // Northern Alps
    expect(at(30.0, 140.0)).toBeNull(); // open sea
  });
});

describe('infection simulation', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = runScenario(grid, seedRng(5), 40);
    const b = runScenario(grid, seedRng(5), 40);
    const c = runScenario(grid, seedRng(6), 40);
    expect(a.cells).toEqual(b.cells);
    expect(a.sources).toEqual(b.sources);
    expect(c.cells.Z).not.toEqual(a.cells.Z);
  });

  it('conserves the head count and never touches the sea or the high mountains', () => {
    let dead = 0;
    const { cells } = runScenario(grid, seedRng(BALANCE.infection.scenarioSeeds[0]), 90, (_day, c, stats) => {
      if (stats) dead += stats.died + stats.killed;
      expect(living(c) + dead).toBe(TOTAL); // S + Z + H + dead never exceeds (in fact equals) pop0
    });
    for (let id = 0; id < grid.gridW * grid.gridH; id++) {
      const info = grid.cells[id];
      if (!info) {
        expect(cells.Z[id]).toBe(-1);
        expect(cells.S[id]! + cells.H[id]! + cells.loot[id]!).toBe(0);
      } else {
        expect(cells.Z[id]).toBeGreaterThanOrEqual(0);
        expect(cells.S[id]).toBeGreaterThanOrEqual(0);
        expect(cells.loot[id]).toBeGreaterThanOrEqual(0);
        expect(cells.loot[id]).toBeLessThanOrEqual(1);
        if (info.land === 'mountain') expect(cells.Z[id]).toBe(0);
      }
    }
  });

  it('ends with ruined metropolises, dense towns and a sparse countryside', () => {
    for (let n = 0; n < BALANCE.infection.scenarioSeeds.length; n++) {
      const d = loadScenario(n);
      const by: Record<string, number[]> = {};
      grid.landIds.forEach((id, i) => (by[grid.cells[id]!.land] ??= []).push(d.Z[i]!));
      const median = (a: number[]): number => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
      expect(median(by.urban!)).toBeGreaterThan(30_000);
      expect(median(by.suburb!)).toBeGreaterThan(3_000);
      expect(median(by.rural!)).toBeLessThan(median(by.suburb!) / 3);
      expect(median(by.forest!)).toBeLessThan(200);
      // Not uniformly red: a good part of the land has (almost) no zombies.
      const quiet = d.Z.filter((z) => z < 200).length / d.Z.length;
      expect(quiet).toBeGreaterThan(0.3);
      expect(quiet).toBeLessThan(0.8);
    }
  });

  it('one day takes less than 5 ms', () => {
    const state = newGame();
    const rng = seedRng(1);
    stepInfection(state.world.cells, grid, 91, null, rng); // warm-up
    const t0 = performance.now();
    for (let day = 92; day < 122; day++) stepInfection(state.world.cells, grid, day, null, rng);
    expect((performance.now() - t0) / 30).toBeLessThan(5);
  });
});

describe('bundled scenarios', () => {
  it('round-trip through the binary codec', () => {
    const d = loadScenario(1);
    const again = decodeScenario(encodeScenario(d).buffer as ArrayBuffer);
    expect(again).toEqual(d);
    expect(d.days).toBe(BALANCE.infection.precomputeDays);
    expect(d.snapshots.length).toBe((d.days + 1) * grid.landIds.length);
    for (const z of [1, 9, 250, 12_345, 2_000_000]) expect(Math.abs(Math.log10(dequantizeZ(quantizeZ(z)) / z))).toBeLessThan(0.02);
    expect(quantizeZ(0)).toBe(0);
  });

  it('are up to date with the simulation (npm run data)', () => {
    expect(computeScenario(grid, 2)).toEqual(loadScenario(2));
  });

  it('continue seamlessly in the game', () => {
    const data = loadScenario(0);
    const state = newGame(0);
    // The loaded world equals the simulation after day 90 ...
    const { cells } = runScenario(grid, seedRng(data.seed), data.days);
    expect(state.world.cells.S).toEqual(cells.S);
    expect(state.world.cells.Z).toEqual(cells.Z);
    expect(state.world.cells.H).toEqual(cells.H);
    expect(state.world.cells.loot).toEqual(cells.loot);
    // ... the last snapshot shows the same zombies ...
    const n = grid.landIds.length;
    grid.landIds.forEach((id, i) => expect(data.snapshots[data.days * n + i]).toBe(quantizeZ(cells.Z[id]!)));
    // ... and the game's first midnight runs day 91 on top of it.
    const home = findStartCandidates(state.world.cells, grid, seedRng(1))[0]!.cell;
    beginAt(state, grid, home);
    const before = living(state.world.cells);
    const zBefore = state.world.cells.Z.slice();
    const sim = createSim({ grid });
    const stepped: number[] = [];
    sim.events.on('infectionStepped', (e) => stepped.push(e.day));
    state.time.minute = 1439;
    state.time.sub = 0.99;
    sim.tick(state, 1, emptyInputFrame());
    expect(state.time.day).toBe(BALANCE.time.startDay + 1);
    expect(stepped).toEqual([91]);
    expect(state.world.cells.Z).not.toEqual(zBefore);
    expect(living(state.world.cells)).toBeLessThanOrEqual(before);
    expect(living(state.world.cells)).toBeGreaterThan(before * 0.98);
    expect(state.world.hordeMeter).toBeGreaterThanOrEqual(0);
    expect(() => JSON.stringify(state)).not.toThrow();
  });
});

describe('start candidates', () => {
  it('offers two quiet rural places and one busier one (danger 20..30 %) near a town, far apart', () => {
    for (let n = 0; n < 3; n++) {
      const state = newGame(n);
      const found = findStartCandidates(state.world.cells, grid, seedRng(n + 10));
      expect(found).toHaveLength(3);
      expect(found.map((c) => c.tier)).toEqual(['quiet', 'quiet', 'busy']);
      for (const c of found) {
        const info = grid.cells[c.cell]!;
        expect(['rural', 'forest']).toContain(info.land);
        if (c.tier === 'quiet') expect(c.z).toBeLessThan(200);
        else {
          expect(dangerOf(c.z)).toBeGreaterThanOrEqual(0.2);
          expect(dangerOf(c.z)).toBeLessThan(0.3);
        }
        expect(c.z).toBeGreaterThanOrEqual(BALANCE.world.start.minCellZ); // something to shoot at home (04)
        expect(c.nearbyH).toBeGreaterThanOrEqual(5);
        expect(cellsWithin(grid, c.cell, 3).some((id) => grid.cells[id]!.land === 'suburb')).toBe(true);
        expect(evaluateStart(state.world.cells, grid, c.cell)).toEqual(c);
      }
      expect(findStartCandidates(state.world.cells, grid, seedRng(n + 10))).toEqual(found);
    }
  });
});

describe('cell -> tactical parameters', () => {
  it('follows the spec formulas', () => {
    expect(activeCap(0)).toBe(0);
    expect(activeCap(1)).toBeGreaterThanOrEqual(5);
    expect(activeCap(100)).toBe(Math.round(BALANCE.world.active.base + BALANCE.world.active.perLog * Math.log10(101)));
    expect(activeCap(5_000_000)).toBeLessThanOrEqual(120);
    expect(dangerOf(0)).toBe(0);
    expect(dangerOf(1e9)).toBe(1);
    const urban = kindMix('urban');
    const rural = kindMix('rural');
    expect(urban.walker + urban.runner + urban.crawler + urban.brute).toBeCloseTo(1);
    expect(rural.runner).toBeCloseTo(0.12);
    expect(urban.runner).toBeGreaterThan(rural.runner);
    const state = newGame();
    const tokyo = grid.hubs.find((h) => h.name.startsWith('東京'))!.cell;
    const t = cellTactical(state, grid, tokyo)!;
    expect(t.land).toBe('urban');
    expect(t.active).toBeGreaterThan(80);
    expect(t.cleared).toBe(false);
  });
});

describe('travel', () => {
  const setup = () => {
    const state = newGame(0);
    const start = findStartCandidates(state.world.cells, grid, seedRng(3))[0]!.cell;
    beginAt(state, grid, start);
    const sim = createSim({ grid });
    return { state, sim, start };
  };
  const run = (sim: ReturnType<typeof createSim>, state: GameState, minutes: number): void => {
    for (let i = 0; i < minutes; i++) sim.tick(state, 1, emptyInputFrame());
  };

  it('finds routes over land only and charges mountains more', () => {
    const tokyo = grid.hubs.find((h) => h.name.startsWith('東京'))!.cell;
    const osaka = grid.hubs.find((h) => h.name.startsWith('新大阪'))!.cell;
    const sapporo = grid.hubs.find((h) => h.name.startsWith('札幌'))!.cell;
    const route = findRoute(grid, tokyo, osaka)!;
    expect(route.path[0]).toBe(tokyo);
    expect(route.path.at(-1)).toBe(osaka);
    expect(route.path.length).toBeGreaterThan(35);
    expect(route.minutes).toBeGreaterThanOrEqual((route.path.length - 1) * 180);
    for (const c of route.path) expect(grid.cells[c]).toBeTruthy();
    // Hokkaido is reached through the Seikan tunnel (06); islands without a crossing stay out of reach.
    const north = findRoute(grid, tokyo, sapporo)!;
    expect(north.minutes).toBeGreaterThan((north.path.length - 2) * 180 + 400);
    expect(findRoute(grid, tokyo, grid.places.find((p) => p.name === '対馬市')!.cell)).toBeNull();
    const mountain = grid.landIds.find((id) => grid.cells[id]!.land === 'mountain' && grid.cells[id - 1]?.land === 'forest')!;
    expect(legMinutes(grid, mountain - 1, mountain)).toBe(270);
    expect(legMinutes(grid, mountain, mountain - 1)).toBe(180);
  });

  it('moves the player to an adjacent cell while time passes', () => {
    const { state, sim, start } = setup();
    const target = cellsWithin(grid, start, 1).find((id) => id !== start && Math.abs(id - start) === 1)!;
    const events: string[] = [];
    sim.events.onAny((e) => e.type.startsWith('travel') || e.type === 'cellEntered' ? events.push(e.type) : 0);
    const t0 = state.time.day * 1440 + state.time.minute;
    sim.dispatch({ type: 'travel', to: target });
    run(sim, state, 10);
    expect(state.world.travel).not.toBeNull();
    expect(state.player.cell).toBe(start);
    run(sim, state, 300);
    expect(state.player.cell).toBe(target);
    expect(state.world.travel).toBeNull();
    expect(state.world.cells.visited[target]).toBe(true);
    expect(state.world.cells.intel[target]).toBe(2);
    expect(events.filter((e) => e !== 'travelEncounter')).toEqual(['travelStarted', 'cellEntered', 'travelArrived']);
    expect(state.time.day * 1440 + state.time.minute - t0).toBe(310);
    expect(state.world.homeCell).toBe(start);
  });

  it('rejects unreachable destinations', () => {
    const { state, sim } = setup();
    const rejected: string[] = [];
    sim.events.on('commandRejected', (e) => rejected.push(e.reason));
    const sado = grid.places.find((p) => p.name === '対馬市')!.cell; // no crossing leads to Tsushima
    sim.dispatch({ type: 'travel', to: sado });
    sim.dispatch({ type: 'travel', to: 0 });
    run(sim, state, 1);
    expect(rejected).toEqual(['noRoute', 'noRoute']);
    expect(state.world.travel).toBeNull();
  });

  it('player kills reduce the zombies of the current cell', () => {
    const { state } = setup();
    const cell = state.player.cell;
    state.world.cells.Z[cell] = 5;
    const kill: GameEvent = { type: 'zombieKilled', id: 1, kind: 'walker', by: 'player', headshot: true, pos: [0, 0, 0] };
    // Emit through a fake system in the same sim: the world system reads it one tick later.
    const sim2 = createSim({ grid, systems: [{ id: 'fake', step: (_s, ctx) => ctx.emit(kill) }, worldSystem] });
    sim2.tick(state, 0.01, emptyInputFrame());
    sim2.tick(state, 0.01, emptyInputFrame());
    sim2.tick(state, 0.01, emptyInputFrame());
    expect(state.world.cells.Z[cell]).toBe(3);
  });
});
