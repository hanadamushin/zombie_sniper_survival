// L7: 坂本龍馬像 (the statue of Sakamoto Ryōma), on the cape of Ryūzu above Katsurahama, Kōchi. The bronze
// of 1928 stands on a tall pedestal among the pines and looks out over the Pacific: Ryōma in kimono and
// hakama with boots, his right hand tucked into the front of his kimono (懐手), the left hanging, his
// hair loosely tied.
//
// Real size: the figure 5.3 m on a pedestal of 8.1 m (13.5 m in all). The figure is a stack of oval
// prisms (the hakama widening to its hem, the body, the shoulders, the head and its hair), the sleeves
// as boxes. The front (local z = d, the way he looks) faces south, towards the sea.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine } from '../tohoku/parts.ts';

const W = 36;
const D = 36;
const [X, Z] = [18, 16];
/** The pedestal's top: the figure's feet. */
const B = 8.1;
const BR: PaintName = 'bronze';

export const LANDMARK_RYOMA_STATUE = landmarkDef({
  variant: 'ryoma_statue',
  size: { w: [W, W], d: [D, D] },
  eaves: B,
  top: B + 5.3,
  kind: 'tower',
  build,
});

function oval(L: Lm, x: number, z: number, w: number, d: number, y0: number, y1: number, taper = 1, solid = true): void {
  const p = L.shape('cyl', x - w / 2, y0, z - d / 2, x + w / 2, y1, z + d / 2, 'paint', { paint: BR, solid });
  if (taper !== 1) p.taper = taper;
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[X - 7, Z - 7], [X + 7, Z - 7], [X + 7, Z + 9], [X - 7, Z + 9]]);
  // The pedestal: the stepped base, the tall shaft with its dark name panel, the cap.
  L.box(X - 4.5, 0, Z - 4.5, X + 4.5, 0.7, Z + 4.5, 'paint', { paint: 'granite' });
  L.box(X - 3.4, 0.7, Z - 3.4, X + 3.4, 1.6, Z + 3.4, 'paint', { paint: 'granite' });
  L.box(X - 2.3, 1.6, Z - 2.3, X + 2.3, B - 0.5, Z + 2.3, 'paint', { paint: 'granite' });
  L.box(X - 0.7, 3, Z + 2.3, X + 0.7, 6.4, Z + 2.38, 'paint', { paint: 'charcoal', solid: false });
  L.box(X - 2.7, B - 0.5, Z - 2.7, X + 2.7, B, Z + 2.7, 'paint', { paint: 'gray' });

  // The figure. The hakama: wide at the hem, narrowing to the waist; the boots' toes under it.
  for (const s of [-1, 1]) L.box(X + s * 0.32 - 0.2, B, Z + 0.1, X + s * 0.32 + 0.2, B + 0.25, Z + 0.62, 'paint', { paint: 'black', solid: false });
  oval(L, X, Z, 1.9, 1.15, B + 0.15, B + 2.7, 0.52);
  L.box(X - 0.03, B + 0.2, Z + 0.4, X + 0.03, B + 2.4, Z + 0.47, 'paint', { paint: 'black', solid: false });
  // The body in its kimono, widening to the shoulders; the collar's V; the sash.
  oval(L, X, Z, 1, 0.66, B + 2.7, B + 4.15, 1.18);
  L.box(X - 0.52, B + 2.6, Z - 0.34, X + 0.52, B + 2.82, Z + 0.34, 'paint', { paint: 'charcoal', solid: false });
  oval(L, X, Z, 1.22, 0.7, B + 4.1, B + 4.45, 0.62);
  L.box(X - 0.16, B + 3.7, Z + 0.33, X + 0.16, B + 4.3, Z + 0.39, 'paint', { paint: 'charcoal', solid: false });
  // The sleeves: the right arm (local -x) folded into the kimono, its hand a bulge at the chest; the
  // left hanging at the side, its hand out of the sleeve.
  L.box(X - 0.78, B + 3.2, Z - 0.3, X - 0.46, B + 4.25, Z + 0.32, 'paint', { paint: BR });
  oval(L, X - 0.12, Z + 0.32, 0.46, 0.22, B + 3.35, B + 3.75, 1, false);
  L.box(X + 0.46, B + 2.75, Z - 0.28, X + 0.76, B + 4.25, Z + 0.26, 'paint', { paint: BR });
  L.box(X + 0.5, B + 2.4, Z - 0.1, X + 0.68, B + 2.75, Z + 0.12, 'paint', { paint: BR, solid: false });
  // The neck, the head, the loosely tied hair (a little wider at the back).
  L.column(X, Z, 0.16, B + 4.4, B + 4.6, 'paint', { paint: BR });
  oval(L, X, Z + 0.04, 0.44, 0.52, B + 4.55, B + 5.12, 0.9);
  oval(L, X, Z - 0.06, 0.5, 0.58, B + 4.98, B + 5.3, 0.6, false);
  L.box(X - 0.16, B + 4.6, Z - 0.36, X + 0.16, B + 5.05, Z - 0.2, 'paint', { paint: BR, solid: false });

  // The low stone fence round the paving, the pines of the cape.
  for (const [a, b, c, d] of [[X - 7, Z + 9, X + 7, Z + 9.4], [X - 7, Z - 7, X - 6.6, Z + 9], [X + 6.6, Z - 7, X + 7, Z + 9]] as const) {
    L.box(a, 0, b, c, 0.7, d, 'paint', { paint: 'granite' });
  }
  for (const [x, z, h] of [[4, 4, 12], [32, 4, 13], [3, 20, 11], [33, 22, 12], [6, 32, 9], [30, 33, 9], [14, 4, 11]] as const) pine(L, x, z, h);

  // 90 days on: a fallen information board, relief crates left by the fence.
  L.fallenSign(X + 10, Z + 12, 'x');
  L.crates(X - 11, Z + 11, 3);
}
