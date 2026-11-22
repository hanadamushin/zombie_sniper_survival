// Hand corrections of the real-map data of Kinki (R5). Format: tools/data/real/overrides/types.ts,
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
 * `node tools/real/sightlines.ts kinki --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {
  18601: [[648, 168]], 18942: [[552, 232], [680, 648], [872, 424]], 18943: [[744, 72]], 19110: [[712, 456], [168, 680]],
  19280: [[712, 712]], 19286: [[136, 424], [200, 616]], 19601: [[360, 712]], 19608: [[680, 296]], 19787: [[328, 616], [552, 328], [648, 648]],
  19951: [[648, 328]], 20115: [[616, 680]], 20286: [[296, 488]], 20784: [[296, 488]], 20944: [[744, 520]], 21107: [[296, 520]],
  21117: [[168, 584]], 21616: [[488, 232]], 21617: [[744, 520]], 21779: [[712, 712]], 21950: [[712, 392]], 21951: [[424, 328]],
};

const CELLS: Record<number, CellOverride> = {
  // Itami: the Middle Army HQ (中部方面総監部) sits on the Itami garrison and the 3rd Division HQ on the Senzo
  // garrison; the HQ annotations duplicate them. Both garrisons large (as Asaka / Nerima / Moriyama).
  19944: {
    dropPois: ['陸上自衛隊中部方面総監部', '陸上自衛隊第三師団司令部', '陸上自衛隊伊丹駐屯地', '陸上自衛隊千僧駐屯地'],
    addPois: [gsdf('伊丹駐屯地', 208.6, 841.6, 3), gsdf('千僧駐屯地', 175.6, 968.4, 3)],
  },
  // Imazu: the compound fits nowhere within 160 m of the annotation (the town's roads, the lake shore); with the
  // annotation 200 m west it is built 2.2 km (real) west of the garrison, inside the real Aibano training area.
  18947: { dropPois: ['陸上自衛隊今津駐屯地'], addPois: [gsdf('今津駐屯地', 527, 198)] },
  // Training areas (open ground, not garrisons): 饗庭野 (19107), 青野ヶ原, 大阪府の演習場 (19943), 長池, 白山 (20120).
  19107: { dropPois: ['演習場'] },
  19772: { dropPois: ['演習場'] },
  19943: { dropPois: ['演習場'] },
  19947: { dropPois: ['演習場'] },
  20120: { dropPois: ['演習場'] },
  // Maizuru: the naval air station (舞鶴航空基地, annotated 舞鶴飛行場) north-east of the district HQ.
  18774: { addPois: [msdf('舞鶴航空基地', 956.6, 178.1)] },
  // Hanshin base (阪神基地隊, Kobe Higashinada), outside the town tiles the converter reads.
  20110: { addPois: [msdf('阪神基地隊', 133.7, 902.1)] },
  // Radar sites on the mountains / capes, outside the town tiles.
  18272: { addPois: [asdf('経ヶ岬分屯基地', 295.8, 108.5)] },
  20119: { addPois: [asdf('笠取山分屯基地', 285.8, 719)] },
  // Kushimoto radar site: 23 m into the sea cell 22453; put on the east edge of the land cell west of it.
  22452: { addPois: [asdf('串本分屯基地', 1000, 601.9)] },
};

/**
 * Every prefectural office is annotated twice at the same point (「県庁」/「府庁」 and 「○○県庁舎」), and two ward
 * offices share their city hall's building: one point each (the short name made the full one).
 */
const OFFICES: Record<number, CellOverride> = {
  19613: { dropPois: ['京都府庁舎'], renamePois: { 府庁: '京都府庁' } },
  19614: { dropPois: ['滋賀県庁舎'], renamePois: { 県庁: '滋賀県庁' } },
  20121: { dropPois: ['三重県庁舎'], renamePois: { 県庁: '三重県庁' } },
  20276: { dropPois: ['兵庫県庁舎', '神戸市中央区役所'], renamePois: { 県庁: '兵庫県庁' } },
  20279: { dropPois: ['大阪府庁舎'], renamePois: { 府庁: '大阪府庁' } },
  20282: { dropPois: ['奈良県庁舎'], renamePois: { 県庁: '奈良県庁' } },
  20445: { dropPois: ['堺市堺区役所'] },
  21111: { dropPois: ['和歌山県庁舎'], renamePois: { 県庁: '和歌山県庁' } },
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

// Dense cities (Osaka, Kobe, Kyoto, Sakai): the municipal wide-street grid would pave the town over. Same
// value as Hokkaido / Tohoku / Kanto / Chubu: Kinki borders Chubu by land, edge decisions must agree.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
