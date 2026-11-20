// コンビニ (07d sample). One storey, flat roof with a sign along the front parapet.
//
//   +-----------------+------+
//   | backroom   (Dx) |toilet|      back door (Dx) locked
//   +--D--------------+--D---+
//   |          B (back aisle)  |
//   |c| L |g| a |g| a |cnt|stf|    c coolers, g gondolas, a aisles, cnt counter, stf staff side
//   |          F (front aisle) |
//   +=====glass=====[auto]=====+    the automatic door is broken and stays open
//
// Every walkable strip is its own rectangular room so that zombies (and the tests) can go between
// any two doors in straight lines.

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';

const P = ARCH.wall.partition / 2;

export const SHOP_KONBINI: BuildingDef = {
  id: 'shop.konbini',
  category: 'shop',
  variant: 'konbini',
  kind: 'shop',
  size: { w: [12, 16], d: [10, 13] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 0.9,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_KONBINI, params, rng);
    const { w, d } = k;
    const t = 0.25;
    k.thick = t;
    const y = k.levelY(0);
    const zb = t + 3.0; // backroom | sales floor
    const xt = w - t - 2.0; // backroom | toilet
    const zM0 = zb + P + 1.5; // shelving zone between the back and front aisles
    const zM1 = d - t - 1.8;
    const xL = t + 0.75; // coolers along the left wall, then the left aisle
    const xA = xL + 1.4;
    const xCounter = w - t - 2.6;
    const span = xCounter - xA;
    const n = Math.max(1, Math.floor(span / 2.3));
    const aisle = span / n - 1.0;
    const doorX = w - 2.4;
    const brand = k.rand();

    k.floor(0, 'tileFloor');
    const nWin = Math.max(1, Math.floor((doorX - 0.9 - 0.4) / 2.2));
    const fronts = k.evenly(0.4, doorX - 0.95, nWin).map((x) => k.window(x, (doorX - 1.35) / nWin - 0.2, { sill: 0.1, head: 2.7, broken: k.rand() < 0.3 }));
    k.outerWalls(0, {
      mat: 'plaster', tint: brand, parapet: 0.9,
      front: [...fronts, k.door(doorX, 'open', ARCH.door.wide), k.window((doorX + 0.95 + w - 0.3) / 2, w - 0.3 - doorX - 1.05, { sill: 0.1, head: 2.7 })],
      back: [k.door(t + 1.6, 'locked'), k.window((xt + w - t) / 2, 0.6, { sill: 1.5 })],
    });
    // Broken automatic door: the two leaves pushed aside behind the glass.
    k.part({ shape: 'box', x0: doorX - 1.9, x1: doorX - 0.95, z0: d - t - 0.08, z1: d - t - 0.03, y0: y, y1: y + 2.1, mat: 'glass', layer: 'shell', level: 0, solid: false });
    k.roofFlat({ mat: 'concrete', parapet: 0.9, parapetMat: 'plaster', tint: brand });
    k.part({ shape: 'box', x0: 0.4, x1: w - 0.4, z0: d, z1: d + 0.15, y0: k.eaves - 0.7, y1: k.eaves + 0.6, mat: 'sign', layer: 'shell', level: -1, tint: brand, solid: false });

    // Back of house.
    k.partition(0, t, zb, w - t, zb, [k.door(1.2 - t + t), k.door(xt + 1.0 - t)]);
    k.partition(0, xt, t, xt, zb - P, [], { mat: 'plaster' });
    k.room(0, t, t, xt - P, zb - P, 'backroom');
    k.room(0, xt + P, t, w - t, zb - P, 'toilet');
    k.furniture(0, t + 2.5, t, xt - 0.5, t + 0.6, 2.0, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'storage' } });
    k.furniture(0, xt - 1.1, zb - 1.1, xt - P, zb - P, 1.1, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'x-', table: 'grocery' } });
    k.furniture(0, w - t - 0.5, t + 0.2, w - t, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });
    k.furniture(0, xt + P + 0.1, t, xt + 0.6, t + 0.6, 0.45, 'appliance', { solid: false });

    // Sales floor: back aisle B, front aisle F, the left aisle, the aisles between the gondolas, behind the counter.
    const B = k.room(0, t, zb + P, w - t, zM0, 'sales');
    const F = k.room(0, t, zM1, w - t, d - t, 'sales');
    const L = k.room(0, xL, zM0, xA, zM1, 'sales');
    k.join(B, L);
    k.join(L, F);
    k.furniture(0, t, zM0, xL, zM1, 2.0, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'grocery' } });
    for (let i = 0; i < n; i++) {
      const gx = xA + i * (1.0 + aisle);
      k.furniture(0, gx, zM0, gx + 1.0, zM1, 1.5, 'shelf', { tint: brand, search: { kind: 'shelf', face: 'x+', table: 'grocery' } });
      const a = k.room(0, gx + 1.0, zM0, gx + 1.0 + aisle, zM1, 'sales');
      k.join(B, a);
      k.join(a, F);
    }
    const staff = k.room(0, xCounter + 0.7, zM0, w - t, zM1, 'sales');
    k.join(B, staff);
    k.join(staff, F);
    k.furniture(0, xCounter, zM0 + 0.6, xCounter + 0.7, zM1 - 0.3, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x+', table: 'sales' } });
    k.furniture(0, w - t - 0.45, zM0 + 0.8, w - t, zM1 - 0.8, 1.8, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'pharmacy' } });
    if (k.rand() < 0.8) k.stain(0, xCounter - 1.4, zM1 - 0.2, xCounter - 0.2, zM1 + 0.9);
    k.stain(0, xA + 0.3, zM1 + 0.2, xA + 1.6, zM1 + 0.9, 'debris');
    return k.finish();
  },
};
