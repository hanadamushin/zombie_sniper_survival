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

export const LANDMARK_KANTO: readonly BuildingDef[] = [
  // L3a Tokyo
  LANDMARK_TOKYO_SKYTREE, LANDMARK_TOKYO_TOWER, LANDMARK_TOKYO_STATION, LANDMARK_NATIONAL_DIET,
  LANDMARK_TOKYO_METROPOLITAN_GOVERNMENT, LANDMARK_YASUDA_AUDITORIUM, LANDMARK_AKAMON, LANDMARK_SENSOJI,
  LANDMARK_KOKYO_NIJUBASHI, LANDMARK_RAINBOW_BRIDGE, LANDMARK_MEIJI_JINGU_OTORII, LANDMARK_NIPPON_BUDOKAN,
  LANDMARK_TOKYO_DOME,
  // L3b (the other prefectures of Kanto) below
];
