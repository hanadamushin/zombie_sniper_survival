// Building types of the 'base' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/base/ and is listed here — this file belongs to the session making base buildings.
// See docs/buildings_guide.md.

import { BASE_BUILDINGS } from '../defs/base/hall.ts';
import type { BuildingDef } from '../types.ts';

export const BASE: readonly BuildingDef[] = [...BASE_BUILDINGS];
