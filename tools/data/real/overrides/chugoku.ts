// Hand corrections of the real-map data of Chugoku (R6). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (some looked up outside the "town tiles" the converter reads).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

const gsdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.gsdf, grade, x, z, name: `陸上自衛隊${name}` });
const msdf = (name: string, x: number, z: number, grade = 1): RealPoi => ({ kind: POI.msdf, grade, x, z, name: `海上自衛隊${name}` });
const asdf = (name: string, x: number, z: number, grade = 1): RealPoi => ({ kind: POI.asdf, grade, x, z, name: `航空自衛隊${name}` });

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than 3 firing positions seeing 300 m. Spots chosen by
 * `node tools/real/sightlines.ts chugoku --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {
  17252: [[712, 520]], 18926: [[712, 712], [552, 296]], 19086: [[840, 392]], 19253: [[680, 360]], 19259: [[776, 584]],
  19424: [[328, 424]], 19433: [[424, 712]], 19752: [[712, 680]], 20081: [[328, 264], [520, 328]], 20412: [[520, 232], [840, 392]],
  20583: [[840, 680], [712, 264]], 20742: [[552, 168]], 20906: [[712, 744]], 21073: [[72, 648]], 21242: [[680, 616]],
};

const CELLS: Record<number, CellOverride> = {
  // Kaitaichi: the 13th Brigade HQ (第十三旅団司令部) sits on the garrison; the HQ annotation duplicates it.
  // One large garrison (as the brigade garrisons of Hokkaido / Kanto).
  20753: { dropPois: ['陸上自衛隊第十三旅団司令部', '陸上自衛隊海田市駐屯地'], addPois: [gsdf('海田市駐屯地', 311.9, 731, 3)] },
  // Training areas (open ground, not garrisons): 日光 (Daisen), 日本原, むつみ, 山口.
  18925: { dropPois: ['演習場'] },
  19431: { dropPois: ['演習場'] },
  20577: { dropPois: ['演習場'] },
  21077: { dropPois: ['演習場'] },
  // Takaosan radar site (Mihonoseki, the east tip of the Shimane peninsula), outside the town tiles.
  18588: { addPois: [asdf('高尾山分屯基地', 573, 513)] },
  // Etajima: the 1st Service School (第1術科学校, the old naval academy) is not annotated by name at z14;
  // placed from the MOD drone-restriction map (about 34°14.5'N 132°28'E) on the north edge of the cell.
  21086: { addPois: [msdf('第1術科学校', 748, 21)] },
};

/**
 * Every prefectural office is annotated twice at the same point (「県庁」 and 「○○県庁舎」), and the central ward
 * offices of Hiroshima / Okayama share their city hall's building: one point each (as Kinki, R5).
 */
const OFFICES: Record<number, CellOverride> = {
  18753: { dropPois: ['島根県庁舎'], renamePois: { 県庁: '島根県庁' } },
  18764: { dropPois: ['鳥取県庁舎'], renamePois: { 県庁: '鳥取県庁' } },
  20264: { dropPois: ['岡山県庁舎', '岡山市北区役所'], renamePois: { 県庁: '岡山県庁' } },
  20752: { dropPois: ['広島県庁舎', '広島市中区役所'], renamePois: { 県庁: '広島県庁' } },
  21077: { dropPois: ['山口県庁舎'], renamePois: { 県庁: '山口県庁' } },
};

const cells: Record<number, CellOverride> = { ...CELLS };
for (const [cell, o] of Object.entries(OFFICES)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, ...o, dropPois: [...(c.dropPois ?? []), ...(o.dropPois ?? [])] };
}
for (const [cell, spots] of Object.entries(TOWERS)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, addPois: [...(c.addPois ?? []), ...spots.map(([x, z]): RealPoi => ({ kind: POI.tower, grade: 20, x, z, name: '物見櫓' }))] };
}

// Dense cities (Hiroshima, Okayama): the municipal wide-street grid would pave the town over. Same value as
// Kinki (and Hokkaido .. Chubu): Chugoku borders Kinki by land, edge decisions must agree.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
