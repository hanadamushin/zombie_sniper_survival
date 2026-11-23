// Landmark buildings of the tohoku region (L2). Each type lives in its own file under
// src/gen/buildings/defs/landmark/tohoku/ (shared shapes: parts.ts) and is listed here. Category
// 'landmark', id 'landmark.<variant>'. Where each stands: the table src/data/landmarks/tohoku.ts.
// See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_AOMORI_BAY_BRIDGE } from '../defs/landmark/tohoku/aomori_bay_bridge.ts';
import { LANDMARK_CHUSONJI_KONJIKIDO } from '../defs/landmark/tohoku/chusonji_konjikido.ts';
import { LANDMARK_DATE_MASAMUNE_STATUE } from '../defs/landmark/tohoku/date_masamune_statue.ts';
import { LANDMARK_HIROSAKI_CASTLE } from '../defs/landmark/tohoku/hirosaki_castle.ts';
import { LANDMARK_KAKUNODATE_BUKEYASHIKI } from '../defs/landmark/tohoku/kakunodate_bukeyashiki.ts';
import { LANDMARK_TSURUGA_CASTLE } from '../defs/landmark/tohoku/tsuruga_castle.ts';
import { LANDMARK_YAMADERA } from '../defs/landmark/tohoku/yamadera.ts';
import { LANDMARK_ZUIHODEN } from '../defs/landmark/tohoku/zuihoden.ts';

export const LANDMARK_TOHOKU: readonly BuildingDef[] = [
  LANDMARK_HIROSAKI_CASTLE, LANDMARK_AOMORI_BAY_BRIDGE, LANDMARK_CHUSONJI_KONJIKIDO, LANDMARK_DATE_MASAMUNE_STATUE,
  LANDMARK_ZUIHODEN, LANDMARK_KAKUNODATE_BUKEYASHIKI, LANDMARK_YAMADERA, LANDMARK_TSURUGA_CASTLE,
];
