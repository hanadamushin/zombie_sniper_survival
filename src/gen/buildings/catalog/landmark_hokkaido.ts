// Landmark buildings of the hokkaido region (R1 made the two towers, L1 the rest and remade the towers
// exterior-only). Each type lives in its own file under src/gen/buildings/defs/landmark/hokkaido/ and
// is listed here. Category 'landmark', id 'landmark.<variant>'. Where each stands: the table
// src/data/landmarks/hokkaido.ts. See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_GORYOKAKU } from '../defs/landmark/hokkaido/goryokaku.ts';
import { LANDMARK_GORYOKAKU_TOWER } from '../defs/landmark/hokkaido/goryokaku_tower.ts';
import { LANDMARK_HOKKAIDO_AKARENGA } from '../defs/landmark/hokkaido/hokkaido_akarenga.ts';
import { LANDMARK_HOKUDAI_CLARK, LANDMARK_HOKUDAI_POPLAR } from '../defs/landmark/hokkaido/hokudai.ts';
import { LANDMARK_OTARU_CANAL } from '../defs/landmark/hokkaido/otaru_canal.ts';
import { LANDMARK_SAPPORO_CLOCK_TOWER } from '../defs/landmark/hokkaido/sapporo_clock_tower.ts';
import { LANDMARK_SAPPORO_TV_TOWER } from '../defs/landmark/hokkaido/sapporo_tv_tower.ts';

export const LANDMARK_HOKKAIDO: readonly BuildingDef[] = [
  LANDMARK_SAPPORO_TV_TOWER, LANDMARK_SAPPORO_CLOCK_TOWER, LANDMARK_HOKKAIDO_AKARENGA, LANDMARK_HOKUDAI_CLARK, LANDMARK_HOKUDAI_POPLAR,
  LANDMARK_GORYOKAKU, LANDMARK_GORYOKAKU_TOWER, LANDMARK_OTARU_CANAL,
];
