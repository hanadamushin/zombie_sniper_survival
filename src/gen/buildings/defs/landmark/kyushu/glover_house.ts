// L8: 旧グラバー住宅 (the Former Glover House, 1863), Glover Garden, Minamiyamate, Nagasaki. Japan's oldest
// standing Western-style wooden house: one storey on the hillside over the harbour, its plan of three
// wings round a core like a clover leaf, each wing ringed by a deep veranda — white posts and the white
// diamond lattice under the eaves, stone-paved floors — and all under Japanese grey tiles in hipped
// roofs; green shutters, white chimneys, palms and a pond in the garden before it.
//
// Real size: about 30 × 24 m, the ridges 8 m. The front (local z = d, the verandas) faces west, over
// the harbour.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';
import { palm } from './parts.ts';

const W = 40;
const D = 38;
/** The floor's height (the stone-paved veranda) and the eaves. */
const F = 0.6;
const E = 4.4;

export const LANDMARK_GLOVER_HOUSE = landmarkDef({
  variant: 'glover_house',
  size: { w: [W, W], d: [D, D] },
  eaves: E,
  top: 11,
  roof: 'hip',
  kind: 'house',
  build,
});

/**
 * A wing: its walls (x0, z0)–(x1, z1), the veranda `v` wide round the sides `open` (front, left,
 * right: z+, x-, x+), white posts along its edge, the lattice band under the eaves, the hipped roof over it all.
 */
function wing(L: Lm, x0: number, z0: number, x1: number, z1: number, v: number, open: { zp?: boolean; xm?: boolean; xp?: boolean }): void {
  const [ox0, oz0, ox1, oz1] = [x0 - (open.xm ? v : 0), z0, x1 + (open.xp ? v : 0), z1 + (open.zp ? v : 0)];
  L.box(ox0, 0, oz0, ox1, F, oz1, 'paint', { paint: 'granite' });
  L.box(x0, F, z0, x1, E, z1, 'paint', { paint: 'offWhite' });
  // Tall windows with green shutters on the open faces.
  if (open.zp) L.windows('x', z1, 1, x0 + 1, x1 - 1, Math.max(2, Math.round((x1 - x0) / 2.6)), F + 0.6, E - 0.8, 1.1, { paint: 'copper', broken: 0.3 });
  if (open.xm) L.windows('z', x0, -1, z0 + 1, z1 - 1, Math.max(2, Math.round((z1 - z0) / 2.6)), F + 0.6, E - 0.8, 1.1, { paint: 'copper', broken: 0.3 });
  if (open.xp) L.windows('z', x1, 1, z0 + 1, z1 - 1, Math.max(2, Math.round((z1 - z0) / 2.6)), F + 0.6, E - 0.8, 1.1, { paint: 'copper', broken: 0.3 });
  // The veranda's posts and the lattice band under the eaves (white; the diamonds read as a light band).
  const post = (x: number, z: number): void => {
    L.box(x - 0.14, F, z - 0.14, x + 0.14, E, z + 0.14, 'paint', { paint: 'white' });
  };
  const lattice = (a: number, b: number, c: number, d: number): void => {
    L.box(a, E - 0.75, b, c, E - 0.05, d, 'paint', { paint: 'white', solid: false });
    L.box(a, F + 0.1, b, c, F + 0.9, d, 'paint', { paint: 'white', solid: false }); // the low rail
  };
  if (open.zp) {
    const n = Math.max(2, Math.round((ox1 - ox0) / 2.6));
    for (let i = 0; i <= n; i++) post(ox0 + 0.2 + ((ox1 - ox0 - 0.4) * i) / n, oz1 - 0.2);
    lattice(ox0, oz1 - 0.3, ox1, oz1 - 0.1);
  }
  for (const [on, x] of [[open.xm, ox0 + 0.2], [open.xp, ox1 - 0.2]] as const) {
    if (!on) continue;
    const n = Math.max(2, Math.round((oz1 - oz0) / 2.6));
    for (let i = 1; i <= n; i++) post(x, oz0 + ((oz1 - 0.2 - oz0) * i) / n);
    lattice(x - 0.1, oz0, x + 0.1, oz1);
  }
  // The roof over walls and veranda (a little past the posts), grey tiles.
  L.box(ox0 - 0.6, E - 0.15, oz0 - 0.6, ox1 + 0.6, E + 0.1, oz1 + 0.6, 'paint', { paint: 'white', solid: false });
  L.shape('hip', ox0 - 0.6, E + 0.1, oz0 - 0.6, ox1 + 0.6, E + 0.1 + Math.min(ox1 - ox0, oz1 - oz0) * 0.32, oz1 + 0.6, 'paint', { paint: 'kawara', axis: ox1 - ox0 >= oz1 - oz0 ? 'x' : 'z' });
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[3, 31], [37, 31], [37, 34], [3, 34]]);
  // The garden's pond in front (its fountain a white post), off the lot's middle.
  L.ground('water', [[15, 33.5], [25, 33.5], [26, 37], [14, 37]], 1, 0.4);
  L.column(20, 35.2, 0.3, 0, 1.4, 'paint', { paint: 'white', solid: false });

  // The core (the drawing room, the hall), the two front wings and the south wing, each with its veranda.
  wing(L, 14, 5, 27, 18, 0, {});
  wing(L, 7, 15, 17, 25, 2.6, { zp: true, xm: true });
  wing(L, 23, 15, 33, 25, 2.6, { zp: true, xp: true });
  wing(L, 27, 4, 35, 13, 2.4, { xp: true });
  // The middle veranda between the front wings (the entrance), white chimneys.
  L.box(17, 0, 18, 23, F, 27.6, 'paint', { paint: 'granite' });
  L.box(17, E - 0.75, 27.3, 23, E - 0.05, 27.5, 'paint', { paint: 'white', solid: false });
  L.shape('wedge', 16.6, E - 0.2, 18, 23.4, E + 1.2, 28, 'paint', { paint: 'kawara', slope: 'z-' });
  for (const [x, z, h] of [[18, 9, 10.5], [24.5, 14, 10], [12, 19, 8.4], [30, 7, 8]] as const) L.box(x - 0.5, E, z - 0.5, x + 0.5, h, z + 0.5, 'paint', { paint: 'white' });

  // Palms and a camphor in the garden.
  for (const [x, z, h] of [[3.5, 30, 8], [36.5, 30, 9], [4, 6, 7]] as const) palm(L, x, z, h, 7, 3);
  broadleaf(L, 37, 18, 11, 2.8);

  // 90 days on: relief crates on the veranda, a fallen sign by the pond.
  L.crates(9, 27.4, 3);
  L.fallenSign(30, 35.5, 'x');
}
