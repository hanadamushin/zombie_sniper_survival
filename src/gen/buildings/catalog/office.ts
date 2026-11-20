// Building types of the 'office' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/office/ and is listed here — this file belongs to the session making office buildings.
// See docs/buildings_guide.md.

import { OFFICE_ZAKKYO5 } from '../defs/office/zakkyo5.ts';
import type { BuildingDef } from '../types.ts';

export const OFFICE: readonly BuildingDef[] = [OFFICE_ZAKKYO5];
