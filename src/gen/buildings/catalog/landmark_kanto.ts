// Landmark buildings of the kanto region (L3a Tokyo; L3b adds the other prefectures). Each type lives
// in its own file under src/gen/buildings/defs/landmark/kanto/ (shared shapes: parts.ts) and is listed
// here. Category 'landmark', id 'landmark.<variant>'. Where each stands: the table
// src/data/landmarks/kanto.ts. See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_KOKYO_NIJUBASHI } from '../defs/landmark/kanto/kokyo_nijubashi.ts';
import { LANDMARK_MEIJI_JINGU_OTORII } from '../defs/landmark/kanto/meiji_jingu_otorii.ts';
import { LANDMARK_NATIONAL_DIET } from '../defs/landmark/kanto/national_diet.ts';
import { LANDMARK_NIPPON_BUDOKAN } from '../defs/landmark/kanto/nippon_budokan.ts';
import { LANDMARK_RAINBOW_BRIDGE } from '../defs/landmark/kanto/rainbow_bridge.ts';
import { LANDMARK_SENSOJI } from '../defs/landmark/kanto/sensoji.ts';
import { LANDMARK_AKAMON, LANDMARK_YASUDA_AUDITORIUM } from '../defs/landmark/kanto/todai.ts';
import { LANDMARK_TOKYO_DOME } from '../defs/landmark/kanto/tokyo_dome.ts';
import { LANDMARK_TOKYO_METROPOLITAN_GOVERNMENT } from '../defs/landmark/kanto/tokyo_metropolitan_government.ts';
import { LANDMARK_TOKYO_SKYTREE } from '../defs/landmark/kanto/tokyo_skytree.ts';
import { LANDMARK_TOKYO_STATION } from '../defs/landmark/kanto/tokyo_station.ts';
import { LANDMARK_TOKYO_TOWER } from '../defs/landmark/kanto/tokyo_tower.ts';
import { LANDMARK_COSMO_CLOCK } from '../defs/landmark/kanto/cosmo_clock.ts';
import { LANDMARK_KAMAKURA_DAIBUTSU } from '../defs/landmark/kanto/kamakura_daibutsu.ts';
import { LANDMARK_YOKOHAMA_AKARENGA } from '../defs/landmark/kanto/yokohama_akarenga.ts';
import { LANDMARK_YOKOHAMA_LANDMARK_TOWER } from '../defs/landmark/kanto/yokohama_landmark_tower.ts';
import { LANDMARK_YOKOHAMA_MARINE_TOWER } from '../defs/landmark/kanto/yokohama_marine_tower.ts';
import { LANDMARK_BAY_THEME_PARK } from '../defs/landmark/kanto/bay_theme_park.ts';
import { LANDMARK_CHIBA_PORT_TOWER } from '../defs/landmark/kanto/chiba_port_tower.ts';
import { LANDMARK_NARITASAN } from '../defs/landmark/kanto/naritasan.ts';
import { LANDMARK_KAWAGOE } from '../defs/landmark/kanto/kawagoe.ts';
import { LANDMARK_SAITAMA_SUPER_ARENA } from '../defs/landmark/kanto/saitama_super_arena.ts';
import { LANDMARK_USHIKU_DAIBUTSU } from '../defs/landmark/kanto/ushiku_daibutsu.ts';
import { LANDMARK_NIKKO_YOMEIMON } from '../defs/landmark/kanto/nikko_yomeimon.ts';
import { LANDMARK_TOMIOKA_SILK_MILL } from '../defs/landmark/kanto/tomioka_silk_mill.ts';

export const LANDMARK_KANTO: readonly BuildingDef[] = [
  // L3a Tokyo
  LANDMARK_TOKYO_SKYTREE, LANDMARK_TOKYO_TOWER, LANDMARK_TOKYO_STATION, LANDMARK_NATIONAL_DIET,
  LANDMARK_TOKYO_METROPOLITAN_GOVERNMENT, LANDMARK_YASUDA_AUDITORIUM, LANDMARK_AKAMON, LANDMARK_SENSOJI,
  LANDMARK_KOKYO_NIJUBASHI, LANDMARK_RAINBOW_BRIDGE, LANDMARK_MEIJI_JINGU_OTORII, LANDMARK_NIPPON_BUDOKAN,
  LANDMARK_TOKYO_DOME,
  // L3b (the other prefectures of Kanto) below
  // Kanagawa
  LANDMARK_YOKOHAMA_LANDMARK_TOWER, LANDMARK_YOKOHAMA_AKARENGA, LANDMARK_COSMO_CLOCK, LANDMARK_YOKOHAMA_MARINE_TOWER,
  LANDMARK_KAMAKURA_DAIBUTSU,
  // Chiba, Saitama, Ibaraki, Tochigi, Gunma
  LANDMARK_CHIBA_PORT_TOWER, LANDMARK_NARITASAN, LANDMARK_BAY_THEME_PARK, LANDMARK_KAWAGOE, LANDMARK_SAITAMA_SUPER_ARENA,
  LANDMARK_USHIKU_DAIBUTSU, LANDMARK_NIKKO_YOMEIMON, LANDMARK_TOMIOKA_SILK_MILL,
];
