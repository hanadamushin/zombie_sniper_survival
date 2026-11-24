// L5: あべのハルカス (Abeno Harukas, 2014, Cesar Pelli), Abeno, over Ōsaka-Abenobashi station. 300 m,
// the tallest building in Japan until 2023: three glass blocks stacked and stepping back on the west
// side (the department store, the offices, the hotel with the observatory on top), each set back
// over a dark atrium (the voids between the blocks), the east face rising sheer. Fine white mullions
// run up the glass; the top is the open frame round the roof court of the observatory (Harukas 300).
//
// Real size: 300 m; the plan is drawn 84 × 60 m on a 96 × 72 m lot. Local x runs east (the sheer face at x = W), the
// steps on the west (x = 0); the front (local z = d) faces south (Abeno's main road).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 96;
const D = 72;
const TOP = 300;
/** The sheer east face, the south face (the street side). */
const E = 90;
const S = 66;
/** The blocks: west edge, north and south edges, foot, roof. */
const BLOCKS: readonly [number, number, number, number, number][] = [
  [6, 6, S, 0, 68],
  [30, 9, S - 3, 72, 172],
  [50, 12, S - 6, 176, 288],
];
const GLASS: PaintName = 'mirror';

export const LANDMARK_ABENO_HARUKAS = landmarkDef({
  variant: 'abeno_harukas',
  size: { w: [W, W], d: [D, D] },
  eaves: 288,
  top: TOP,
  kind: 'office',
  build,
});

/** White mullions up a face of a block: `n` thin fins from y0 to y1. */
function fins(L: Lm, face: 'x' | 'z', at: number, out: 1 | -1, u0: number, u1: number, n: number, y0: number, y1: number): void {
  const t = 0.35;
  const c0 = out > 0 ? at : at - t;
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    if (face === 'x') L.box(u - 0.25, y0, c0, u + 0.25, y1, c0 + t, 'paint', { paint: 'white', solid: false });
    else L.box(c0, y0, u - 0.25, c0 + t, y1, u + 0.25, 'paint', { paint: 'white', solid: false });
  }
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  BLOCKS.forEach(([x0, z0, z1, y0, y1], i) => {
    L.box(x0, y0, z0, E, y1, z1, 'paint', { paint: GLASS });
    // The dark atrium under the next block (the void where the steps meet).
    if (i < BLOCKS.length - 1) {
      const nx = BLOCKS[i + 1]![0];
      L.box(nx - 0.5, y1, z0 + 1, E - 0.5, BLOCKS[i + 1]![3], z1 - 1, 'paint', { paint: 'deckGlass' });
      // The roof of the step: a white edge.
      L.box(x0 - 0.2, y1 - 1.2, z0 - 0.2, nx, y1, z1 + 0.2, 'paint', { paint: 'white', solid: false });
    }
    const span = E - x0;
    // Mullions: on the south and north faces every 6 m, on the east and west faces every 6 m.
    fins(L, 'x', z1, 1, x0 + 1, E - 1, Math.round(span / 6), y0, y1);
    fins(L, 'x', z0, -1, x0 + 1, E - 1, Math.round(span / 6), y0, y1);
    fins(L, 'z', x0, -1, z0 + 1, z1 - 1, Math.round((z1 - z0) / 6), y0, y1);
    fins(L, 'z', E, 1, z0 + 1, z1 - 1, Math.round((z1 - z0) / 6), y0, y1);
    // A few dark plant floors across the faces (the bands that mark the blocks' uses).
    for (const y of i === 0 ? [30] : i === 1 ? [120] : [232]) {
      L.box(x0 - 0.15, y, z0 - 0.15, E + 0.15, y + 3, z1 + 0.15, 'paint', { paint: 'deckGlass', solid: false });
    }
  });
  // The crown: the open frame of the observatory's roof court (Harukas 300), the heliport's edge.
  const [x0, z0, z1] = [BLOCKS[2]![0], BLOCKS[2]![1], BLOCKS[2]![2]];
  const y = 288;
  for (const [a, b] of [[x0, x0 + 1.2], [E - 1.2, E]] as const) {
    for (const [c, e] of [[z0, z0 + 1.2], [z1 - 1.2, z1]] as const) L.box(a, y, c, b, TOP, e, 'paint', { paint: 'white' });
  }
  L.box(x0, TOP - 1.5, z0, E, TOP, z0 + 1.2, 'paint', { paint: 'white' });
  L.box(x0, TOP - 1.5, z1 - 1.2, E, TOP, z1, 'paint', { paint: 'white' });
  L.box(x0, TOP - 1.5, z0, x0 + 1.2, TOP, z1, 'paint', { paint: 'white' });
  L.box(E - 1.2, TOP - 1.5, z0, E, TOP, z1, 'paint', { paint: 'white' });
  for (let i = 1; i < 7; i++) {
    const x = x0 + ((E - x0) * i) / 7;
    L.box(x - 0.2, y, z0 - 0.1, x + 0.2, TOP - 1.5, z0 + 0.3, 'paint', { paint: 'white', solid: false });
    L.box(x - 0.2, y, z1 - 0.3, x + 0.2, TOP - 1.5, z1 + 0.1, 'paint', { paint: 'white', solid: false });
  }
  L.box(x0 + 8, y, z0 + 8, E - 8, y + 2.5, z1 - 8, 'paint', { paint: 'gray', solid: false });
  L.box(x0 + 10, y + 2.5, z0 + 10, E - 10, y + 2.8, z1 - 10, 'paint', { paint: 'red', solid: false });

  // The street: the station's entrance canopy along the south face, the department store's doors (shut).
  L.box(12, 6, S, 84, 6.6, S + 3.5, 'paint', { paint: 'white', solid: false });
  L.box(36, 0, S - 0.1, 52, 4.5, S + 0.05, 'doorSteel');
  L.windows('x', S, 1, 8, 34, 4, 1, 5, 4.6, { paint: 'skyBlue', broken: 0.6 });
  L.windows('x', S, 1, 54, 88, 5, 1, 5, 4.6, { paint: 'skyBlue', broken: 0.6 });

  // 90 days on: burnt cars and a bus at the kerb, crates and sandbags at the station's doors, scorch.
  L.car(14, 69.5, 'x', { burnt: true });
  L.car(93, 30, 'z');
  L.sandbags(34, S + 1.2, 54, S + 1.2);
  L.crates(58, S + 1.8, 4);
  L.scorch(12, 0.4, S + 0.02, 24, 9, S + 0.1);
}
