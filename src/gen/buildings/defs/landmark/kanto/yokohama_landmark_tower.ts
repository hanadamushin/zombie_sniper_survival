// L3b: 横浜ランドマークタワー (Yokohama Landmark Tower, 1993), Minato Mirai 21. 296.3 m, 70 floors: a
// square tower that narrows as it rises (its faces bow in a little), clad in a warm grey granite, the
// four corners as piers with a slot of dark glass down the middle of each face, the Sky Garden's glass
// on the 69th floor and the crown where the corner piers rise past the roof (the heliport between
// them). At its foot the low glass of Landmark Plaza.
//
// Real size: about 62 m square at the foot, 40 m at the top. The plaza is kept to a strip on the
// front (the real one, and the Dockyard Garden, run 200 m along the harbour). The front (local z = d)
// faces south-east in reality (rot 0: south).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 70;
const D = 84;
const CX = W / 2;
const CZ = 34;
const TOP = 296.3;
const ROOF = 282;
/** Half the side of the tower at height y: 31 m at the foot, 20 m at the roof, the faces bowing in. */
const half = (y: number): number => 31 - 11 * Math.pow(Math.min(1, y / ROOF), 1.35);

export const LANDMARK_YOKOHAMA_LANDMARK_TOWER = landmarkDef({
  variant: 'yokohama_landmark_tower',
  size: { w: [W, W], d: [D, D] },
  eaves: ROOF,
  top: TOP,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  const stone: PaintName = 'granite';
  const glass: PaintName = 'deckGlass';
  // The shaft in steps (each a granite block; a pier on each corner a little proud; a slot of dark
  // glass down each face; two dark window bands per step).
  const ys = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 262, ROOF];
  for (let i = 0; i < ys.length - 1; i++) {
    const [y0, y1] = [ys[i]!, ys[i + 1]!];
    const h = half((y0 + y1) / 2);
    const pier = h * 0.3;
    L.box(CX - h + 0.6, y0, CZ - h + 0.6, CX + h - 0.6, y1, CZ + h - 0.6, 'paint', { paint: stone });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const [x0, x1] = sx < 0 ? [CX - h, CX - h + pier] : [CX + h - pier, CX + h];
      const [z0, z1] = sz < 0 ? [CZ - h, CZ - h + pier] : [CZ + h - pier, CZ + h];
      L.box(x0, y0, z0, x1, y1 + 0.05, z1, 'paint', { paint: stone, solid: false });
    }
    const slot = h * 0.16;
    const f = h - 0.55;
    for (const s of [-1, 1]) {
      L.box(CX - slot, y0, CZ + s * f - 0.06, CX + slot, y1, CZ + s * f + 0.06, 'paint', { paint: glass, solid: false });
      L.box(CX + s * f - 0.06, y0, CZ - slot, CX + s * f + 0.06, y1, CZ + slot, 'paint', { paint: glass, solid: false });
    }
    for (const t of [0.3, 0.75]) {
      const yb = y0 + (y1 - y0) * t;
      const e = h - pier;
      for (const s of [-1, 1]) {
        L.box(CX - e, yb, CZ + s * (f + 0.03) - 0.05, CX + e, yb + 1.6, CZ + s * (f + 0.03) + 0.05, 'paint', { paint: 'windowDark', solid: false });
        L.box(CX + s * (f + 0.03) - 0.05, yb, CZ - e, CX + s * (f + 0.03) + 0.05, yb + 1.6, CZ + e, 'paint', { paint: 'windowDark', solid: false });
      }
    }
  }
  // The Sky Garden (69th floor): a band of glass under the crown.
  const hg = half(ROOF);
  L.box(CX - hg - 0.15, 268, CZ - hg - 0.15, CX + hg + 0.15, 275, CZ + hg + 0.15, 'paint', { paint: glass, solid: false });
  // The crown: the corner piers rise past the roof, the heliport's deck between them.
  const pier = hg * 0.42;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x0, x1] = sx < 0 ? [CX - hg, CX - hg + pier] : [CX + hg - pier, CX + hg];
    const [z0, z1] = sz < 0 ? [CZ - hg, CZ - hg + pier] : [CZ + hg - pier, CZ + hg];
    L.box(x0, ROOF, z0, x1, TOP - 1.2, z1, 'paint', { paint: stone });
    L.box(x0 + 0.3, TOP - 1.2, z0 + 0.3, x1 - 0.3, TOP, z1 - 0.3, 'paint', { paint: 'offWhite' });
  }
  L.box(CX - hg + 1, ROOF, CZ - hg + 1, CX + hg - 1, ROOF + 2.5, CZ + hg - 1, 'paint', { paint: 'gray' });
  L.box(CX - 9, ROOF + 2.5, CZ - 9, CX + 9, ROOF + 2.9, CZ + 9, 'paint', { paint: 'charcoal', solid: false });
  // Landmark Plaza: the low glass block at the foot, its roof, the entrance.
  L.box(3, 0, 66, W - 3, 16, 76, 'paint', { paint: 'offWhite' });
  L.box(2.6, 16, 65.6, W - 2.6, 17, 76.4, 'paint', { paint: 'silver' });
  L.windows('x', 76, 1, 4, W - 4, 8, 2, 14, 6.4, { paint: 'skyBlue', broken: 0.35 });
  L.box(CX - 5, 0, 76, CX + 5, 4.5, 76.15, 'doorSteel');

  // 90 days on: relief tents on the forecourt, crates, a burnt car, a fallen sign.
  L.tent(8, 80, 'x', 7);
  L.tent(18, 80, 'x', 7);
  L.crates(27, 79, 4);
  L.car(58, 80.5, 'x', { burnt: true });
  L.fallenSign(CX + 4, 79.5, 'x');
  L.scorch(CX + 8, 0.3, 76.05, CX + 16, 11, 76.2);
}
