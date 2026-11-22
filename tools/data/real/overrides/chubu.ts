// Hand corrections of the real-map data of Chubu (R4). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (some looked up outside the "town tiles" the converter reads).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

const gsdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.gsdf, grade, x, z, name: `陸上自衛隊${name}` });
const asdf = (name: string, x: number, z: number, grade = 1): RealPoi => ({ kind: POI.asdf, grade, x, z, name: `航空自衛隊${name}` });
const msdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.msdf, grade, x, z, name: `海上自衛隊${name}` });
/** A garrison annotation replaced by one at (x, z): moved in from the area's edge so that the 180 × 100 m compound fits, or made large (grade 3). */
const moveGsdf = (name: string, x: number, z: number, grade = 2, drop: string[] = []): CellOverride => ({
  dropPois: [`陸上自衛隊${name}`, ...drop],
  addPois: [gsdf(name, x, z, grade)],
});

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than 3 firing positions seeing 300 m. Spots chosen by
 * `node tools/real/sightlines.ts chubu --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {};

const CELLS: Record<number, CellOverride> = {
  // The 10th Division HQ on the Moriyama garrison (Nagoya): one large garrison. The HQ annotation duplicates it.
  19290: moveGsdf('守山駐屯地', 198.2, 408.9, 3, ['第十師団司令部']),
  // Training areas (東富士・金沢・豊川): open ground, not garrisons.
  16782: { dropPois: ['演習場'] },
  18973: { dropPois: ['演習場'] },
  19139: { dropPois: ['演習場'] },
  19962: { dropPois: ['演習場'] },
  // Higashi-Fuji training area (dropped) and the Takigahara garrison 18 m from the north edge: moved in.
  19140: { ...moveGsdf('滝ヶ原駐屯地', 461, 70), dropPois: ['演習場', '陸上自衛隊滝ヶ原駐屯地'] },
  // Toyama garrison (Tonami) 6 m from the east edge: moved in.
  16617: moveGsdf('富山駐屯地', 930, 380.7),
  // Sites outside the town tiles the converter reads (GSI z14 annotations looked up by name).
  14134: { addPois: [gsdf('新発田駐屯地', 501.5, 834.2)] },
  15794: { addPois: [gsdf('高田駐屯地', 923.7, 263)] },
  13958: { addPois: [asdf('佐渡分屯基地', 710.1, 485.7)] },
  14132: { addPois: [asdf('新潟分屯基地', 553.5, 863.8), msdf('新潟基地分遣隊', 203.5, 978.6)] },
  // Omaezaki radar site: on the cape's tip in a sea cell (20470, 0.3 km south of its north edge); put on the
  // south edge of the land cell north of it.
  20303: { addPois: [asdf('御前崎分屯基地', 519.2, 990)] },
};

const cells: Record<number, CellOverride> = { ...CELLS };
for (const [cell, spots] of Object.entries(TOWERS)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, addPois: [...(c.addPois ?? []), ...spots.map(([x, z]): RealPoi => ({ kind: POI.tower, grade: 20, x, z, name: '物見櫓' }))] };
}

// Dense cities (Nagoya, Niigata, Shizuoka, Hamamatsu): the municipal wide-street grid would pave the town
// over. Same value as Hokkaido / Tohoku / Kanto: Chubu borders Tohoku and Kanto by land, edge decisions must agree.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
