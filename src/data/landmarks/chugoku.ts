// Landmarks of the chugoku region (L6). One line per landmark: its building type, real position and the
// side its front faces (types.ts). Building types: src/gen/buildings/defs/landmark/chugoku/, listed in
// src/gen/buildings/catalog/landmark_chugoku.ts; names in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_CHUGOKU: readonly LandmarkSpot[] = [
  // Hiroshima (cell 20752). The Atomic Bomb Dome on the east bank of the Motoyasu River, its dome side
  // towards the river (west): a place of remembrance (memorial: as it stands, no props of the fall, no
  // firing position, no zombie placed within 60 m, nothing searched there). The castle over its moats.
  { id: 'landmark.genbaku_dome', lat: 34.39548, lon: 132.45357, rot: 3, memorial: true, drain: 0.3, cutRoads: true, reach: 16 },
  { id: 'landmark.hiroshima_castle', lat: 34.40265, lon: 132.45938, rot: 0, drain: 0.3, cutRoads: true, reach: 16 },
  // Miyajima: the great torii in the sea (the lot is all sea: drain 1.1 as Akashi's tower, L5).
  { id: 'landmark.itsukushima_otorii', lat: 34.29632, lon: 132.31803, rot: 2, drain: 1.1, reach: 16 },
  // Okayama (cell 20264): the castle by the Asahi River first, then Kōraku-en across it.
  { id: 'landmark.okayama_castle', lat: 34.6672, lon: 133.93597, rot: 0, drain: 0.3, reach: 16 },
  { id: 'landmark.korakuen_enyotei', lat: 34.6731, lon: 133.9280, rot: 0, drain: 0.5, reach: 16 },
  // Shimane: Izumo Taisha at the foot of its hills; Matsue Castle on Kameda-yama over its moats.
  { id: 'landmark.izumo_taisha', lat: 35.4019, lon: 132.6855, rot: 0, level: 30, cutRoads: true },
  { id: 'landmark.matsue_castle', lat: 35.47507, lon: 133.05069, rot: 0, drain: 0.3, level: 12 },
  // Yamaguchi: the Kintai Bridge over the Nishiki River (the river under the lot; L9 makes it the area's
  // bridge), the pagoda of Rurikō-ji on its hillside. The Tsunoshima Bridge is not built: its cell
  // (20738) is not a land cell of the game (PROGRESS.md L6).
  { id: 'landmark.kintaikyo', lat: 34.16772, lon: 132.17847, rot: 0, drain: 0.6, cutRoads: true },
  { id: 'landmark.rurikoji_pagoda', lat: 34.19029, lon: 131.47268, rot: 0, level: 12 },
  // Tottori: Jinpū-kaku below the castle hill; the Dune Centre on the hill south of the dunes, facing them (north).
  { id: 'landmark.jinpukaku', lat: 35.50633, lon: 134.24025, rot: 0, cutRoads: true, drain: 0.3, level: 30 },
  { id: 'landmark.tottori_sakyu_center', lat: 35.5362, lon: 134.2338, rot: 2, level: 12 },
];
