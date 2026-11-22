// Hand corrections of the real-map data of Kyushu / Okinawa (R8). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (some looked up outside the "town tiles" the converter reads with
// tools/real/label-search.ts).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

const gsdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.gsdf, grade, x, z, name: `陸上自衛隊${name}` });
const msdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.msdf, grade, x, z, name: `海上自衛隊${name}` });
const asdf = (name: string, x: number, z: number, grade = 1): RealPoi => ({ kind: POI.asdf, grade, x, z, name: `航空自衛隊${name}` });

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than 3 firing positions seeing 300 m. Spots chosen by
 * `node tools/real/sightlines.ts kyushu --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {
  20391: [[232, 840]], 20557: [[872, 808]], 21906: [[328, 584]], 22245: [[264, 488], [680, 616], [488, 712]], 22248: [[680, 264]],
  22409: [[712, 392]], 22576: [[648, 648], [328, 840]], 22577: [[776, 584]], 22579: [[424, 264], [168, 456]],
  22580: [[488, 328]], 22741: [[488, 296]], 22910: [[520, 328]], 23076: [[264, 520]], 23232: [[488, 712]],
  23409: [[712, 424]], 23410: [[328, 360]], 23418: [[936, 904]], 23580: [[680, 584], [360, 648]], 23582: [[296, 232]],
  23583: [[328, 680]], 23585: [[136, 712]], 23745: [[712, 456], [328, 488], [328, 296]], 23751: [[968, 296]],
  24082: [[584, 744], [232, 584]], 24579: [[680, 776]], 24911: [[712, 232]], 25586: [[776, 392]],
  25913: [[712, 648], [424, 712]], 25918: [[424, 296]], 26413: [[712, 744]], 26417: [[488, 328]], 26584: [[328, 392]],
  28082: [[616, 360], [360, 872]], 28417: [[712, 328]], 32911: [[616, 680]], 33743: [[328, 424], [328, 136], [680, 616]],
  34742: [[648, 712]],
};

const CELLS: Record<number, CellOverride> = {
  // Division / army HQs sit on their garrisons; the HQ annotation duplicates it. One large garrison each
  // (as the brigade garrisons of Hokkaido .. Shikoku): Fukuoka (4th Division), Kita-Kumamoto (8th Division),
  // Kengun (Western Army HQ), Naha (15th Brigade).
  22237: { dropPois: ['陸上自衛隊第四師団司令部', '陸上自衛隊福岡駐屯地'], addPois: [gsdf('福岡駐屯地', 637.5, 829, 3)] },
  23576: { dropPois: ['陸上自衛隊第八師団司令部', '陸上自衛隊北熊本駐屯地', '演習場'], addPois: [gsdf('北熊本駐屯地', 104.5, 545, 3)] },
  23743: { dropPois: ['陸上自衛隊西部方面総監部', '陸上自衛隊健軍駐屯地'], addPois: [gsdf('健軍駐屯地', 415.5, 109, 3)] },
  35906: { dropPois: ['陸上自衛隊那覇駐屯地'], addPois: [gsdf('那覇駐屯地', 463.5, 165.5, 3)] },
  // Training areas (open ground, not garrisons): Tosu / Ogori, 高良台, 日出生台, 十文字原, 大野原, 大村, 大矢野原, 霧島, Kokubu (Kirishima city).
  22572: { dropPois: ['演習場'] },
  22739: { dropPois: ['演習場'] },
  22745: { dropPois: ['演習場'] },
  22747: { dropPois: ['演習場'] },
  23235: { dropPois: ['演習場'] },
  23402: { dropPois: ['演習場'] },
  23745: { dropPois: ['演習場'] },
  25079: { dropPois: ['演習場'] },
  25748: { dropPois: ['演習場'] },
  // Sites outside the town tiles (z14 annotations found by name).
  22570: { addPois: [asdf('脊振山分屯基地', 936, 63)] },
  23724: { addPois: [asdf('福江島分屯基地', 528, 463)] },
  26253: { addPois: [asdf('高畑山分屯基地', 539, 58)] },
  33743: { addPois: [asdf('沖永良部島分屯基地', 615, 310)] },
  35407: { addPois: [asdf('恩納分屯基地', 26, 207)] },
  20891: { addPois: [msdf('対馬防備隊', 254, 319)] },
  20224: {
    addPois: [
      msdf('上対馬警備所', 364, 118),
      // 海栗島 (Unishima) is an islet in the sea cell north (20057); on the north edge of this one (~1.4 km off).
      asdf('海栗島分屯基地', 453, 4),
    ],
  },
  // Shimo-Koshiki: the radar site is on the east tip, in the sea cell east (25738); on the east edge here.
  25737: { addPois: [asdf('下甑島分屯基地', 1020, 48)] },
  // Katsuren peninsula (Uruma): the MSDF Okinawa base and the GSDF Katsuren sub-garrison are in the sea cell
  // south (35741); on the south edge of this one (~1.2 km off).
  35574: { addPois: [msdf('沖縄基地隊', 783, 1020), gsdf('勝連分屯地', 610, 1020, 1)] },
  // Not annotated on the GSI map; placed at the GSI place-name annotation of their address (approximate):
  // Ebino garrison (えびの市大字大明司), Amami garrison (奄美市名瀬大熊).
  25080: { addPois: [gsdf('えびの駐屯地', 44, 247)] },
  31748: { addPois: [gsdf('奄美駐屯地', 224, 698)] },
};

/**
 * Every prefectural office is annotated twice at the same point (「県庁」 and 「○○県庁舎」), and Kumamoto's
 * central ward office shares the city hall's building: one point each (as Kinki, R5).
 */
const OFFICES: Record<number, CellOverride> = {
  22237: { dropPois: ['福岡県庁舎'], renamePois: { 県庁: '福岡県庁' } },
  22904: { dropPois: ['佐賀県庁舎'], renamePois: { 県庁: '佐賀県庁' } },
  22916: { dropPois: ['大分県庁舎'], renamePois: { 県庁: '大分県庁' } },
  23575: { dropPois: ['熊本市中央区役所'] },
  23735: { dropPois: ['長崎県庁舎'], renamePois: { 県庁: '長崎県庁' } },
  23743: { dropPois: ['熊本県庁舎'], renamePois: { 県庁: '熊本県庁' } },
  25252: { dropPois: ['宮崎県庁舎'], renamePois: { 県庁: '宮崎県庁' } },
  25912: { dropPois: ['鹿児島県庁舎'], renamePois: { 県庁: '鹿児島県庁' } },
  35906: { dropPois: ['沖縄県庁舎'], renamePois: { 県庁: '沖縄県庁' } },
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

// Dense city centres (Fukuoka, Kitakyushu, Kumamoto, Kagoshima, Naha): the municipal wide-street grid would
// pave the town over. Same value as every other region: Kyushu meets Chugoku by land at the Kanmon strait.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
