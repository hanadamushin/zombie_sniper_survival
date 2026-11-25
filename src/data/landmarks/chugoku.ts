// Landmarks of the chugoku region (L6). One line per landmark: its building type, real position and the
// side its front faces (types.ts). Building types: src/gen/buildings/defs/landmark/chugoku/, listed in
// src/gen/buildings/catalog/landmark_chugoku.ts; names in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_CHUGOKU: readonly LandmarkSpot[] = [
  // Hiroshima (cell 20752). The Atomic Bomb Dome on the east bank of the Motoyasu River, its dome side
  // towards the river (west): a place of remembrance (memorial: as it stands, no props of the fall, no
  // firing position, no zombie placed within 60 m, nothing searched there). The delta's rivers and the
  // avenues are under its lot (drain, cutRoads; held at its point). The castle over its moats, held at
  // its point (reach 16: free to go 40 m south-east, its lot took the city hospital's site, which shrank).
  { id: 'landmark.genbaku_dome', lat: 34.39548, lon: 132.45357, rot: 3, memorial: true, drain: 0.3, cutRoads: true, reach: 16 },
  { id: 'landmark.hiroshima_castle', lat: 34.40265, lon: 132.45938, rot: 0, drain: 0.3, cutRoads: true, reach: 16 },
  // Miyajima: the great torii in the sea (the lot is all sea: drain 1.1 as Akashi's tower, L5).
  { id: 'landmark.itsukushima_otorii', lat: 34.29632, lon: 132.31803, rot: 2, drain: 1.1, reach: 16 },
  // Okayama (cell 20264): the castle by the Asahi River first, then Kōraku-en north of it across the river.
  // The real points are 30 m apart in the shrunk area, with the prefectural office 40 m south of the
  // castle and the central police station north of the garden: the castle's point is moved 130 m north
  // (34.66506 → 34.6672) and the garden's 900 m north-west (34.6676, 133.9351 → 34.6731, 133.928), so
  // that both keep their sites (PROGRESS.md L6).
  { id: 'landmark.okayama_castle', lat: 34.6672, lon: 133.93597, rot: 0, drain: 0.3, reach: 16 },
  { id: 'landmark.korakuen_enyotei', lat: 34.6731, lon: 133.9280, rot: 0, drain: 0.5, reach: 16 },
  // Shimane: Izumo Taisha at the foot of its hills; Matsue Castle on Kameda-yama over its moats.
  { id: 'landmark.izumo_taisha', lat: 35.4019, lon: 132.6855, rot: 0, level: 30, cutRoads: true },
  { id: 'landmark.matsue_castle', lat: 35.47507, lon: 133.05069, rot: 0, drain: 0.3, level: 12 },
  // Yamaguchi: the Kintai Bridge across the area's Nishiki River (L9: west bank to east bank, the river's
  // surface 1.4 m), the pagoda of Rurikō-ji on its hillside. The Tsunoshima Bridge is not built: its cell
  // (20738) is not a land cell of the game (PROGRESS.md L6).
  { id: 'landmark.kintaikyo', lat: 34.16493, lon: 132.17668, rot: 0, bridge: { path: [[34.16484, 132.17462], [34.16502, 132.17874]], ends: [3.8, 2], water: 1.4 } },
  // L10: 下津井瀬戸大橋 (the Seto-Ōhashi's first bridge: Washūzan → Hitsuishijima, cell 20597), 多々羅大橋
  // (20925) and 因島大橋 (20759) of the Shimanami Kaidō — from the area's expressway line (LINE_BRIDGE).
  { id: 'landmark.shimotsui_seto_bridge', lat: 34.43080, lon: 133.80598, rot: 0, bridge: { path: [[34.43726, 133.80764], [34.42408, 133.80425]], ends: [8.26, 5.02] } },
  { id: 'landmark.tatara_bridge', lat: 34.25962, lon: 133.06391, rot: 0, bridge: { path: [[34.26127, 133.07246], [34.25792, 133.05516], [34.25700, 133.05294]], ends: [8.32, 2.94] } },
  { id: 'landmark.innoshima_bridge', lat: 34.35724, lon: 133.18041, rot: 0, bridge: { path: [[34.35404, 133.17292], [34.36064, 133.18837]], ends: [10.23, 10.32] } },
  { id: 'landmark.rurikoji_pagoda', lat: 34.19029, lon: 131.47268, rot: 0, level: 12 },
  // Tottori (cell 18597): Jinpū-kaku at the foot of the castle hill, 11 m from the cell's south edge: it
  // stands on a terrace cut into the hill (level 30) 45 m north-east; the Dune Centre on the hill south
  // of the dunes, facing them (north).
  { id: 'landmark.jinpukaku', lat: 35.50633, lon: 134.24025, rot: 0, cutRoads: true, drain: 0.3, level: 30 },
  { id: 'landmark.tottori_sakyu_center', lat: 35.5362, lon: 134.2338, rot: 2, level: 12 },
];
