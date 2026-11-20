// 居酒屋 (07d-2b). A two-storey timber house of a pub under a tiled gable roof, red lanterns at the
// door. Ground floor: the entrance room with two tables and the shoe shelf, the counter with its
// stools in front of the kitchen (its window over the counter, a staff door at the end), the toilet
// beside the stair. Upstairs the 座敷: two tatami rooms opened into one by the fusuma, low tables,
// and the store of cushions in front of the stairwell.
//
//   ground                               upper
//   +-----------------+---+              +-----------------+---+
//   | kitchen         |toi|              | zashiki 1       | H |  H: the landing / corridor
//   +==counter window=D+-D+              |                 D   |
//   | aisle (stools)    |st|             +---[fusuma]------+===+  stairwell (railing)
//   |                   |ai|             | zashiki 2       |   |
//   +    open           |r |             |                 D cl|  cl: cushion store
//   | front room (tables)   |            +-----------------+---+
//   +--D---------[window]---+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

export const SHOP_IZAKAYA: BuildingDef = {
  id: 'shop.izakaya',
  category: 'shop',
  variant: 'izakaya',
  kind: 'shop',
  size: { w: [8, 11], d: [12, 15] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.3,
  roof: 'gable',
  roofRise: 2.0,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_IZAKAYA, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const y0 = k.levelY(0);
    const y1 = k.levelY(1);
    const sw = 1.0; // stair width
    const xs = w - t - sw - P; // aisle | stair column (centre line)
    const zk = t + 2.6; // kitchen | aisle
    const zf = d - t - 3.0; // aisle | front room; the foot of the stair
    const flight = Math.ceil(k.def.storeyHeight / ARCH.stair.maxRise - 1e-6) * ARCH.stair.going;
    const s0 = zf - flight; // top of the stair
    const zm = d / 2; // zashiki 1 | zashiki 2
    const doorX = (t + xs) / 2;
    const wall = k.pick(['plaster', 'woodDark', 'siding'] as const);
    const tint = k.rand();
    const red = 0.05 + k.rand() * 0.08;

    // --- ground floor ---
    k.floor(0, 'tileFloor', undefined, { tint: 0.35 });
    k.outerWalls(0, {
      mat: wall, tint,
      front: [k.door(doorX, 'open', 1.2), k.window((doorX + 0.9 + w - 0.3) / 2, w - 0.3 - doorX - 0.9 - 0.3, { sill: 0.9, head: 2.0, broken: k.rand() < 0.4 })],
      back: [k.door(t + 1.2, 'locked'), k.window(xs - 1.6, 0.8, { sill: 1.2 })],
      left: [k.window((zk + zf) / 2, 1.2, { sill: 1.1 })],
    });
    k.stairs({ level: 0, start: [w - t - sw / 2, zf], dir: 'z-', width: sw, rails: ['end'], mat: 'woodDark' });
    k.partition(0, xs, t, xs, zf, [k.door((zk + P + s0) / 2 - t)]);
    k.partition(0, xs + P, s0, w - t, s0);
    k.partition(0, t, zk, xs - P, zk, [k.window((t + xs - 1.4) / 2 - t, xs - 1.4 - t - 0.6, { sill: 1.0, head: 2.0, broken: true }), k.door(xs - 0.75 - t)]);
    k.room(0, t, t, xs - P, zk - P, 'kitchen');
    k.room(0, xs + P, t, w - t, s0 - P, 'toilet');
    const aisle = k.room(0, t, zk + P, xs - P, zf, 'bar');
    const front = k.room(0, t, zf, w - t, d - t, 'bar');
    k.join(aisle, front);
    // Counter with stools; the kitchen behind it.
    k.furniture(0, t + 0.3, zk + P, xs - 1.6, zk + P + 0.45, 1.05, 'woodDark', { search: { kind: 'counter', face: 'z+', table: 'bar' } });
    for (let x = t + 0.6; x < xs - 1.9; x += 0.7) k.furniture(0, x, zk + 1.0, x + 0.32, zk + 1.32, 0.65, 'wood', { tint: 0.3, solid: false });
    k.furniture(0, t + 1.6, t, xs - 2.2, t + 0.65, 0.9, 'steel', { tint: 0.8, search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, t, t + 0.9, t + 0.7, zk - P - 0.2, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'bar' } });
    k.furniture(0, xs + P, t, w - t, t + 0.4, 0.8, 'appliance', { search: { kind: 'cabinet', face: 'z+', table: 'toilet' } });
    // Front room: two tables in the corner, the shoe shelf, sake crates.
    k.furniture(0, t, d - t - 1.9, t + 1.4, d - t - 1.1, 0.7, 'wood', { tint: 0.35, search: { kind: 'table', face: 'z-', table: 'bar' } });
    k.furniture(0, t, d - t - 0.9, t + 0.35, d - t - 0.2, 1.0, 'woodDark'); // shoe shelf
    k.furniture(0, w - t - 1.1, d - t - 0.7, w - t - 0.2, d - t - 0.15, 0.6, 'wood', { tint: 0.15 }); // sake crates
    k.stain(0, doorX + 0.4, zf + 0.8, doorX + 1.6, zf + 1.6);
    // Lanterns and the noren.
    for (const lx of [doorX - 0.95, doorX + 0.75]) k.box(-1, lx, y0 + 1.8, d + 0.1, lx + 0.3, y0 + 2.3, d + 0.4, 'paper', { layer: 'shell', tint: red, solid: false });
    k.box(-1, doorX - 0.65, y0 + 1.45, d, doorX + 0.65, y0 + 2.0, d + 0.04, 'fabric', { layer: 'shell', tint: 0.6, solid: false });
    sign(k, doorX - 1.6, doorX + 1.6, y1 - 0.65, y1 - 0.1, red, { mat: 'woodDark' });

    // --- upper floor: 座敷 ---
    k.floor(1, 'tatami');
    k.outerWalls(1, {
      mat: wall, tint,
      front: [k.window(doorX, 1.8, { broken: k.rand() < 0.3 })],
      back: [k.window(doorX, 1.6)],
      left: [k.window((t + zm) / 2, 1.2), k.window((zm + d) / 2, 1.2)],
      right: [k.window((zf + d) / 2, 0.8, { sill: 1.2 })],
    });
    k.partition(1, xs, t, xs, d - t, [k.door((t + s0) / 2 - t), k.door((zf + d - t) / 2 - t)], { mat: 'plaster', tint: 0.95 });
    k.partition(1, t, zm, xs - P, zm, [k.door(doorX - t, 'open', 1.8)], { mat: 'plaster', tint: 0.95 });
    k.partition(1, xs + P, zf + ARCH.rail.thick + P, w - t, zf + ARCH.rail.thick + P);
    k.room(1, xs + P, t, w - t, s0, 'hall');
    const z1 = k.room(1, t, t, xs - P, zm - P, 'tatami');
    const z2 = k.room(1, t, zm + P, xs - P, d - t, 'tatami');
    k.room(1, xs + P, zf + ARCH.rail.thick + 2 * P, w - t, d - t, 'closet');
    for (const r of [z1, z2]) {
      const q = k.roomById(r);
      k.stain(1, q.x0, q.z0, q.x1, q.z1, 'tatami');
      k.furniture(1, t + 0.6, q.z0 + 0.8, t + 1.6, q.z1 - 0.8, 0.35, 'woodDark', { search: { kind: 'table', face: 'x+', table: 'tatami' } });
      for (let z = q.z0 + 1.0; z < q.z1 - 1.2; z += 0.9) k.furniture(1, t + 0.1, z, t + 0.5, z + 0.4, 0.1, 'fabric', { tint: red, solid: false });
    }
    k.furniture(1, xs + P, d - t - 0.6, w - t, d - t, 1.4, 'fabric', { tint: 0.6, search: { kind: 'closet', face: 'z-', table: 'closet' } }); // futons and cushions
    k.box(1, t + 2.0, y1, zm + 1.4, t + 2.4, y1 + 0.35, zm + 2.4, 'woodDark', { role: 'furniture', solid: false }); // a low table kicked over
    k.roofGable({ mat: 'tile', tint: k.rand(), axis: 'z' });
    return k.finish();
  },
};
