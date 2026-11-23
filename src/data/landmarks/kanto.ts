// Landmarks of the kanto region (L3a Tokyo; L3b the other prefectures). One line per landmark: its
// building type, real position and the side its front faces (types.ts). Building types:
// src/gen/buildings/defs/landmark/kanto/, listed in src/gen/buildings/catalog/landmark_kanto.ts; names
// in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_KANTO: readonly LandmarkSpot[] = [
  // --- L3a Tokyo ---
  // Cell 18480 (Marunouchi, Kasumigaseki, Shiba, the harbour): the station before the palace, the
  // Diet, the tower, one tower of the Rainbow Bridge.
  { id: 'landmark.tokyo_station', lat: 35.68124, lon: 139.76712, rot: 3, cutRoads: true },
  { id: 'landmark.kokyo_nijubashi', lat: 35.6802, lon: 139.7504, rot: 1, drain: 0.3, cutRoads: true },
  { id: 'landmark.national_diet', lat: 35.67594, lon: 139.74485, rot: 1, cutRoads: true },
  { id: 'landmark.tokyo_tower', lat: 35.65858, lon: 139.74543, rot: 0, cutRoads: true },
  { id: 'landmark.rainbow_bridge', lat: 35.6366, lon: 139.7636, rot: 0, drain: 1 },
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
];
