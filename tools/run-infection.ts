// Precomputes the bundled infection scenarios (days 0..N) with the very same stepInfection the
// game uses, and encodes them for public/data/infection_<n>.bin.

import { seedRng } from '../src/core/rng.ts';
import type { StaticGrid } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { runScenario } from '../src/sim/world/infection.ts';
import { encodeScenario, quantizeZ, type ScenarioData } from '../src/sim/world/scenario.ts';

export function computeScenario(grid: StaticGrid, scenario: number): ScenarioData {
  const seed = BALANCE.infection.scenarioSeeds[scenario];
  if (seed === undefined) throw new Error(`No scenario ${scenario}`);
  const days = BALANCE.infection.precomputeDays;
  const n = grid.landIds.length;
  const snapshots = new Uint8Array((days + 1) * n);
  const { cells, sources } = runScenario(grid, seedRng(seed), days, (day, c) => {
    for (let i = 0; i < n; i++) snapshots[day * n + i] = quantizeZ(c.Z[grid.landIds[i]!]!);
  });
  const pack = (arr: number[], scale = 1): Uint32Array => Uint32Array.from(grid.landIds, (id) => Math.round(arr[id]! * scale));
  return { scenario, seed, days, sources, S: pack(cells.S), Z: pack(cells.Z), H: pack(cells.H), loot: pack(cells.loot, 1e5), snapshots };
}

export function buildScenarioFile(grid: StaticGrid, scenario: number): Uint8Array {
  return encodeScenario(computeScenario(grid, scenario));
}
