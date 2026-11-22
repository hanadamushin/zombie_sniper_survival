// Hand corrections of the real-map data of Tohoku (R2). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (some looked up outside the "town tiles" the converter reads).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

const gsdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.gsdf, grade, x, z, name: `陸上自衛隊${name}` });
const asdf = (name: string, x: number, z: number): RealPoi => ({ kind: POI.asdf, grade: 1, x, z, name: `航空自衛隊${name}` });
/** Training areas (演習場) are open ground, not garrisons: no compound, not counted as SDF sites. */
const noRange = { dropPois: ['演習場'] };
/** A garrison annotation replaced by one at (x, z): moved in from the area's edge so that the 180 × 100 m compound fits, or made large (grade 3). */
const moveGsdf = (name: string, x: number, z: number, grade = 2, drop: string[] = []): CellOverride => ({
  dropPois: [`陸上自衛隊${name}`, ...drop],
  addPois: [gsdf(name, x, z, grade)],
});

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than 3 firing positions seeing 300 m (rolling hills under forest). Spots
 * chosen by `node tools/real/sightlines.ts tohoku --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {
  8633: [[392, 360], [392, 712]], 8634: [[136, 584]], 8640: [[712, 360]], 8801: [[776, 424]], 8805: [[360, 232]],
  8807: [[648, 712], [360, 392]], 9133: [[584, 296]], 9137: [[712, 360]], 9297: [[456, 808], [392, 200]], 9308: [[712, 712], [296, 520]],
  9464: [[200, 200]], 9466: [[296, 328]], 9467: [[328, 232], [840, 488]], 9472: [[328, 456], [424, 232]],
  9633: [[648, 360]], 9637: [[488, 328]], 9643: [[488, 328]], 9645: [[456, 328]], 9814: [[328, 392]],
  9969: [[264, 424]], 9971: [[296, 840], [712, 776]], 9974: [[328, 360]], 9975: [[712, 424]], 10143: [[584, 680], [328, 680]],
  10312: [[584, 136]], 10474: [[520, 328]], 10475: [[680, 328], [648, 648]], 10639: [[680, 392]],
  10642: [[584, 328]], 10647: [[232, 200]], 10814: [[648, 296]], 10971: [[328, 136]],
  11146: [[360, 136], [232, 520]], 11149: [[424, 328]], 11303: [[712, 520]], 11308: [[680, 712]],
  11470: [[456, 328]], 11640: [[488, 264], [264, 488]], 11817: [[296, 168], [808, 680]], 11969: [[552, 296]], 11973: [[360, 392]],
  11978: [[648, 648], [328, 648]], 11979: [[360, 648], [328, 136]], 11984: [[264, 712]], 12136: [[360, 680]], 12145: [[712, 360]], 12147: [[424, 328]],
  12309: [[712, 424]], 12469: [[616, 328]], 12477: [[520, 200]], 12481: [[584, 680]], 12647: [[552, 296]],
  12813: [[584, 328], [232, 584], [552, 712]], 12817: [[424, 712], [456, 936]], 12969: [[360, 200]], 12980: [[488, 328]],
  13141: [[648, 360]], 13142: [[680, 360]], 13144: [[296, 360], [488, 872]], 13315: [[648, 328]],
  14143: [[680, 392]], 14648: [[520, 328]], 14811: [[456, 712]], 15303: [[424, 840]], 15309: [[680, 648]],
  15312: [[680, 584]], 15317: [[648, 392]], 15470: [[872, 616]], 15485: [[680, 616]], 15981: [[296, 296]],
  // R9: after the rebuild with the final shared code.
  14306: [[328, 424], [680, 296]],
  14639: [[456, 328], [776, 712]],
  15304: [[680, 264]],
  15316: [[552, 712]],
  15646: [[680, 712], [744, 296]],
  15816: [[392, 232], [360, 712]],
  15819: [[328, 552]],
  15982: [[616, 264]],
  16149: [[616, 360], [424, 136]],
};

const CELLS: Record<number, CellOverride> = {
  // Army HQs on their garrisons (東北方面総監部 at Sendai, 第9師団 at Aomori, 第6師団 at Jinmachi): one large garrison each.
  13647: moveGsdf('仙台駐屯地', 884, 390.5, 3, ['東北方面総監部']),
  // Aomori: the garrison (浪館) is on the north-east corner of 8969, the compound cannot fit there: on
  // the other side of the edge (8970), where the search (gen/real/layout.ts) finds room in the town.
  8969: { dropPois: ['陸上自衛隊青森駐屯地', '第九師団司令部'] },
  8970: { addPois: [gsdf('青森駐屯地', 40, 126.5, 3)] },
  13309: moveGsdf('神町駐屯地', 154, 878, 3, ['第六師団司令部']),
  // Garrisons whose annotations lie on the area's edge, moved in so that the compound fits.
  9310: { ...moveGsdf('八戸駐屯地', 686.5, 968), dropPois: ['陸上自衛隊八戸駐屯地', '演習場'] },
  14645: moveGsdf('福島駐屯地', 100, 552),
  15312: moveGsdf('郡山駐屯地', 533.5, 56),
  13648: moveGsdf('多賀城駐屯地', 827.5, 56),
  13315: { dropPois: ['陸上自衛隊反町分屯地'], addPois: [gsdf('反町分屯地', 96, 970, 1)] },
  // Ōminato: the district HQ (地方総監部) is on the naval base; the air base (helicopters) is its own site.
  // The ASDF radar site on Mt. Kamafuse (大湊分屯基地) is outside the town tiles.
  8138: { dropPois: ['大湊地方総監部'], addPois: [asdf('大湊分屯基地', 761, 228)] },
  // ASDF radar sites outside the town tiles (z14 annotations).
  8632: { addPois: [asdf('車力分屯基地', 504, 413)] }, // annotated only as 「航空自衛隊」
  10631: { addPois: [asdf('加茂分屯基地', 618, 91)] },
  11319: { addPois: [asdf('山田分屯基地', 371, 299)] },
  // Training areas (岩手山, 秋田 (寺内), 大高根, 王城寺原, 福島 (庭坂)).
  10643: noRange, 10968: noRange, 13141: noRange, 13145: noRange, 14644: noRange,
};

const cells: Record<number, CellOverride> = { ...CELLS };
for (const [cell, spots] of Object.entries(TOWERS)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, addPois: [...(c.addPois ?? []), ...spots.map(([x, z]): RealPoi => ({ kind: POI.tower, grade: 20, x, z, name: '物見櫓' }))] };
}

// Dense cities (Sendai...): the municipal wide-street grid would pave the town over. Same value as
// Hokkaido (R1); Kanto (R3) and Chubu (R4) share land borders with Tohoku and should use it too.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
