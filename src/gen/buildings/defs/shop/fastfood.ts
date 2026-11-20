// ファストフード (ドライブスルー) (07d-2b). The restaurant stands in the front-left of its lot; the
// drive-through lane runs up the right side past the pick-up window and round the back, under a
// height bar at its entrance. Inside: the dining room with the order counter (a low wall with a
// gate), the kitchen behind it (fryers, grill, the pick-up window), the walk-in store with the back
// door and the office at the back; the toilet in the front-left corner. A mansard band runs round
// the roof.
//
//   +--------------------------------+------+
//   |  lane (round the back)               |
//   +-------------+-----------+      |  lane |
//   | office      | store [Dx]|      |  [menu]
//   +---------D---+------D----+      |      |
//   |  kitchen [fryers/grill]  win-- | [car]|   win: the pick-up window
//   +==WC==+==== counter =======g+   |      |
//   | WC   |  dining              |  |      |
//   +--D---+   [tables]           |  |      |
//   | D2   |                      |  |      |
//   +==glass=========[door]=======+  [bar]  |

import { ARCH } from '../../../../data/architecture.ts';
import { ring } from '../house/common.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car, clearOfWays, P, poleSign, sign, table } from './common.ts';

const LANE = 4.0;

export const SHOP_FASTFOOD: BuildingDef = {
  id: 'shop.fastfood',
  category: 'shop',
  variant: 'fastfood',
  kind: 'shop',
  size: { w: [19, 23], d: [21, 26] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 2.6,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_FASTFOOD, params, rng);
    const { w, d } = k;
    const t = 0.25;
    k.thick = t;
    const y = k.levelY(0);
    const brand = k.pick([0.55, 0.85, 0.05]);
    const wall = k.rand();
    const xb = w - LANE; // building's right outer face
    const X = xb - t;
    const Z0 = LANE + t;
    const zk = Z0 + 3.0; // back rooms | kitchen
    const zc = zk + 4.0; // kitchen | dining (the counter line)
    const xT = t + 2.6; // toilet column
    const zT = zc + 2.6; // toilet | D2
    const doorX = X - 2.2;
    const gateX = X - 0.7;
    const xo = X - 3.0; // office | store

    k.floor(0, 'tileFloor', [t, Z0, X, d - t]);
    const nf = Math.max(2, Math.round((doorX - 1.2) / 3));
    ring(k, 0, [0, LANE, xb, d], {
      mat: 'plaster', tint: wall,
      front: [...k.evenly(0.5, doorX - 1.1, nf).map((x) => k.window(x, (doorX - 1.6) / nf - 0.3, { sill: 0.4, head: 2.6, broken: k.rand() < 0.35 })), k.door(doorX, 'open', ARCH.door.wide), k.window((doorX + 1.0 + xb - 0.3) / 2, xb - 0.3 - doorX - 1.2, { sill: 0.4, head: 2.6 })],
      back: [k.door(X - 1.5, k.rand() < 0.4 ? 'open' : 'locked'), k.window(t + 1.5, 0.8, { sill: 1.5 })],
      left: [...k.evenly(zT + 0.3, d - 0.5, 2).map((z) => k.window(z, (d - 0.8 - zT) / 2 - 0.4, { sill: 0.6, head: 2.5, broken: k.rand() < 0.3 })), k.window(zc + 1.3, 0.6, { sill: 1.6 })],
      right: [k.window((zk + zc) / 2, 1.2, { sill: 0.9, head: 1.9, broken: k.rand() < 0.5 }), k.window((zc + d) / 2, 2.4, { sill: 0.6, head: 2.5 })],
    });
    // Roof slab, a plain parapet at the back, the mansard band round the front and the sides.
    const e = k.eaves;
    k.floor(1, 'concrete', [t, Z0, X, d - t]);
    k.box(-1, 0, e, LANE, xb, e + 0.9, LANE + t, 'plaster', { layer: 'shell', tint: wall });
    k.part({ shape: 'wedge', x0: 0, x1: xb, z0: d - 0.9, z1: d, y0: e, y1: e + 1.0, mat: 'metalRoof', tint: brand, slope: 'z-' });
    k.part({ shape: 'wedge', x0: 0, x1: 0.9, z0: LANE, z1: d - 0.9, y0: e, y1: e + 1.0, mat: 'metalRoof', tint: brand, slope: 'x+' });
    k.part({ shape: 'wedge', x0: xb - 0.9, x1: xb, z0: LANE, z1: d - 0.9, y0: e, y1: e + 1.0, mat: 'metalRoof', tint: brand, slope: 'x-' });
    sign(k, xb / 2 - 2.5, e + 0.1, d + 0.02, xb / 2 + 2.5, e + 0.8, d + 0.12, 1 - brand);

    // Dining room, the toilet and the corner beyond it.
    k.partition(0, t, zc, xT, zc);
    k.partition(0, xT, zc, X, zc, [k.door(gateX - xT)], { mat: 'counter', tint: brand, y1: y + 1.05 });
    k.partition(0, xT, zc + P, xT, zT - P);
    k.partition(0, t, zT, xT, zT, [k.door(1.0)]);
    k.room(0, t, zc + P, xT - P, zT - P, 'toilet');
    k.furniture(0, t, zc + 0.3, t + 0.5, zc + 1.0, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x+', table: 'toilet' } });
    const D = k.room(0, xT + P, zc + P, X, d - t, 'canteen');
    const D2 = k.room(0, t, zT + P, xT + P, d - t, 'canteen');
    k.join(D2, D);
    const zm = (zT + P + d - t) / 2;
    const ways: [number, number][] = [[xT + P + 0.5, zm], [doorX, d - t - 0.65], [gateX, zc + 0.61]];
    let first = true;
    for (let x = xT + 1.3; x + 0.6 <= X - 0.3; x += 2.2) {
      for (let z = zc + 1.4; z + 0.6 <= d - t - 0.4; z += 2.0) {
        if (!clearOfWays(ways, [x - 0.9, z - 0.8, x + 0.9, z + 0.8], 0.35)) continue;
        table(k, 0, x, z, 0.8, 0.8, { chairs: ['x+', 'x-'], mat: 'counter', tint: brand });
        if (first) k.search(0, x, z + 0.95, 'table', 'canteen');
        first = false;
      }
    }
    if (clearOfWays([[t + 1.0, zT + 0.61], [xT - 0.5, zm]], [t, d - t - 1.4, t + 1.3, d - t], 0.35)) table(k, 0, t + 0.65, d - t - 0.7, 0.9, 0.9, { mat: 'counter', tint: 1 - brand });
    k.stain(0, doorX - 0.9, d - t - 1.5, doorX + 0.9, d - t - 0.4, 'debris');
    // The menu boards over the counter (hung from the ceiling).
    k.box(0, xT + 1.0, y + 2.4, zc - 0.05, X - 1.6, y + 3.1, zc + 0.05, 'sign', { tint: brand, solid: false });

    // Kitchen: the fry / grill line, the bagging counter behind the order counter, the pick-up window.
    k.room(0, t, zk + P, X, zc - P, 'kitchen');
    const kways: [number, number][] = [[gateX, zc - 0.61], [X - 0.7, zk + 0.61], [xo - 0.6, zk + 0.61]];
    const fry: [number, number, number, number] = [t + 0.8, zk + 1.4, X - 4.4, zk + 2.2];
    if (clearOfWays(kways, fry, 0.35)) k.furniture(0, fry[0], fry[1], fry[2], fry[3], 0.95, 'steel', { tint: 0.4, search: { kind: 'counter', face: 'z+', table: 'kitchen' } });
    const bag: [number, number, number, number] = [t + 0.3, zc - 0.85, X - 2.2, zc - P];
    if (clearOfWays(kways, bag, 0.35)) k.furniture(0, bag[0], bag[1], bag[2], bag[3], 0.95, 'steel', { tint: 0.6 });
    k.furniture(0, t, zk + 0.3, t + 0.75, zk + 1.1, 1.9, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'kitchen' } });
    if (k.rand() < 0.7) k.stain(0, X - 2.2, zk + 1.2, X - 1.0, zk + 2.4);

    // Back rooms: the office and the walk-in store (with the back door to the lane).
    k.partition(0, t, zk, X, zk, [k.door(xo - 0.6 - t), k.door(X - 0.7 - t)]);
    k.partition(0, xo, Z0, xo, zk - P);
    k.room(0, t, Z0, xo - P, zk - P, 'office');
    k.furniture(0, t, Z0 + 0.4, t + 0.8, Z0 + 1.9, 0.72, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'x+', table: 'office' } });
    k.furniture(0, t + 1.6, Z0, xo - 1.4, Z0 + 0.45, 1.8, 'steel', { tint: 0.7, search: { kind: 'locker', face: 'z+', table: 'closet' } });
    k.room(0, xo + P, Z0, X, zk - P, 'storage');
    k.furniture(0, xo + P, Z0 + 1.3, xo + 0.6, zk - 0.3, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'grocery' } });
    k.furniture(0, xo + P, Z0, xo + 0.9, Z0 + 0.8, 1.9, 'appliance', { tint: 0.9, search: { kind: 'fridge', face: 'x+', table: 'grocery' } });

    // The lane: asphalt, the menu board and speaker at the back corner, the height bar, a car at the window.
    k.box(-1, xb, 0, 0, w, 0.02, d, 'asphalt', { layer: 'shell', solid: false });
    k.box(-1, 0, 0, 0, xb, 0.02, LANE, 'asphalt', { layer: 'shell', solid: false });
    k.box(-1, w - 0.45, -0.3, LANE + 1.0, w - 0.15, 2.1, LANE + 3.0, 'sign', { layer: 'shell', tint: brand });
    k.box(-1, w - 0.4, -0.3, LANE + 3.6, w - 0.2, 1.2, LANE + 3.8, 'steel', { layer: 'shell' });
    for (const x of [xb + 0.05, w - 0.25]) k.box(-1, x, -0.3, d - 1.3, x + 0.2, 2.9, d - 1.1, 'steel', { layer: 'shell', tint: 0.5 });
    k.box(-1, xb + 0.05, 2.6, d - 1.3, w - 0.05, 2.9, d - 1.1, 'sign', { layer: 'shell', tint: 0.85, solid: false });
    if (k.rand() < 0.75) car(k, xb + LANE / 2, (zk + zc) / 2, 'z');
    poleSign(k, xb + 0.5, d - 0.4, e + 2.5, 2.2, brand);
    return k.finish();
  },
};
