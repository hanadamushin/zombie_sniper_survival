// 木造 2 階建て・洋風 (07d-2a). Siding walls, a gable whose end faces the street, one open-plan LDK
// on the ground floor, a carport (often with an abandoned car) and a low wooden fence round the lawn.
// The entrance hall and the stair are in a column along the right wall.
//
//   ground floor                         upper floor
//   +---------------------+------+       +-------------+-----------+
//   | kitchen  [island]   | bath |       | bedroom 1   | hall    ↑ |
//   |                     +--D---+       |             D strip  || |
//   | LDK                 | hall ||      +-------------+       || |
//   |                     |  ↑   ||      | bedroom 2   D       || |
//   |  sofa               D entrance|    |             +---D-------+
//   +---------------------+---D------+   |             | WC        |
//                          front door     +-------------+-----------+   carport on the right

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { carport, fence, hedge, P, pitched, ring } from './common.ts';

export const HOUSE_YOFU2: BuildingDef = {
  id: 'house.yofu2',
  category: 'house',
  variant: 'yofu2',
  kind: 'house',
  size: { w: [11, 13], d: [10, 12] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.4,
  roof: 'gable',
  roofRise: 2.6,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_YOFU2, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const Wh = w - 3.0; // the house; the carport on the right
    const D = d - 1.6; // the lawn in front
    const xh = Wh - t - 2.1; // LDK | hall column (centre line)
    const lane = Wh - t - 0.47;
    const zb = t + 2.45; // bath | hall beside the stair; upstairs: the hall at the top
    const zs = zb + 3.75; // foot of the stair
    const zm = (zb + zs) / 2; // upstairs: bedroom 1 | bedroom 2
    const tint = k.rand();
    const wallMat = k.pick(['siding', 'siding', 'plaster'] as const);
    const doorX = xh + 1.05;
    const xd = xh - 1.0; // back door
    const y0 = k.levelY(0);

    // --- ground floor ---
    k.floor(0, 'flooring', [t, t, Wh - t, D - t]);
    ring(k, 0, [0, 0, Wh, D], {
      mat: wallMat, tint,
      front: [k.window((t + xh) / 2 - 0.6, Math.min(2.6, xh - 1.6), { sill: 0.1, head: 2.1, broken: k.rand() < 0.35 }), k.door(doorX)],
      back: [k.window(t + 1.3, 1.6, { sill: 1.0 }), k.door(xd, k.rand() < 0.5 ? 'open' : 'locked'), k.window(Wh - t - 1.2, 0.6, { sill: 1.4 })],
      left: [k.window(zm, 1.8, { sill: 0.8 })],
      right: [k.window((zs + D) / 2, 0.5, { sill: 1.0 })],
    });
    k.partition(0, xh, t, xh, D - t, [k.door((zs + D - t) / 2 - t, 'open', 1.0)]);
    k.partition(0, xh, zb, Wh - t, zb, [k.door(0.59)]);
    const ldk = k.room(0, t, t, xh - P, D - t, 'living');
    void ldk;
    k.room(0, xh + P, t, Wh - t, zb - P, 'bath');
    const hall = k.room(0, xh + P, zb + P, Wh - t - 0.92, zs, 'hall');
    const entrance = k.room(0, xh + P, zs, Wh - t, D - t, 'genkan');
    k.join(hall, entrance);
    k.stairs({ level: 0, start: [lane, zs], dir: 'z-', width: 0.9, rails: ['left'], mat: 'wood', tint: 0.8 });

    // LDK: kitchen along the back, an island, the dining table, the sofa by the front window.
    k.furniture(0, t, t, t + 2.6, t + 0.65, 0.9, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, t + 2.7, t, t + 3.4, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(0, t + 0.8, t + 1.7, t + 2.4, t + 2.4, 0.9, 'counter', { tint: 0.4 }); // island
    k.furniture(0, t + 0.6, zm - 0.5, t + 2.2, zm + 0.4, 0.72, 'wood', { tint: 0.9, search: { kind: 'table', face: 'x+', table: 'living' } });
    k.furniture(0, t, D - t - 2.6, t + 0.9, D - t - 0.6, 0.45, 'fabric', { tint: k.rand() }); // sofa
    k.furniture(0, t + 2.6, D - t - 2.2, t + 3.1, D - t - 1.0, 0.55, 'woodDark', { search: { kind: 'cabinet', face: 'x-', table: 'living' } }); // TV board
    k.stain(0, t + 1.2, D - t - 3.4, t + 2.6, D - t - 2.6, 'carpet');
    k.furniture(0, Wh - t - 0.75, t, Wh - t, t + 1.6, 0.6, 'tileFloor'); // tub
    k.furniture(0, xh + P, t, xh + 0.9, t + 0.5, 0.85, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'bath' } });
    // The ruin: the dining chairs piled against the back door, blood across the floor.
    k.box(0, xd - 0.6, y0, t + 0.2, xd + 0.6, y0 + 0.9, t + 0.7, 'wood', { tint: 0.9, solid: false });
    if (k.rand() < 0.7) k.stain(0, xh - 1.6, zm, xh - 0.4, zm + 1.6);

    // --- upper floor ---
    k.floor(1, 'flooring', [t, t, Wh - t, D - t]);
    ring(k, 1, [0, 0, Wh, D], {
      mat: wallMat, tint,
      front: [...k.evenly(t + 0.4, xh - 0.4, 2).map((x) => k.window(x, 1.4, { broken: k.rand() < 0.3 })), k.window(doorX, 0.6, { sill: 1.3 })],
      back: [k.window((t + xh) / 2, 1.6)],
      left: [k.window(zm / 2, 0.9, { sill: 1.0 })],
      right: [k.window(zb / 2 + 0.2, 0.8, { sill: 1.2 })],
    });
    k.partition(1, xh, t, xh, D - t, [k.door((zb + zm) / 2 - t), k.door((zm + zs) / 2 - t)]);
    k.partition(1, t, zm, xh, zm);
    k.partition(1, xh, zs + P, Wh - t, zs + P, [k.door(0.59, 'open', 0.8)]);
    const top = k.room(1, xh + P, t, Wh - t, zb, 'hall');
    const strip = k.room(1, xh + P, zb, Wh - t - 0.98, zs, 'hall');
    k.join(top, strip);
    k.room(1, t, t, xh - P, zm - P, 'bedroom');
    k.room(1, t, zm + P, xh - P, D - t, 'bedroom');
    k.room(1, xh + P, zs + 2 * P, Wh - t, D - t, 'toilet');
    k.furniture(1, t, t, t + 1.6, t + 2.1, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
    k.furniture(1, xh - P - 0.6, t, xh - P, t + 1.4, 1.9, 'wood', { search: { kind: 'closet', face: 'x-', table: 'bedroom' } });
    k.furniture(1, t, D - t - 2.1, t + 1.0, D - t, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
    k.furniture(1, t + 1.6, zm + P, t + 2.8, zm + 0.65, 0.75, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'z+', table: 'bedroom' } });
    k.furniture(1, Wh - t - 0.5, D - t - 0.9, Wh - t, D - t, 0.45, 'appliance', { solid: false });
    k.furniture(1, xh + P, D - t - 0.45, xh + 0.8, D - t, 1.2, 'shelf', { search: { kind: 'shelf', face: 'z-', table: 'toilet' } });
    // Toppled wardrobe in the front bedroom.
    k.box(1, t + 2.2, k.levelY(1), D - t - 1.4, t + 4.0, k.levelY(1) + 0.55, D - t - 0.8, 'wood', { tint: 0.2, role: 'furniture' });

    // --- roof, porch ---
    pitched(k, [0, 0, Wh, D], { mat: k.pick(['slate', 'metalRoof'] as const), tint: k.rand(), axis: 'z' });
    k.part({ shape: 'wedge', x0: doorX - 1.0, x1: Wh + 0.1, z0: D, z1: D + 1.0, y0: y0 + 2.3, y1: y0 + 2.6, slope: 'z-', mat: 'metalRoof', tint: 0.4, solid: false });

    // --- outside: carport, fence, lawn ---
    carport(k, [Wh + 0.3, D - 5.0, w - 0.2, Math.min(d - 0.2, D + 1.2)], { along: 'z' });
    fence(k, 0, d - 0.1, doorX - 0.8, d, 0.9, 'wood', 0.95);
    fence(k, doorX + 0.8, d - 0.1, Wh - 0.2, d, 0.9, 'wood', 0.95);
    fence(k, 0, D, 0.1, d - 0.1, 0.9, 'wood', 0.95);
    hedge(k, 0.2, d - 0.7, doorX - 1.2, d - 0.2, 0.8);
    return k.finish();
  },
};
