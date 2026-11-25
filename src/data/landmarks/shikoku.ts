// Landmarks of the shikoku region (L7). One line per landmark: its building type, real position and the
// side its front faces (types.ts). Building types: src/gen/buildings/defs/landmark/shikoku/, listed in
// src/gen/buildings/catalog/landmark_shikoku.ts; names in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_SHIKOKU: readonly LandmarkSpot[] = [
  // Ehime, Matsuyama (cell 21757): the castle on the top of Katsuyama (the hill levelled into a
  // terrace), then Dōgo Onsen Honkan 2 km east (200 m in the area).
  { id: 'landmark.matsuyama_castle', lat: 33.8457, lon: 132.7655, rot: 0, level: 30 },
  { id: 'landmark.dogo_onsen_honkan', lat: 33.8522, lon: 132.7866, rot: 3 },
  // Kagawa: Kotohira-gū's main shrine on Zōzu-san, the stairway climbing from the town (east). The
  // hillside is too steep round the point even levelled (30 m): the lot stands 44 m east, towards the
  // town, its back (the main shrine) on the real point.
  { id: 'landmark.kotohiragu', lat: 34.1840, lon: 133.8094, rot: 1, level: 30 },
  // Takamatsu: the Moon-viewing Turret on the sea moat of Tamamo Park. The point is 4 m from the west
  // edge of cell 20767; left free, the lot went 47 m south-east into the town and the cell's garrison
  // and a school changed: it is held at the shore, its north half over the sea (drain, cutRoads, reach).
  { id: 'landmark.takamatsu_tsukimi_yagura', lat: 34.3509, lon: 134.0538, rot: 2, drain: 1.1, cutRoads: true, reach: 16 },
  // Kōchi (cell 22265): the castle on its hill (the Ōtemon east of the keep), then Harimaya Bridge. The
  // keep's shrunk point (33.5607, 133.5314) is on the prefectural office's site, the city's other
  // office 40 m north-west: the castle's point is moved 670 m west along the castle hill and 80 m
  // south, where the lot keeps clear of both (PROGRESS.md L7).
  { id: 'landmark.kochi_castle', lat: 33.5600, lon: 133.5240, rot: 1, level: 30, drain: 0.3, reach: 16 },
  { id: 'landmark.harimaya_bridge', lat: 33.5607, lon: 133.5428, rot: 0, drain: 0.5 },
  // Katsurahama: Ryōma on the cape above the beach, looking out to sea.
  { id: 'landmark.ryoma_statue', lat: 33.4978, lon: 133.5738, rot: 0, level: 12 },
  // Tokushima: the vine bridge across the Iya gorge (cell 21767); the Washi-no-mon by the station.
  { id: 'landmark.iya_kazurabashi', lat: 33.8751, lon: 133.8355, rot: 0, drain: 0.6, level: 30 },
  { id: 'landmark.tokushima_washinomon', lat: 34.0741, lon: 134.5538, rot: 0, drain: 0.3 },
  // L9: the Ōnaruto Bridge from Ōge Island over the Naruto Strait to Awaji (its motorway's line, cell 21106).
  { id: 'landmark.onaruto_bridge', lat: 34.23860, lon: 134.65029, rot: 0, bridge: { path: [[34.23482, 134.63989], [34.24265, 134.66168]], ends: [10.5, 2.7] } },
  // L10: 瀬戸大橋 — the five bridges in the sea cell 20764 (no area: never built in one; their lines are
  // placed along the route between the north tip of Hitsuishijima and Bannosu by their real lengths,
  // approximately) and 来島海峡大橋 (three rows meeting over the water and on Umajima, cell 21258).
  { id: 'landmark.hitsuishijima_bridge', lat: 34.41544, lon: 133.80626, rot: 0, bridge: { path: [[34.41893, 133.80539], [34.41195, 133.80713]], ends: [9, 9] } },
  { id: 'landmark.iwakurojima_bridge', lat: 34.40660, lon: 133.80847, rot: 0, bridge: { path: [[34.41009, 133.80760], [34.40311, 133.80935]], ends: [9, 9] } },
  { id: 'landmark.yoshima_bridge', lat: 34.39560, lon: 133.81123, rot: 0, bridge: { path: [[34.39949, 133.81025], [34.39171, 133.81220]], ends: [9, 9] } },
  { id: 'landmark.kita_bisan_seto_bridge', lat: 34.37678, lon: 133.81594, rot: 0, bridge: { path: [[34.38358, 133.81423], [34.36998, 133.81764]], ends: [9, 9] } },
  { id: 'landmark.minami_bisan_seto_bridge', lat: 34.36269, lon: 133.81946, rot: 0, bridge: { path: [[34.36998, 133.81764], [34.35540, 133.82129]], ends: [9, 9] } },
  { id: 'landmark.kurushima_kaikyo_bridge_1', lat: 34.12620, lon: 133.01340, rot: 0, bridge: { path: [[34.13012, 133.02198], [34.12796, 133.01802], [34.12444, 133.00873]], ends: [6.34, 10] } },
  { id: 'landmark.kurushima_kaikyo_bridge_2', lat: 34.12163, lon: 133.00132, rot: 0, bridge: { path: [[34.12444, 133.00873], [34.11880, 132.99385]], ends: [10, 9.91] } },
  { id: 'landmark.kurushima_kaikyo_bridge_3', lat: 34.11590, lon: 132.98619, rot: 0, bridge: { path: [[34.11880, 132.99385], [34.11335, 132.97947], [34.11283, 132.97850], [34.11201, 132.97754]], ends: [9.91, 7.62] } },
];
