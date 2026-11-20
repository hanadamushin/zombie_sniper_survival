// Building yard (07d, debug): every enterable building type on flat ground, in two rows facing a
// street — the first row's fronts face south (rot 0), the second row's north (rot 2). Like the firing
// range it needs no world data (state.flags.range + state.flags.yard; area.ts). Tests and e2e walk
// into the buildings here; the 07d-2 sessions see their new types appear in it automatically.

import { BUILDING_DEFS } from '../../gen/buildings/index.ts';
import { addEnterable, createFlatBuilder } from '../../gen/builder.ts';
import { finishMap, type TacticalMap } from '../../gen/index.ts';

/** The street between the two rows (z) and where the first building starts (x). */
export const YARD = { street: 520, startX: 120, gap: 14, streetHalf: 9 } as const;

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
  for (const rot of [0, 2] as const) {
    let x = YARD.startX;
    for (const def of BUILDING_DEFS) {
      const w = (def.size.w[0] + def.size.w[1]) / 2;
      const d = (def.size.d[0] + def.size.d[1]) / 2;
      const z0 = rot === 0 ? YARD.street - YARD.streetHalf - d : YARD.street + YARD.streetHalf;
      const bd = addEnterable(b, def.id, x, z0, w, d, rot);
      entries.push({ def: def.id, enter: bd.enter!, rot });
      x += w + YARD.gap;
    }
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
