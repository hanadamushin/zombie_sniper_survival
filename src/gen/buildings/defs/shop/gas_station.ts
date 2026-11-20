// ガソリンスタンド (07d-2b). The forecourt in front under the big canopy (two islands with their
// pumps, the columns, a car or two left at the pumps), the low building behind it: the shop with the
// office behind it, the toilet (its door outside), the store full of fuel cans and oil, and the
// service bay with its wide door, the car lift, the tool cabinets and the bench. Fuel is found in
// the store and the bay (the `fuel` table).
//
//   +--------+----+-------+------------------+
//   | office | WC | store D   service bay     |
//   +---D----+    | [fuel]|   [lift] [tools]  |
//   |  shop  |    |       |                   |
//   +=[D]====+-D--+-------+=====[  wide  ]====+
//        canopy  [pump|island|pump]  [pump|island|pump]
//                     o                   o          (columns)

import { ARCH } from '../../../../data/architecture.ts';
import { ring } from '../house/common.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car, clearOfWays, P, poleSign, sign, tall, toppled } from './common.ts';

export const SHOP_GAS_STATION: BuildingDef = {
  id: 'shop.gas_station',
  category: 'shop',
  variant: 'gas_station',
  kind: 'shop',
  size: { w: [24, 30], d: [20, 26] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 2.6,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_GAS_STATION, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.exterior;
    k.thick = t;
    const y = k.levelY(0);
    const brand = k.pick([0.05, 0.3, 0.55, 0.85]);
    const zb = k.range(8.0, 9.0); // the building's front face
    const zf = zb - t;
    const zm = t + 3.4; // office | shop
    const x1 = t + 7.0; // shop | toilet
    const x2 = x1 + 1.8; // toilet | store
    const xS = x2 + 3.0; // store | bay
    const shopDoor = x1 - 1.5;
    const bayDoor = (xS + w - t) / 2;

    // ---- The building.
    k.floor(0, 'concrete', [t, t, w - t, zf]);
    ring(k, 0, [0, 0, w, zb], {
      mat: 'siding', tint: brand,
      front: [
        k.window((t + shopDoor - 0.6) / 2 + 0.1, shopDoor - 0.6 - t - 0.6, { sill: 0.3, head: 2.7, broken: k.rand() < 0.4 }),
        k.door(shopDoor, 'open', 1.2),
        k.door(x1 + 0.9),
        k.window((x2 + xS) / 2, 1.0, { sill: 1.5 }),
        tall(k.door(bayDoor, 'open', Math.min(3.4, w - t - xS - 2.0)), 3.2),
      ],
      back: [k.window(t + 2.0, 1.2, { sill: 1.2 }), k.window((xS + w) / 2, 2.0, { sill: 1.6, head: 2.6 })],
      right: [k.window(zb / 2, 1.6, { sill: 1.4 })],
    });
    k.floor(1, 'concrete', [t, t, w - t, zf]);
    const e = k.eaves;
    for (const [x0, z0, xx, zz] of [[0, zb - t, w, zb], [0, 0, w, t], [0, t, t, zb - t], [w - t, t, w, zb - t]] as const) k.box(-1, x0, e, z0, xx, e + 0.6, zz, 'siding', { layer: 'shell', tint: brand });
    sign(k, 0.4, e - 0.5, zb, xS - 0.4, e + 0.5, zb + 0.12, brand);

    // Shop (counter, oil, drinks) and the office behind it.
    k.partition(0, t, zm, x1, zm, [k.door(shopDoor - t)]);
    k.room(0, t, zm + P, x1 - P, zf, 'sales');
    k.furniture(0, t, zm + 0.6, t + 0.6, zf - 0.6, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x+', table: 'sales' } });
    k.furniture(0, t + 1.8, zm + P, shopDoor - 1.1, zm + 0.55, 1.8, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'garage' } });
    k.furniture(0, x1 - P - 0.7, zm + P, x1 - P, zm + 1.0, 1.9, 'appliance', { tint: 0.2, search: { kind: 'fridge', face: 'z+', table: 'grocery' } });
    k.room(0, t, t, x1 - P, zm - P, 'office');
    k.furniture(0, t, t + 0.4, t + 0.8, t + 1.9, 0.72, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'x+', table: 'office' } });
    k.furniture(0, t + 2.0, t, t + 3.4, t + 0.5, 1.4, 'steel', { tint: 0.7, search: { kind: 'cabinet', face: 'z+', table: 'office' } });
    // Toilet (door outside), store (fuel cans) off the bay.
    k.partition(0, x1, t, x1, zf);
    k.partition(0, x2, t, x2, zf);
    k.room(0, x1 + P, t, x2 - P, zf, 'toilet');
    k.furniture(0, x1 + P, t + 0.2, x2 - P, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'z+', table: 'toilet' } });
    k.partition(0, xS, t, xS, zf, [k.door(zb / 2 - t)]);
    k.room(0, x2 + P, t, xS - P, zf, 'storage');
    k.furniture(0, x2 + P, t, xS - 0.6, t + 0.55, 1.9, 'shelf', { tint: 0.3, search: { kind: 'shelf', face: 'z+', table: 'fuel' } });
    k.furniture(0, x2 + P, zf - 1.4, x2 + 1.1, zf - 0.4, 0.9, 'rust', { search: { kind: 'crate', face: 'x+', table: 'fuel' } });
    // Service bay.
    k.room(0, xS + P, t, w - t, zf, 'garage');
    const ways: [number, number][] = [[bayDoor, zf - 0.55], [xS + 0.61, zb / 2]];
    k.furniture(0, xS + P, t, xS + 2.4, t + 0.6, 1.8, 'steel', { tint: 0.85, search: { kind: 'cabinet', face: 'z+', table: 'tools' } });
    k.furniture(0, w - t - 0.8, t + 0.5, w - t, zf - 1.5, 0.9, 'wood', { tint: 0.4, search: { kind: 'table', face: 'x-', table: 'workshop' } });
    // The lift with a car up on it, where it does not stand in the way.
    const lx = Math.max(xS + 3.2, bayDoor + 0.6);
    const lift: [number, number, number, number] = [lx, t + 1.2, lx + 2.0, Math.min(zf - 1.4, t + 5.6)];
    if (lift[2] < w - t - 1.4 && clearOfWays(ways, lift, 0.35)) {
      for (const xx of [lift[0], lift[2] - 0.25]) k.furniture(0, xx, (lift[1] + lift[3]) / 2 - 0.2, xx + 0.25, (lift[1] + lift[3]) / 2 + 0.2, 2.4, 'steel', { tint: 0.2 });
      k.box(0, lift[0] + 0.1, y + 1.4, lift[1], lift[2] - 0.1, y + 2.2, lift[3], 'steel', { tint: k.rand(), role: 'furniture' });
    }
    const tires: [number, number, number, number] = [xS + 2.8, t, xS + 3.6, t + 0.8];
    if (clearOfWays(ways, tires, 0.35)) k.furniture(0, tires[0], tires[1], tires[2], tires[3], 1.0, 'rust', { tint: 0.2, search: { kind: 'crate', face: 'z+', table: 'garage' } });
    k.stain(0, bayDoor - 1.2, zf - 3.0, bayDoor + 0.4, zf - 1.6, 'debris');
    if (k.rand() < 0.6) toppled(k, 0, xS + 0.6, zf - 1.2, xS + 2.0, zf - 0.6, 'steel');

    // ---- Forecourt: asphalt, two islands with pumps, the canopy on its columns, cars.
    k.box(-1, 0, 0, zb, w, 0.02, d, 'asphalt', { layer: 'shell', solid: false });
    const cz0 = zb + 1.8;
    const cz1 = d - 2.2;
    const czm = (cz0 + cz1) / 2;
    const ch = 4.6;
    k.box(-1, 2.0, ch, cz0, w - 2.0, ch + 0.25, cz1, 'concrete', { layer: 'shell', tint: 0.9 });
    sign(k, 1.95, ch - 0.25, cz1, w - 1.95, ch + 0.55, cz1 + 0.06, brand);
    sign(k, 1.95, ch - 0.25, cz0 - 0.06, w - 1.95, ch + 0.55, cz0, brand);
    for (const ix of [w * 0.33, w * 0.67]) {
      const iz0 = czm - 2.6;
      const iz1 = czm + 2.6;
      k.box(-1, ix - 0.5, -0.3, iz0, ix + 0.5, 0.15, iz1, 'concrete', { layer: 'shell', tint: 0.8 });
      k.box(-1, ix - 0.2, 0.15, czm - 0.2, ix + 0.2, ch, czm + 0.2, 'steel', { layer: 'shell', tint: 0.6 });
      for (const pz of [iz0 + 0.5, iz1 - 1.3]) {
        k.box(-1, ix - 0.35, 0.15, pz, ix + 0.35, 1.9, pz + 0.8, 'appliance', { layer: 'shell', tint: brand, role: 'furniture' });
        k.box(-1, ix + 0.35, 0.8, pz + 0.3, ix + 0.6, 0.85, pz + 0.5, 'steel', { layer: 'shell', solid: false });
      }
      if (k.rand() < 0.5) car(k, ix + 2.2, czm, 'z');
    }
    // Price board and the tall sign at the front corner.
    k.box(-1, 0.4, 0, d - 1.4, 0.6, 2.4, d - 0.4, 'sign', { layer: 'shell', tint: 1 - brand });
    poleSign(k, w - 0.6, d - 0.6, e + 2.5, 2.2, brand);
    return k.finish();
  },
};
