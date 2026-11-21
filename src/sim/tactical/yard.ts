// Building yard (07d, debug): every enterable building type on flat ground, in two rows facing a
// street — the first row's fronts face south (rot 0), the second row's north (rot 2). Like the firing
// range it needs no world data (state.flags.range + state.flags.yard; area.ts). Tests and e2e walk
// into the buildings here; the 07d-2 sessions see their new types appear in it automatically.

import { BUILDING_DEFS } from '../../gen/buildings/index.ts';
import { addEnterable, createFlatBuilder } from '../../gen/builder.ts';
import { finishMap, type TacticalMap } from '../../gen/index.ts';

/** The street between the two rows (z) and where the first building starts (x). */
export const YARD = { street: 520, startX: 120, gap: 14, streetHalf: 9 } as const;
/**
 * 07d-2b: when a row would run off the map (x past `endX`) it goes on along the next street (z).
 * 07d-2d: the streets are spaced by the depth of what stands on them (school sites and campuses
 * are 60–80 m deep): the next street goes on the +z side, then the -z side, then +z... of the
 * streets laid out so far, clear of their rows by `STREET_GAP`.
 */
const END_X = 990;
const STREET_GAP = 6;

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
  const depth: number[] = [0];
  let x = YARD.startX;
  let street = 0;
  for (const def of BUILDING_DEFS) {
    const w = (def.size.w[0] + def.size.w[1]) / 2;
    if (x + w > END_X) {
      street++;
      depth.push(0);
      x = YARD.startX;
    }
    slots.push({ x, street });
    depth[street] = Math.max(depth[street]!, (def.size.d[0] + def.size.d[1]) / 2);
    x += w + YARD.gap;
  }
  // Street z: the first at YARD.street, the others alternately on the +z and the -z side of the band used so far.
  const zs: number[] = [YARD.street];
  let north = YARD.street + YARD.streetHalf + depth[0]!;
  let south = YARD.street - YARD.streetHalf - depth[0]!;
  for (let i = 1; i < depth.length; i++) {
    const half = YARD.streetHalf + depth[i]!;
    if (i % 2 === 1) {
      zs.push(north + STREET_GAP + half);
      north += STREET_GAP + 2 * half;
    } else {
      zs.push(south - STREET_GAP - half);
      south -= STREET_GAP + 2 * half;
    }
  }
  for (const rot of [0, 2] as const) {
    BUILDING_DEFS.forEach((def, i) => {
      const w = (def.size.w[0] + def.size.w[1]) / 2;
      const d = (def.size.d[0] + def.size.d[1]) / 2;
      const { x: x0, street: si } = slots[i]!;
      const z = zs[si]!;
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
