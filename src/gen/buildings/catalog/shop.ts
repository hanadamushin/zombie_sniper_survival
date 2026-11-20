// Building types of the 'shop' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/shop/ and is listed here — this file belongs to the session making shop buildings.
// See docs/buildings_guide.md.

import { SHOP_KONBINI } from '../defs/shop/konbini.ts';
import { SHOP_BANK } from '../defs/shop/bank.ts';
import { SHOP_BANK_CITY } from '../defs/shop/bank_city.ts';
import { SHOP_FAMIRES } from '../defs/shop/famires.ts';
import { SHOP_KAITENZUSHI } from '../defs/shop/kaitenzushi.ts';
import { SHOP_FASTFOOD } from '../defs/shop/fastfood.ts';
import { SHOP_HOTEL_BIZ } from '../defs/shop/hotel_biz.ts';
import { SHOP_HOTEL_RESORT } from '../defs/shop/hotel_resort.ts';
import { SHOP_RYOKAN } from '../defs/shop/ryokan.ts';
import { SHOP_MINSHUKU } from '../defs/shop/minshuku.ts';
import { SHOP_GAS_STATION } from '../defs/shop/gas_station.ts';
import { SHOP_IZAKAYA } from '../defs/shop/izakaya.ts';
import { SHOP_RAMEN } from '../defs/shop/ramen.ts';
import { SHOP_KONBINI_ROAD } from '../defs/shop/konbini_road.ts';
import { SHOP_KONBINI_TENANT } from '../defs/shop/konbini_tenant.ts';
import {
  SHOP_SHUT_DENKI, SHOP_SHUT_DRUG, SHOP_SHUT_FUKU, SHOP_SHUT_HONYA, SHOP_SHUT_SAKAYA, SHOP_SHUT_YAKKYOKU, SHOP_SHUT_YAOYA,
} from '../defs/shop/shuttered.ts';
import type { BuildingDef } from '../types.ts';

export const SHOP: readonly BuildingDef[] = [
  SHOP_KONBINI,
  SHOP_BANK,
  SHOP_BANK_CITY,
  SHOP_KONBINI_ROAD,
  SHOP_KONBINI_TENANT,
  SHOP_FAMIRES,
  SHOP_RAMEN,
  SHOP_KAITENZUSHI,
  SHOP_IZAKAYA,
  SHOP_FASTFOOD,
  SHOP_HOTEL_BIZ,
  SHOP_HOTEL_RESORT,
  SHOP_RYOKAN,
  SHOP_MINSHUKU,
  SHOP_GAS_STATION,
  SHOP_SHUT_YAOYA,
  SHOP_SHUT_HONYA,
  SHOP_SHUT_YAKKYOKU,
  SHOP_SHUT_DENKI,
  SHOP_SHUT_FUKU,
  SHOP_SHUT_DRUG,
  SHOP_SHUT_SAKAYA,
];
