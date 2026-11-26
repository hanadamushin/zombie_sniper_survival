// Landmarks of the hokkaido region (L1). One line per landmark: its building type, real position and the
// side its front faces (types.ts). Building types: src/gen/buildings/defs/landmark/hokkaido/, listed in
// src/gen/buildings/catalog/landmark_hokkaido.ts; names in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_HOKKAIDO: readonly LandmarkSpot[] = [
  // Sapporo (cell 4800): the TV tower at the east end of Ōdōri Park (R1's point, its clock to the park),
  // the clock tower on 北一条通, the red-brick office facing east down 北三条通; the university to the north.
  { id: 'landmark.sapporo_tv_tower', lat: 43.0611, lon: 141.3564, rot: 3, poi: 'さっぽろテレビ塔', clues: ['okinawa'] },
  { id: 'landmark.sapporo_clock_tower', lat: 43.0626, lon: 141.3536, rot: 0 },
  { id: 'landmark.hokkaido_akarenga', lat: 43.0637, lon: 141.3478, rot: 1 },
  { id: 'landmark.hokudai_clark', lat: 43.0700, lon: 141.3460, rot: 0 },
  { id: 'landmark.hokudai_poplar', lat: 43.0757, lon: 141.3408, rot: 0 },
  // Hakodate (cell 7133): the star fort first, then its tower beside it (R1's point).
  { id: 'landmark.goryokaku', lat: 41.7969, lon: 140.7570, rot: 0 },
  { id: 'landmark.goryokaku_tower', lat: 41.7942, lon: 140.7538, rot: 0, poi: '五稜郭タワー' },
  // Otaru (cell 4463): the canal along the port, the town (the promenade) to the west.
  { id: 'landmark.otaru_canal', lat: 43.1990, lon: 141.0010, rot: 3 },
];
