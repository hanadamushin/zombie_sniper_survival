// The eight regions of the real-map work (R1..R8). Okinawa belongs to kyushu.
export const REGIONS = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu'] as const;
export type RegionKey = (typeof REGIONS)[number];

/** Region index (0..7, same as StaticGrid.regionNames) of a prefecture code 1..47. */
export function regionOfPref(pref: number): number {
  if (pref <= 1) return 0;
  if (pref <= 7) return 1;
  if (pref <= 14) return 2;
  if (pref <= 23) return 3;
  if (pref <= 30) return 4;
  if (pref <= 35) return 5;
  if (pref <= 39) return 6;
  return 7;
}

/** Prefecture capitals (県庁所在地) by prefecture code, as municipality names in N03. */
export const PREF_CAPITALS: string[] = ['', '札幌市', '青森市', '盛岡市', '仙台市', '秋田市', '山形市', '福島市', '水戸市', '宇都宮市', '前橋市',
  'さいたま市', '千葉市', '新宿区', '横浜市', '新潟市', '富山市', '金沢市', '福井市', '甲府市', '長野市', '岐阜市', '静岡市', '名古屋市',
  '津市', '大津市', '京都市', '大阪市', '神戸市', '奈良市', '和歌山市', '鳥取市', '松江市', '岡山市', '広島市', '山口市', '徳島市',
  '高松市', '松山市', '高知市', '福岡市', '佐賀市', '長崎市', '熊本市', '大分市', '宮崎市', '鹿児島市', '那覇市'];
