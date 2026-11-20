// 農家 (07d-2a). A two-storey farmhouse with a wide genkan in the middle, and a timber barn (納屋)
// beside it with a tractor, hay, sacks of rice and a tool rack. A light truck stands in the yard.
//
//   ground floor (house)                          barn (納屋)
//   +---------+--+-----+------+                   +-------------------+
//   | kitchen |st|hall |bath  |                   | tools   hay  rice |
//   |   (back |ai| |   D------+                   |                   |
//   |   door) |rs| |   D WC   |                   |   tractor         |
//   +---D-----+  | |   +------+                   |                   |
//   | 座敷     |  | |   D 居間  |                   +------[ wide ]-----+
//   |         D 広い玄関 |       |
//   +---------+---D-----+------+      front (z = d): the farmyard
//
// Upstairs: the stair arrives at a hall at the back of the middle column; a room on each side.

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, pitched, ring } from './common.ts';

export const HOUSE_NOKA: BuildingDef = {
  id: 'house.noka',
  category: 'house',
  variant: 'noka',
  kind: 'house',
  size: { w: [18, 21], d: [12.5, 14.5] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.4,
  roof: 'gable',
  roofRise: 2.3,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_NOKA, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const Wh = Math.min(10.4, w - 8.0); // the house; the barn to the right
    const D = d - 3.8; // the farmyard in front
    const xc0 = Wh / 2 - 1.05; // middle column (centre lines)
    const xc1 = xc0 + 2.1;
    const lane = xc0 + 0.53;
    const xs = xc0 + 1.04; // the hall beside the stair
    const zs = 5.2; // foot of the stair
    const zh = zs - 3.75; // upstairs: the hall at the top
    const zl = zs - 0.5; // kitchen | 座敷
    const tint = k.rand();
    const wallMat = k.pick(['plaster', 'siding', 'mortar'] as const);
    const fy = k.levelY(0);
    const cx = (xc0 + xc1) / 2;

    // --- house, ground floor ---
    k.floor(0, 'flooring', [t, t, Wh - t, D - t]);
    ring(k, 0, [0, 0, Wh, D], {
      mat: wallMat, tint,
      front: [k.window((t + xc0) / 2, 1.8, { sill: 0.4, broken: k.rand() < 0.3 }), k.door(cx, 'open', 1.6), k.window((xc1 + Wh - t) / 2, 1.8, { sill: 0.4 })],
      back: [k.window(t + 0.9, 1.0, { sill: 1.0 }), k.door(xc0 - 1.0, k.rand() < 0.6 ? 'open' : 'locked'), k.window((xc1 + Wh - t) / 2, 0.6, { sill: 1.4 })],
      left: [k.window(zl / 2, 0.9, { sill: 1.0 }), k.window((zl + D) / 2, 1.4, { sill: 0.8 })],
      right: [k.window((zs + D) / 2, 1.4, { sill: 0.8 }), k.window(3.3, 0.5, { sill: 1.4 })],
    });
    k.partition(0, xc0, zl, xc0, D - t, [k.door((zs + D - t) / 2 - zl)]);
    k.partition(0, xc0, t, xc0, zl);
    k.partition(0, t, zl, xc0, zl, [k.door((t + xc0) / 2 - t)]);
    k.partition(0, xc1, t, xc1, D - t, [k.door(1.4 - t), k.door(3.3 - t, 'open', 0.8), k.door(4.6 - t)]);
    k.partition(0, xc1, 2.6, Wh - t, 2.6);
    k.partition(0, xc1, 4.0, Wh - t, 4.0);
    const genkan = k.room(0, xc0 + P, zs, xc1 - P, D - t, 'genkan');
    const hall = k.room(0, xs, t, xc1 - P, zs, 'hall');
    k.join(hall, genkan);
    k.room(0, t, t, xc0 - P, zl - P, 'kitchen');
    k.room(0, t, zl + P, xc0 - P, D - t, 'tatami');
    k.room(0, xc1 + P, t, Wh - t, 2.6 - P, 'bath');
    k.room(0, xc1 + P, 2.6 + P, Wh - t, 4.0 - P, 'toilet');
    k.room(0, xc1 + P, 4.0 + P, Wh - t, D - t, 'living');
    k.stairs({ level: 0, start: [lane, zs], dir: 'z-', width: 0.9, rails: ['right', 'end'], mat: 'woodDark' });

    k.furniture(0, t, t, t + 0.65, zl - 1.4, 0.88, 'counter', { search: { kind: 'cabinet', face: 'x+', table: 'kitchen' } });
    k.furniture(0, xc0 - P - 0.7, t + 0.9, xc0 - P, t + 1.6, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x-', table: 'kitchen' } });
    k.furniture(0, t + 0.8, 2.6, t + 1.6, 3.6, 0.72, 'wood', { tint: 0.4 }); // table
    k.stain(0, t, zl + P, xc0 - P, D - t, 'tatami');
    k.furniture(0, t, D - t - 0.5, t + 1.6, D - t, 1.5, 'woodDark', { search: { kind: 'closet', face: 'z-', table: 'tatami' } });
    k.furniture(0, t, zl + 1.0, t + 0.45, zl + 2.0, 1.1, 'woodDark', { search: { kind: 'cabinet', face: 'x+', table: 'tatami' } }); // 仏壇
    k.furniture(0, Wh - t - 0.8, t, Wh - t, t + 1.6, 0.6, 'tileFloor'); // tub
    k.furniture(0, xc1 + P, t, xc1 + 0.9, t + 0.45, 0.85, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'bath' } });
    k.furniture(0, Wh - t - 0.7, 2.6 + P + 0.3, Wh - t - 0.3, 2.6 + P + 1.0, 0.42, 'appliance', { solid: false });
    k.furniture(0, Wh - t - 0.5, 4.0 + 0.6, Wh - t, 4.0 + 2.2, 0.55, 'woodDark', { search: { kind: 'cabinet', face: 'x-', table: 'living' } });
    k.furniture(0, t + 0.8, t, t + 1.6, t + 0.6, 0.8, 'wood', { tint: 0.5, search: { kind: 'crate', face: 'z+', table: 'grocery' } }); // crates of vegetables
    // Muddy boots and blood across the genkan; the kitchen chairs thrown about.
    k.stain(0, cx - 0.4, D - t - 1.6, cx + 0.7, D - t - 0.5, 'debris');
    if (k.rand() < 0.6) k.stain(0, t + 0.6, zl - 1.2, t + 1.6, zl - 0.3);

    // --- house, upper floor ---
    k.floor(1, 'tatami', [t, t, Wh - t, D - t]);
    ring(k, 1, [0, 0, Wh, D], {
      mat: wallMat, tint,
      front: [k.window((t + xc0) / 2, 1.6), k.window(cx, 1.2, { broken: k.rand() < 0.4 }), k.window((xc1 + Wh - t) / 2, 1.6)],
      back: [k.window((t + xc0) / 2, 1.2), k.window((xc1 + Wh - t) / 2, 1.2)],
      left: [k.window(D / 2, 1.2)],
      right: [k.window(2.4, 0.9)],
    });
    k.partition(1, xc0, t, xc0, D - t, [k.door((zs + D - t) / 2 + 0.4 - t)]);
    k.partition(1, xc1, t, xc1, D - t, [k.door(3.3 - t), k.door((zs + D - t) / 2 - 0.4 - t)]);
    k.partition(1, xc1, zs - 0.3, Wh - t, zs - 0.3);
    const top = k.room(1, xc0 + P, t, xc1 - P, zh, 'hall');
    const strip = k.room(1, xs + ARCH.rail.thick, zh, xc1 - P, zs, 'hall');
    const front = k.room(1, xc0 + P, zs + ARCH.rail.thick, xc1 - P, D - t, 'hall');
    k.join(top, strip);
    k.join(strip, front);
    k.room(1, t, t, xc0 - P, D - t, 'tatami');
    k.room(1, xc1 + P, t, Wh - t, zs - 0.3 - P, 'bedroom');
    k.room(1, xc1 + P, zs - 0.3 + P, Wh - t, D - t, 'bedroom');
    k.furniture(1, t, t, t + 0.6, t + 1.8, 1.8, 'wood', { tint: 0.7, search: { kind: 'closet', face: 'x+', table: 'closet' } });
    k.furniture(1, t + 1.0, D - t - 1.8, t + 2.6, D - t - 1.0, 0.35, 'wood', { tint: 0.6 }); // low table
    k.furniture(1, Wh - t - 1.0, t, Wh - t, t + 2.0, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x-', table: 'bedroom' } });
    k.furniture(1, Wh - t - 2.1, D - t - 1.0, Wh - t, D - t, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'z-', table: 'bedroom' } });
    k.furniture(1, xc1 + P, D - t - 0.5, xc1 + 1.0, D - t, 1.2, 'wood', { tint: 0.3, search: { kind: 'shelf', face: 'z-', table: 'bedroom' } });

    pitched(k, [0, 0, Wh, D], { mat: k.pick(['tile', 'metalRoof'] as const), tint: k.rand(), axis: 'x' });

    // --- barn ---
    const bx0 = Wh + 0.8;
    const bx1 = w - 0.2;
    const bz0 = 0.3;
    const bz1 = Math.min(D, 9.2);
    const bt = 0.12;
    const by = fy + 4.0;
    const bcx = (bx0 + bx1) / 2;
    const bdoor = { ...k.door(bcx, 'open', 2.8), head: 3.0 };
    ring(k, 0, [bx0, bz0, bx1, bz1], {
      mat: k.pick(['woodDark', 'rust'] as const), thick: bt, y1: by,
      front: [bdoor], left: [k.window((bz0 + bz1) / 2, 1.2, { sill: 1.6, head: 2.4, broken: true })], right: [k.window(bz0 + 2.0, 1.2, { sill: 1.6, head: 2.4 })],
    });
    k.part({ shape: 'gable', x0: bx0 - 0.3, x1: bx1 + 0.15, z0: bz0 - 0.3, z1: bz1 + 0.3, y0: by, y1: by + 1.7, mat: 'metalRoof', tint: k.rand(), axis: 'z' });
    const bi: [number, number, number, number] = [bx0 + bt, bz0 + bt, bx1 - bt, bz1 - bt];
    k.floor(0, 'concrete', bi);
    k.room(0, bi[0], bi[1], bi[2], bi[3], 'storage');
    k.furniture(0, bi[0], bi[1], bi[0] + 0.5, bi[1] + 3.0, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'tools' } });
    k.furniture(0, bi[0] + 1.5, bi[1], bi[0] + 3.3, bi[1] + 1.2, 1.1, 'wood', { tint: 0.95, search: { kind: 'crate', face: 'z+', table: 'storage' } }); // hay bales
    k.furniture(0, bi[2] - 1.2, bi[1], bi[2], bi[1] + 1.6, 0.9, 'fabric', { tint: 0.75, search: { kind: 'crate', face: 'x-', table: 'grocery' } }); // rice sacks
    k.furniture(0, bi[2] - 0.7, bi[1] + 2.6, bi[2], bi[1] + 4.4, 0.9, 'wood', { tint: 0.3, search: { kind: 'counter', face: 'x-', table: 'workshop' } }); // workbench
    // Tractor: body, engine hood, the big rear wheels.
    const tx = bi[0] + 1.0;
    const tz = bi[1] + 2.4;
    k.box(0, tx, fy + 0.4, tz, tx + 1.3, fy + 1.3, tz + 2.6, 'sign', { tint: 0.6, role: 'furniture' });
    k.box(0, tx - 0.15, fy, tz + 1.6, tx + 1.45, fy + 1.3, tz + 2.6, 'steel', { tint: 0.66, role: 'furniture' });
    k.box(0, tx + 0.1, fy + 1.3, tz + 1.7, tx + 1.2, fy + 1.4, tz + 2.4, 'fabric', { solid: false });
    k.stain(0, bcx - 1.0, bi[3] - 2.2, bcx + 1.2, bi[3] - 0.6, 'debris');

    // --- yard: a light truck and crates ---
    const kx = xc1 + 0.6;
    const kz = D + 0.6;
    k.box(-1, kx, 0.3, kz, kx + 3.4, 1.0, kz + 1.5, 'appliance', { layer: 'shell', role: 'furniture' });
    k.box(-1, kx, 1.0, kz, kx + 1.1, 1.8, kz + 1.5, 'appliance', { layer: 'shell', role: 'furniture' });
    k.box(-1, kx + 0.05, 1.05, kz + 0.1, kx + 0.08, 1.7, kz + 1.4, 'glass', { layer: 'shell', solid: false });
    k.box(-1, t + 0.5, 0, D + 0.8, t + 1.5, 0.6, D + 1.6, 'wood', { layer: 'shell', tint: 0.5 });
    k.box(-1, t + 0.6, 0.6, D + 0.9, t + 1.4, 1.1, D + 1.5, 'wood', { layer: 'shell', tint: 0.5 });
    return k.finish();
  },
};
