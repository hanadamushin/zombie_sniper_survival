// 木造 2 階建て・和風 (07d-2a). Hipped tile roof, a lower roof (下屋) over a wooden veranda along
// the two tatami rooms, a tall block wall with a gate and a side garden with a stone lantern.
// The stair climbs from the corridor towards the back along the left wall.
//
//   ground floor                                   upper floor
//   +--+--------+------+--+----+                   +----------------------------+
//   |st| DK     | bath |WC|納戸|                   | back hall                   |
//   |ai|        +-D----+D-+    |                   |  ||  +-----D-----+------D----+
//   |rs|        | 洗面 |  |    |                   |  ||  | bedroom   | 和室        |
//   +  +--D-----+--D---+--+-D--+                   +--++  |          |             |
//   |        corridor           |                   |押入] |          |             |
//   +  open +----D----+----D----+                   +--+--+----------+-------------+
//   | genkan| 和室 A  =D= 和室 B |  (床の間)
//   +--D----+---------+---------+
//   ======= veranda (縁側) =====      front (z = d), gate in the wall before the genkan

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { fence, P, pitched, ring, tree } from './common.ts';

export const HOUSE_WAFU2: BuildingDef = {
  id: 'house.wafu2',
  category: 'house',
  variant: 'wafu2',
  kind: 'house',
  size: { w: [12, 14], d: [12, 13.5] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.45,
  roof: 'hip',
  roofRise: 2.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_WAFU2, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const Wh = w - 2.4; // the house; a garden on the right
    const D = d - 1.8; // the veranda and the gate in front
    const lane = t + 0.47; // stair centre line
    const xr = t + 1.04; // stair column | the rest (centre line)
    const zc0 = 5.3; // back rooms | corridor: the stair climbs 3.75 m to the back hall upstairs
    const zh = zc0 - 3.75; // upstairs: back hall | rooms
    const zc1 = zc0 + 1.3; // corridor | front rooms
    const xk = xr + 3.2; // DK | bath
    const xb = xk + 2.1; // bath | WC
    const xw = xb + 1.2; // WC | 納戸
    const zbath = t + 2.5; // bath | 洗面
    const zwc = zc0 - 1.7; // WC (front part of its column)
    const xg = t + 2.0; // genkan | 和室 A
    const xm = (xg + Wh - t) / 2; // 和室 A | 和室 B
    const xm1 = xr + (Wh - t - xr) * 0.45; // upstairs: bedroom | 和室
    const tint = k.rand();
    const wallMat = k.pick(['plaster', 'mortar'] as const);
    const doorX = (t + xg) / 2;
    const y0 = k.levelY(0);

    // --- ground floor ---
    k.floor(0, 'flooring', [t, t, Wh - t, D - t]);
    const sweep = { sill: 0.05, head: 1.9 }; // 掃き出し窓 onto the veranda
    ring(k, 0, [0, 0, Wh, D], {
      mat: wallMat, tint,
      front: [k.door(doorX), ...k.evenly(xg + 0.2, Wh - t - 0.2, 2).map((x) => k.window(x, Math.min(2.6, (Wh - xg) / 2 - 0.8), { ...sweep, broken: k.rand() < 0.3 }))],
      back: [k.door(xr + 0.7, 'locked'), k.window((xr + xk) / 2 + 0.6, 1.4, { sill: 1.0 }), k.window((xk + xb) / 2, 0.8, { sill: 1.3 }), k.window((xw + Wh - t) / 2, 0.6, { sill: 1.4 })],
      left: [k.window((zc1 + D) / 2, 0.8, { sill: 1.0 })],
      right: [k.window((zc1 + D) / 2 + 0.4, 1.4, sweep), k.window(zc0 / 2, 0.8, { sill: 1.2 })],
    });
    // Back-room partitions; the stair column is open to the corridor.
    k.partition(0, xr, t, xr, zc0);
    k.partition(0, xr, zc0, Wh - t, zc0, [k.door(xr + 1.0 - xr), k.door((xk + xb) / 2 - xr), k.door((xb + xw) / 2 - xr, 'open', 0.8), k.door((xw + Wh - t) / 2 - xr)]);
    k.partition(0, xk, t, xk, zc0);
    k.partition(0, xb, t, xb, zc0);
    k.partition(0, xw, t, xw, zc0);
    k.partition(0, xk, zbath, xb, zbath, [k.door((xk + xb) / 2 - xk)]);
    k.partition(0, xb, zwc, xw, zwc);
    k.partition(0, xg, zc1, Wh - t, zc1, [k.door((xg + xm) / 2 - xg), k.door((xm + Wh - t) / 2 - xg)]);
    k.partition(0, xg, zc1, xg, D - t);
    k.partition(0, xm, zc1, xm, D - t, [k.door((zc1 + D - t) / 2 - zc1, 'open', 1.8)]); // fusuma taken out
    const corridor = k.room(0, t, zc0 + P, Wh - t, zc1 - P, 'hall');
    const genkan = k.room(0, t, zc1 - P, xg - P, D - t, 'genkan');
    k.join(genkan, corridor);
    k.room(0, xr + P, t, xk - P, zc0 - P, 'kitchen');
    k.room(0, xk + P, t, xb - P, zbath - P, 'bath');
    k.room(0, xk + P, zbath + P, xb - P, zc0 - P, 'bath');
    k.room(0, xb + P, zwc + P, xw - P, zc0 - P, 'toilet');
    k.room(0, xw + P, t, Wh - t, zc0 - P, 'closet');
    k.room(0, xg + P, zc1 + P, xm - P, D - t, 'tatami');
    k.room(0, xm + P, zc1 + P, Wh - t, D - t, 'tatami');
    k.stairs({ level: 0, start: [lane, zc0], dir: 'z-', width: 0.9, rails: ['end'], mat: 'woodDark' });

    // Furniture.
    k.furniture(0, t, D - t - 1.9, t + 0.35, D - t - 0.95, 1.0, 'woodDark'); // shoe cabinet
    k.furniture(0, xr + 1.7, t, xk - 0.8, t + 0.62, 0.88, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xk - 0.75, t, xk - P - 0.02, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xr + 0.7, 2.2, xr + 2.0, 3.1, 0.72, 'wood', { tint: 0.4, search: { kind: 'table', face: 'x+', table: 'kitchen' } }); // dining table
    k.furniture(0, xk + P + 0.1, t, xb - P - 0.1, t + 0.85, 0.6, 'tileFloor'); // tub
    k.search(0, xk + P + 0.45, t + 1.3, 'cabinet', 'bath');
    k.furniture(0, xb - P - 0.6, zc0 - 1.7, xb - P, zc0 - 1.1, 0.85, 'counter', { search: { kind: 'cabinet', face: 'x-', table: 'bath' } }); // washbasin
    k.furniture(0, (xb + xw) / 2 - 0.2, zwc + P, (xb + xw) / 2 + 0.2, zwc + 0.75, 0.42, 'appliance', { solid: false });
    k.furniture(0, Wh - t - 0.5, t, Wh - t, zc0 - 1.4, 1.9, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'closet' } });
    k.stain(0, xg + P, zc1 + P, Wh - t, D - t, 'tatami');
    k.furniture(0, Wh - t - 0.9, zc1 + P, Wh - t, zc1 + 1.3, 0.2, 'woodDark'); // 床の間
    k.furniture(0, xm + P, zc1 + P, xm + 1.0, zc1 + 0.55, 1.6, 'woodDark', { search: { kind: 'cabinet', face: 'z+', table: 'tatami' } }); // 仏壇
    k.furniture(0, xg + P, zc1 + P, xg + 1.1, zc1 + 0.5, 1.4, 'wood', { tint: 0.7, search: { kind: 'closet', face: 'z+', table: 'closet' } }); // 箪笥
    k.stain(0, t + 0.4, zc0 + 0.3, t + 1.6, zc1 - 0.2);
    // A 箪笥 knocked over across the 和室 A.
    k.box(0, xg + 1.0, y0, zc1 + 1.8, xm - 0.4, y0 + 0.45, zc1 + 2.3, 'wood', { tint: 0.7, role: 'furniture' });

    // --- upper floor ---
    k.floor(1, 'flooring', [t, t, Wh - t, D - t]);
    ring(k, 1, [0, 0, Wh, D], {
      mat: wallMat, tint,
      front: [k.window(t + 0.5, 0.5, { sill: 1.2 }), ...k.evenly(xr + 0.3, Wh - t - 0.3, 2).map((x) => k.window(x, 1.6, { broken: k.rand() < 0.3 }))],
      back: [k.window(Wh / 2, 1.8)],
      left: [],
      right: [k.window((zh + D) / 2, 1.2)],
    });
    k.partition(1, xr, zh, xr, D - t, [k.window((zc0 + D - t) / 2 - zh, Math.min(1.5, D - t - zc0 - 0.4), { sill: 0, head: 1.8, broken: true })]);
    k.partition(1, xr - P, zh + P, Wh - t, zh + P, [k.door((xr + xm1) / 2 - xr + P), k.door((xm1 + Wh - t) / 2 - xr + P)]);
    k.partition(1, xm1, zh + 2 * P, xm1, D - t);
    k.room(1, t, t, Wh - t, zh, 'hall');
    k.room(1, xr + P, zh + 2 * P, xm1 - P, D - t, 'bedroom');
    k.room(1, xm1 + P, zh + 2 * P, Wh - t, D - t, 'tatami');
    k.room(1, t, zc0, xr - P, D - t, 'closet', { locked: true }); // 押入 beyond the stairwell
    k.search(1, xr + P + 0.5, (zc0 + D - t) / 2, 'closet', 'closet');
    k.furniture(1, xm1 - P - 1.0, D - t - 2.1, xm1 - P, D - t, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
    k.furniture(1, xm1 - P - 0.6, zh + 0.9, xm1 - P, zh + 2.1, 1.8, 'wood', { search: { kind: 'closet', face: 'x-', table: 'bedroom' } });
    k.stain(1, xm1 + P, zh + 2 * P, Wh - t, D - t, 'tatami');
    k.furniture(1, Wh - t - 0.5, D - t - 2.0, Wh - t, D - t - 0.5, 1.1, 'woodDark', { search: { kind: 'cabinet', face: 'x-', table: 'tatami' } });
    if (k.rand() < 0.6) k.stain(1, xr + 0.6, zh + 1.0, xr + 1.6, zh + 1.8);

    // --- roofs ---
    const roofTint = k.rand();
    pitched(k, [0, 0, Wh, D], { mat: 'tile', tint: roofTint, hip: true, axis: 'x' });
    // 下屋 over the veranda (drawn only; it is in front of the wall, under the upper windows).
    const ly = k.levelY(1);
    k.part({ shape: 'wedge', x0: xg - 0.2, x1: Wh + 0.3, z0: D, z1: D + 1.2, y0: ly - 0.55, y1: ly - 0.05, slope: 'z-', mat: 'tile', tint: roofTint, solid: false });
    k.box(-1, xg, -0.5, D, Wh, y0 - 0.05, D + 0.9, 'wood', { layer: 'shell', tint: 0.4 }); // veranda
    for (const x of [xg + 0.1, Wh - 0.2]) k.box(-1, x, y0, D + 1.0, x + 0.1, ly - 0.5, D + 1.1, 'woodDark', { layer: 'shell' });

    // --- garden: tall block wall, gate, a pine, a stone lantern ---
    const g0 = doorX - 1.3;
    const g1 = doorX + 1.4;
    if (g0 > 0.2) fence(k, 0, d - 0.15, g0, d, 1.7, 'mortar', tint);
    fence(k, g1, d - 0.15, w, d, 1.7, 'mortar', tint);
    fence(k, w - 0.15, 0, w, d - 0.15, 1.7, 'mortar', tint);
    fence(k, Wh, 0, w - 0.15, 0.15, 1.7, 'mortar', tint);
    for (const x of [g0, g1]) if (x > 0.1) k.box(-1, x - 0.15, -0.5, d - 0.3, x + 0.15, 2.2, d, 'woodDark', { layer: 'shell' }); // gate posts
    tree(k, Wh + 1.2, D * 0.35, 2.0);
    tree(k, Wh + 1.1, D * 0.75, 1.3);
    k.box(-1, Wh + 0.9, 0, D * 0.55, Wh + 1.4, 1.1, D * 0.55 + 0.5, 'concrete', { layer: 'shell', tint: 0.66 }); // 石灯籠
    return k.finish();
  },
};
