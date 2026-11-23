// L3a: 国会議事堂 (the National Diet Building, 1936), Nagatachō. A symmetric granite building facing
// east: the House of Representatives' wing on the left (south), the House of Councillors' on the
// right, each with the raised roof of its chamber, pavilions at the ends, and in the middle the
// central tower (65.45 m): a square body ringed by columns, crowned by a stepped pyramid (after the
// Mausoleum at Halicarnassus). The central entrance has a portico of columns.
//
// The real front is 206 m: the wings are drawn a little shorter (180 m); the tower, the heights and
// the depth of the wings are real. The front (local z = d) faces east, a lawn before it.

import { landmarkDef, type Lm } from '../common.ts';

const W = 180;
const D = 76;
const MID = W / 2;
/** The front of the wings, their eaves. */
const FRONT = 60;
const EAVES = 20;

export const LANDMARK_NATIONAL_DIET = landmarkDef({
  variant: 'national_diet',
  size: { w: [W, W], d: [D, D] },
  eaves: EAVES,
  top: 65.5,
  kind: 'office',
  build,
});

const G = { paint: 'granite' as const };

/** Rows of dark windows on the front and back of a block. */
function rows(L: Lm, x0: number, x1: number, z0: number, z1: number, ys: readonly number[], back = true): void {
  const n = Math.max(2, Math.round((x1 - x0) / 4.2));
  for (const y of ys) {
    L.windows('x', z1, 1, x0 + 1.5, x1 - 1.5, n, y, y + 2.6, 1.5, { broken: 0.3 });
    if (back) L.windows('x', z0, -1, x0 + 1.5, x1 - 1.5, n, y, y + 2.6, 1.5, { broken: 0.3 });
  }
}

function build(L: Lm): void {
  L.ground('grass', [[0, FRONT + 4], [W, FRONT + 4], [W, D], [0, D]]);
  L.ground('paved', [[MID - 10, FRONT + 4], [MID + 10, FRONT + 4], [MID + 10, D], [MID - 10, D]]);

  for (const s of [-1, 1]) {
    // A wing: the long block, its end pavilion (forward and higher), the chamber's raised roof behind.
    const [x0, x1] = s < 0 ? [24, MID - 20] : [MID + 20, W - 24];
    L.box(x0, 0, 12, x1, EAVES, FRONT, 'paint', G);
    L.box(x0 - 0.2, EAVES - 1, 11.8, x1 + 0.2, EAVES, FRONT + 0.2, 'paint', { paint: 'white', solid: false });
    rows(L, x0, x1, 12, FRONT, [3, 8, 13.5]);
    const [e0, e1] = s < 0 ? [4, 24] : [W - 24, W - 4];
    L.box(e0, 0, 6, e1, EAVES + 4, FRONT + 4, 'paint', G);
    L.box(e0 - 0.2, EAVES + 3, 5.8, e1 + 0.2, EAVES + 4, FRONT + 4.2, 'paint', { paint: 'white', solid: false });
    rows(L, e0, e1, 6, FRONT + 4, [3, 8, 13.5, 18.5]);
    L.windows('z', s < 0 ? e0 : e1, s < 0 ? -1 : 1, 9, FRONT + 1, 9, 8, 10.6, 1.5, { broken: 0.3 });
    // The chamber: a higher block in the wing's middle with a low pyramid of glass and copper.
    const cx = (x0 + x1) / 2;
    L.box(cx - 15, EAVES, 20, cx + 15, EAVES + 6, 50, 'paint', G);
    L.shape('hip', cx - 15.5, EAVES + 6, 19.5, cx + 15.5, EAVES + 9, 50.5, 'paint', { paint: 'slateBlue', axis: 'x' });
  }

  // The central block, its portico (eight columns, an attic over them) and the tower.
  L.box(MID - 20, 0, 8, MID + 20, 26, FRONT + 2, 'paint', G);
  rows(L, MID - 20, MID + 20, 8, FRONT + 2, [16, 21]);
  L.box(MID - 14, 0, FRONT + 2, MID + 14, 1, FRONT + 9, 'paint', G); // the steps' platform
  for (let i = 0; i < 8; i++) {
    const x = MID - 12.25 + i * 3.5;
    L.column(x, FRONT + 7.6, 0.7, 1, 14, 'paint', G);
  }
  L.box(MID - 13.5, 14, FRONT + 2, MID + 13.5, 17.5, FRONT + 8.6, 'paint', G);
  L.box(MID - 4, 1, FRONT + 2, MID + 4, 8, FRONT + 2.15, 'paint', { paint: 'bronze' }); // the bronze doors, shut

  // The tower: the body (to 44 m), a column on each face's middle and at the corners, the stepped pyramid.
  const TX = MID;
  const TZ = 34;
  L.box(TX - 14, 26, TZ - 14, TX + 14, 44, TZ + 14, 'paint', G);
  L.box(TX - 11.5, 28, TZ - 14.1, TX + 11.5, 41, TZ + 14.1, 'paint', { paint: 'windowDark', solid: false });
  L.box(TX - 14.1, 28, TZ - 11.5, TX + 14.1, 41, TZ + 11.5, 'paint', { paint: 'windowDark', solid: false });
  for (const k of [-10.5, -3.5, 3.5, 10.5]) {
    for (const s of [-1, 1]) {
      L.box(TX + k - 0.9, 27, TZ + s * 14.6 - 0.9, TX + k + 0.9, 42, TZ + s * 14.6 + 0.9, 'paint', G);
      L.box(TX + s * 14.6 - 0.9, 27, TZ + k - 0.9, TX + s * 14.6 + 0.9, 42, TZ + k + 0.9, 'paint', G);
    }
  }
  L.box(TX - 15.6, 42, TZ - 15.6, TX + 15.6, 44.5, TZ + 15.6, 'paint', G);
  let y = 44.5;
  for (const [half, h] of [[13.4, 3.6], [11.4, 3.6], [9.4, 3.6], [7.4, 3.6], [5.4, 3.4]] as const) {
    L.box(TX - half, y, TZ - half, TX + half, y + h, TZ + half, 'paint', G);
    y += h;
  }
  L.box(TX - 3.4, y, TZ - 3.4, TX + 3.4, y + 2, TZ + 3.4, 'paint', G);
  L.shape('hip', TX - 3.4, y + 2, TZ - 3.4, TX + 3.4, 65.5, TZ + 3.4, 'paint', { paint: 'granite', axis: 'x' });

  // 90 days on: barricades of sandbags at the gate, a burnt-out van, a fallen board.
  L.sandbags(MID - 26, D - 3, MID - 11, D - 3);
  L.sandbags(MID + 11, D - 3, MID + 26, D - 3);
  L.car(40, D - 5, 'x', { burnt: true });
  L.fallenSign(MID + 30, FRONT + 9, 'x');
  L.scorch(MID - 34, 2, FRONT + 0.05, MID - 26, 11, FRONT + 0.15);
}
