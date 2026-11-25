// Landmark buildings of the shikoku region (L7). Each type lives in its own file under
// src/gen/buildings/defs/landmark/shikoku/ (shared shapes: parts.ts) and is listed here. Category
// 'landmark', id 'landmark.<variant>'. Where each stands: the table src/data/landmarks/shikoku.ts.
// See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_MATSUYAMA_CASTLE } from '../defs/landmark/shikoku/matsuyama_castle.ts';
import { LANDMARK_DOGO_ONSEN_HONKAN } from '../defs/landmark/shikoku/dogo_onsen_honkan.ts';
import { LANDMARK_KOTOHIRAGU } from '../defs/landmark/shikoku/kotohiragu.ts';
import { LANDMARK_TAKAMATSU_TSUKIMI_YAGURA } from '../defs/landmark/shikoku/takamatsu_tsukimi_yagura.ts';
import { LANDMARK_KOCHI_CASTLE } from '../defs/landmark/shikoku/kochi_castle.ts';
import { LANDMARK_HARIMAYA_BRIDGE } from '../defs/landmark/shikoku/harimaya_bridge.ts';
import { LANDMARK_RYOMA_STATUE } from '../defs/landmark/shikoku/ryoma_statue.ts';
import { LANDMARK_IYA_KAZURABASHI } from '../defs/landmark/shikoku/iya_kazurabashi.ts';
import { LANDMARK_TOKUSHIMA_WASHINOMON } from '../defs/landmark/shikoku/tokushima_washinomon.ts';
import { LANDMARK_ONARUTO_BRIDGE } from '../defs/landmark/shikoku/onaruto_bridge.ts';

export const LANDMARK_SHIKOKU: readonly BuildingDef[] = [
  LANDMARK_MATSUYAMA_CASTLE, LANDMARK_DOGO_ONSEN_HONKAN, LANDMARK_KOTOHIRAGU, LANDMARK_TAKAMATSU_TSUKIMI_YAGURA,
  LANDMARK_KOCHI_CASTLE, LANDMARK_HARIMAYA_BRIDGE, LANDMARK_RYOMA_STATUE, LANDMARK_IYA_KAZURABASHI,
  LANDMARK_TOKUSHIMA_WASHINOMON, LANDMARK_ONARUTO_BRIDGE,
];
