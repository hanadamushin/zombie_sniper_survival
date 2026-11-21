// Landmark buildings of the hokkaido region (R1): the two observation towers. Each type lives in its
// own file under src/gen/buildings/defs/landmark/hokkaido/ and is listed here. Category 'landmark',
// id 'landmark.<variant>'. Placed at the shrunk real position by src/gen/real/layout.ts (by the
// annotation's name). See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_GORYOKAKU_TOWER } from '../defs/landmark/hokkaido/goryokaku_tower.ts';
import { LANDMARK_SAPPORO_TV_TOWER } from '../defs/landmark/hokkaido/sapporo_tv_tower.ts';

export const LANDMARK_HOKKAIDO: readonly BuildingDef[] = [LANDMARK_SAPPORO_TV_TOWER, LANDMARK_GORYOKAKU_TOWER];
