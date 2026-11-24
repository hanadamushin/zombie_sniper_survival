// Landmark buildings of the chugoku region (L6). Each type lives in its own file under
// src/gen/buildings/defs/landmark/chugoku/ (shared shapes: parts.ts) and is listed here. Category
// 'landmark', id 'landmark.<variant>'. Where each stands: the table src/data/landmarks/chugoku.ts.
// See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_GENBAKU_DOME } from '../defs/landmark/chugoku/genbaku_dome.ts';
import { LANDMARK_HIROSHIMA_CASTLE } from '../defs/landmark/chugoku/hiroshima_castle.ts';
import { LANDMARK_ITSUKUSHIMA_OTORII } from '../defs/landmark/chugoku/itsukushima_otorii.ts';
import { LANDMARK_OKAYAMA_CASTLE } from '../defs/landmark/chugoku/okayama_castle.ts';
import { LANDMARK_KORAKUEN_ENYOTEI } from '../defs/landmark/chugoku/korakuen_enyotei.ts';
import { LANDMARK_IZUMO_TAISHA } from '../defs/landmark/chugoku/izumo_taisha.ts';
import { LANDMARK_MATSUE_CASTLE } from '../defs/landmark/chugoku/matsue_castle.ts';
import { LANDMARK_KINTAIKYO } from '../defs/landmark/chugoku/kintaikyo.ts';
import { LANDMARK_RURIKOJI_PAGODA } from '../defs/landmark/chugoku/rurikoji_pagoda.ts';
import { LANDMARK_JINPUKAKU } from '../defs/landmark/chugoku/jinpukaku.ts';
import { LANDMARK_TOTTORI_SAKYU_CENTER } from '../defs/landmark/chugoku/tottori_sakyu_center.ts';

export const LANDMARK_CHUGOKU: readonly BuildingDef[] = [
  LANDMARK_GENBAKU_DOME, LANDMARK_HIROSHIMA_CASTLE, LANDMARK_ITSUKUSHIMA_OTORII, LANDMARK_OKAYAMA_CASTLE,
  LANDMARK_KORAKUEN_ENYOTEI, LANDMARK_IZUMO_TAISHA, LANDMARK_MATSUE_CASTLE, LANDMARK_KINTAIKYO,
  LANDMARK_RURIKOJI_PAGODA, LANDMARK_JINPUKAKU, LANDMARK_TOTTORI_SAKYU_CENTER,
];
