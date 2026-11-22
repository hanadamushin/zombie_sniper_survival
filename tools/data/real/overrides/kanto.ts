// Hand corrections of the real-map data of Kanto (R3). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10);
// SDF positions are the GSI z14 annotations (some looked up outside the "town tiles" the converter reads).
import { POI, type RealPoi } from '../../../../src/gen/real/format.ts';
import type { CellOverride, RegionOverrides } from './types.ts';

const gsdf = (name: string, x: number, z: number, grade = 2): RealPoi => ({ kind: POI.gsdf, grade, x, z, name: `陸上自衛隊${name}` });
const asdf = (name: string, x: number, z: number, grade = 1): RealPoi => ({ kind: POI.asdf, grade, x, z, name: `航空自衛隊${name}` });
/** A garrison annotation replaced by one at (x, z): moved in from the area's edge so that the 180 × 100 m compound fits, or made large (grade 3). */
const moveGsdf = (name: string, x: number, z: number, grade = 2, drop: string[] = []): CellOverride => ({
  dropPois: [`陸上自衛隊${name}`, ...drop],
  addPois: [gsdf(name, x, z, grade)],
});

/**
 * Lookout towers (物見櫓, POI.tower: gen/real/layout.ts builds a tower, its deck at the grade: 20 m, over the
 * canopy) where the area has fewer than 3 firing positions seeing 300 m. Spots chosen by
 * `node tools/real/sightlines.ts kanto --suggest` (free dry ground, most clear 300 m directions).
 */
const TOWERS: Record<number, [number, number][]> = {
  16815: [[584, 296]], 16817: [[520, 712], [776, 648]], 16968: [[712, 584], [424, 680]], 16978: [[616, 712]],
  17303: [[328, 456]], 17803: [[552, 744]], 17805: [[680, 168]], 17816: [[712, 392]], 18147: [[684, 436]],
  18154: [[328, 296]], 18321: [[648, 392], [264, 456]], 18641: [[552, 328]], 18645: [[200, 936]], 18647: [[648, 328]],
  18985: [[648, 328], [328, 584]], 20147: [[488, 328], [520, 744]], 21317: [[328, 392], [584, 680], [72, 392]],
  // R9: northern Tochigi / Gunma read their land use (forest, not beach) after the rebuild.
  15810: [[680, 232], [776, 424], [424, 744]], 15979: [[424, 296]], 16136: [[712, 680]], 16147: [[264, 584]], 19309: [[680, 584]],
};

const CELLS: Record<number, CellOverride> = {
  // Army HQs on their garrisons: one large garrison each (東部方面総監部 at Asaka, 第1師団 at Nerima,
  // 第12旅団 at Sōmagahara). The HQ annotations duplicate the garrison.
  // Asaka: two annotations of the garrison and the HQ on the south-east corner of 18144 (Nerima / Asaka /
  // Wakō / Niiza): one garrison, moved 50 m in so that the compound fits inside the area.
  18144: moveGsdf('朝霞駐屯地', 920, 930, 3, ['東部方面総監部']),
  18312: moveGsdf('練馬駐屯地', 517.5, 139.5, 3, ['第一師団司令部']),
  16970: moveGsdf('相馬原駐屯地', 280, 703, 3, ['第十二旅団司令部', '演習場']),
  // Training areas (習志野, the one annotated only 「陸上自衛隊演習場」): open ground, not garrisons.
  18316: { dropPois: ['演習場'] },
  16984: { dropPois: ['演習場'] },
  // Annotated without the garrison's name (新町駐屯地, Takasaki).
  17305: { renamePois: { 陸上自衛隊駐屯地: '陸上自衛隊新町駐屯地' } },
  // The ASDF site in the Takeyama garrison area (武山分屯基地), annotated 「航空自衛隊レーダー基地」.
  19314: { renamePois: { 航空自衛隊レーダー基地: '航空自衛隊武山分屯基地' } },
  // Sites the GSI map annotates under another name (z14): Ichigaya (the Ministry of Defense, 「防衛省」),
  // Mishuku (自衛隊中央病院), Zama (in 「米軍座間キャンプ」), the ASDF Air Defense Command at Yokota
  // (「航空自衛隊航空総隊」), the radar site on Mt. Mineoka outside the town tiles.
  18313: { addPois: [gsdf('市ヶ谷駐屯地', 136, 930)] },
  18479: { addPois: [gsdf('三宿駐屯地', 753, 459.5)] },
  18811: { addPois: [gsdf('座間駐屯地', 144, 60)] },
  18309: { addPois: [asdf('横田基地', 704.5, 380.5, 2)] },
  19484: { addPois: [asdf('峯岡山分屯基地', 460.5, 334.5)] },
};

const cells: Record<number, CellOverride> = { ...CELLS };
for (const [cell, spots] of Object.entries(TOWERS)) {
  const c = cells[Number(cell)] ?? {};
  cells[Number(cell)] = { ...c, addPois: [...(c.addPois ?? []), ...spots.map(([x, z]): RealPoi => ({ kind: POI.tower, grade: 20, x, z, name: '物見櫓' }))] };
}

// Dense cities (Tokyo, Yokohama...): the municipal wide-street grid would pave the town over. Same
// value as Hokkaido / Tohoku: Kanto borders Tohoku and Chubu by land, the edge decisions must agree.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
