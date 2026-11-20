// Building types of the 'apartment' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/apartment/ and is listed here — this file belongs to the session making apartment buildings.
// See docs/buildings_guide.md.

import { APARTMENT_MOKUZO2 } from '../defs/apartment/mokuzo2.ts';
import { APARTMENT_TEKKOTSU3 } from '../defs/apartment/tekkotsu3.ts';
import { APARTMENT_DANCHI5 } from '../defs/apartment/danchi5.ts';
import { APARTMENT_MANSION8 } from '../defs/apartment/mansion8.ts';
import { APARTMENT_RYO } from '../defs/apartment/ryo.ts';
import { APARTMENT_SHATAKU } from '../defs/apartment/shataku.ts';
import type { BuildingDef } from '../types.ts';

export const APARTMENT: readonly BuildingDef[] = [APARTMENT_MOKUZO2, APARTMENT_TEKKOTSU3, APARTMENT_DANCHI5, APARTMENT_MANSION8, APARTMENT_RYO, APARTMENT_SHATAKU];
