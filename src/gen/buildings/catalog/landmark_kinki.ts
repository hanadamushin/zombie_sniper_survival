// Landmark buildings of the kinki region (L5). Each type lives in its own file under
// src/gen/buildings/defs/landmark/kinki/ (shared shapes: parts.ts) and is listed here. Category
// 'landmark', id 'landmark.<variant>'. Where each stands: the table src/data/landmarks/kinki.ts.
// See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_ABENO_HARUKAS } from '../defs/landmark/kinki/abeno_harukas.ts';
import { LANDMARK_AKASHI_KAIKYO_BRIDGE } from '../defs/landmark/kinki/akashi_kaikyo_bridge.ts';
import { LANDMARK_FUSHIMI_INARI } from '../defs/landmark/kinki/fushimi_inari.ts';
import { LANDMARK_HIKONE_CASTLE } from '../defs/landmark/kinki/hikone_castle.ts';
import { LANDMARK_HIMEJI_CASTLE } from '../defs/landmark/kinki/himeji_castle.ts';
import { LANDMARK_ISE_UJIBASHI } from '../defs/landmark/kinki/ise_ujibashi.ts';
import { LANDMARK_KINKAKUJI } from '../defs/landmark/kinki/kinkakuji.ts';
import { LANDMARK_KIYOMIZUDERA } from '../defs/landmark/kinki/kiyomizudera.ts';
import { LANDMARK_KOBE_PORT_TOWER } from '../defs/landmark/kinki/kobe_port_tower.ts';
import { LANDMARK_KOFUKUJI_PAGODA } from '../defs/landmark/kinki/kofukuji_pagoda.ts';
import { LANDMARK_KYODAI_CLOCK_TOWER } from '../defs/landmark/kinki/kyodai_clock_tower.ts';
import { LANDMARK_KYOTO_TOWER } from '../defs/landmark/kinki/kyoto_tower.ts';
import { LANDMARK_NACHI_SEIGANTOJI } from '../defs/landmark/kinki/nachi_seigantoji.ts';
import { LANDMARK_OSAKA_BAY_THEME_PARK } from '../defs/landmark/kinki/osaka_bay_theme_park.ts';
import { LANDMARK_OSAKA_CASTLE } from '../defs/landmark/kinki/osaka_castle.ts';
import { LANDMARK_TODAIJI_DAIBUTSUDEN } from '../defs/landmark/kinki/todaiji_daibutsuden.ts';
import { LANDMARK_TOJI_PAGODA } from '../defs/landmark/kinki/toji_pagoda.ts';
import { LANDMARK_TOWER_OF_THE_SUN } from '../defs/landmark/kinki/tower_of_the_sun.ts';
import { LANDMARK_TSUTENKAKU } from '../defs/landmark/kinki/tsutenkaku.ts';
import { LANDMARK_UMEDA_SKY_BUILDING } from '../defs/landmark/kinki/umeda_sky_building.ts';
import { LANDMARK_WAKAYAMA_CASTLE } from '../defs/landmark/kinki/wakayama_castle.ts';

export const LANDMARK_KINKI: readonly BuildingDef[] = [
  LANDMARK_OSAKA_CASTLE, LANDMARK_TSUTENKAKU, LANDMARK_ABENO_HARUKAS, LANDMARK_TOWER_OF_THE_SUN,
  LANDMARK_UMEDA_SKY_BUILDING, LANDMARK_OSAKA_BAY_THEME_PARK, LANDMARK_KIYOMIZUDERA,
  LANDMARK_KINKAKUJI, LANDMARK_KYOTO_TOWER, LANDMARK_FUSHIMI_INARI, LANDMARK_TOJI_PAGODA,
  LANDMARK_KYODAI_CLOCK_TOWER, LANDMARK_HIMEJI_CASTLE, LANDMARK_KOBE_PORT_TOWER,
  LANDMARK_AKASHI_KAIKYO_BRIDGE, LANDMARK_TODAIJI_DAIBUTSUDEN, LANDMARK_KOFUKUJI_PAGODA,
  LANDMARK_ISE_UJIBASHI, LANDMARK_HIKONE_CASTLE, LANDMARK_WAKAYAMA_CASTLE, LANDMARK_NACHI_SEIGANTOJI,
];
