// Ammunition caches left in the world (07c): police boxes, farm co-ops, a soldier's crate by the
// road. How many a cell has and how many rounds each holds follow from the cell's map seed alone,
// so the strategic map can list them without generating the area; where they stand comes with
// the generated map (TacticalMap.caches).

import { fork, randInt, randRange, seedRng } from '../core/rng.ts';
import type { Land } from '../core/types.ts';
import { BALANCE } from '../data/balance.ts';

const C = BALANCE.world.caches;

/** Rounds in each cache of a cell (the number of entries is the number of caches). */
export function cacheAmmo(mapSeed: number, land: Land): number[] {
  const rng = fork(seedRng(mapSeed), 'caches');
  const [lo, hi] = C.perCell[land];
  const n = randInt(rng, lo, hi);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round(randRange(rng, C.ammo[0], C.ammo[1])));
  return out;
}
