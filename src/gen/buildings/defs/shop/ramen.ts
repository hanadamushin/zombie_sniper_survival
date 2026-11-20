// ラーメン屋 (07d-2b). A narrow one-storey shop under a gable roof whose end faces the street: a
// row of stools along the counter down the left side (the ticket machine by the door), two small
// tables at the front, the kitchen behind the counter (stock pots, the stove, a fridge), the store
// room and the toilet at the back. Red noren and a lantern over the sliding door.
//
//   +-------+---------------+
//   |toilet | store (D)     |   back door locked
//   +--D----+--D------------+
//   |C|cnt| kitchen         |
//   |o|cnt|                 |
//   |u|cnt+-------------D---+
//   |n|  tables             |
//   +-D---+=====window======+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

export const SHOP_RAMEN: BuildingDef = {
  id: 'shop.ramen',
  category: 'shop',
  variant: 'ramen',
  kind: 'shop',
  size: { w: [7, 9], d: [10, 13] },
  storeys: 1,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'gable',
  roofRise: 1.8,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_RAMEN, params, rng);
    const { w, d } = k;
    const t = 0.2;
    k.thick = t;
    const y = k.levelY(0);
    const zb = t + 2.4; // toilet and store | the shop
    const xc = t + 1.9; // customers | counter
    const xq = xc + 0.6; // counter | kitchen
    const xb = t + 1.9; // toilet | store
    const zT = d - t - 2.6; // kitchen | tables
    const doorX = (t + xc) / 2;
    const tint = k.rand();
    const red = 0.05 + k.rand() * 0.1;

    k.floor(0, 'tileFloor', undefined, { tint: 0.3 });
    k.outerWalls(0, {
      mat: k.pick(['mortar', 'siding', 'woodDark'] as const), tint,
      front: [k.door(doorX, 'open', 1.0), k.window((xc + 0.3 + w - 0.4) / 2, w - 0.7 - xc - 0.4, { sill: 0.9, head: 2.2, broken: k.rand() < 0.4 })],
      back: [k.door(w - t - 1.2, 'locked'), k.window(t + 1.0, 0.5, { sill: 1.6 })],
      left: [k.window((zb + zT) / 2, 1.2, { sill: 1.3 })],
      right: [k.window((zb + zT) / 2, 1.0, { sill: 1.3, broken: k.rand() < 0.5 })],
    });
    k.roofGable({ mat: 'metalRoof', tint: k.rand(), axis: 'z' });
    // Signboard on the gable end, the noren over the door, a red lantern.
    sign(k, 0.6, w - 0.6, k.eaves + 0.1, k.eaves + 1.0, red, { z: d + 0.02 });
    k.box(-1, doorX - 0.6, y + 1.55, d, doorX + 0.6, y + 2.05, d + 0.04, 'fabric', { layer: 'shell', tint: red, solid: false });
    k.box(-1, xc + 0.1, y + 1.9, d + 0.1, xc + 0.5, y + 2.5, d + 0.5, 'paper', { layer: 'shell', tint: red, solid: false });

    // --- back: toilet (from the customers' side) and the store (from the kitchen) ---
    k.partition(0, t, zb, w - t, zb, [k.door(doorX - t), k.door(xb + 1.0 - t)]);
    k.partition(0, xb, t, xb, zb - P);
    k.room(0, t, t, xb - P, zb - P, 'toilet');
    k.room(0, xb + P, t, w - t, zb - P, 'storage');
    k.furniture(0, t, t + 0.2, t + 0.5, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x+', table: 'toilet' } });
    k.furniture(0, xb + P, t, w - t - 1.8, t + 0.5, 1.9, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'grocery' } });
    k.furniture(0, w - t - 1.0, zb - P - 1.0, w - t, zb - P, 0.9, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'x-', table: 'storage' } });

    // --- the shop ---
    const C = k.room(0, t, zb + P, xc, d - t, 'canteen');
    const T = k.room(0, xc, zT + P, w - t, d - t, 'canteen');
    k.join(C, T);
    k.partition(0, xc, zT, w - t, zT, [k.door(w - t - 0.7 - xc)]);
    k.room(0, xq, zb + P, w - t, zT - P, 'kitchen');
    k.furniture(0, xc, zb + P, xq, zT - P, 1.0, 'counter', { tint: 0.25, search: { kind: 'counter', face: 'x-', table: 'canteen' } });
    for (let z = zb + 0.8; z < zT - 0.6; z += 0.8) k.furniture(0, xc - 0.45, z, xc - 0.15, z + 0.3, 0.65, 'steel', { tint: red, solid: false }); // stools
    k.furniture(0, t, zT - 1.3, t + 0.55, zT - 0.5, 1.6, 'appliance', { tint: 0.9 }); // ticket machine
    for (const x of [xc + 1.2, xc + 3.0]) if (x + 0.8 < w - t - 0.3) k.furniture(0, x, d - t - 0.8, x + 0.8, d - t - 0.1, 0.72, 'wood', { tint: 0.4 });
    // Kitchen: a work top along the counter, the stove and the stock pots, a fridge.
    k.furniture(0, xq, zb + P + 1.2, xq + 0.5, zT - P - 0.3, 0.9, 'steel', { tint: 0.85 });
    k.furniture(0, w - t - 0.6, zb + P, w - t, zb + P + 1.8, 0.85, 'steel', { tint: 0.7, search: { kind: 'cabinet', face: 'x-', table: 'kitchen' } });
    k.box(0, w - t - 0.55, y + 0.85, zb + P + 0.2, w - t - 0.1, y + 1.35, zb + P + 0.65, 'steel', { tint: 0.95 }); // stock pot
    k.furniture(0, w - t - 0.7, zb + P + 1.9, w - t, zb + P + 2.6, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x-', table: 'kitchen' } });
    k.stain(0, xq + 0.6, zT - 1.6, xq + 1.6, zT - 0.7, 'debris'); // broken bowls
    if (k.rand() < 0.7) k.stain(0, t + 0.3, zb + 1.0, xc - 0.2, zb + 2.0);
    return k.finish();
  },
};
