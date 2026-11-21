// Building types of the 'base' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/base/ and is listed here — this file belongs to the session making base buildings.
// See docs/buildings_guide.md.

import { BASE_BUILDINGS } from '../defs/base/hall.ts';
import type { BuildingDef } from '../types.ts';
import { BASE_JGSDF } from '../defs/base/jgsdf.ts';
import { BASE_JMSDF } from '../defs/base/jmsdf.ts';
import { BASE_JASDF } from '../defs/base/jasdf.ts';

export const BASE: readonly BuildingDef[] = [...BASE_BUILDINGS, ...BASE_JGSDF, BASE_JMSDF, BASE_JASDF];
