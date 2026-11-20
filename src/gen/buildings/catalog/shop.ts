// Building types of the 'shop' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/shop/ and is listed here — this file belongs to the session making shop buildings.
// See docs/buildings_guide.md.

import { SHOP_KONBINI } from '../defs/shop/konbini.ts';
import type { BuildingDef } from '../types.ts';

export const SHOP: readonly BuildingDef[] = [SHOP_KONBINI];
