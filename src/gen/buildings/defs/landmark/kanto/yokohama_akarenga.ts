// L3b: 横浜赤レンガ倉庫 (Yokohama Red Brick Warehouses, 1911 / 1913), Shinkō. Two long bonded
// warehouses of red brick side by side with a paved square between them: three storeys (17.8 m to
// the ridge), rows of small windows behind iron shutters, white stone sills, the slate-grey roofs, and
// the iron balconies and stairs along the square side. Warehouse No. 2 is 149 m long, No. 1 (half
// lost in the 1923 earthquake) 76 m.
//
// Shortened to 104 m and 58 m (the shrunk harbour has no room for 150 m between its roads); their
// width and height are real. The front (local z = d) is the square's open end.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 112;
const D = 76;
const DEEP = 21.6;

export const LANDMARK_YOKOHAMA_AKARENGA = landmarkDef({
  variant: 'yokohama_akarenga',
  size: { w: [W, W], d: [D, D] },
  eaves: 15,
  top: 17.8,
  kind: 'warehouse',
  build,
});

/** One warehouse along x from x0 to x1, z0..z0 + DEEP; `square` is the side (+1 / -1 in z) with the balconies. */
function warehouse(L: Lm, x0: number, x1: number, z0: number, square: 1 | -1): void {
  const z1 = z0 + DEEP;
  const brick: PaintName = 'brickRed';
  L.box(x0, 0, z0, x1, 15, z1, 'paint', { paint: brick });
  // White stone courses at each floor, the cornice.
  for (const y of [5.2, 10.2]) L.box(x0 - 0.1, y, z0 - 0.1, x1 + 0.1, y + 0.35, z1 + 0.1, 'paint', { paint: 'offWhite', solid: false });
  L.box(x0 - 0.25, 14.4, z0 - 0.25, x1 + 0.25, 15, z1 + 0.25, 'paint', { paint: 'offWhite', solid: false });
  // The slate hip roof.
  L.shape('hip', x0 - 0.6, 15, z0 - 0.6, x1 + 0.6, 17.8, z1 + 0.6, 'paint', { paint: 'slateBlue', axis: 'x' });
  // Windows behind iron shutters (dark), three rows, both long faces; the ends two columns.
  const n = Math.round((x1 - x0) / 6.5);
  for (const [y0, y1] of [[1.4, 3.8], [6.4, 8.9], [11.3, 13.6]] as const) {
    L.windows('x', z1, 1, x0 + 2, x1 - 2, n, y0, y1, 1.5, { paint: 'charcoal', broken: 0.15 });
    L.windows('x', z0, -1, x0 + 2, x1 - 2, n, y0, y1, 1.5, { paint: 'charcoal', broken: 0.15 });
    L.windows('z', x0, -1, z0 + 3, z1 - 3, 3, y0, y1, 1.5, { paint: 'charcoal' });
    L.windows('z', x1, 1, z0 + 3, z1 - 3, 3, y0, y1, 1.5, { paint: 'charcoal' });
  }
  // The iron balconies along the square (2nd and 3rd floors) on thin posts, and a stair at each end.
  const zs = square > 0 ? z1 : z0 - 1.8;
  for (const y of [5.4, 10.4]) {
    L.box(x0 + 3, y, zs, x1 - 3, y + 0.25, zs + 1.8, 'paint', { paint: 'charcoal', solid: false });
    L.box(x0 + 3, y + 0.25, (square > 0 ? zs + 1.7 : zs), x1 - 3, y + 1.3, (square > 0 ? zs + 1.8 : zs + 0.1), 'paint', { paint: 'charcoal', solid: false });
  }
  for (let x = x0 + 3; x <= x1 - 3; x += 12) L.box(x, 0, square > 0 ? zs + 1.6 : zs, x + 0.25, 10.4, square > 0 ? zs + 1.8 : zs + 0.2, 'paint', { paint: 'charcoal' });
  for (const x of [x0 + 4.5, x1 - 8.5]) {
    for (let k = 0; k < 4; k++) L.box(x + k, k * 1.35, square > 0 ? zs : zs, x + k + 1.2, k * 1.35 + 1.35, square > 0 ? zs + 1.6 : zs + 1.8, 'paint', { paint: 'charcoal', solid: false });
  }
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // No. 2 at the back, No. 1 in front, the square between them.
  warehouse(L, 4, W - 4, 4, 1);
  warehouse(L, 40, W - 14, D - 4 - DEEP, -1);

  // 90 days on: the square was a relief point — tents, crates, sandbags; a burnt car at the far end.
  L.tent(16, 42, 'x', 8);
  L.tent(16, 50, 'x', 8);
  L.crates(28, 46, 5);
  L.sandbags(4, 60, 30, 60);
  L.car(104, 44, 'z', { burnt: true });
  L.fallenSign(60, 44, 'x');
  L.scorch(70, 0.4, D - 4 - DEEP - 1.85, 80, 9, D - 4 - DEEP - 1.8);
}
