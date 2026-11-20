// ビルの 1 階に入るコンビニ (07d-2b). Only the ground storey: a narrow, deep tenant floor whose
// ceiling slab is the top of the blueprint (no parapet, nothing on it), so the office blocks of
// 07d-2c can stand their upper floors on it. The fascia sign is on the front of the storey itself.
//
//   +------------------+------+
//   | back room        |toilet|   back door locked
//   +--D---------------+--D---+
//   | B back aisle            |
//   |  L  |=| a |=| a |cooler|   gondolas front-to-back, coolers along the right wall
//   |-----|=|   |=|   |      |
//   |stf|c|=|   |=|   |      |   staff behind the counter, entered from the left aisle
//   |   |n| F front strip     |
//   +===glass===[auto]=glass==+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

export const SHOP_KONBINI_TENANT: BuildingDef = {
  id: 'shop.konbini_tenant',
  category: 'shop',
  variant: 'konbini_tenant',
  kind: 'shop',
  size: { w: [8, 11], d: [14, 18] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 0.1,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_KONBINI_TENANT, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const zb = t + 2.8; // back room | sales
    const xt = w - t - 1.8; // back room | toilet
    const zM0 = zb + P + 1.4; // back aisle | gondolas
    const zM1 = d - t - 2.0; // gondolas | front strip
    const zs = d - t - 4.0; // left aisle | staff side
    const xs = t + 1.2; // staff | counter
    const xg = t + 1.8; // first gondola
    const xk = w - t - 0.7; // coolers
    const zone = xk - xg;
    const n = Math.max(1, Math.floor(zone / 2.3));
    const aisle = zone / n - 1.0;
    const doorX = (xg + w - t) / 2;
    const brand = k.rand();

    k.floor(0, 'tileFloor');
    const lw = doorX - 0.95 - 0.5;
    const rw = w - 0.3 - doorX - 0.95 - 0.2;
    k.outerWalls(0, {
      mat: 'concrete', tint: k.rand(),
      front: [k.window(0.25 + lw / 2, lw, { sill: 0.15, head: 2.9, broken: k.rand() < 0.3 }), k.door(doorX, 'open', ARCH.door.wide), k.window(doorX + 0.95 + 0.1 + rw / 2, rw, { sill: 0.15, head: 2.9 })],
      back: [k.door(t + 1.0, 'locked')],
    });
    // The ceiling slab is the floor of whatever building stands on top.
    k.floor(1, 'concrete', [0, 0, w, d]);
    sign(k, 0.1, w - 0.1, k.eaves - 0.65, k.eaves - 0.05, brand);
    // Broken automatic door: one leaf pushed aside behind the glass.
    k.box(0, doorX - 1.85, k.levelY(0), d - t - 0.09, doorX - 0.95, k.levelY(0) + 2.1, d - t - 0.04, 'glass', { layer: 'shell', solid: false });

    // --- back of house ---
    k.partition(0, t, zb, w - t, zb, [k.door(1.0), k.door((xt + w - t) / 2 - t)]);
    k.partition(0, xt, t, xt, zb - P);
    k.room(0, t, t, xt - P, zb - P, 'backroom');
    k.room(0, xt + P, t, w - t, zb - P, 'toilet');
    k.furniture(0, t + 2.0, t, xt - P, t + 0.5, 2.0, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'storage' } });
    k.furniture(0, t, t, t + 1.0, t + 1.0, 1.0, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'z+', table: 'grocery' } });
    k.furniture(0, xt - P - 0.7, zb - P - 1.4, xt - P, zb - P - 0.2, 0.75, 'wood', { tint: 0.6, search: { kind: 'desk', face: 'x-', table: 'office' } });
    k.furniture(0, w - t - 0.5, t + 0.2, w - t, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });

    // --- sales floor ---
    const B = k.room(0, t, zb + P, w - t, zM0, 'sales');
    const F = k.room(0, xg, zM1, w - t, d - t, 'sales');
    const L = k.room(0, t, zM0, xg, zs, 'sales');
    const staff = k.room(0, t, zs, xs, d - t, 'sales');
    k.join(B, L);
    k.join(L, staff);
    for (let i = 0; i < n; i++) {
      const gx = xg + i * (1.0 + aisle);
      k.furniture(0, gx, zM0, gx + 1.0, zM1, 1.5, 'shelf', { tint: brand, search: i % 2 === 0 ? { kind: 'shelf', face: 'x+', table: 'grocery' } : undefined });
      const a = k.room(0, gx + 1.0, zM0, gx + 1.0 + aisle, zM1, 'sales');
      k.join(B, a);
      k.join(a, F);
    }
    k.furniture(0, xk, zM0 + 0.2, w - t, zM1, 2.0, 'appliance', { search: { kind: 'fridge', face: 'x-', table: 'grocery' } });
    k.furniture(0, xs, zs + 0.2, xg, d - t - 0.3, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x-', table: 'sales' } });
    k.stain(0, xg + 1.1, zM1 + 0.3, xg + 2.4, zM1 + 1.4);
    k.stain(0, t + 0.3, zM0 + 0.4, t + 1.4, zM0 + 1.6, 'debris');
    return k.finish();
  },
};
