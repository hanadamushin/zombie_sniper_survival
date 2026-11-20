// ラーメン屋 (07d-2b). A small one-storey shop: a long counter down the side with stools, the open
// kitchen behind it (stock pots on the stoves), the ticket machine by the sliding door, the toilet
// and the store at the back. A big sign board over the front, red lanterns and a noren.
//
//   +------+------------------+
//   |  WC  |  store     [Dx]  |    back door: seeded open / locked
//   +--D---+---D--------------+
//   |  A   |c|  kitchen  [st] |    A: the customers' side (stools drawn only), c: the counter
//   | (tbl)|c|  [prep]   [st] |    st: stoves along the right wall
//   +------+----- low wall --g+
//   | [tm]   F (entrance)     |    tm: ticket machine
//   +---[door]---[window]-----+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign, stools } from './common.ts';

export const SHOP_RAMEN: BuildingDef = {
  id: 'shop.ramen',
  category: 'shop',
  variant: 'ramen',
  kind: 'shop',
  size: { w: [7, 9.5], d: [10, 13] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 1.8,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_RAMEN, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.exterior;
    k.thick = t;
    const y = k.levelY(0);
    const red = k.pick([0.55, 0.6, 0.85]);
    const tables = w >= 8.4; // a row of two-seat tables along the left wall
    const xc = t + (tables ? 2.3 : 1.5) + 0.45; // the counter's customer face
    const xk = xc + 0.55; // counter | kitchen
    const zF = d - t - 1.9; // entrance | the rest
    const zs = t + 2.2; // store and toilet | counter and kitchen
    const doorX = (t + xc) / 2 + 0.7;

    k.floor(0, 'tileFloor');
    k.outerWalls(0, {
      mat: 'siding', tint: k.rand(), parapet: 0.6,
      front: [k.door(doorX, 'open', 1.2), k.window((doorX + 0.9 + w - 0.5) / 2, w - 0.5 - doorX - 1.1, { sill: 0.8, head: 2.3, broken: k.rand() < 0.5 })],
      back: [k.door(w - t - 0.9, k.rand() < 0.35 ? 'open' : 'locked'), k.window(t + 0.8, 0.5, { sill: 1.6 })],
      right: [k.window((zs + zF) / 2, 1.4, { sill: 1.2 })],
    });
    k.roofFlat({ mat: 'concrete', parapet: 0.6, parapetMat: 'siding' });
    // The big sign board over the front (above the parapet), lanterns, noren, the duct up the side.
    sign(k, 0.1, y + 2.6, d, w - 0.1, k.eaves + 1.7, d + 0.2, red);
    for (const x of [doorX - 0.9, doorX + 0.9]) k.box(-1, x - 0.2, y + 1.7, d + 0.05, x + 0.2, y + 2.35, d + 0.45, 'sign', { layer: 'shell', tint: 0.55, solid: false });
    k.box(-1, doorX - 0.7, y + 1.55, d + 0.02, doorX + 0.7, y + 2.15, d + 0.05, 'fabric', { layer: 'shell', tint: 0.3, solid: false });
    k.box(-1, w, y + 0.8, 1.0, w + 0.45, k.eaves + 1.2, 1.45, 'steel', { layer: 'shell', solid: false });

    // Entrance (ticket machine) and the low wall with the swing gate into the kitchen.
    const F = k.room(0, t, zF + P, w - t, d - t, 'hall');
    k.furniture(0, t, d - t - 0.6, t + 0.75, d - t, 1.7, 'appliance', { tint: 0.4 });
    k.partition(0, xk, zF, w - t, zF, [k.door(0.75, 'open')], { mat: 'counter', tint: 0.3, y1: y + 1.1 });
    k.partition(0, xc, zF, xk, zF, [], { mat: 'counter', tint: 0.3, y1: y + 1.1 });
    k.stain(0, doorX - 0.5, d - t - 1.4, doorX + 0.6, d - t - 0.4, 'debris');

    // The customers' side: counter and stools, the two-seat tables.
    const A = k.room(0, t, zs + P, xc, zF - P, 'canteen');
    k.join(A, F);
    k.furniture(0, xc, zs + 0.3, xk, zF - P, 1.05, 'counter', { tint: 0.3, search: { kind: 'counter', face: 'x-', table: 'canteen' } });
    stools(k, 0, 'z', zs + 0.4, zF - 0.4, xc - 0.3);
    if (tables) for (let z = zs + 0.8; z + 0.6 < zF - 0.8; z += 1.6) k.furniture(0, t, z, t + 0.6, z + 0.6, 0.72, 'wood', { tint: 0.6 });
    if (k.rand() < 0.75) k.stain(0, t + 0.4, zF - 2.2, xc - 0.5, zF - 1.1);

    // Kitchen: stoves with stock pots on the right wall, a prep table, the fridge.
    k.room(0, xk, zs + P, w - t, zF - P, 'kitchen');
    k.furniture(0, w - t - 0.7, zs + 0.5, w - t, zF - 1.3, 0.9, 'steel', { tint: 0.5, search: { kind: 'counter', face: 'x-', table: 'kitchen' } });
    for (let z = zs + 0.7; z + 0.5 < zF - 1.4; z += 0.8) k.box(0, w - t - 0.6, y + 0.9, z, w - t - 0.1, y + 1.45, z + 0.5, 'steel', { tint: 0.2, role: 'furniture' });
    if (w - t - 0.7 - xk > 3.2) k.furniture(0, xk + 1.6, zs + 1.8, xk + 2.3, zF - 1.4, 0.9, 'steel', { tint: 0.4 });
    k.furniture(0, xk + 1.5, zs + P, xk + 2.2, zs + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });

    // Back: toilet off the customers' side, the store (noodles, soup bones) behind the kitchen.
    k.partition(0, t, zs, w - t, zs, [k.door(1.1), k.door(xk + 0.75 - t)]);
    k.partition(0, xc, t, xc, zs - P);
    k.room(0, t, t, xc - P, zs - P, 'toilet');
    k.furniture(0, t, t + 0.2, t + 0.5, t + 0.9, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x+', table: 'toilet' } });
    k.room(0, xc + P, t, w - t, zs - P, 'storage');
    k.furniture(0, xc + 1.9, t, w - t - 1.5, t + 0.5, 1.9, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'grocery' } });
    k.furniture(0, xc + P, zs - 1.0, xc + 0.9, zs - P, 0.8, 'wood', { tint: 0.5, search: { kind: 'crate', face: 'x+', table: 'storage' } });
    // Beer crates stacked by the back door, outside.
    k.box(-1, w - t - 2.0, 0, -0.5, w - t - 1.5, 0.9, -0.1, 'sign', { layer: 'shell', tint: 0.85, solid: false });
    return k.finish();
  },
};
