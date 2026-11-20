// 二世帯住宅 (07d-2a). A two-family house under a single-pitch (片流れ) roof: the parents live on the
// ground floor (their own genkan, LDK, tatami room, bath), the young family upstairs, reached from a
// second front door and a stair of their own. The door between the two genkans is usually locked.
//
//   ground floor (parents)                        upper floor (young family)
//   +------------+-----+---+--+                   +--------+--------+-----+-----+
//   | LDK        |bath |WC |  |                   | bed 1  | bed 2  |bath | hall|
//   |  (back dr) +-D---+-D-+st|                   |        |        +--D--D ↑   |
//   |            D  hall A |ai|                   |        |        |WC   D|| |
//   +-----D------+   ||    |rs|                   |        |        |     |strip|
//   | tatami     D genkan A D genkan B            +---D----+---D----+-----+--D--+
//   +------------+---D-----+---D---+              | LDK (whole front)            |
//                                                 +------------------------------+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { boards, hedge, inner, P, ring } from './common.ts';

export const HOUSE_NISETAI: BuildingDef = {
  id: 'house.nisetai',
  category: 'house',
  variant: 'nisetai',
  kind: 'house',
  size: { w: [11, 13], d: [10, 11.5] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.35,
  roof: 'shed',
  roofRise: 1.3,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_NISETAI, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const D = d - 2.0;
    const xl = w - t - 0.47; // stair lane (unit B)
    const xsw = w - t - 0.98; // hall A | the stair (centre line)
    const xb0 = w - t - 2.1; // genkan A | genkan B; upstairs: rooms | hall
    const xa0 = xb0 - 2.0; // tatami, LDK | genkan A, hall A
    const zf = D - t - 2.6; // back | front row; foot of the stair
    const zh = zf - 3.75; // upstairs: the hall at the top
    const zw = t + 2.2; // bath, WC | hall A
    const xm = (t + xb0 - 2.0) / 2; // upstairs: bedroom 1 | bedroom 2
    const tint = k.rand();
    const wallMat = k.pick(['siding', 'siding', 'mortar'] as const);
    const doorA = (xa0 + xb0) / 2;
    const doorB = xb0 + 1.05;
    const zfm = (zf + D - t) / 2;

    // --- ground floor: the parents ---
    k.floor(0, 'flooring', [t, t, w - t, D - t]);
    ring(k, 0, [0, 0, w, D], {
      mat: wallMat, tint,
      front: [k.window((t + xa0) / 2, 1.6, { sill: 0.6, broken: k.rand() < 0.35 }), k.door(doorA), k.door(doorB)],
      back: [k.window(t + 1.2, 1.6, { sill: 0.9 }), k.door(xa0 - 1.0, k.rand() < 0.5 ? 'open' : 'locked'), k.window(xa0 + 0.95, 0.6, { sill: 1.4 }), k.window(xa0 + 2.51, 0.4, { sill: 1.5 })],
      left: [k.window(zf / 2, 1.6, { sill: 0.8 }), k.window(zfm, 0.9, { sill: 0.9 })],
      right: [k.window((zh + zf) / 2, 0.5, { sill: 1.6, head: 2.4 })],
    });
    k.partition(0, xa0, t, xa0, D - t, [k.door((zw + zf) / 2 - t), k.door(zfm - t)]);
    k.partition(0, t, zf, xa0, zf, [k.door((t + xa0) / 2 - t)]);
    k.partition(0, xb0, zf, xsw, zf);
    k.partition(0, xb0, zf, xb0, D - t, [k.door(zfm - zf, k.rand() < 0.7 ? 'locked' : 'open')]);
    k.partition(0, xsw, t, xsw, zf);
    k.partition(0, xa0, zw, xsw, zw, [k.door(0.95), k.door(2.51, 'open', 0.8)]);
    k.partition(0, xa0 + 1.9, t, xa0 + 1.9, zw);
    k.room(0, t, t, xa0 - P, zf - P, 'living');
    k.room(0, t, zf + P, xa0 - P, D - t, 'tatami');
    const genkanA = k.room(0, xa0 + P, zf, xb0 - P, D - t, 'genkan');
    const hallA = k.room(0, xa0 + P, zw + P, xsw - P, zf, 'hall');
    k.join(hallA, genkanA);
    k.room(0, xb0 + P, zf + P, w - t, D - t, 'genkan');
    k.room(0, xa0 + P, t, xa0 + 1.9 - P, zw - P, 'bath');
    k.room(0, xa0 + 1.9 + P, t, xsw - P, zw - P, 'toilet');
    k.stairs({ level: 0, start: [xl, zf], dir: 'z-', width: 0.9, rails: ['left'], mat: 'wood', tint: 0.6 });

    k.furniture(0, t, t, t + 2.4, t + 0.65, 0.88, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, t, t + 0.9, t + 0.7, t + 1.6, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'kitchen' } });
    k.furniture(0, t + 0.8, zf - 2.6, t + 2.2, zf - 1.7, 0.72, 'wood', { tint: 0.6 }); // dining table
    k.furniture(0, t, zf - 0.6 - P, t + 1.4, zf - P, 1.0, 'woodDark', { search: { kind: 'cabinet', face: 'z-', table: 'living' } });
    k.stain(0, t, zf + P, xa0 - P, D - t, 'tatami');
    k.furniture(0, t, D - t - 1.8, t + 0.55, D - t - 0.4, 1.7, 'wood', { tint: 0.7, search: { kind: 'closet', face: 'x+', table: 'tatami' } });
    k.furniture(0, xa0 + P, t, xa0 + 1.0, t + 0.75, 0.6, 'tileFloor'); // tub
    k.search(0, xa0 + 1.3, t + 0.6, 'cabinet', 'bath');
    k.furniture(0, xa0 + 2.3, t, xa0 + 2.7, t + 0.7, 0.42, 'appliance', { solid: false });
    k.furniture(0, xsw - P - 0.4, zw + 1.4, xsw - P, zw + 2.5, 1.2, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'closet' } });
    // A walking frame and blood in the parents' hall.
    if (k.rand() < 0.7) k.stain(0, xa0 + 0.6, zw + 1.0, xa0 + 1.8, zw + 2.0);
    k.box(0, xa0 + 0.3, k.levelY(0), zf + 0.3, xa0 + 0.9, k.levelY(0) + 0.8, zf + 0.8, 'steel', { solid: false });

    // --- upper floor: the young family ---
    k.floor(1, 'flooring', [t, t, w - t, D - t]);
    ring(k, 1, [0, 0, w, D], {
      mat: wallMat, tint,
      front: k.evenly(t + 0.4, w - t - 0.4, 3).map((x) => k.window(x, 1.6, { broken: k.rand() < 0.3 })),
      back: [k.window((t + xm) / 2, 1.2), k.window((xm + xb0 - 2.0) / 2, 1.2), k.window(xb0 - 1.0, 0.6, { sill: 1.4 })],
      left: [k.window(zf / 2, 0.9), k.window(zfm, 0.9)],
      right: [k.window((t + zh) / 2 + 0.2, 0.6, { sill: 1.2 })],
    });
    k.partition(1, xb0, t, xb0, zf, [k.door(Math.min(1.2, zh - 0.5) - t), k.door((2.6 + zf) / 2 - t, 'open', 0.8)]);
    k.partition(1, xb0 - 2.0, t, xb0 - 2.0, zf);
    k.partition(1, xm, t, xm, zf);
    k.partition(1, xb0 - 2.0, 2.6, xb0, 2.6);
    k.partition(1, t, zf + P, w - t, zf + P, [k.door((t + xm) / 2 - t), k.door((xm + xb0 - 2.0) / 2 - t), k.door(xb0 + 0.59 - t)]);
    const h1 = k.room(1, xb0 + P, t, w - t, zh, 'hall');
    const h2 = k.room(1, xb0 + P, zh, w - t - 0.98, zf, 'hall');
    k.join(h1, h2);
    k.room(1, t, t, xm - P, zf - P, 'bedroom');
    k.room(1, xm + P, t, xb0 - 2.0 - P, zf - P, 'bedroom');
    k.room(1, xb0 - 2.0 + P, t, xb0 - P, 2.6 - P, 'bath');
    k.room(1, xb0 - 2.0 + P, 2.6 + P, xb0 - P, zf - P, 'toilet');
    k.room(1, t, zf + 2 * P, w - t, D - t, 'living');
    k.furniture(1, t, t, t + 1.4, t + 2.0, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
    k.furniture(1, xm - P - 0.6, t, xm - P, t + 1.5, 1.9, 'wood', { search: { kind: 'closet', face: 'x-', table: 'bedroom' } });
    k.furniture(1, xm + P, t, xm + 1.0, t + 1.8, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } }); // kids' bunk
    k.furniture(1, xb0 - 2.0 - P - 1.1, t, xb0 - 2.0 - P, t + 0.55, 0.75, 'wood', { tint: 0.8, search: { kind: 'desk', face: 'z+', table: 'bedroom' } });
    k.furniture(1, xb0 - 2.0 + P, t, xb0 - 1.2, t + 1.5, 0.6, 'tileFloor'); // tub
    k.search(1, xb0 - 0.7, 2.0, 'cabinet', 'bath');
    k.furniture(1, xb0 - 2.0 + P, zf - P - 0.5, xb0 - 2.0 + 0.9, zf - P, 1.0, 'shelf', { search: { kind: 'shelf', face: 'z-', table: 'toilet' } });
    k.furniture(1, t, zf + 2 * P + 0.4, t + 0.6, D - t - 0.3, 0.9, 'counter', { search: { kind: 'cabinet', face: 'x+', table: 'kitchen' } });
    k.furniture(1, w - t - 0.5, D - t - 2.0, w - t, D - t - 0.3, 0.5, 'woodDark', { search: { kind: 'cabinet', face: 'x-', table: 'living' } });
    k.furniture(1, w - t - 2.4, D - t - 0.8, w - t - 0.9, D - t, 0.42, 'fabric', { tint: k.rand() }); // sofa
    // Barricade: boards over the back window of the main bedroom.
    boards(k, 1, (t + xm) / 2 - 0.75, t + 0.02, (t + xm) / 2 + 0.75, t + 0.06, ARCH.window.sill, ARCH.window.head);

    // --- roof: single pitch rising to the back ---
    const e = k.eaves;
    k.part({ shape: 'wedge', x0: -0.45, x1: w + 0.45, z0: -0.45, z1: D + 0.45, y0: e, y1: e + 1.3, slope: 'z-', mat: 'metalRoof', tint: k.rand() });
    k.floor(k.storeys, 'wood', inner([0, 0, w, D], t));

    // --- front: a low wall between the two doors, bicycles, a planter ---
    k.box(-1, xb0 - 0.1, -0.5, D + 1.1, xb0 + 0.1, 1.2, d - 0.1, 'concrete', { layer: 'shell', tint: 0.66 });
    for (const x of [t + 0.8, t + 1.5]) k.box(-1, x, 0, D + 0.3, x + 0.08, 1.0, D + 1.9, 'steel', { layer: 'shell', role: 'furniture' });
    hedge(k, (t + xa0) / 2 - 1.2, D + 0.2, (t + xa0) / 2 + 1.2, D + 0.7, 0.7);
    return k.finish();
  },
};
