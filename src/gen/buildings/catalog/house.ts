// Building types of the 'house' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/house/ and is listed here — this file belongs to the session making house buildings.
// See docs/buildings_guide.md.

import { HOUSE_WOOD2 } from '../defs/house/wood2.ts';
import type { BuildingDef } from '../types.ts';

export const HOUSE: readonly BuildingDef[] = [HOUSE_WOOD2];
