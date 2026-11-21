// Building types of the 'public' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/public/ and is listed here — this file belongs to the session making public buildings.
// See docs/buildings_guide.md.

import type { BuildingDef } from '../types.ts';
import { SCHOOLS } from '../defs/public/schools.ts';
import { UNIVERSITIES } from '../defs/public/university.ts';
import { SAFETY } from '../defs/public/safety.ts';
import { HOSPITALS } from '../defs/public/hospital.ts';
import { FACTORIES } from '../defs/public/factory.ts';

export const PUBLIC: readonly BuildingDef[] = [...SCHOOLS, ...UNIVERSITIES, ...SAFETY, ...HOSPITALS, ...FACTORIES];
