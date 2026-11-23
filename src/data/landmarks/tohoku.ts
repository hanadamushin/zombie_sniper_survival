// Landmarks of the tohoku region (L2). One line per landmark: its building type, real position and the
// side its front faces (types.ts). Building types: src/gen/buildings/defs/landmark/tohoku/, listed in
// src/gen/buildings/catalog/landmark_tohoku.ts; names in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_TOHOKU: readonly LandmarkSpot[] = [
  // Aomori: Hirosaki Castle's keep in the south-east corner of the main enclosure (the moats south
  // and east of it); one tower of the bay bridge by Aomori Station, its deck east–west.
  { id: 'landmark.hirosaki_castle', lat: 40.6075, lon: 140.4645, rot: 0, drain: 0.25 },
  { id: 'landmark.aomori_bay_bridge', lat: 40.8302, lon: 140.7385, rot: 0 },
  // Iwate: the Golden Hall's cover hall at the top of 月見坂 (the lot's middle is half way up the
  // avenue, which climbs from the south-east).
  { id: 'landmark.chusonji_konjikido', lat: 39.0003, lon: 141.1012, rot: 0 },
  // Miyagi (Sendai, cell 13647): the statue on the castle site looking east over the city; the
  // mausoleum on 経ヶ峯 across the river, its stairs coming up from the north.
  { id: 'landmark.date_masamune_statue', lat: 38.2532, lon: 140.8563, rot: 1, level: 12 },
  { id: 'landmark.zuihoden', lat: 38.2523, lon: 140.88, rot: 2 },
  // Akita: the samurai street of Kakunodate, running north–south.
  { id: 'landmark.kakunodate_bukeyashiki', lat: 39.597, lon: 140.5625, rot: 0 },
  // Yamagata: Yamadera's crag above the valley (to the south).
  { id: 'landmark.yamadera', lat: 38.3127, lon: 140.438, rot: 0, level: 30 },
  // Fukushima: Tsuruga Castle's keep in the north-west of the main enclosure.
  { id: 'landmark.tsuruga_castle', lat: 37.4877, lon: 139.9298, rot: 0, drain: 0.2 },
];
