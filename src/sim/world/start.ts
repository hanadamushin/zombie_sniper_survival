// Start location candidates (docs/02_systems_spec.md §2.4) and placing the player on the map.

import { foundBase } from '../build/blueprints.ts';
import type { RngState } from '../../core/rng.ts';
import { rand } from '../../core/rng.ts';
import type { CellId, GameState, Land, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { cellDistance, cellsWithin } from './grid.ts';
import type { InfectionCells } from './infection.ts';
import { reveal } from './travel.ts';

const R = BALANCE.world.start;

export interface StartCandidate {
  cell: CellId;
  /** Zombies in the cell itself. */
  z: number;
  /** Hidden survivors within suburbRadius. */
  nearbyH: number;
  /** Zombies within suburbRadius (what there is to hunt). */
  nearbyZ: number;
  /** Distance in cells to the nearest suburb cell. */
  suburbDistance: number;
}

const landmassCache = new WeakMap<StaticGrid, Int32Array>();
/** Size of the connected landmass each cell belongs to (0 for sea). */
export function landmassSizes(grid: StaticGrid): Int32Array {
  let sizes = landmassCache.get(grid);
  if (sizes) return sizes;
  const { gridW: w, gridH: h } = grid;
  sizes = new Int32Array(w * h);
  const seen = new Uint8Array(w * h);
  for (const start of grid.landIds) {
    if (seen[start]) continue;
    const members = [start];
    seen[start] = 1;
    for (let i = 0; i < members.length; i++) {
      const c = members[i]!;
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const o = y * w + x;
          if (seen[o] || !grid.cells[o]) continue;
          seen[o] = 1;
          members.push(o);
        }
      }
    }
    for (const c of members) sizes[c] = members.length;
  }
  landmassCache.set(grid, sizes);
  return sizes;
}

/** Evaluate one cell against the start rules; null when it does not qualify. */
export function evaluateStart(cells: InfectionCells, grid: StaticGrid, cell: CellId): StartCandidate | null {
  const info = grid.cells[cell];
  if (!info || !(R.lands as readonly Land[]).includes(info.land)) return null;
  const z = cells.Z[cell]!;
  if (z / BALANCE.world.cellAreaKm2 >= R.maxZPerKm2) return null;
  if (z < R.minCellZ) return null; // nothing to hunt at home on day one
  if (landmassSizes(grid)[cell]! < R.minLandmass) return null;
  let nearbyH = 0;
  let nearbyZ = 0;
  let suburbDistance = Infinity;
  for (const id of cellsWithin(grid, cell, R.suburbRadius)) {
    nearbyH += cells.H[id]!;
    nearbyZ += Math.max(0, cells.Z[id]!);
    if (grid.cells[id]!.land === 'suburb') suburbDistance = Math.min(suburbDistance, cellDistance(grid, cell, id));
  }
  if (suburbDistance === Infinity || nearbyH < R.minNearbyH) return null;
  return { cell, z, nearbyH, nearbyZ, suburbDistance };
}

/**
 * Pick up to `count` start candidates: qualifying cells, far apart from each other, preferring
 * places that have something to hunt nearby. Deterministic for a given rng state.
 */
export function findStartCandidates(cells: InfectionCells, grid: StaticGrid, rng: RngState, count: number = R.count): StartCandidate[] {
  const all: StartCandidate[] = [];
  for (const id of grid.landIds) {
    const c = evaluateStart(cells, grid, id);
    if (c) all.push(c);
  }
  const hunting = all.filter((c) => c.nearbyZ >= R.minNearbyZ);
  const pool = hunting.length >= count ? hunting : all;
  // Fisher–Yates with the seeded stream.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand(rng) * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const chosen: StartCandidate[] = [];
  for (let separation: number = R.minSeparation; chosen.length < count && separation >= 0; separation = separation > 0 ? Math.floor(separation / 2) : -1) {
    for (const c of pool) {
      if (chosen.length >= count) break;
      if (chosen.includes(c)) continue;
      if (chosen.every((o) => cellDistance(grid, o.cell, c.cell) >= separation)) chosen.push(c);
    }
  }
  return chosen;
}

/** Put the player (and the home base) on the chosen cell and reveal the surroundings. */
export function beginAt(state: GameState, grid: StaticGrid, cell: CellId): void {
  if (!grid.cells[cell]) throw new Error(`Cell ${cell} is not land`);
  state.player.cell = cell;
  state.world.homeCell = cell;
  state.world.travel = null;
  reveal(state, grid, cell, R.intelRadius);
  foundBase(state); // headquarters and the first field (06)
}
