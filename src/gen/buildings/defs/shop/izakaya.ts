// 居酒屋 (07d-2b). Two wooden storeys under a tiled gable. Downstairs a bar counter in front of the
// kitchen (a low wall the cook served over), a few tables, the toilet; the narrow stair just inside
// the door goes up to the 座敷 — two tatami banquet rooms with low tables, off a landing.
//
//   ground                               upper
//   +-----+-----------------+            +----------------------+
//   | WC  | kitchen   [Dx]  |            |  back 座敷  [closet]  |
//   +--D--+== counter ====g-+            +--------[fusuma]------+
//   |st|  |  hall: stools   |            |  landing             |
//   |ai|  |  [tbl]  [tbl]   |            |st|+--[fusuma]--------+
//   |r | ||                 |            |ai||  front 座敷       |
//   |S |  |                 |            |r ||  low tables       |
//   +--+[door]===window=====+            +--+-------------------+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign, stools, table } from './common.ts';

export const SHOP_IZAKAYA: BuildingDef = {
  id: 'shop.izakaya',
  category: 'shop',
  variant: 'izakaya',
  kind: 'shop',
  size: { w: [9, 12], d: [11, 14] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.2,
  roof: 'gable',
  roofRise: 2.0,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_IZAKAYA, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.exterior;
    k.thick = t;
    const y0 = k.levelY(0);
    const xS = t + 1.1; // stair column | hall
    const foot = d - t - 1.3;
    const st = k.stairs({ level: 0, start: [t + 0.55, foot], dir: 'z-', width: ARCH.stair.width, rails: ['right', 'end'], mat: 'woodDark' });
    const hb = st.rect[1]; // back of the stairwell
    const xT = t + 2.2; // toilet | kitchen
    const zc = t + 3.0; // kitchen | hall
    const doorX = t + 2.6;
    const wood = k.rand();

    // ---- Ground: hall, counter, kitchen, toilet, the landing at the foot of the stair.
    k.floor(0, 'flooring');
    k.outerWalls(0, {
      mat: 'woodDark', tint: wood,
      front: [k.door(doorX, 'open', 1.2), k.window((doorX + 1.0 + w - 0.5) / 2, w - 0.5 - doorX - 1.2, { sill: 0.9, head: 2.1, broken: k.rand() < 0.4 })],
      back: [k.window(t + 1.0, 0.5, { sill: 1.5 }), k.door(w - t - 0.6, k.rand() < 0.4 ? 'open' : 'locked')],
      right: [k.window((zc + d) / 2, 1.6, { sill: 0.9, broken: k.rand() < 0.3 })],
    });
    const S = k.room(0, t, foot, xS, d - t, 'hall');
    k.partition(0, xS, hb, xS, foot, [], { mat: 'woodDark', tint: wood });
    const H = k.room(0, xS, zc + P, w - t, d - t, 'bar');
    k.join(S, H);
    k.partition(0, t, zc, xT, zc, [k.door(1.55)]);
    k.partition(0, xT, zc, w - t, zc, [k.door(w - t - 0.6 - xT)], { mat: 'woodDark', tint: 0.2, y1: y0 + 1.05 });
    // The counter top on the low wall (the wall itself stops people), the bottles behind it.
    k.box(0, xT + P, y0 + 1.05, zc - 0.25, w - t - 1.05, y0 + 1.1, zc + 0.2, 'wood', { tint: 0.9, solid: false });
    k.search(0, (xT + w - t) / 2, zc + 0.75, 'counter', 'bar');
    stools(k, 0, 'x', xT + 0.3, w - t - 1.3, zc + 0.6);
    for (const cx of [w - t - 1.3, w - t - 3.3]) if (cx - 0.6 > doorX + 1.0) table(k, 0, cx, d - t - 1.5, 1.2, 0.8, { chairs: ['z+', 'z-'], tint: 0.4 });
    if (k.rand() < 0.7) k.stain(0, doorX + 0.6, zc + 1.4, doorX + 2.0, zc + 2.4);
    k.stain(0, xS + 0.6, d - t - 1.0, xS + 1.6, d - t - 0.2, 'debris');
    // Toilet and kitchen.
    k.partition(0, xT, t, xT, zc - P);
    k.room(0, t, t, xT - P, zc - P, 'toilet');
    k.furniture(0, t, t + 0.2, t + 0.5, t + 0.9, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x+', table: 'toilet' } });
    k.room(0, xT + P, t, w - t, zc - P, 'kitchen');
    k.furniture(0, xT + 0.3, t, w - t - 1.4, t + 0.65, 0.9, 'steel', { tint: 0.5, search: { kind: 'counter', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xT + P, zc - 1.5, xT + 0.75, zc - 0.75, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'kitchen' } });

    // ---- Upper: landing, front and back 座敷.
    const z0 = hb - 1.5; // back zashiki | landing
    k.floor(1, 'tatami');
    k.outerWalls(1, {
      mat: 'plaster', tint: k.rand(),
      front: k.evenly(xS + 0.4, w - 0.4, 2).map((x) => k.window(x, 1.6, { broken: k.rand() < 0.3 })),
      back: k.evenly(0.6, w - 0.6, 2).map((x) => k.window(x, 1.4)),
      left: [k.window(z0 / 2 + 0.2, 0.9)],
      right: [k.window((hb + d) / 2, 1.4)],
    });
    k.room(1, t, z0 + P, w - t, hb, 'hall');
    k.partition(1, xS, hb, xS, d - t, [], { mat: 'plaster' });
    k.partition(1, xS + P, hb, w - t, hb, [k.door((w - t - xS) / 2, 'open', ARCH.door.wide)], { mat: 'paper' });
    k.partition(1, t, z0, w - t, z0, [k.door((w - 2 * t) / 2, 'open', ARCH.door.wide)], { mat: 'paper' });
    // Front: the big room with two rows of low tables.
    k.room(1, xS + P, hb + P, w - t, d - t, 'tatami');
    const fx0 = xS + 0.8;
    const fx1 = w - t - 0.6;
    for (const z of [hb + 1.6, d - t - 1.2]) {
      if (z - hb < 1.4) continue;
      table(k, 1, (fx0 + fx1) / 2, z, fx1 - fx0 - 0.6, 0.75, { low: true, chairs: ['z+', 'z-'], tint: 0.25 });
    }
    k.search(1, fx0 + 0.2, d - t - 0.5, 'table', 'tatami');
    k.furniture(1, w - t - 0.9, d - t - 0.5, w - t, d - t, 0.15, 'woodDark'); // tokonoma
    // Back: the smaller room, oshiire along the back wall.
    k.room(1, t, t, w - t, z0 - P, 'tatami');
    k.furniture(1, t, t, t + 1.8, t + 0.75, 1.9, 'wood', { tint: 0.7, search: { kind: 'closet', face: 'z+', table: 'closet' } });
    table(k, 1, w / 2 + 0.6, (t + z0) / 2 + 0.3, Math.min(2.4, w - 4.5), 0.75, { low: true, chairs: ['z+', 'z-'], tint: 0.25 });
    if (k.rand() < 0.6) k.stain(1, w - t - 2.2, t + 0.5, w - t - 1.0, t + 1.3);

    k.roofGable({ mat: 'tile', axis: 'x', tint: k.rand() });
    // Red lanterns, noren, the sign board over the door; crates and a barrel by the door.
    for (const x of [doorX - 0.9, doorX + 0.9]) k.box(-1, x - 0.22, y0 + 1.6, d + 0.05, x + 0.22, y0 + 2.3, d + 0.5, 'sign', { layer: 'shell', tint: 0.55, solid: false });
    k.box(-1, doorX - 0.65, y0 + 1.5, d + 0.02, doorX + 0.65, y0 + 2.1, d + 0.05, 'fabric', { layer: 'shell', tint: 0.0, solid: false });
    sign(k, doorX - 1.4, y0 + 2.25, d, doorX + 1.4, y0 + 2.75, d + 0.12, 0.2, 'wood');
    k.box(-1, w - 1.3, 0, d - 0.2, w - 0.8, 0.9, d + 0.4, 'sign', { layer: 'shell', tint: 0.85, solid: false });
    k.box(-1, w - 0.7, 0, d - 0.1, w - 0.15, 0.8, d + 0.45, 'wood', { layer: 'shell', tint: 0.3, solid: false });
    return k.finish();
  },
};
