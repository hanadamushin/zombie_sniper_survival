// L6: 仁風閣 (Jinpū-kaku), Tottori, an Important Cultural Property. The white wooden villa in the French
// Renaissance manner built in 1907 for the Crown Prince's visit, at the foot of Kyūshō-zan below the
// stone walls of Tottori Castle: two storeys of white weatherboard with tall windows, the open
// verandas of both floors along the south front behind slender white posts, grey tiled hipped roofs
// with chimneys, and at the west end a square tower with its tall pointed roof. A lawn and the
// garden's pond (宝隆院庭園) before it.
//
// Real size (about 38 × 17 m, the tower to about 19 m), from photographs as remembered; the castle's
// stone walls behind are a low piece of them. The front (local z = d) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase } from '../tohoku/parts.ts';
import { maple } from '../chubu/parts.ts';

const W = 52;
const D = 48;
const X0 = 8;
const X1 = 46;
const Z0 = 12;
const Z1 = 28;
const F = 4.6;
const ROOF: PaintName = 'kawara';

export const LANDMARK_JINPUKAKU = landmarkDef({
  variant: 'jinpukaku',
  size: { w: [W, W], d: [D, D] },
  eaves: 2 * F + 0.6,
  top: 19.5,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('water', [[30, 38], [44, 36], [50, 40], [48, 46], [34, 46], [28, 43]], 1.2, 0.45);
  L.ground('gravel', [[X0, Z1], [X1, Z1], [X1, Z1 + 6], [X0, Z1 + 6]]);

  // The castle's stone walls on the hill behind.
  stoneBase(L, 2, 0, 50, 6, 0, 4.6, 0.1, 2, 'gray');
  for (const [x, z] of [[4, 8], [48, 8]] as const) pine(L, x, z, 12);

  // The main block: white walls, two rows of tall dark windows with white frames, the hipped roof.
  const top = 2 * F + 0.6;
  L.box(X0 - 0.3, 0, Z0 - 0.3, X1 + 0.3, 0.6, Z1 + 0.3, 'paint', { paint: 'stone' });
  L.box(X0, 0.6, Z0, X1, top, Z1, 'paint', { paint: 'white' });
  for (const [y0, y1] of [[1.6, 4.2], [F + 1.4, F + 3.9]] as const) {
    L.windows('x', Z0, -1, X0 + 1, X1 - 1, 10, y0, y1, 1.2, { broken: 0.3 });
    L.windows('z', X1, 1, Z0 + 1, Z1 - 1, 4, y0, y1, 1.2, { broken: 0.3 });
    L.windows('x', Z1, 1, X0 + 9, X1 - 1, 7, y0, y1, 1.4, { broken: 0.3 });
  }
  L.box(X0 - 0.15, F + 0.4, Z0 - 0.15, X1 + 0.15, F + 0.7, Z1 + 0.15, 'paint', { paint: 'offWhite', solid: false });
  L.box(X0 - 1.4, top - 0.2, Z0 - 1.4, X1 + 1.4, top, Z1 + 1.4, 'paint', { paint: 'white', solid: false });
  L.shape('hip', X0 - 1.4, top, Z0 - 1.4, X1 + 1.4, top + 5.2, Z1 + 1.4, 'paint', { paint: ROOF, axis: 'x' });
  for (const x of [18, 38]) L.box(x - 0.6, top + 2, (Z0 + Z1) / 2 - 0.6, x + 0.6, top + 6.6, (Z0 + Z1) / 2 + 0.6, 'paint', { paint: 'brickRed', solid: false });

  // The verandas along the south front: the upper floor, its railing, the slender white posts, the roof.
  const [vz0, vz1] = [Z1, Z1 + 3.2];
  L.box(X0 + 8, F + 0.4, vz0, X1, F + 0.7, vz1, 'paint', { paint: 'white' });
  L.box(X0 + 8, F + 0.7, vz1 - 0.12, X1, F + 1.7, vz1, 'paint', { paint: 'white', solid: false });
  for (let x = X0 + 8; x <= X1 + 0.01; x += 3) L.box(x - 0.16, 0.6, vz1 - 0.3, x + 0.16, top, vz1, 'paint', { paint: 'white' });
  L.box(X0 + 7.6, top - 0.2, vz0, X1 + 0.4, top, vz1 + 0.6, 'paint', { paint: 'white', solid: false });
  L.shape('wedge', X0 + 7.6, top, vz0, X1 + 0.4, top + 1.2, vz1 + 0.6, 'paint', { paint: ROOF, slope: 'z-', solid: false });
  // The deep shade of the verandas behind the posts.
  L.box(X0 + 8, 0.6, Z1, X1, top, Z1 + 0.06, 'paint', { paint: 'gray', solid: false });

  // The tower at the west end, standing forward: three storeys, tall windows, the pointed hipped roof and its finial.
  const [tx0, tx1, tz0, tz1] = [X0 - 1, X0 + 7, Z1 - 4, Z1 + 4];
  const ty = 3 * F + 0.8;
  L.box(tx0, 0, tz0, tx1, ty, tz1, 'paint', { paint: 'white' });
  for (const [y0, y1] of [[1.6, 4.2], [F + 1.4, F + 3.9], [2 * F + 1.4, 2 * F + 3.6]] as const) {
    L.windows('x', tz1, 1, tx0 + 1, tx1 - 1, 2, y0, y1, 1.2, { broken: 0.3 });
    L.windows('z', tx0, -1, tz0 + 1, tz1 - 1, 2, y0, y1, 1.2, { broken: 0.3 });
  }
  L.box(tx0 - 0.8, ty - 0.2, tz0 - 0.8, tx1 + 0.8, ty, tz1 + 0.8, 'paint', { paint: 'white', solid: false });
  L.shape('hip', tx0 - 0.8, ty, tz0 - 0.8, tx1 + 0.8, 18.6, tz1 + 0.8, 'paint', { paint: ROOF, axis: 'x' });
  L.column((tx0 + tx1) / 2, (tz0 + tz1) / 2, 0.15, 18.4, 19.5, 'paint', { paint: 'charcoal', solid: false });

  // Pines and maples on the lawn.
  for (const [x, z] of [[4, 40], [18, 44], [48, 30]] as const) pine(L, x, z, 9);
  for (const [x, z] of [[26, 40], [4, 26]] as const) maple(L, x, z, 6, 2.6);

  // 90 days on: a burnt car on the drive, relief crates, a fallen sign, scorch by a window.
  L.car(22, 37, 'x', { burnt: true });
  L.crates(40, 34, 3);
  L.fallenSign(14, 38, 'x');
  L.scorch(X1 + 0.02, 1.4, 16, X1 + 0.1, 4.6, 19);
}
