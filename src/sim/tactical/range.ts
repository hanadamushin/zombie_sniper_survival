// Firing range (debug): a flat map with target lines at known distances — a standing target in
// front of a board and a pacing target on every line. Works without any world data
// (state.flags.range; see area.ts). Used to check ballistics, sway and the reticle by eye.

import type { ZombieKind } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { createFlatBuilder } from '../../gen/builder.ts';
import { finishMap, type TacticalMap } from '../../gen/index.ts';

const R = BALANCE.range;

export interface RangeSpot {
  kind: ZombieKind;
  /** 1 = stands still, 2 = paces between x0 and x1. */
  dummy: 1 | 2;
  x: number;
  z: number;
  x0: number;
  x1: number;
  distance: number;
}

function layout(): RangeSpot[] {
  const [fx, fz] = R.firingLine;
  const spots: RangeSpot[] = [];
  R.distances.forEach((d, i) => {
    const x = fx + (i - (R.distances.length - 1) / 2) * R.laneSpacing;
    const z = fz - d;
    spots.push({ kind: 'walker', dummy: 1, x, z, x0: x, x1: x, distance: d });
    spots.push({ kind: 'walker', dummy: 2, x: fx + R.walkerLane[0], z, x0: fx + R.walkerLane[0], x1: fx + R.walkerLane[1], distance: d });
  });
  // The other kinds, side by side on the first line.
  const z = fz - R.distances[0]!;
  const x = fx - ((R.distances.length - 1) / 2) * R.laneSpacing;
  spots.push({ kind: 'runner', dummy: 1, x: x - 6, z, x0: 0, x1: 0, distance: R.distances[0]! });
  spots.push({ kind: 'brute', dummy: 1, x: x - 10, z, x0: 0, x1: 0, distance: R.distances[0]! });
  spots.push({ kind: 'crawler', dummy: 1, x: x - 14, z, x0: 0, x1: 0, distance: R.distances[0]! });
  return spots;
}

export const RANGE_SPOTS: readonly RangeSpot[] = layout();

let cached: TacticalMap | null = null;

export function rangeMap(): TacticalMap {
  if (cached) return cached;
  const b = createFlatBuilder(0, { mapSeed: 7, land: 'rural' });
  for (const s of RANGE_SPOTS) {
    if (s.dummy !== 1 || s.kind !== 'walker') continue;
    // Board behind the target (shows where a miss went) and one post per 100 m beside it.
    b.solids.push({ x0: s.x - 1.5, x1: s.x + 1.5, z0: s.z - 2.3, z1: s.z - 2, y0: -1, y1: 2.6, kind: 'prop', ref: -1 });
    for (let k = 0; k < s.distance / 100; k++) {
      const px = s.x - 2.4 - k * 0.7;
      b.solids.push({ x0: px - 0.15, x1: px + 0.15, z0: s.z - 2.3, z1: s.z - 2, y0: -1, y1: 1.4, kind: 'prop', ref: -1 });
    }
  }
  cached = finishMap(b);
  cached.spawn.edge = [R.firingLine[0], R.firingLine[1]];
  cached.spawn.edgeYaw = 0;
  return cached;
}
