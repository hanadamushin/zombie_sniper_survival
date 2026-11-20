// 民宿 (07d-2b). A family-run inn in a big two-storey timber house under a gable roof, its name on
// a board by the door. A hall down the left side with a straight stair; downstairs the guests'
// dining room, the kitchen and the family bath, upstairs two large tatami rooms for the guests and
// the toilet at the end of the hall.
//
//   ground                               upper
//   +------+----------+-------+          +------+------------------+
//   |hall  | kitchen  | bath  |          |hall  | guest room 1     |
//   |  ||  D          |       |          | |  | D                  |
//   |  ||  +----D-----+---D---+          | |  | +------------------+
//   |  ||  | dining room      |          |  ..  D guest room 2      |
//   |genkan D        [table]  |          |toilet|                  |
//   +--D---+------------------+          +------+------------------+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

/** Furnish a tatami room x0..x1 × z0..z1 entered from its x0 wall at z = doorZ: low table, cushions, futon closet on the x1 wall. */
function guestRoom(k: Kit, level: number, x0: number, z0: number, x1: number, z1: number, doorZ: number): void {
  k.stain(level, x0, z0, x1, z1, 'tatami');
  const cx = (x0 + x1) / 2 + 0.3;
  const cz = (z0 + z1) / 2;
  k.furniture(level, cx - 0.7, cz - 0.5, cx + 0.7, cz + 0.5, 0.35, 'woodDark', { search: { kind: 'table', face: doorZ < cz ? 'z-' : 'z+', table: 'tatami' } });
  for (const dx of [-1.2, 0.85]) k.furniture(level, cx + dx, cz - 0.2, cx + dx + 0.35, cz + 0.2, 0.1, 'fabric', { tint: 0.15, solid: false });
  k.furniture(level, x1 - 0.8, z0 + 0.3, x1, z1 - 0.3, 1.8, 'wood', { tint: 0.85, search: { kind: 'closet', face: 'x-', table: 'closet' } });
  k.furniture(level, x0 + 1.6, z0, x0 + 2.4, z0 + 0.45, 0.5, 'appliance', { tint: 0.2 }); // TV
}

export const SHOP_MINSHUKU: BuildingDef = {
  id: 'shop.minshuku',
  category: 'shop',
  variant: 'minshuku',
  kind: 'house',
  size: { w: [10, 13], d: [9, 11] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.45,
  roof: 'gable',
  roofRise: 2.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_MINSHUKU, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const hx = t + 2.0; // hall | rooms
    const lane = t + 0.47;
    const zs = t + 5.3; // foot of the stair
    const flight = Math.ceil(k.def.storeyHeight / ARCH.stair.maxRise - 1e-6) * ARCH.stair.going;
    const zh = zs - flight; // top of the stair
    const zk = t + 3.8; // back rooms | dining room
    const xk = hx + (w - t - hx) * 0.55; // kitchen | bath
    const zt = d - t - 1.6; // upstairs hall | toilet
    const zm = d / 2; // guest room 1 | 2
    const zg = (zs + d - t) / 2; // door genkan -> dining
    const wall = k.pick(['plaster', 'siding', 'woodDark'] as const);
    const tint = k.rand();
    const broken = (): boolean => k.rand() < 0.3;

    // --- ground floor ---
    k.floor(0, 'flooring');
    k.outerWalls(0, {
      mat: wall, tint,
      front: [k.door(t + 1.0, 'open', 1.2), ...k.evenly(hx + 0.4, w - t - 0.4, 2).map((x) => k.window(x, 1.6, { sill: 0.8, broken: broken() }))],
      back: [k.door(hx + 1.0, 'locked'), k.window((xk + w - t) / 2, 0.8, { sill: 1.3 })],
      left: [k.window(t + 0.8, 0.6, { sill: 1.3 })],
      right: [k.window(zk / 2, 0.8, { sill: 1.3 }), k.window((zk + d) / 2, 1.6, { sill: 0.8 })],
    });
    k.stairs({ level: 0, start: [lane, zs], dir: 'z-', width: 0.9, rails: ['right', 'end'], mat: 'woodDark' });
    k.partition(0, hx, t, hx, d - t, [k.door(t + 2.6 - t), k.door(zg - t)]);
    k.partition(0, hx + P, zk, w - t, zk, [k.door((hx + xk) / 2 - hx - P), k.door((xk + w - t) / 2 - hx - P)]);
    k.partition(0, xk, t, xk, zk - P);
    const genkan = k.room(0, t, zs, hx - P, d - t, 'genkan');
    const hallA = k.room(0, t, t, hx - P, zh, 'hall');
    const hallB = k.room(0, t + 0.92, zh, hx - P, zs, 'hall');
    k.join(hallA, hallB);
    k.join(hallB, genkan);
    k.room(0, hx + P, t, xk - P, zk - P, 'kitchen');
    k.room(0, xk + P, t, w - t, zk - P, 'bath');
    k.room(0, hx + P, zk + P, w - t, d - t, 'canteen');
    k.furniture(0, t, d - t - 0.4, t + 0.35, d - t - 1.8, 1.0, 'wood', { tint: 0.2 }); // shoe shelf
    k.furniture(0, hx + 1.6, t, xk - 0.9, t + 0.62, 0.88, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xk - 0.8, t, xk - P - 0.05, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'grocery' } });
    k.furniture(0, w - t - 1.6, t, w - t, t + 1.2, 0.6, 'tileFloor', { tint: 0.8 }); // tub
    k.furniture(0, xk + P, t, xk + 0.9, t + 0.45, 1.5, 'wood', { search: { kind: 'cabinet', face: 'z+', table: 'bath' } });
    k.furniture(0, hx + 2.5, d - t - 1.6, w - t - 0.6, d - t - 0.8, 0.72, 'wood', { tint: 0.5, search: { kind: 'table', face: 'z-', table: 'canteen' } });
    for (let x = hx + 2.7; x + 0.4 < w - t - 0.8; x += 0.9) k.furniture(0, x, d - t - 0.75, x + 0.4, d - t - 0.35, 0.45, 'wood', { tint: 0.4, solid: false });
    if (k.rand() < 0.7) k.stain(0, hx + 0.8, zk + 0.8, hx + 2.0, zk + 1.8);
    // A cupboard toppled over in the kitchen.
    k.box(0, hx + 2.2, k.levelY(0), zk - 1.4, hx + 3.6, k.levelY(0) + 0.4, zk - 0.9, 'wood', { tint: 0.4, role: 'furniture', solid: false });

    // --- upper floor ---
    k.floor(1, 'tatami', undefined, { tint: 0.6 });
    k.outerWalls(1, {
      mat: wall, tint,
      front: [k.window(t + 1.0, 0.6, { sill: 1.2 }), ...k.evenly(hx + 0.4, w - t - 0.4, 2).map((x) => k.window(x, 1.4, { broken: broken() }))],
      back: [k.window((hx + w) / 2, 1.8)],
      left: [k.window(t + 0.7, 0.6, { sill: 1.2 })],
      right: [k.window(zm / 2, 1.2), k.window((zm + d) / 2, 1.2)],
    });
    const r1z = (t + zm) / 2;
    const r2z = Math.min(zm + 1.2, zt - 0.7);
    k.partition(1, hx, t, hx, d - t, [k.door(r1z - t), k.door(r2z - t)]);
    k.partition(1, hx + P, zm, w - t, zm);
    k.partition(1, t, zt, hx - P, zt, [k.door(t + 1.5 - t)]);
    const a = k.room(1, t, t, hx - P, zh, 'hall');
    const b = k.room(1, t + 0.98, zh, hx - P, zs, 'hall');
    const c = k.room(1, t, zs, hx - P, zt - P, 'hall');
    k.join(a, b);
    k.join(b, c);
    k.room(1, t, zt + P, hx - P, d - t, 'toilet');
    k.furniture(1, t, d - t - 0.45, t + 0.6, d - t, 0.8, 'appliance', { search: { kind: 'cabinet', face: 'z-', table: 'toilet' } });
    k.room(1, hx + P, t, w - t, zm - P, 'tatami');
    k.room(1, hx + P, zm + P, w - t, d - t, 'tatami');
    guestRoom(k, 1, hx + P, t, w - t, zm - P, r1z);
    guestRoom(k, 1, hx + P, zm + P, w - t, d - t, r2z);

    // --- roof and the street ---
    k.roofGable({ mat: k.pick(['tile', 'slate'] as const), tint: k.rand(), axis: 'x' });
    const y = k.levelY(0);
    sign(k, t + 1.75, t + 2.15, y + 0.3, y + 2.6, 0.3, { mat: 'woodDark' }); // the inn's name, by the door
    k.box(-1, t + 0.4, y + 2.2, d, t + 1.6, y + 2.3, d + 0.6, 'wood', { layer: 'shell', tint: 0.3, solid: false }); // eaves over the door
    k.box(-1, hx + 1.0, 0, d + 0.1, hx + 2.8, 0.45, d + 0.5, 'wood', { layer: 'shell', tint: 0.4, solid: false }); // bench
    k.box(-1, w - 1.2, 0, d + 0.1, w - 0.7, 0.6, d + 0.5, 'plant', { layer: 'shell', solid: false });
    return k.finish();
  },
};
