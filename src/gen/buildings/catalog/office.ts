// Building types of the 'office' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/office/ and is listed here — this file belongs to the session making office buildings.
// See docs/buildings_guide.md.

import { OFFICE_CHOSHA } from '../defs/office/chosha.ts';
import { OFFICE_CLINIC } from '../defs/office/clinic.ts';
import { OFFICE_DEPART } from '../defs/office/depart.ts';
import { OFFICE_EKIMAE } from '../defs/office/ekimae.ts';
import { OFFICE_GLASS_LOW } from '../defs/office/glass_low.ts';
import { OFFICE_HOTEL_OFFICE } from '../defs/office/hotel_office.ts';
import { OFFICE_JUKU } from '../defs/office/juku.ts';
import { OFFICE_MANSION_SHOGYO } from '../defs/office/mansion_shogyo.ts';
import { OFFICE_MEDICAL_MALL } from '../defs/office/medical_mall.ts';
import { OFFICE_MID } from '../defs/office/mid.ts';
import { OFFICE_RC_OLD } from '../defs/office/rc_old.ts';
import { OFFICE_SOKO } from '../defs/office/soko.ts';
import { OFFICE_SHOTENGAI3 } from '../defs/office/shotengai3.ts';
import { OFFICE_SHOGYO } from '../defs/office/shogyo.ts';
import { OFFICE_SKYSCRAPER } from '../defs/office/skyscraper.ts';
import { OFFICE_SMALL } from '../defs/office/small.ts';
import { OFFICE_TENANT } from '../defs/office/tenant.ts';
import { OFFICE_TOWER20 } from '../defs/office/tower20.ts';
import { OFFICE_TOWER_MANSION } from '../defs/office/tower_mansion.ts';
import { OFFICE_ZAKKYO5 } from '../defs/office/zakkyo5.ts';
import { OFFICE_ZAKKYO_NARROW } from '../defs/office/zakkyo_narrow.ts';
import type { BuildingDef } from '../types.ts';

export const OFFICE: readonly BuildingDef[] = [OFFICE_ZAKKYO5, OFFICE_ZAKKYO_NARROW, OFFICE_SMALL, OFFICE_TENANT, OFFICE_SHOTENGAI3, OFFICE_RC_OLD, OFFICE_EKIMAE, OFFICE_CLINIC, OFFICE_JUKU, OFFICE_SOKO, OFFICE_GLASS_LOW, OFFICE_MID, OFFICE_TOWER20, OFFICE_HOTEL_OFFICE, OFFICE_SKYSCRAPER, OFFICE_TOWER_MANSION, OFFICE_SHOGYO, OFFICE_MEDICAL_MALL, OFFICE_MANSION_SHOGYO, OFFICE_CHOSHA, OFFICE_DEPART];
