// Landmark buildings of the chubu region (L4). Each type lives in its own file under
// src/gen/buildings/defs/landmark/chubu/ (shared shapes: parts.ts) and is listed here. Category
// 'landmark', id 'landmark.<variant>'. Where each stands: the table src/data/landmarks/chubu.ts.
// See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_ATSUTA_JINGU } from '../defs/landmark/chubu/atsuta_jingu.ts';
import { LANDMARK_FUJI_SENGEN_JINJA } from '../defs/landmark/chubu/fuji_sengen_jinja.ts';
import { LANDMARK_FUKUI_DINOSAUR_MUSEUM } from '../defs/landmark/chubu/fukui_dinosaur_museum.ts';
import { LANDMARK_GIFU_CASTLE } from '../defs/landmark/chubu/gifu_castle.ts';
import { LANDMARK_KANAZAWA_ISHIKAWAMON } from '../defs/landmark/chubu/kanazawa_ishikawamon.ts';
import { LANDMARK_KENROKUEN_KOTOJI } from '../defs/landmark/chubu/kenrokuen_kotoji.ts';
import { LANDMARK_KUNOZAN_TOSHOGU } from '../defs/landmark/chubu/kunozan_toshogu.ts';
import { LANDMARK_MATSUMOTO_CASTLE } from '../defs/landmark/chubu/matsumoto_castle.ts';
import { LANDMARK_MIRAI_TOWER } from '../defs/landmark/chubu/mirai_tower.ts';
import { LANDMARK_NAGOYA_CASTLE } from '../defs/landmark/chubu/nagoya_castle.ts';
import { LANDMARK_NAGOYA_TWIN_TOWERS } from '../defs/landmark/chubu/nagoya_twin_towers.ts';
import { LANDMARK_SHIRAKAWAGO } from '../defs/landmark/chubu/shirakawago.ts';
import { LANDMARK_TOKI_MESSE } from '../defs/landmark/chubu/toki_messe.ts';
import { LANDMARK_TOYAMA_CASTLE } from '../defs/landmark/chubu/toyama_castle.ts';
import { LANDMARK_ZENKOJI } from '../defs/landmark/chubu/zenkoji.ts';

export const LANDMARK_CHUBU: readonly BuildingDef[] = [
  LANDMARK_NAGOYA_CASTLE, LANDMARK_MIRAI_TOWER, LANDMARK_ATSUTA_JINGU, LANDMARK_NAGOYA_TWIN_TOWERS,
  LANDMARK_MATSUMOTO_CASTLE, LANDMARK_ZENKOJI, LANDMARK_SHIRAKAWAGO, LANDMARK_GIFU_CASTLE,
  LANDMARK_KANAZAWA_ISHIKAWAMON, LANDMARK_KENROKUEN_KOTOJI, LANDMARK_TOKI_MESSE, LANDMARK_TOYAMA_CASTLE,
  LANDMARK_FUKUI_DINOSAUR_MUSEUM, LANDMARK_FUJI_SENGEN_JINJA, LANDMARK_KUNOZAN_TOSHOGU,
];
