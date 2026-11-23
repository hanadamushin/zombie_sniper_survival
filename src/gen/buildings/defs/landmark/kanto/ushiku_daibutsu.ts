// L3b: 牛久大仏 (Ushiku Daibutsu, 1993), Ushiku Arcadia. A standing bronze Amida 120 m tall: the figure
// 100 m on a lotus pedestal of 10 m over a base hall of 10 m. The robe falls straight to the feet with
// broad hanging sleeves; the right hand raised before the chest, palm out; the left hand lowered, palm
// out; the head with its rows of curls and the 肉髻, the long ears. Pale grey bronze. Before it the
// long approach through the flower garden.
//
// The figure is a stack of oval prisms (the robe narrowing a little to the chest, the shoulders, the
// head), the sleeves and the arms as boxes and leaning staircases. Its front (local z = d) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { slant } from './parts.ts';

const W = 64;
const D = 96;
const X = 32;
const Z = 26;
const B = 20;
const BR: PaintName = 'ushiku';

export const LANDMARK_USHIKU_DAIBUTSU = landmarkDef({
  variant: 'ushiku_daibutsu',
  size: { w: [W, W], d: [D, D] },
  eaves: 10,
  top: 120,
  kind: 'tower',
  build,
});

function oval(L: Lm, x: number, z: number, w: number, d: number, y0: number, y1: number, taper = 1, solid = true): void {
  const p = L.shape('cyl', x - w / 2, y0, z - d / 2, x + w / 2, y1, z + d / 2, 'paint', { paint: BR, solid });
  if (taper !== 1) p.taper = taper;
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[X - 4, 48], [X + 4, 48], [X + 4, D], [X - 4, D]]);
  // The base hall (10 m), the lotus pedestal (10 m, its petals as a ring of turned slabs).
  L.box(X - 20, 0, Z - 20, X + 20, 9.4, Z + 20, 'paint', { paint: 'granite' });
  L.box(X - 20.4, 9.4, Z - 20.4, X + 20.4, 10, Z + 20.4, 'paint', { paint: 'gray' });
  L.windows('x', Z + 20, 1, X - 16, X + 16, 6, 2, 7, 2.4, { paint: 'windowDark', broken: 0.3 });
  L.box(X - 2.5, 0, Z + 20, X + 2.5, 4, Z + 20.15, 'doorSteel');
  oval(L, X, Z, 26, 22, 10, 14, 1.1);
  oval(L, X, Z, 29, 25, 14, 20, 1.12);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const [px, pz] = [X + Math.cos(a) * 15, Z + Math.sin(a) * 12.8];
    L.box(px - 2.4, 15, pz - 0.6, px + 2.4, 20.6, pz + 0.6, 'paint', { paint: BR, solid: false, yaw: -a + Math.PI / 2 });
  }

  // The robe: the hem, the body narrowing to the chest, the shoulders.
  oval(L, X, Z, 24, 15, B, B + 6, 0.98);
  oval(L, X, Z, 23.5, 14.7, B + 6, B + 50, 0.97);
  oval(L, X, Z - 0.3, 23, 14.3, B + 50, B + 72, 1.02);
  oval(L, X, Z - 0.3, 25, 13.6, B + 72, B + 77, 0.72);
  // The hanging sleeves at the sides (from the arms down to below the knees).
  for (const s of [-1, 1]) {
    L.box(X + s * 11 - 3, B + 22, Z - 5, X + s * 11 + 3, B + 68, Z + 4.5, 'paint', { paint: BR });
    L.box(X + s * 11 - 2.6, B + 18, Z - 4, X + s * 11 + 2.6, B + 22, Z + 3.5, 'paint', { paint: BR, solid: false });
  }
  // The right hand (local x low side of the figure's front is its right) raised before the chest, palm
  // out; the left lowered, palm out.
  slant(L, [X - 11, B + 52, Z + 4], [X - 7.5, B + 58, Z + 10.5], 4, 3.2, BR, true);
  L.box(X - 9.6, B + 57, Z + 9.5, X - 5.4, B + 65.5, Z + 11.2, 'paint', { paint: BR });
  for (let i = 0; i < 4; i++) L.box(X - 9.5 + i * 1.05, B + 65.5, Z + 9.8, X - 8.7 + i * 1.05, B + 68 - Math.abs(i - 1.5) * 0.5, Z + 10.8, 'paint', { paint: BR, solid: false });
  slant(L, [X + 11, B + 42, Z + 4], [X + 8.5, B + 34, Z + 9.5], 4, 3, BR, true);
  L.box(X + 6.6, B + 27, Z + 8.8, X + 10.6, B + 35, Z + 10.4, 'paint', { paint: BR });
  // The robe's folds down the front (darker lines), the chest's opening.
  for (const dx of [-4.5, -1.5, 1.5, 4.5]) L.box(X + dx - 0.25, B + 1, Z + 7.2, X + dx + 0.25, B + 48, Z + 7.45, 'paint', { paint: 'gray', solid: false });
  L.box(X - 3.5, B + 66, Z + 6.9, X + 3.5, B + 70, Z + 7.15, 'paint', { paint: 'gray', solid: false });
  // The observation windows (small slits in the chest).
  for (const dx of [-5, 5]) L.box(X + dx - 0.9, B + 64, Z + 7.0, X + dx + 0.9, B + 65, Z + 7.2, 'paint', { paint: 'windowDark', solid: false });

  // The neck, the head, the curls, the 肉髻, the ears; the face's lowered eyes and the 白毫.
  L.column(X, Z, 4.2, B + 76.5, B + 80, 'paint', { paint: BR });
  oval(L, X, Z + 0.6, 10, 11, B + 79.5, B + 89, 0.94);
  oval(L, X, Z + 0.2, 10.4, 11.2, B + 89, B + 94.5, 0.72);
  oval(L, X, Z, 6, 6.4, B + 94, B + 100, 0.5);
  for (const s of [-1, 1]) L.box(X + s * 5.1 - 0.7, B + 80.5, Z - 1, X + s * 5.1 + 0.7, B + 90.5, Z + 2, 'paint', { paint: BR });
  const fz = Z + 6.1;
  for (const s of [-1, 1]) L.box(X + s * 2.1 - 1.3, B + 86.6, fz - 0.1, X + s * 2.1 + 1.3, B + 87.1, fz + 0.12, 'paint', { paint: 'charcoal', solid: false });
  L.column(X, fz - 0.1, 0.4, B + 88.3, B + 89.1, 'paint', { paint: 'offWhite', solid: false });
  L.box(X - 1.6, B + 82.6, fz - 0.15, X + 1.6, B + 83, fz + 0.1, 'paint', { paint: 'charcoal', solid: false });

  // The approach: flower beds either side, lanterns.
  for (const s of [-1, 1]) {
    for (const z of [54, 68, 82]) L.box(X + s * 12 - 6, 0, z, X + s * 12 + 6, 0.5, z + 10, 'paint', { paint: s < 0 ? 'sakura' : 'yellow', solid: false });
    for (const z of [52, 66, 80, 94]) L.box(X + s * 5.5 - 0.4, 0, z - 0.4, X + s * 5.5 + 0.4, 2.4, z + 0.4, 'paint', { paint: 'stone' });
  }

  // 90 days on: a relief tent and crates by the hall's door, burnt cars on the approach, a fallen sign.
  L.tent(X + 14, 50, 'x', 7);
  L.crates(X - 16, 50, 4);
  L.car(X - 1.5, 76, 'z', { burnt: true });
  L.car(X + 22, 92, 'x');
  L.fallenSign(X - 6.5, 88, 'z');
}
