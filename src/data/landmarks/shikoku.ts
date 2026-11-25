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
];
