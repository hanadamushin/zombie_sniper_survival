// Building types of the 'house' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/house/ and is listed here — this file belongs to the session making house buildings.
// See docs/buildings_guide.md.

import { HOUSE_WOOD2 } from '../defs/house/wood2.ts';
import { HOUSE_HIRAYA } from '../defs/house/hiraya.ts';
import { HOUSE_WAFU2 } from '../defs/house/wafu2.ts';
import { HOUSE_YOFU2 } from '../defs/house/yofu2.ts';
import { HOUSE_KOMINKA } from '../defs/house/kominka.ts';
import { HOUSE_NOKA } from '../defs/house/noka.ts';
import { HOUSE_NISETAI } from '../defs/house/nisetai.ts';
import { HOUSE_KYOSHO3 } from '../defs/house/kyosho3.ts';
import { HOUSE_PREFAB } from '../defs/house/prefab.ts';
import { HOUSE_TENPO } from '../defs/house/tenpo.ts';
import { HOUSE_BESSOU } from '../defs/house/bessou.ts';
import type { BuildingDef } from '../types.ts';

export const HOUSE: readonly BuildingDef[] = [HOUSE_WOOD2, HOUSE_HIRAYA, HOUSE_WAFU2, HOUSE_YOFU2, HOUSE_KOMINKA, HOUSE_NOKA, HOUSE_NISETAI, HOUSE_KYOSHO3, HOUSE_PREFAB, HOUSE_TENPO, HOUSE_BESSOU];
