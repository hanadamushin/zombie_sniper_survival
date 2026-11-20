// プレハブ住宅 (07d-2a). A one-storey light-steel modular house raised on blocks, under a shallow
// single-pitch roof; the rooms open into each other in a row along the front (no corridor), the
// bath at the end behind the toilet. A steel step at the door, the outdoor unit of the air
// conditioner, gas cylinders and a laundry pole outside.
//
//   +-----------+-----------+---------+------+
//   | kitchen   | living    | bedroom | bath |
//   |           |           |         +--D---+
//   |           D           D         D WC   |
//   +--D--------+-----------+---------+------+    front (z = d)

import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, ring } from './common.ts';

export const HOUSE_PREFAB: BuildingDef = {
  id: 'house.prefab',
  category: 'house',
  variant: 'prefab',
  kind: 'house',
  size: { w: [10, 13], d: [7.5, 9] },
  storeys: 1,
  storeyHeight: 2.7,
  plinth: 0.45,
  roof: 'shed',
  roofRise: 0.7,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_PREFAB, params, rng);
    const { w, d } = k;
    const t = 0.12;
    k.thick = t;
    const D = d - 1.4;
    const W = w - 2 * t;
    const x1 = t + W * 0.28; // kitchen | living
    const x2 = x1 + W * 0.27; // living | bedroom
    const x3 = w - t - 1.9; // bedroom | bath, WC
    const zd = D - t - 1.0; // the doors between the rooms
    const zw = D - t - 2.0; // bath | WC
    const fy = k.levelY(0);
    const doorX = t + 0.9;
    const tint = k.rand();
    const panel = k.pick(['siding', 'steel'] as const);

    k.floor(0, 'vinyl', [t, t, w - t, D - t]);
    ring(k, 0, [0, 0, w, D], {
      mat: panel, tint,
      front: [k.door(doorX), k.window((doorX + x1) / 2 + 0.4, 0.9, { sill: 1.0 }), k.window((x1 + x2) / 2, 1.6, { broken: k.rand() < 0.4 }), k.window((x2 + x3) / 2, 1.2), k.window((x3 + w - t) / 2, 0.5, { sill: 1.5 })],
      back: [k.window((t + x1) / 2, 1.2, { sill: 1.1 }), k.window((x1 + x2) / 2, 1.6), k.window((x2 + x3) / 2, 1.2), k.window((x3 + w - t) / 2 + 0.3, 0.6, { sill: 1.4 })],
      left: [k.window(D / 2, 0.9)],
      right: [k.window(zw / 2, 0.6, { sill: 1.4 })],
    });
    for (const x of [x1, x2, x3]) k.partition(0, x, t, x, D - t, [k.door(zd - t)], { mat: 'plaster', tint: 0.2 });
    k.partition(0, x3, zw, w - t, zw, [k.door(0.6)], { mat: 'plaster', tint: 0.2 });
    k.room(0, t, t, x1 - P, D - t, 'kitchen');
    k.room(0, x1 + P, t, x2 - P, D - t, 'living');
    k.room(0, x2 + P, t, x3 - P, D - t, 'bedroom');
    k.room(0, x3 + P, zw + P, w - t, D - t, 'toilet');
    k.room(0, x3 + P, t, w - t, zw - P, 'bath');

    k.furniture(0, t, t, x1 - P - 0.8, t + 0.62, 0.88, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, x1 - P - 0.7, t, x1 - P, t + 0.7, 1.7, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(0, x1 - P - 1.05, t + 1.8, x1 - P - 0.1, t + 2.7, 0.72, 'wood', { tint: 0.9 }); // table
    k.furniture(0, x1 + P, t, x1 + 1.2, t + 0.8, 0.45, 'fabric', { tint: k.rand() }); // sofa
    k.furniture(0, x2 - P - 0.45, t + 0.3, x2 - P, t + 1.5, 0.5, 'woodDark', { search: { kind: 'cabinet', face: 'x-', table: 'living' } });
    k.furniture(0, x2 + P, t, x2 + 1.0, t + 2.0, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'z+', table: 'bedroom' } });
    k.furniture(0, x3 - P - 0.6, t, x3 - P, t + 1.2, 1.8, 'steel', { tint: 0.5, search: { kind: 'locker', face: 'x-', table: 'closet' } });
    k.furniture(0, x3 + 1.0, t, w - t, t + 1.4, 0.55, 'tileFloor'); // unit bath tub
    k.search(0, x3 + 0.5, t + 0.5, 'cabinet', 'bath');
    k.furniture(0, w - t - 0.45, D - t - 0.9, w - t, D - t - 0.2, 0.42, 'appliance', { solid: false });
    k.search(0, x3 + 0.6, zw + 1.2, 'cabinet', 'toilet');
    // The ruin: the living-room window boarded with a table top, glass on the floor, blood by the door.
    k.stain(0, (x1 + x2) / 2 - 0.9, D - t - 0.7, (x1 + x2) / 2 + 0.9, D - t - 0.2, 'debris');
    if (k.rand() < 0.7) k.stain(0, doorX - 0.5, zd - 1.4, doorX + 0.7, zd - 0.6);

    // Shallow single-pitch roof, with the ceiling under it.
    const e = k.eaves;
    k.part({ shape: 'wedge', x0: -0.3, x1: w + 0.3, z0: -0.3, z1: D + 0.35, y0: e, y1: e + 0.7, slope: 'z-', mat: 'metalRoof', tint: k.rand() });
    k.floor(k.storeys, 'steel', [t, t, w - t, D - t]);

    // Outside: the steel step, the air conditioner, gas cylinders, a laundry pole.
    k.box(-1, doorX - 0.6, 0, D + 0.02, doorX + 0.6, fy - 0.2, D + 0.7, 'steel', { layer: 'shell', solid: false });
    k.box(-1, (x1 + x2) / 2 + 1.0, 0, D + 0.1, (x1 + x2) / 2 + 1.8, 0.6, D + 0.4, 'appliance', { layer: 'shell', role: 'furniture' });
    for (const dx of [0, 0.4]) k.box(-1, w - 0.8 + dx, 0, D + 0.15, w - 0.5 + dx, 1.3, D + 0.45, 'steel', { layer: 'shell', tint: 0.9, role: 'furniture' });
    for (const x of [x2, x3]) k.box(-1, x, 0, D + 0.9, x + 0.06, 1.9, D + 0.96, 'steel', { layer: 'shell' });
    k.box(-1, x2, 1.8, D + 0.9, x3 + 0.06, 1.84, D + 0.96, 'steel', { layer: 'shell', solid: false });
    return k.finish();
  },
};
