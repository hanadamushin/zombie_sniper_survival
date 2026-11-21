// Hand corrections of the real-map data of Hokkaido (R1). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (looked up outside the "town tiles" the converter reads).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

const gsdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.gsdf, grade, x, z, name: `陸上自衛隊${name}` });
const asdf = (name: string, x: number, z: number): RealPoi => ({ kind: POI.asdf, grade: 1, x, z, name: `航空自衛隊${name}` });
/** Training areas (演習場) are open ground, not garrisons: no compound, not counted as SDF sites. */
const noRange = { dropPois: ['演習場'] };

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than
 * 3 firing positions seeing 300 m (rolling hills under forest). Spots chosen by
 * `node tools/real/sightlines.ts hokkaido --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {
  464: [[360, 360], [584, 328], [200, 424]], 632: [[712, 328]], 795: [[712, 424]], 798: [[360, 360], [168, 680]],
  800: [[712, 424], [488, 328]], 965: [[648, 392]], 967: [[648, 232], [328, 264]], 968: [[424, 328], [712, 616], [296, 584]],
  1300: [[520, 264]], 1470: [[680, 296]], 1640: [[328, 456], [488, 712], [296, 680]], 1799: [[968, 136], [552, 328]],
  1966: [[360, 328]], 1967: [[392, 328]], 1969: [[552, 72], [680, 360]], 1974: [[680, 584]],
  1976: [[616, 680], [328, 552]], 2136: [[360, 392]], 2142: [[616, 264], [424, 328]], 2300: [[264, 424]],
  2301: [[296, 296], [392, 648]], 2302: [[488, 328]], 2309: [[232, 648]], 2475: [[296, 456], [328, 40]],
  2632: [[520, 296]], 2649: [[680, 296]], 2807: [[488, 712]], 2972: [[712, 392]],
  2976: [[648, 360], [392, 104]], 2984: [[328, 488]], 2985: [[264, 328]], 2989: [[296, 520]],
  2998: [[584, 328]], 3133: [[424, 232]], 3156: [[328, 392], [680, 424]], 3162: [[584, 296]],
  3164: [[680, 360]], 3311: [[296, 712]], 3315: [[616, 328]], 3329: [[40, 616]],
  3330: [[648, 296], [456, 712]], 3468: [[328, 712]], 3476: [[456, 296]], 3478: [[680, 392]],
  3488: [[712, 712], [744, 296]], 3492: [[392, 680], [680, 360], [296, 424]], 3495: [[680, 712], [584, 328], [424, 744]], 3633: [[328, 680]],
  3639: [[232, 552]], 3642: [[296, 392], [712, 232], [488, 712]], 3652: [[808, 456], [520, 264]], 3657: [[712, 392], [520, 232]],
  3661: [[328, 264]], 3800: [[744, 296], [744, 616]], 3818: [[328, 424]], 3823: [[520, 104]],
  3974: [[424, 680]], 3976: [[360, 328], [328, 616]], 3979: [[424, 680], [712, 488]], 3985: [[488, 296], [680, 680], [392, 744]],
  4136: [[520, 296], [744, 552]], 4139: [[648, 648]], 4152: [[328, 616], [648, 712], [328, 456]], 4155: [[776, 424], [584, 296]],
  4292: [[616, 296]], 4310: [[328, 424]], 4312: [[264, 392], [616, 328], [552, 712]], 4314: [[328, 328]],
  4472: [[680, 392]], 4487: [[424, 232]], 4488: [[360, 392], [584, 168]], 4489: [[360, 648], [392, 776]],
  4492: [[680, 584]], 4633: [[40, 328]], 4648: [[712, 328]], 4660: [[680, 712]],
  4662: [[680, 424], [904, 328]], 4796: [[712, 904]], 4801: [[712, 168]], 4802: [[616, 328], [680, 584]],
  4818: [[424, 232]], 4961: [[328, 456], [552, 328]], 4972: [[392, 680]], 4975: [[264, 616]],
  4976: [[360, 296]], 4985: [[296, 456]], 4996: [[680, 360]], 5126: [[360, 264], [776, 712], [328, 488]],
  5128: [[360, 712], [680, 648]], 5129: [[328, 360], [392, 680]], 5140: [[776, 552]], 5143: [[776, 616]],
  5153: [[520, 328]], 5156: [[392, 840]], 5291: [[712, 328]], 5292: [[296, 456], [520, 136]],
  5295: [[616, 232], [264, 488]], 5319: [[360, 648]], 5455: [[712, 488]], 5456: [[776, 328], [392, 360], [872, 456]],
  5457: [[136, 648]], 5465: [[648, 264]], 5468: [[616, 360]], 5469: [[552, 328], [360, 360]],
  5483: [[680, 136]], 5641: [[360, 680], [264, 424]], 5789: [[264, 648], [712, 424]], 5790: [[424, 680]],
  5791: [[680, 168]], 5819: [[648, 40], [712, 392]], 5958: [[40, 552]], 6123: [[328, 264]],
  6125: [[776, 584]], 6294: [[360, 392], [296, 616]], 6315: [[616, 712]], 6453: [[392, 680]],
  6626: [[328, 360]], 6630: [[680, 360]], 6631: [[360, 616], [328, 296]], 6962: [[712, 360], [520, 296], [808, 616]],
  6963: [[680, 712]], 7129: [[264, 296], [328, 552]], 7130: [[264, 392]], 7133: [[936, 488]],
  7296: [[392, 296]], 7463: [[584, 264]], 7629: [[424, 264], [328, 488], [968, 424]], 7630: [[392, 360], [200, 552], [360, 360], [552, 40], [40, 136]],
};

const CELLS: Record<number, CellOverride> = {
  // Sapporo centre. The TV tower at the east end of Ōdōri Park (43.0611 N, 141.3564 E), a landmark (the
  // generator stands it on the nearest free ground: 20 m south-east, off the crossing roads).
  // The HQ annotations (北部方面総監部, 第十一旅団司令部) sit on their garrisons: one large garrison each.
  4800: {
    addPois: [
      { kind: POI.tower, grade: 0, x: 810, z: 173, name: 'さっぽろテレビ塔' },
      gsdf('札幌駐屯地', 723, 588, 3),
      gsdf('真駒内駐屯地', 832, 801, 3),
    ],
    dropPois: ['北部方面総監部', '第十一旅団司令部', '陸上自衛隊札幌駐屯地', '陸上自衛隊真駒内駐屯地', '北海道庁舎'],
    renamePois: { 道庁: '北海道庁' },
  },
  // Asahikawa: 第2師団 at the garrison (moved 43 m in from the north edge so that the compound fits).
  3473: { dropPois: ['第二師団司令部', '陸上自衛隊旭川駐屯地'], addPois: [gsdf('旭川駐屯地', 905, 70, 3)] },
  // Chitose: 第7師団 at Higashi-Chitose (moved in from the east edge); the ranges dropped.
  5137: { dropPois: ['第七師団司令部', '陸上自衛隊東千歳駐屯地', '演習場'], addPois: [gsdf('東千歳駐屯地', 915, 703, 3)] },
  // Obihiro: 第5旅団 is at the Obihiro garrison, whose annotation lies on the edge with 5151.
  4984: { dropPois: ['第五旅団司令部'] },
  5151: { dropPois: ['陸上自衛隊帯広駐屯地'], addPois: [gsdf('帯広駐屯地', 110, 60, 3)] },
  // Garrisons and air-defence radar sites whose annotations are outside the town tiles.
  5138: { ...noRange, addPois: [gsdf('安平駐屯地', 906, 928)] },
  4648: { addPois: [gsdf('鹿追駐屯地', 610, 230)] },
  6146: { addPois: [gsdf('静内駐屯地', 556, 522)] },
  4301: { addPois: [asdf('当別分屯基地', 316, 406)] },
  6453: { addPois: [asdf('奥尻島分屯基地', 596, 174)] },
  2822: { addPois: [asdf('網走分屯基地', 691, 896)] },
  4804: { addPois: [asdf('長沼分屯基地', 253, 855)] },
  4461: { addPois: [{ kind: POI.msdf, grade: 2, x: 586, z: 473, name: '海上自衛隊余市防備隊' }] },
  // Hakodate: Goryōkaku Tower beside the star fort (41.7942 N, 140.7538 E), a landmark (the shrunk point is
  // on the roads by the moat: it stands on the nearest free ground, 25 m south-east, south of the moat).
  7133: { addPois: [{ kind: POI.tower, grade: 0, x: 372, z: 231, name: '五稜郭タワー' }] },
  // Training areas elsewhere (鬼志別, 遠軽, 留萌, 滝川, 上富良野, 矢臼別, 然別, 銭函, 島松, 千歳・恵庭, 東千歳, 駒ヶ岳).
  465: noRange, 2983: noRange, 3133: noRange, 3804: noRange, 4143: noRange, 4330: noRange, 4331: noRange, 4332: noRange,
  4481: noRange, 4482: noRange, 4499: noRange, 4631: noRange, 5135: noRange, 5136: noRange, 6632: noRange,
};

const cells: Record<number, CellOverride> = { ...CELLS };
for (const [cell, spots] of Object.entries(TOWERS)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, addPois: [...(c.addPois ?? []), ...spots.map(([x, z]): RealPoi => ({ kind: POI.tower, grade: 20, x, z, name: '物見櫓' }))] };
}

// Dense cities (Sapporo, Asahikawa, Hakodate...): the municipal wide-street grid would pave the town over.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
