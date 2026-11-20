// Building types of the 'shop' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/shop/ and is listed here — this file belongs to the session making shop buildings.
// See docs/buildings_guide.md.

import { SHOP_KONBINI } from '../defs/shop/konbini.ts';
import { SHOP_SHUTTERED } from '../defs/shop/shuttered.ts';
import { SHOP_GAS } from '../defs/shop/gas.ts';
import { SHOP_BANK_CHIHOU } from '../defs/shop/bank_chihou.ts';
import { SHOP_BANK_TOSHI } from '../defs/shop/bank_toshi.ts';
import { SHOP_FAMIRESU } from '../defs/shop/famiresu.ts';
import { SHOP_RAMEN } from '../defs/shop/ramen.ts';
import { SHOP_KAITENZUSHI } from '../defs/shop/kaitenzushi.ts';
import { SHOP_IZAKAYA } from '../defs/shop/izakaya.ts';
import { SHOP_FASTFOOD } from '../defs/shop/fastfood.ts';
import { SHOP_HOTEL_BIZ } from '../defs/shop/hotel_biz.ts';
import { SHOP_HOTEL_RESORT } from '../defs/shop/hotel_resort.ts';
import { SHOP_RYOKAN_ONSEN } from '../defs/shop/ryokan_onsen.ts';
import { SHOP_MINSHUKU } from '../defs/shop/minshuku.ts';
import { SHOP_KONBINI_ROAD } from '../defs/shop/konbini_road.ts';
import { SHOP_KONBINI_TENANT } from '../defs/shop/konbini_tenant.ts';
import type { BuildingDef } from '../types.ts';

export const SHOP: readonly BuildingDef[] = [
  SHOP_KONBINI,
  ...SHOP_SHUTTERED,
  SHOP_GAS,
  SHOP_KONBINI_ROAD,
  SHOP_KONBINI_TENANT,
  SHOP_BANK_CHIHOU,
  SHOP_BANK_TOSHI,
  SHOP_FAMIRESU,
  SHOP_RAMEN,
  SHOP_KAITENZUSHI,
  SHOP_IZAKAYA,
  SHOP_FASTFOOD,
  SHOP_HOTEL_BIZ,
  SHOP_HOTEL_RESORT,
  SHOP_RYOKAN_ONSEN,
  SHOP_MINSHUKU,
];
