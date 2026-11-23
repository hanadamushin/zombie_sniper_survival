// L3a: 東京都庁第一本庁舎 (Tokyo Metropolitan Government Building No. 1, 1991, Tange Kenzō), Nishi-
// Shinjuku. 243 m, 48 storeys: a broad slab of two tones of granite in a fine grid (the "circuit
// board" front) that splits into twin towers from the 33rd storey; the towers' tops are cut back on
// the diagonal, the observatories (202 m) in them. The two halves of the slab are marked by a deep
// slot up its middle.
//
// The front (local z = d) faces east (the 都民広場 side); the lot is the building and a strip of its plaza.

import { landmarkDef, type Lm } from '../common.ts';

const W = 112;
const D = 60;
/** The slab's back and front; where the towers split; their tops. */
const Z0 = 8;
const Z1 = 46;
const SPLIT = 158;
const TOP = 243;

export const LANDMARK_TOKYO_METROPOLITAN_GOVERNMENT = landmarkDef({
  variant: 'tokyo_metropolitan_government',
  size: { w: [W, W], d: [D, D] },
  eaves: SPLIT,
  top: TOP,
  kind: 'office',
  build,
});

/** The fine grid of a face: tall dark window strips between the light granite piers, banded every few storeys. */
function grid(L: Lm, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, n: number, nz: number): void {
  L.windows('x', z1, 1, x0 + 1, x1 - 1, n, y0, y1, ((x1 - x0) / n) * 0.42, { paint: 'windowDark' });
  L.windows('x', z0, -1, x0 + 1, x1 - 1, n, y0, y1, ((x1 - x0) / n) * 0.42, { paint: 'windowDark' });
  L.windows('z', x1, 1, z0 + 1, z1 - 1, nz, y0, y1, ((z1 - z0) / nz) * 0.42, { paint: 'windowDark' });
  L.windows('z', x0, -1, z0 + 1, z1 - 1, nz, y0, y1, ((z1 - z0) / nz) * 0.42, { paint: 'windowDark' });
  for (let y = y0 + 16; y < y1 - 4; y += 16) L.box(x0 - 0.12, y, z0 - 0.12, x1 + 0.12, y + 1.6, z1 + 0.12, 'paint', { paint: 'gray', solid: false });
}

function build(L: Lm): void {
  L.ground('paved', [[0, Z1], [W, Z1], [W, D], [0, D]]);
  const tw: [number, number][] = [[6, 46], [66, 106]];

  // The slab: two halves joined by a recessed middle (the slot), to the split.
  for (const [x0, x1] of tw) {
    L.box(x0, 0, Z0, x1, SPLIT, Z1, 'paint', { paint: 'granite' });
    grid(L, x0, x1, Z0, Z1, 8, SPLIT - 2, 8, 7);
  }
  L.box(46, 0, Z0 + 5, 66, SPLIT - 4, Z1 - 5, 'paint', { paint: 'gray' });
  L.windows('x', Z1 - 5, 1, 47, 65, 3, 10, SPLIT - 8, 3.2, { paint: 'deckGlass' });
  L.windows('x', Z0 + 5, -1, 47, 65, 3, 10, SPLIT - 8, 3.2, { paint: 'deckGlass' });
  L.box(46, SPLIT - 4, Z0 + 4, 66, SPLIT, Z1 - 4, 'paint', { paint: 'granite' });
  // The base: a darker granite plinth and the entrance hall at the front (shut).
  L.box(4, 0, Z0 - 2, W - 4, 8, Z1 + 2, 'paint', { paint: 'gray' });
  L.box(48, 0, Z1 + 2, 64, 6, Z1 + 2.15, 'paint', { paint: 'deckGlass' });

  // The twin towers: square to 200 m, then cut back on the diagonal to the top, the crown.
  for (const [x0, x1] of tw) {
    const cx = (x0 + x1) / 2;
    const cz = (Z0 + Z1) / 2;
    L.box(x0 + 2, SPLIT, Z0 + 1, x1 - 2, 200, Z1 - 1, 'paint', { paint: 'granite' });
    grid(L, x0 + 2, x1 - 2, Z0 + 1, Z1 - 1, SPLIT, 200, 6, 6);
    // The top: the square and a square turned 45° (an octagon in plan), narrowing in two steps.
    for (const [half, y0, y1] of [[16, 200, 222], [12.5, 222, 236]] as const) {
      L.box(cx - half, y0, cz - half, cx + half, y1, cz + half, 'paint', { paint: 'granite' });
      L.box(cx - half, y0, cz - half, cx + half, y1, cz + half, 'paint', { paint: 'granite', yaw: Math.PI / 4, solid: false });
      L.box(cx - half - 0.1, y0 + 4, cz - 3, cx + half + 0.1, y1 - 3, cz + 3, 'paint', { paint: 'windowDark', solid: false });
      L.box(cx - 3, y0 + 4, cz - half - 0.1, cx + 3, y1 - 3, cz + half + 0.1, 'paint', { paint: 'windowDark', solid: false });
    }
    L.box(cx - 8, 236, cz - 8, cx + 8, TOP - 3, cz + 8, 'paint', { paint: 'gray' });
    for (const [ax, az] of [[-5, -5], [5, 5], [-5, 5]] as const) L.box(cx + ax - 0.3, TOP - 3, cz + az - 0.3, cx + ax + 0.3, TOP, cz + az + 0.3, 'steel', { solid: false });
  }

  // 90 days on: the plaza's tents and crates (the city's emergency headquarters), a burnt car, sandbags.
  L.tent(20, 53, 'x', 8);
  L.tent(92, 53, 'x', 8);
  L.crates(34, 54, 5);
  L.sandbags(46, Z1 + 5, 66, Z1 + 5);
  L.car(76, 56, 'x', { burnt: true });
  L.scorch(8, 9, Z1 + 0.05, 16, 22, Z1 + 0.15);
}
