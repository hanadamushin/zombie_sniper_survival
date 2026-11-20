// Building yard (07d, debug): every enterable building type on flat ground, in two rows facing a
// street — the first row's fronts face south (rot 0), the second row's north (rot 2). Like the firing
// range it needs no world data (state.flags.range + state.flags.yard; area.ts). Tests and e2e walk
// into the buildings here; the 07d-2 sessions see their new types appear in it automatically.

import { BUILDING_DEFS } from '../../gen/buildings/index.ts';
import { addEnterable, createFlatBuilder } from '../../gen/builder.ts';
import { finishMap, type TacticalMap } from '../../gen/index.ts';

/** The street between the two rows (z) and where the first building starts (x). */
export const YARD = { street: 520, startX: 120, gap: 14, streetHalf: 9 } as const;
/** 07d-2b: when a row would run off the map (x past `endX`) it goes on along the next street (z). */
const MORE_STREETS = [600, 680, 440, 360, 760, 280] as const;
const END_X = 990;

export interface YardEntry {
  def: string;
  /** TacticalMap.placements index. */
  enter: number;
  rot: 0 | 2;
}

let cached: { map: TacticalMap; entries: YardEntry[] } | null = null;

function build(): { map: TacticalMap; entries: YardEntry[] } {
  const b = createFlatBuilder(0, { mapSeed: 11, land: 'suburb', lootSpots: 100000 });
  const entries: YardEntry[] = [];
  // Where each type stands along which street (both rows break at the same types).
  const slots: { x: number; street: number }[] = [];
  let x = YARD.startX;
  let street = 0;
  for (const def of BUILDING_DEFS) {
    const w = (def.size.w[0] + def.size.w[1]) / 2;
    if (x + w > END_X && street < MORE_STREETS.length) {
      street++;
      x = YARD.startX;
    }
    slots.push({ x, street: street === 0 ? YARD.street : MORE_STREETS[street - 1]! });
    x += w + YARD.gap;
  }
  for (const rot of [0, 2] as const) {
    BUILDING_DEFS.forEach((def, i) => {
      const w = (def.size.w[0] + def.size.w[1]) / 2;
      const d = (def.size.d[0] + def.size.d[1]) / 2;
      const { x: x0, street: z } = slots[i]!;
      const z0 = rot === 0 ? z - YARD.streetHalf - d : z + YARD.streetHalf;
      const bd = addEnterable(b, def.id, x0, z0, w, d, rot);
      entries.push({ def: def.id, enter: bd.enter!, rot });
    });
  }
  const map = finishMap(b);
  map.spawn.edge = [YARD.startX - 8, YARD.street];
  map.spawn.edgeYaw = -Math.PI / 2; // facing east along the street
  return { map, entries };
}

export function yardMap(): TacticalMap {
  return (cached ??= build()).map;
}

export function yardEntries(): YardEntry[] {
  return (cached ??= build()).entries;
}
