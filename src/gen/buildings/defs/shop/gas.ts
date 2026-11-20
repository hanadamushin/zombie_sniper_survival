// ガソリンスタンド (07d-2b). A low building at the back (the shop with the cashier, the staff office,
// a two-bay service garage) and the forecourt in front: a canopy on four posts over two pump islands,
// a price pylon at the corner. Fuel is found in the shop (oil cans) and in the garage (drums).
//
//   +------------+---------------------------+
//   | staff (D)  |                           |   staff office: the desk and the safe; back door locked
//   +------D-----+   service garage          |
//   |cnt  shop   D   lift   tools    drums   |
//   +-D--[glass]-+--[ open bay ]--[shutter]--+   z = D
//        forecourt:  [pump  ||  pump]    [pump  ||  pump]   under the canopy
//   [pylon]                                                  z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { ring } from '../house/common.ts';
import { car, flatRoof, P, sign } from './common.ts';

export const SHOP_GAS: BuildingDef = {
  id: 'shop.gas',
  category: 'shop',
  variant: 'gas',
  kind: 'shop',
  size: { w: [22, 28], d: [20, 25] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.1,
  roof: 'flat',
  roofRise: 1.8,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_GAS, params, rng);
    const { w, d } = k;
    const t = 0.2;
    k.thick = t;
    const D = 8.5; // depth of the building
    const y = k.levelY(0);
    const xo = Math.round(w * 0.42 * 10) / 10; // shop | garage
    const zs = t + 2.6; // staff office | shop
    const zm = (zs + D - t) / 2; // door shop -> garage
    const brand = k.rand();
    const bay1 = xo + 0.4 + 1.6;
    const bay2 = (bay1 + 1.6 + w - t) / 2;

    // --- the building ---
    k.floor(0, 'concrete', [t, t, w - t, D - t]);
    ring(k, 0, [0, 0, w, D], {
      mat: 'siding', tint: 0.9,
      front: [k.door(t + 1.2, 'open', 1.0), k.window((t + 2.0 + xo - 0.3) / 2, xo - 2.6, { sill: 0.5, head: 2.6, broken: k.rand() < 0.4 }), { ...k.door(bay1, 'open', 3.2), head: 3.1 }, { ...k.door(bay2, 'shutter', 3.2), head: 3.1 }],
      back: [k.door(t + 1.4, 'locked'), k.window(xo + 3, 1.6, { sill: 1.4 })],
      left: [k.window((zs + D) / 2, 1.2)],
      right: [k.window(D / 2, 1.6, { sill: 1.5, head: 2.6 })],
    });
    k.partition(0, xo, t, xo, D - t, [k.door(zm - t)]);
    k.partition(0, t, zs, xo - P, zs, [k.door(xo - 1.0 - t)]);
    k.room(0, t, t, xo - P, zs - P, 'office');
    k.room(0, t, zs + P, xo - P, D - t, 'sales');
    k.room(0, xo + P, t, w - t, D - t, 'garage');
    // Shop: the cashier's counter on the left wall, oil cans by the window.
    k.furniture(0, t, zs + 0.5, t + 0.6, D - t - 1.6, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x+', table: 'sales' } });
    k.furniture(0, xo - 1.6, D - t - 0.45, xo - P, D - t, 1.4, 'shelf', { tint: brand, search: { kind: 'shelf', face: 'z-', table: 'fuel' } });
    if (k.rand() < 0.7) k.stain(0, t + 0.9, zs + 1.2, t + 2.0, zs + 2.4);
    // Staff office: a desk and the safe.
    k.furniture(0, t + 0.2, t, t + 1.6, t + 0.7, 0.75, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'z+', table: 'office' } });
    k.furniture(0, xo - P - 0.7, t, xo - P, t + 0.7, 1.0, 'steel', { tint: 0.2 });
    // Garage: a lift with a car up on it in the second bay, the tool chest, the drums.
    const lx = bay2;
    for (const [px, pz] of [[lx - 1.6, D - t - 5.6], [lx + 1.3, D - t - 5.6], [lx - 1.6, D - t - 1.0], [lx + 1.3, D - t - 1.0]] as const) k.box(0, px, y, pz, px + 0.3, y + 3.0, pz + 0.3, 'steel', { tint: 0.15 });
    k.box(0, lx - 0.85, y + 1.8, D - t - 5.4, lx + 0.85, y + 2.6, D - t - 1.1, 'steel', { tint: k.rand(), role: 'furniture' });
    k.furniture(0, xo + 2.2, t, xo + 4.2, t + 0.6, 1.1, 'steel', { tint: 0.05, search: { kind: 'cabinet', face: 'z+', table: 'tools' } });
    k.furniture(0, w - t - 1.2, t, w - t, t + 1.2, 0.95, 'rust', { search: { kind: 'crate', face: 'x-', table: 'fuel' } });
    k.furniture(0, xo + P, t, xo + 0.8, t + 1.6, 1.8, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'garage' } });
    k.stain(0, bay1 - 1.0, D - t - 3.6, bay1 + 0.6, D - t - 2.2, 'debris');
    flatRoof(k, [0, 0, w, D], { parapet: 0.5, parapetMat: 'siding', tint: 0.9 });
    sign(k, t + 0.2, xo, k.eaves - 0.75, k.eaves + 0.4, brand, { z: D });

    // --- the forecourt ---
    k.box(-1, 0, -0.3, D, w, 0.02, d, 'concrete', { layer: 'shell', tint: 0.7, solid: false });
    const cz0 = D + 1.5;
    const cz1 = d - 1.0;
    const zc = (cz0 + cz1) / 2;
    const top = k.eaves + 1.2;
    k.box(-1, 1.0, top - 0.35, cz0, w - 1.0, top, cz1, 'steel', { layer: 'shell', tint: 0.95 });
    sign(k, 1.0, w - 1.0, top - 0.6, top + 0.3, brand, { z: cz1 });
    sign(k, 1.0, w - 1.0, top - 0.6, top + 0.3, brand, { z: cz0 - 0.15 });
    const tipped = k.rand() < 0.5 ? 0 : 3;
    let n = 0;
    for (const ix of [w * 0.3, w * 0.7]) {
      k.box(-1, ix - 2.2, -0.2, zc - 0.55, ix + 2.2, 0.18, zc + 0.55, 'concrete', { layer: 'shell', tint: 0.9 });
      k.box(-1, ix - 0.2, 0.18, zc - 0.2, ix + 0.2, top - 0.35, zc + 0.2, 'steel', { layer: 'shell', tint: 0.95 });
      for (const px of [ix - 1.3, ix + 1.3]) {
        if (n++ === tipped) k.box(-1, px - 0.4, 0.18, zc + 0.55, px + 0.4, 0.68, zc + 2.3, 'appliance', { layer: 'shell', tint: brand, role: 'furniture' });
        else k.box(-1, px - 0.35, 0.18, zc - 0.4, px + 0.35, 1.9, zc + 0.4, 'appliance', { layer: 'shell', tint: brand, role: 'furniture' });
      }
    }
    car(k, w * 0.3, zc - 2.0, 'x', k.rand());
    if (tipped === 0) car(k, w * 0.7 + 0.6, zc + 2.1, 'x', k.rand());
    // Underground tank caps and the price pylon.
    for (let i = 0; i < 3; i++) k.box(-1, w - 6 + i * 1.2, 0.02, D + 0.5, w - 5.5 + i * 1.2, 0.06, D + 1.0, 'steel', { layer: 'shell', solid: false, tint: 0.3 + i * 0.2 });
    k.box(-1, 0.4, -0.5, d - 0.7, 0.7, top - 0.4, d - 0.4, 'steel', { layer: 'shell' });
    k.box(-1, -0.1, top - 2.6, d - 0.4, 1.2, top + 0.5, d - 0.25, 'sign', { layer: 'shell', tint: brand, solid: false });
    return k.finish();
  },
};
