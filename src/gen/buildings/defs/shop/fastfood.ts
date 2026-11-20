// ファストフード (07d-2b). A flat-roofed box with a drive-through lane down its right side: the menu
// board, the pickup window in the kitchen wall, a car abandoned at it, the tall pole sign at the
// corner. Inside: the dining room behind the glass front, the queue in front of the counter (the
// toilet and the staff door off it), the kitchen behind the counter and the store at the back.
//
//   +-----------------------------+ . . .
//   | store (D)                   | lane
//   +--D---+----------------------+  .
//   |toilet| kitchen       [grill] [pickup window]  car
//   +--D---D====counter window====+  .
//   | queue                       | [menu]
//   | tables     |      tables    |  .
//   +==glass=====[auto]====glass==+ [pole]   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { ring } from '../house/common.ts';
import { car, flatRoof, P, sign } from './common.ts';

export const SHOP_FASTFOOD: BuildingDef = {
  id: 'shop.fastfood',
  category: 'shop',
  variant: 'fastfood',
  kind: 'shop',
  size: { w: [16, 20], d: [17, 21] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 3.0,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_FASTFOOD, params, rng);
    const { w, d } = k;
    const t = 0.25;
    k.thick = t;
    const y = k.levelY(0);
    const wb = w - 4.2; // the building; the lane beyond
    const zs = t + 2.8; // store | kitchen
    const zc = zs + P + 4.0; // kitchen | queue (the counter)
    const zq = zc + P + 2.0; // queue | dining room
    const xT = t + 2.4; // toilet | kitchen
    const doorX = wb / 2;
    const brand = k.rand();
    const zw = (zs + zc) / 2; // pickup window

    // --- the building ---
    k.floor(0, 'tileFloor', [t, t, wb - t, d - t], { tint: brand });
    const fw = doorX - 1.0 - 0.4 - 0.3;
    ring(k, 0, [0, 0, wb, d], {
      mat: 'plaster', tint: brand,
      front: [k.window(0.4 + fw / 2, fw, { sill: 0.5, head: 2.8, broken: k.rand() < 0.4 }), k.door(doorX, 'open', ARCH.door.wide), k.window(wb - 0.4 - fw / 2, fw, { sill: 0.5, head: 2.8 })],
      back: [k.door(wb - t - 1.5, 'locked')],
      left: [k.window((zq + d) / 2, d - zq - 1.4, { sill: 0.5, head: 2.8 })],
      right: [k.window(zw, 1.2, { sill: 1.0, head: 2.0, broken: k.rand() < 0.5 }), k.window((zq + d) / 2, 2.0, { sill: 0.9 })],
    });
    flatRoof(k, [0, 0, wb, d], { parapet: 0.8, parapetMat: 'plaster', tint: brand });
    sign(k, 0.6, wb - 0.6, k.eaves - 0.5, k.eaves + 0.7, brand);

    // --- store, toilet, kitchen ---
    k.partition(0, t, zs, wb - t, zs, [k.door(xT + 1.0 - t)]);
    k.partition(0, xT, zs + P, xT, zc - P);
    k.partition(0, t, zc, wb - t, zc, [k.door(1.2), k.door(xT + 0.9 - t), k.window((xT + 2.4 + wb - t - 0.4) / 2 - t, wb - t - 0.4 - xT - 2.4, { sill: 1.0, head: 2.2, broken: true })]);
    k.room(0, t, t, wb - t, zs - P, 'storage');
    k.room(0, t, zs + P, xT - P, zc - P, 'toilet');
    k.room(0, xT + P, zs + P, wb - t, zc - P, 'kitchen');
    k.furniture(0, xT + 2.2, t, wb - t - 2.4, t + 0.55, 2.0, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'grocery' } });
    k.furniture(0, t, t, t + 1.2, t + 0.9, 1.9, 'appliance', { tint: 0.9, search: { kind: 'fridge', face: 'z+', table: 'kitchen' } }); // freezer
    k.furniture(0, t, zs + P + 0.2, t + 0.5, zs + P + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x+', table: 'toilet' } });
    k.furniture(0, xT + 2.0, zs + P, wb - t, zs + P + 0.75, 0.95, 'steel', { tint: 0.75, search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } }); // fryers, grill
    k.furniture(0, xT + 2.4, zc - P - 0.7, wb - t - 0.2, zc - P, 1.0, 'steel', { tint: 0.85 }); // the line under the counter window
    k.furniture(0, xT + 3.0, zw - 0.4, wb - t - 2.0, zw + 0.4, 0.9, 'steel', { tint: 0.85 }); // prep table
    k.stain(0, xT + 1.6, zw - 0.6, xT + 2.8, zw + 0.5);

    // --- queue and dining room ---
    const Q = k.room(0, t, zc + P, wb - t, zq, 'canteen');
    const S = k.room(0, t, zq, wb - t, d - t, 'canteen');
    k.join(Q, S);
    k.furniture(0, xT + 2.4, zc + P, wb - t - 0.4, zc + P + 0.5, 1.05, 'counter', { tint: brand, search: { kind: 'counter', face: 'z+', table: 'canteen' } });
    for (const side of [-1, 1]) {
      for (let off = 1.4; off + 0.8 < wb / 2 - t - 0.6; off += 2.0) {
        const x0 = side < 0 ? doorX - off - 0.8 : doorX + off;
        for (let z = zq + 1.1; z + 0.8 < d - t - 1.0; z += 2.1) {
          const first = off === 1.4 && z === zq + 1.1;
          k.furniture(0, x0, z, x0 + 0.8, z + 0.8, 0.72, 'counter', { tint: brand, search: first ? { kind: 'table', face: side < 0 ? 'x+' : 'x-', table: 'canteen' } : undefined });
          k.furniture(0, x0 + 0.15, z - 0.45, x0 + 0.65, z - 0.05, 0.45, 'fabric', { tint: 0.1, solid: false });
          k.furniture(0, x0 + 0.15, z + 0.85, x0 + 0.65, z + 1.25, 0.45, 'fabric', { tint: 0.1, solid: false });
        }
      }
    }
    k.stain(0, doorX - 0.9, zq + 0.3, doorX + 0.5, zq + 1.2, 'debris'); // trays and cups
    if (k.rand() < 0.6) k.stain(0, t + 0.6, zc + 0.8, t + 1.8, zc + 1.8);

    // --- the drive-through lane ---
    k.box(-1, wb + 0.2, -0.2, 0.3, w - 0.2, 0.015, d - 0.3, 'asphalt', { layer: 'shell', solid: false });
    for (let z = 2.0; z < d - 2.0; z += 4.0) k.box(-1, wb + 1.9, 0.015, z, wb + 2.3, 0.02, z + 1.4, 'paper', { layer: 'shell', tint: 0.98, solid: false });
    k.box(-1, wb, y + 2.4, zw - 1.2, wb + 0.9, y + 2.5, zw + 1.2, 'sign', { layer: 'shell', tint: brand, solid: false }); // pickup canopy
    car(k, wb + 2.1, zw, 'z', k.rand());
    // Menu board on two posts, the speaker.
    for (const z of [zc + 1.0, zc + 2.4]) k.box(-1, w - 0.5, -0.3, z, w - 0.4, 1.0, z + 0.1, 'steel', { layer: 'shell' });
    k.box(-1, w - 0.55, 1.0, zc + 0.9, w - 0.35, 2.4, zc + 2.6, 'sign', { layer: 'shell', tint: brand });
    k.box(-1, w - 0.6, -0.3, zc - 0.3, w - 0.3, 1.3, zc, 'steel', { layer: 'shell', tint: 0.3 });
    // Pole sign.
    k.box(-1, w - 0.5, -0.5, d - 0.5, w - 0.2, k.eaves + 1.8, d - 0.2, 'steel', { layer: 'shell' });
    k.box(-1, w - 1.9, k.eaves + 1.2, d - 0.45, w + 0.2, k.eaves + 2.95, d - 0.25, 'sign', { layer: 'shell', tint: brand, solid: false });
    return k.finish();
  },
};
