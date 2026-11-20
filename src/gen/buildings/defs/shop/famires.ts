// ファミレス (07d-2b): the restaurant sits upstairs over its own car park (pilotis). On the ground
// only the glass stair box at the front-left corner is closed; the rest is columns, car stops and a
// couple of abandoned cars under the slab. Upstairs: the waiting area at the top of the stair with
// the toilets behind it, the drink bar and register beside the stairwell, the dining room with
// booths along the windows and tables in the middle, the kitchen and the office at the back.
//
//   upper                                         ground
//   +---------+----------------------------+      +----+--------------------------+
//   | office  |  kitchen     [pass]        |      |    |  o      o      o      o  |   o columns
//   +----D----+-------D--------------------+      |    |                          |
//   | WC | WC |  dining: tables  [booths]  |      |    |  [car]   car park        |
//   +-D--+--D-+                            |      +----+                          |
//   | waiting  ]  (join)          [booths] |      |stair  o      o      o      o  |
//   +--+------+                            |      |box |                          |
//   |st| drink]  (join)                    |      |   D|                          |
//   |ai| bar  ]   [booth][booth][booth]    |      +----+  o      o      o      o  |
//   +--+------+============================+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { booth, car, P, poleSign, sign, table, toppled } from './common.ts';

export const SHOP_FAMIRES: BuildingDef = {
  id: 'shop.famires',
  category: 'shop',
  variant: 'famires',
  kind: 'shop',
  size: { w: [22, 28], d: [17, 21] },
  storeys: 2,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.1,
  roof: 'flat',
  roofRise: 2.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_FAMIRES, params, rng);
    const { w, d } = k;
    const t = 0.25;
    k.thick = t;
    const y1 = k.levelY(1);
    const brand = k.rand();
    const wall = k.rand();
    const SW = ARCH.stair.wideWidth;
    const foot = d - t - 2.0;
    const st = k.stairs({ level: 0, start: [t + 0.1 + SW / 2, foot], dir: 'z-', width: SW, rails: ['end'], mat: 'concrete', tint: wall });
    const hb = st.rect[1]; // back of the stairwell
    const xE = t + 3.4; // the stair box's inside right face (ground) / the drink bar's right edge (upper)
    const xH = t + 0.1 + SW + 0.1; // the wall beside the flight
    const zW0 = hb - 2.6; // waiting area's back edge
    const zT0 = zW0 - 3.0; // toilets' back edge = kitchen's front
    const zk = zT0;

    // ---- Ground: the stair box (closed, glass at the front) and the car park under the slab.
    const ext = { mat: 'plaster' as const, tint: wall, exterior: true, layer: 'shell' as const, y1 };
    k.wall(0, 0, d - t, xE + t, d, [k.window(t + 0.55, 0.6, { sill: 0.3, head: 2.6, broken: k.rand() < 0.4 }), k.door(t + 1.9, 'open', 1.2), k.window(t + 3.0, 0.6, { sill: 0.3, head: 2.6 })], ext);
    k.wall(0, 0, hb - t, xE + t, hb, [], ext);
    k.wall(0, 0, hb, t, d - t, [], ext);
    k.wall(0, xE, hb, xE + t, d - t, [k.window((d - t - hb) / 2, 1.2, { sill: 1.0 })], ext);
    k.floor(0, 'tileFloor', [t, hb, xE, d - t]);
    k.partition(0, xH, hb, xH, foot, [], { mat: 'plaster', y1 });
    k.room(0, t, foot, xE, d - t, 'hall');
    k.stain(0, t + 1.4, foot + 0.3, xE - 0.3, foot + 1.2, 'debris');
    // The slab seen from below (the upper floor itself only draws close up), with its edge beam, and the columns.
    for (const r of [[xE + t, 0, w, d], [0, 0, xE + t, hb - t]] as const) k.box(-1, r[0], y1 - 0.4, r[1], r[2], y1 - 0.2, r[3], 'concrete', { layer: 'shell', tint: wall });
    for (const r of [[0, d - t, w, d], [0, 0, w, t], [0, t, t, d - t], [w - t, t, w, d - t]] as const) k.box(-1, r[0], y1 - 0.7, r[1], r[2], y1, r[3], 'plaster', { layer: 'shell', tint: wall });
    const cols = Math.max(3, Math.round((w - xE) / 6));
    const zs = [0.05, d / 2 - 0.25, d - 0.55];
    for (let i = 0; i < cols; i++) {
      const x = xE + t + 1.5 + ((w - xE - t - 2.0) * i) / (cols - 1) - 0.25;
      for (const z of zs) k.box(-1, x, -0.5, z, x + 0.5, y1 - 0.4, z + 0.5, 'concrete', { layer: 'shell', tint: wall });
    }
    for (let i = 0; i < cols - 1; i++) {
      const x = xE + t + 1.5 + ((w - xE - t - 2.0) * (i + 0.5)) / (cols - 1);
      k.box(-1, x - 0.8, 0, 1.0, x + 0.8, 0.12, 1.2, 'concrete', { layer: 'shell', tint: 0.9 });
      if (i === 0 || k.rand() < 0.3) car(k, x, 3.4, 'z');
    }
    k.box(-1, xE + t, 0, 0, w, 0.02, d, 'asphalt', { layer: 'shell', solid: false });

    // ---- Upper: the restaurant.
    k.floor(1, 'vinyl');
    const nf = Math.max(4, Math.round((w - xE) / 2.6));
    k.outerWalls(1, {
      mat: 'plaster', tint: wall, parapet: 1.0,
      front: [k.window(t + 1.0, 1.2, { broken: k.rand() < 0.4 }), ...k.evenly(xE + 0.4, w - 0.4, nf).map((x) => k.window(x, (w - xE - 0.8) / nf - 0.35, { sill: 0.75, head: 2.7, broken: k.rand() < 0.25 }))],
      back: [k.window(t + 1.6, 0.8, { sill: 1.4 }), k.window(w - 3.0, 1.2, { sill: 1.3 })],
      left: [k.window((zk + zW0) / 2, 0.6, { sill: 1.5 }), k.window((t + zk) / 2, 1.0)],
      right: k.evenly(zk + 0.4, d - 0.4, 3).map((z) => k.window(z, (d - zk - 0.8) / 3 - 0.4, { sill: 0.75, head: 2.7, broken: k.rand() < 0.25 })),
    });
    // The left column: office, toilets, the waiting area at the top of the stair, the drink bar beside the stairwell.
    k.partition(1, xH, hb, xH, d - t, [], { mat: 'plaster' });
    k.partition(1, xE, t, xE, d - t, [k.door((t + zk) / 2 - t), k.door((zW0 + hb) / 2 - t, 'open', ARCH.door.wide), k.door(hb + 2.0 - t, 'open', ARCH.door.wide)], { mat: 'plaster', tint: brand });
    k.room(1, xH + P, hb, xE - P, d - t, 'canteen');
    k.furniture(1, xH + P, hb + 0.4, xH + 0.7, d - t - 1.2, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x+', table: 'grocery' } });
    k.furniture(1, xH + P, d - t - 0.6, xE - P, d - t, 1.05, 'counter', { tint: 0.6, search: { kind: 'counter', face: 'z-', table: 'sales' } });
    k.room(1, t, zW0 + P, xE - P, hb, 'hall');
    k.partition(1, t, zW0, xE - P, zW0, [k.door(0.9), k.door(xE - t - 0.9)]);
    const xm = (t + xE) / 2;
    k.partition(1, xm, zT0 + P, xm, zW0 - P);
    k.room(1, t, zT0 + P, xm - P, zW0 - P, 'toilet');
    k.room(1, xm + P, zT0 + P, xE - P, zW0 - P, 'toilet');
    k.furniture(1, t, zT0 + 0.3, t + 0.5, zT0 + 1.0, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x+', table: 'toilet' } });
    k.furniture(1, xE - P - 0.5, zT0 + 0.3, xE - P, zT0 + 1.0, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });
    k.partition(1, t, zT0, xE - P, zT0);
    k.room(1, t, t, xE - P, zT0 - P, 'office');
    k.furniture(1, t, t + 0.4, t + 0.8, t + 1.8, 0.72, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'x+', table: 'office' } });
    k.furniture(1, t + 1.2, t, xE - 0.6, t + 0.45, 1.4, 'steel', { tint: 0.7, search: { kind: 'cabinet', face: 'z+', table: 'office' } });
    if (k.rand() < 0.6) toppled(k, 1, t + 1.0, zk - 1.0, xE - 1.0, zk - 0.4, 'steel');

    // Kitchen across the back, the pass hatch and the staff door.
    const xK = xE + P;
    k.partition(1, xK, zk, w - t, zk, [k.door(1.2), k.window((w - t - xK) / 2, Math.min(3.0, w - xK - 5), { sill: 0.95, head: 1.7, broken: true })], { mat: 'plaster' });
    k.room(1, xK, t, w - t, zk - P, 'kitchen');
    k.furniture(1, xK + 2.6, t, w - t - 0.6, t + 0.75, 0.9, 'steel', { tint: 0.5, search: { kind: 'counter', face: 'z+', table: 'kitchen' } });
    k.furniture(1, w - t - 0.75, t + 1.4, w - t, zk - 0.6, 1.9, 'appliance', { search: { kind: 'fridge', face: 'x-', table: 'kitchen' } });
    if (zk - t > 4.2) k.furniture(1, xK + 3.2, t + 1.9, w - t - 2.4, zk - 1.4, 0.9, 'steel', { tint: 0.3 });
    k.furniture(1, xK + 1.9, zk - 0.6, xK + 3.4, zk - P, 1.9, 'shelf', { search: { kind: 'shelf', face: 'z-', table: 'grocery' } });

    // Dining room: booths along the front and right windows, tables in the middle; the left strip stays clear.
    k.room(1, xK, zk + P, w - t, d - t, 'canteen');
    const bx0 = xK + 2.2;
    const nb = Math.floor((w - t - 1.6 - bx0) / 2.05);
    for (let i = 0; i < nb; i++) {
      const a0 = bx0 + i * 2.05;
      booth(k, 1, 'x', a0, a0 + 1.95, d - t, d - t - 1.5, brand, i === 0 ? { kind: 'table', face: 'z-' } : undefined);
    }
    const bz1 = d - t - 1.6;
    const nr = Math.floor((bz1 - zk - 0.6) / 2.05);
    for (let i = 0; i < nr; i++) {
      const a1 = bz1 - i * 2.05;
      booth(k, 1, 'z', a1 - 1.95, a1, w - t, w - t - 1.5, brand, i === 0 ? { kind: 'table', face: 'x-' } : undefined);
    }
    for (let x = xK + 3.4; x + 0.6 <= w - t - 2.6; x += 2.6) {
      for (let z = zk + 1.8; z + 0.4 <= d - t - 2.6; z += 2.4) table(k, 1, x, z, 1.2, 0.75, { chairs: ['z+', 'z-'], tint: 0.6 });
    }
    if (k.rand() < 0.8) k.stain(1, xK + 0.4, (zk + d) / 2 - 0.6, xK + 1.8, (zk + d) / 2 + 0.8);

    k.roofFlat({ mat: 'concrete', parapet: 1.0, parapetMat: 'plaster', tint: wall });
    sign(k, xE + 1.0, k.eaves - 0.3, d, w - 1.0, k.eaves + 0.95, d + 0.15, brand);
    poleSign(k, xE + t + 0.6, d - 0.35, k.eaves + 2.3, 2.4, brand);
    return k.finish();
  },
};
