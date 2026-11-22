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
const TOWERS: Record<number, [number, number][]> = {
  13302: [[968, 488]], 13625: [[200, 648]], 13636: [[872, 552]], 13792: [[552, 840], [712, 264], [296, 744]],
  13970: [[712, 328]], 14302: [[296, 232], [296, 456]], 14466: [[328, 456], [392, 232]], 14634: [[392, 648]],
  14799: [[616, 360]], 14803: [[360, 712]], 14804: [[712, 488]], 14968: [[616, 712]], 15116: [[680, 872]],
  15282: [[712, 648]], 15284: [[552, 328], [712, 648]], 15448: [[520, 712]], 15615: [[680, 328]],
  15631: [[712, 616]], 15792: [[648, 296]], 15793: [[584, 296]], 15795: [[328, 520]], 15798: [[232, 392]],
  15964: [[712, 776]], 15965: [[712, 520]], 16618: [[392, 776], [456, 136], [328, 360]], 17280: [[552, 296]],
  17289: [[392, 328]], 17451: [[712, 648]], 17460: [[712, 360]], 17465: [[456, 328], [392, 712]],
  17467: [[584, 328]], 17778: [[328, 616]], 17787: [[360, 264]], 17945: [[584, 72]], 17963: [[360, 360], [360, 648]],
  17965: [[648, 392], [584, 712], [264, 456]], 18117: [[424, 264]], 18131: [[296, 424]], 18280: [[616, 40]],
  18289: [[424, 168]], 18295: [[584, 744]], 18296: [[328, 520]], 18298: [[584, 680]], 18449: [[488, 328]],
  18454: [[168, 616]], 18455: [[456, 72]], 18459: [[680, 360]], 18463: [[584, 264], [776, 712]], 18613: [[168, 648]],
  18620: [[328, 776]], 18626: [[712, 552]], 18632: [[296, 552]], 18634: [[456, 200]], 18779: [[552, 200]],
  18785: [[744, 488]], 18800: [[360, 680], [488, 264]], 18960: [[328, 296]], 18968: [[200, 584], [360, 872]],
  18973: [[744, 648]], 19302: [[488, 264]], 19306: [[296, 488]], 19460: [[712, 552]],
  19462: [[648, 296], [392, 648]], 19463: [[328, 392]], 19643: [[616, 968], [392, 200]], 19958: [[616, 712]],
  19968: [[744, 712]], 20293: [[392, 680]],
};

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
  // Sado radar site (航空自衛隊佐渡分屯基地) on the mountain, outside the town tiles the converter reads.
  13958: { addPois: [asdf('佐渡分屯基地', 710.1, 485.7)] },
  // Training area (大日原, Takada): open ground.
  14468: { dropPois: ['演習場'] },
  // Kita-Fuji garrison 4 m from the west edge and Toyokawa 22 m from the east edge: moved in.
  18806: moveGsdf('北富士駐屯地', 95, 611.2),
  19961: moveGsdf('豊川駐屯地', 920, 491.1),
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
