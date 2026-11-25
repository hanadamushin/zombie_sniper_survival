// Landmarks of the kanto region (L3a Tokyo; L3b the other prefectures). One line per landmark: its
// building type, real position and the side its front faces (types.ts). Building types:
// src/gen/buildings/defs/landmark/kanto/, listed in src/gen/buildings/catalog/landmark_kanto.ts; names
// in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_KANTO: readonly LandmarkSpot[] = [
  // --- L3a Tokyo ---
  // Cell 18480 (Marunouchi, Kasumigaseki, Shiba, the harbour): the station before the palace, the
  // Diet, the tower; the Rainbow Bridge from the Shibaura shore to Daiba (L9: along the area's own road).
  { id: 'landmark.tokyo_station', lat: 35.68124, lon: 139.76712, rot: 3, cutRoads: true },
  { id: 'landmark.kokyo_nijubashi', lat: 35.6802, lon: 139.7504, rot: 1, drain: 0.3, cutRoads: true },
  { id: 'landmark.national_diet', lat: 35.67594, lon: 139.74485, rot: 1, cutRoads: true },
  { id: 'landmark.tokyo_tower', lat: 35.65858, lon: 139.74543, rot: 0, cutRoads: true },
  { id: 'landmark.rainbow_bridge', lat: 35.63633, lon: 139.76407, rot: 0, bridge: { path: [[35.63818, 139.75854], [35.63510, 139.76830], [35.63493, 139.77057], [35.63625, 139.77459], [35.63633, 139.77806], [35.63572, 139.78001]], ends: [0.8, 0.9] } },
  // Cell 18313 (Hongō, Kōrakuen, Kudan, Asakusa, Oshiage).
  { id: 'landmark.tokyo_skytree', lat: 35.71006, lon: 139.8107, rot: 0 },
  { id: 'landmark.sensoji', lat: 35.7127, lon: 139.7966, rot: 0 },
  { id: 'landmark.yasuda_auditorium', lat: 35.71336, lon: 139.76223, rot: 3 },
  { id: 'landmark.akamon', lat: 35.70924, lon: 139.7601, rot: 3 },
  { id: 'landmark.nippon_budokan', lat: 35.69331, lon: 139.74993, rot: 0, drain: 0.2, cutRoads: true },
  { id: 'landmark.tokyo_dome', lat: 35.70564, lon: 139.7519, rot: 0, cutRoads: true },
  // Cell 18312 (Nishi-Shinjuku): the twin towers face east.
  { id: 'landmark.tokyo_metropolitan_government', lat: 35.68959, lon: 139.69171, rot: 1 },
  // Cell 18479 (Yoyogi): the great torii in the shrine's forest, the approach from the south.
  { id: 'landmark.meiji_jingu_otorii', lat: 35.6731, lon: 139.6989, rot: 0 },
  // --- L3b (the other prefectures of Kanto) below ---
  // Kanagawa. Cell 18813 (Minato Mirai, Shinkō, Yamashita): the tower first, then the warehouses,
  // the wheel between them, the Marine Tower by Yamashita Park.
  { id: 'landmark.yokohama_landmark_tower', lat: 35.45472, lon: 139.63139, rot: 1, drain: 0.25 },
  { id: 'landmark.yokohama_akarenga', lat: 35.4527, lon: 139.6425, rot: 0, drain: 1 },
  { id: 'landmark.cosmo_clock', lat: 35.4555, lon: 139.6375, rot: 0, drain: 1 },
  { id: 'landmark.yokohama_marine_tower', lat: 35.44396, lon: 139.65083, rot: 2 },
  // Cell 19146 (Hase, Kamakura): the Great Buddha faces south.
  { id: 'landmark.kamakura_daibutsu', lat: 35.31667, lon: 139.53583, rot: 0, poi: '高徳院', level: 10 },
  // Chiba: the port tower in its park (cell 18483), the pagoda before Naritasan's great hall (18151),
  // the nameless theme park ruin on the Maihama shore (18481).
  { id: 'landmark.chiba_port_tower', lat: 35.6025, lon: 140.0952, rot: 0 },
  { id: 'landmark.naritasan', lat: 35.7856, lon: 140.3184, rot: 0, poi: '新勝寺' },
  { id: 'landmark.bay_theme_park', lat: 35.6329, lon: 139.8804, rot: 0, drain: 1 },
  // Saitama: Kawagoe's storehouse street and the Bell of Time (17976), the arena by Saitama-Shintoshin
  // station (17978, its glass front east to the station).
  { id: 'landmark.kawagoe', lat: 35.9192, lon: 139.4828, rot: 0 },
  { id: 'landmark.saitama_super_arena', lat: 35.8949, lon: 139.6311, rot: 1 },
  // Ibaraki: Ushiku Daibutsu (17816). Tochigi: the Yōmeimon of Nikkō Tōshō-gū (16474). Gunma: the
  // Tomioka Silk Mill, its warehouse arch facing the gate (east) (17303).
  { id: 'landmark.ushiku_daibutsu', lat: 35.9798, lon: 140.2196, rot: 0 },
  { id: 'landmark.nikko_yomeimon', lat: 36.758, lon: 139.5988, rot: 0, poi: '東照宮', level: 12 },
  { id: 'landmark.tomioka_silk_mill', lat: 36.2551, lon: 138.8879, rot: 1 },
];
