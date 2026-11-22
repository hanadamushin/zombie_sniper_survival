// Hand corrections of the real-map data of Chugoku (R6). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (some looked up outside the "town tiles" the converter reads).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than 3 firing positions seeing 300 m. Spots chosen by
 * `node tools/real/sightlines.ts chugoku --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {};

const CELLS: Record<number, CellOverride> = {};

const cells: Record<number, CellOverride> = { ...CELLS };
for (const [cell, spots] of Object.entries(TOWERS)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, addPois: [...(c.addPois ?? []), ...spots.map(([x, z]): RealPoi => ({ kind: POI.tower, grade: 20, x, z, name: '物見櫓' }))] };
}

// Dense cities (Hiroshima, Okayama): the municipal wide-street grid would pave the town over. Same value as
// Kinki (and Hokkaido .. Chubu): Chugoku borders Kinki by land, edge decisions must agree.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
