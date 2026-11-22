// Hand corrections of the real-map data of Shikoku (R7). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (some under names the converter does not classify).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

const gsdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.gsdf, grade, x, z, name: `陸上自衛隊${name}` });
const msdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.msdf, grade, x, z, name: `海上自衛隊${name}` });

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than 3 firing positions seeing 300 m. Spots chosen by
 * `node tools/real/sightlines.ts shikoku --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {
  21104: [[776, 552]], 21265: [[648, 328]], 21590: [[712, 200]], 21759: [[264, 456]], 21761: [[744, 488]], 21762: [[328, 456]],
  21765: [[488, 40]], 21773: [[776, 616]], 22093: [[776, 488]], 22103: [[680, 616]], 22262: [[872, 328]], 22269: [[136, 488]],
  22270: [[744, 616]], 22424: [[488, 296]], 22428: [[552, 200]], 23094: [[424, 40]], 23261: [[744, 392]], 23761: [[328, 360]],
};

const CELLS: Record<number, CellOverride> = {
  // Zentsuji: the 14th Brigade HQ (第十四旅団司令部) sits on the garrison; the HQ annotation duplicates it.
  // One large garrison (as the brigade garrisons of Hokkaido / Chugoku).
  21098: { dropPois: ['陸上自衛隊第十四旅団司令部', '陸上自衛隊善通寺駐屯地'], addPois: [gsdf('善通寺駐屯地', 546, 253, 3)] },
  // Komatsushima air station: annotated as 「海上自衛隊第２４航空隊」 (no 基地 in the name, not classified).
  21440: { addPois: [msdf('小松島航空基地', 205, 664)] },
  // Tokushima air station (Matsushige, shared with Tokushima airport): annotated as 「海上自衛隊教育航空群」.
  // The runway and the terminal are in the sea cell to the east (21273, no area); the airport point on the edge.
  21272: { addPois: [msdf('徳島航空基地', 933, 245), { kind: POI.airport, grade: 0, x: 1016, z: 220, name: '徳島空港' }] },
};

/** Every prefectural office is annotated twice at the same point (「県庁」 and 「○○県庁舎」): one point each (as Kinki, R5). */
const OFFICES: Record<number, CellOverride> = {
  20766: { dropPois: ['香川県庁舎'], renamePois: { 県庁: '香川県庁' } },
  21272: { dropPois: ['徳島県庁舎'], renamePois: { 県庁: '徳島県庁' } },
  21757: { dropPois: ['愛媛県庁舎'], renamePois: { 県庁: '愛媛県庁' } },
  22265: { dropPois: ['高知県庁舎'], renamePois: { 県庁: '高知県庁' } },
};

const cells: Record<number, CellOverride> = { ...CELLS };
for (const [cell, o] of Object.entries(OFFICES)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, ...o, dropPois: [...(c.dropPois ?? []), ...(o.dropPois ?? [])], addPois: c.addPois };
}
for (const [cell, spots] of Object.entries(TOWERS)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, addPois: [...(c.addPois ?? []), ...spots.map(([x, z]): RealPoi => ({ kind: POI.tower, grade: 20, x, z, name: '物見櫓' }))] };
}

// Dense city centres (Matsuyama, Takamatsu, Kochi, Tokushima): the municipal wide-street grid would pave the
// town over. Same value as every other region: Shikoku meets Chugoku (Seto Ohashi, Shimanami) and Kinki
// (Onaruto) across bridges, edge decisions must agree.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
