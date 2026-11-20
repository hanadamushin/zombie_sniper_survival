// 路面店のコンビニ (07d-2b). Unlike the sample (shop.konbini), the store stands back behind its own
// car park, its shelves run across the floor (parallel to the front), and the back room runs down
// the right side with the toilet behind it.
//
//   +--coolers--------------+-------+
//   | B back aisle        (D)toilet |
//   |L|=====gondola=====|R|c|st|----+    gondola rows across the floor, aisles between them,
//   | |   aisle row     | |n|af|back|    L / R side aisles, the counter and the staff side,
//   | |=====gondola=====| |t|f D room|    the back room (its side door locked) off the staff side
//   | F front strip              |    |
//   +==glass==[auto]==glass======+----+   z = D
//      car park: stops, painted bays, an abandoned car, the pole sign      z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { ring } from '../house/common.ts';
import { car, flatRoof, P, parking, sign } from './common.ts';

export const SHOP_KONBINI_ROAD: BuildingDef = {
  id: 'shop.konbini_road',
  category: 'shop',
  variant: 'konbini_road',
  kind: 'shop',
  size: { w: [14, 18], d: [16, 19] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 2.8,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_KONBINI_ROAD, params, rng);
    const { w, d } = k;
    const t = 0.25;
    k.thick = t;
    const D = Math.min(12.5, Math.max(10, d - 6)); // building depth; the car park in front
    const xr = w - t - 3.0; // sales | back room (centre line)
    const zT = t + 2.2; // toilet | back room
    const zc = t + 0.75; // front of the coolers on the back wall
    const zB = zc + 1.5; // back aisle | gondolas
    const zF = D - t - 2.0; // gondolas | front strip
    const xc = xr - P - 1.3 - 0.7; // counter (its customer side)
    const xg0 = t + 1.6;
    const xg1 = xc - 1.4;
    const rows = Math.max(1, Math.floor((zF - zB + 1.3) / 2.3));
    const aisle = (zF - zB) / rows - 1.0;
    const doorX = t + 3.0;
    const brand = k.rand();

    // --- walls, floor, roof ---
    k.floor(0, 'tileFloor', [t, t, w - t, D - t]);
    const left = k.evenly(0.4, doorX - 0.95, 1);
    const right = k.evenly(doorX + 0.95, xr - 0.2, Math.max(1, Math.round((xr - doorX - 1.2) / 2.4)));
    const lw = doorX - 0.95 - 0.4 - 0.2;
    const rw = (xr - 0.2 - doorX - 0.95) / right.length - 0.2;
    ring(k, 0, [0, 0, w, D], {
      mat: 'plaster', tint: brand,
      front: [...left.map((x) => k.window(x, lw, { sill: 0.1, head: 2.7 })), k.door(doorX, 'open', ARCH.door.wide), ...right.map((x) => k.window(x, rw, { sill: 0.1, head: 2.7, broken: k.rand() < 0.25 }))],
      back: [k.window((xr + w - t) / 2, 0.6, { sill: 1.6 })],
      right: [k.door((zT + D) / 2, 'locked', 1.4)],
    });
    flatRoof(k, [0, 0, w, D], { parapet: 0.9, parapetMat: 'plaster', tint: brand });
    sign(k, 0.4, xr, k.eaves - 0.7, k.eaves + 0.75, brand, { z: D });

    // --- back of house: toilet, back room ---
    k.partition(0, xr, t, xr, D - t, [k.door(t + 1.45 - t), k.door((zB + zF) / 2 - t)]);
    k.partition(0, xr + P, zT, w - t, zT);
    k.room(0, xr + P, t, w - t, zT - P, 'toilet');
    k.room(0, xr + P, zT + P, w - t, D - t, 'backroom');
    k.furniture(0, w - t - 0.5, t + 0.2, w - t, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });
    k.furniture(0, w - t - 0.55, zT + 0.8, w - t, D - t - 0.3, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'storage' } });
    k.furniture(0, xr + P, D - t - 1.2, xr + 1.1, D - t, 1.1, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'x+', table: 'grocery' } });

    // --- sales floor ---
    const B = k.room(0, t, zc, xr - P, zB, 'sales');
    const F = k.room(0, t, zF, xr - P, D - t, 'sales');
    const L = k.room(0, t, zB, xg0, zF, 'sales');
    const R = k.room(0, xg1, zB, xc, zF, 'sales');
    const staff = k.room(0, xc + 0.7, zB, xr - P, zF, 'sales');
    for (const r of [L, R, staff]) {
      k.join(B, r);
      k.join(r, F);
    }
    k.furniture(0, t, t, xr - 1.2, zc, 2.0, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'grocery' } });
    for (let i = 0; i < rows; i++) {
      const gz = zB + i * (1.0 + aisle);
      k.furniture(0, xg0, gz, xg1, gz + 1.0, 1.5, 'shelf', { tint: brand, search: { kind: 'shelf', face: 'z+', table: 'grocery' } });
      const a = k.room(0, xg0, gz + 1.0, xg1, gz + 1.0 + aisle, 'sales');
      k.join(L, a);
      k.join(a, R);
    }
    k.furniture(0, xc, zB + 0.3, xc + 0.7, zF - 0.3, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x+', table: 'sales' } });
    k.furniture(0, t, D - t - 0.7, t + 0.8, D - t, 1.3, 'appliance', { tint: 0.8 }); // copier
    k.stain(0, xg0 + 1.0, zB + 1.1, xg0 + 2.6, zB + 1.1 + Math.min(0.9, aisle - 0.1), 'debris');
    if (k.rand() < 0.7) k.stain(0, xc - 1.3, zF - 1.2, xc - 0.2, zF + 0.4);

    // --- car park ---
    const bays = parking(k, 0.4, w - 0.4, D + 0.3, d - 0.3, Math.max(3, Math.floor((w - 0.8) / 2.6)));
    car(k, k.pick(bays), D + 3.0, 'z', k.rand());
    k.box(-1, w - 0.55, -0.5, d - 0.55, w - 0.3, k.eaves + 1.7, d - 0.3, 'steel', { layer: 'shell' });
    k.box(-1, w - 1.7, k.eaves + 0.6, d - 0.6, w + 0.3, k.eaves + 2.75, d - 0.25, 'sign', { layer: 'shell', tint: brand, solid: false });
    return k.finish();
  },
};
