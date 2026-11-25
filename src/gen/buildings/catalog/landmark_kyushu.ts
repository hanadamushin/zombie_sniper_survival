// Landmark buildings of the kyushu region (L8: Kyushu and Okinawa). Each type lives in its own file under
// src/gen/buildings/defs/landmark/kyushu/ (shared shapes: parts.ts) and is listed here. Category
// 'landmark', id 'landmark.<variant>'. Where each stands: the table src/data/landmarks/kyushu.ts.
// See docs/realmap_guide.md §7.

import type { BuildingDef } from '../types.ts';
import { LANDMARK_FUKUOKA_TOWER } from '../defs/landmark/kyushu/fukuoka_tower.ts';
import { LANDMARK_DAZAIFU_TENMANGU } from '../defs/landmark/kyushu/dazaifu_tenmangu.ts';
import { LANDMARK_KARATSU_CASTLE } from '../defs/landmark/kyushu/karatsu_castle.ts';
import { LANDMARK_YOSHINOGARI } from '../defs/landmark/kyushu/yoshinogari.ts';
import { LANDMARK_OURA_CATHEDRAL } from '../defs/landmark/kyushu/oura_cathedral.ts';
import { LANDMARK_GLOVER_HOUSE } from '../defs/landmark/kyushu/glover_house.ts';
import { LANDMARK_HASHIMA } from '../defs/landmark/kyushu/hashima.ts';
import { LANDMARK_KUMAMOTO_CASTLE } from '../defs/landmark/kyushu/kumamoto_castle.ts';
import { LANDMARK_BEPPU_UMI_JIGOKU } from '../defs/landmark/kyushu/beppu_umi_jigoku.ts';
import { LANDMARK_AOSHIMA_SHRINE } from '../defs/landmark/kyushu/aoshima_shrine.ts';
import { LANDMARK_KAGOSHIMA_AMU_RUN } from '../defs/landmark/kyushu/kagoshima_amu_run.ts';
import { LANDMARK_SAIGO_STATUE } from '../defs/landmark/kyushu/saigo_statue.ts';
import { LANDMARK_SHURI_CASTLE } from '../defs/landmark/kyushu/shuri_castle.ts';
import { LANDMARK_CHURAUMI_AQUARIUM } from '../defs/landmark/kyushu/churaumi_aquarium.ts';

export const LANDMARK_KYUSHU: readonly BuildingDef[] = [
  LANDMARK_FUKUOKA_TOWER, LANDMARK_DAZAIFU_TENMANGU, LANDMARK_KARATSU_CASTLE, LANDMARK_YOSHINOGARI, LANDMARK_OURA_CATHEDRAL,
  LANDMARK_GLOVER_HOUSE, LANDMARK_HASHIMA, LANDMARK_KUMAMOTO_CASTLE, LANDMARK_BEPPU_UMI_JIGOKU, LANDMARK_AOSHIMA_SHRINE,
  LANDMARK_KAGOSHIMA_AMU_RUN, LANDMARK_SAIGO_STATUE, LANDMARK_SHURI_CASTLE, LANDMARK_CHURAUMI_AQUARIUM,
];
