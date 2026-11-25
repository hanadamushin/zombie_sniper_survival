// Landmarks of the kinki region (L5). One line per landmark: its building type, real position and the
// side its front faces (types.ts). Building types: src/gen/buildings/defs/landmark/kinki/, listed in
// src/gen/buildings/catalog/landmark_kinki.ts; names in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_KINKI: readonly LandmarkSpot[] = [
  // Osaka. Cell 20279: the castle over the remains of its moats on the Uemachi rise (drain, level), then
  // Abeno Harukas before Tsūtenkaku (in the other order Tsūtenkaku's lot took the ground between the
  // railways and the expressways and Harukas went 140 m off); in the shrunk city centre an expressway or
  // a national road runs every 60–100 m, so the three cut them (cutRoads, as central Tokyo). Harukas
  // stands over Abenobashi station in reality: its lot keeps 80 m north of the tracks (never cut).
  // Tsūtenkaku is held at its point (reach 16): 46 m east its lot took the ground of Tennōji station's
  // yard, which then shrank from the prefectural to the city size.
  { id: 'landmark.osaka_castle', lat: 34.68731, lon: 135.52582, rot: 0, drain: 0.4, level: 14, cutRoads: true },
  { id: 'landmark.abeno_harukas', lat: 34.64593, lon: 135.51337, rot: 0, cutRoads: true },
  { id: 'landmark.tsutenkaku', lat: 34.65249, lon: 135.50632, rot: 0, cutRoads: true, reach: 16 },
  // The Expo park (its ponds), Umeda Sky at the east edge of 20111 between the Yodo River and the
  // tracks to Osaka station, the theme park on the reclaimed shore of Konohana (the area's canals and
  // sea under it; its gate faces the station, east).
  { id: 'landmark.tower_of_the_sun', lat: 34.80937, lon: 135.53233, rot: 0, drain: 0.3 },
  { id: 'landmark.umeda_sky_building', lat: 34.70532, lon: 135.49057, rot: 0, cutRoads: true },
  { id: 'landmark.osaka_bay_theme_park', lat: 34.66563, lon: 135.43234, rot: 1, drain: 0.6, cutRoads: true },
  // Kyoto (cell 19613, six of them). Kiyomizu-dera on its hillside (level); Fushimi Inari at the cell's
  // south edge, facing west, its hill behind (level: it stands 80 m north-east, up the hill); Kyōto
  // Tower between national roads (cutRoads); the clock tower faces its gate (west). Tō-ji's real point
  // (34.98056, 135.7475) is inside the yard of Kyōto Station (the designated-city station, 280 × 180 m,
  // R5): a lot there shrank the station to the prefectural size, so the point is moved 1.6 km
  // south-west (the station's south-west corner, the same side of the tracks; PROGRESS.md L5).
  { id: 'landmark.kiyomizudera', lat: 34.99486, lon: 135.78502, rot: 0, level: 30 },
  { id: 'landmark.kinkakuji', lat: 35.03937, lon: 135.72924, rot: 0 },
  { id: 'landmark.kyoto_tower', lat: 34.98756, lon: 135.75936, rot: 0, cutRoads: true },
  { id: 'landmark.fushimi_inari', lat: 34.96715, lon: 135.77267, rot: 3, level: 20 },
  { id: 'landmark.toji_pagoda', lat: 34.97083, lon: 135.7339, rot: 0, cutRoads: true },
  { id: 'landmark.kyodai_clock_tower', lat: 35.02621, lon: 135.78077, rot: 3 },
  // Hyogo. Himeji Castle over its moats on Himeyama (drain, level); the port tower on the edge of
  // Naka pier (the harbour under half its lot filled); L9: the Akashi Kaikyō Bridge along the area's
  // motorway from the Maiko shore to Awaji (its line runs on into cell 20441, which builds the Awaji end).
  { id: 'landmark.himeji_castle', lat: 34.83944, lon: 134.69389, rot: 0, level: 14, drain: 0.3 },
  { id: 'landmark.kobe_port_tower', lat: 34.68263, lon: 135.18661, rot: 0, drain: 0.6 },
  { id: 'landmark.akashi_kaikyo_bridge', lat: 34.61752, lon: 135.02190, rot: 0, bridge: { path: [[34.63425, 135.03567], [34.59913, 135.00671]], ends: [6, 12] } },
  // Nara (cell 20282). Kōfuku-ji first (Sarusawa Pond's edge, Noborioji-dōri cut: in the other order
  // Tōdai-ji's lot pushed it 115 m east), then Tōdai-ji on the slope of the park.
  { id: 'landmark.kofukuji_pagoda', lat: 34.68275, lon: 135.83217, rot: 0, drain: 0.25, cutRoads: true },
  { id: 'landmark.todaiji_daibutsuden', lat: 34.68895, lon: 135.83984, rot: 0 },
  // Mie: the Uji Bridge over the Isuzu (the river under the lot; the valley's sides levelled). Shiga:
  // Hikone Castle on its hill over the moats. Wakayama: the castle on Torafusu hill over its moats;
  // Seiganto-ji on the mountainside of Nachi (it stands 75 m off, where the slope is under 30 m).
  { id: 'landmark.ise_ujibashi', lat: 34.45537, lon: 136.72527, rot: 0, drain: 0.4, level: 22 },
  { id: 'landmark.hikone_castle', lat: 35.27645, lon: 136.25172, rot: 0, level: 20, drain: 0.3 },
  { id: 'landmark.wakayama_castle', lat: 34.22743, lon: 135.17124, rot: 0, level: 12, drain: 0.3 },
  { id: 'landmark.nachi_seigantoji', lat: 33.66828, lon: 135.88979, rot: 0, level: 30 },
];
