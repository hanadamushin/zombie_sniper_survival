// L3b: 富岡製糸場 (Tomioka Silk Mill, 1872), Tomioka. The 繰糸所 (silk-reeling mill): one long hall,
// 140.4 m × 12.3 m and 12.1 m high, of timber frame filled with red brick (木骨煉瓦造), rows of tall
// glass windows in white frames down both long walls (the reeling wanted daylight), a tiled gable
// roof with the raised ventilating ridge (越屋根) along its top. Across its end, facing the gate, the
// 東置繭所 (east cocoon warehouse, 104 m, two storeys, 14.8 m) with the arched passage under the
// keystone dated 明治五年.
//
// Both kept to their real width and height, shortened in length (the mill 86 m, the warehouse 60 m)
// for the shrunk town. The front (local z = d, the warehouse with its arch) faces the gate (east).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 70;
const D = 112;
const WOOD: PaintName = 'brown';

export const LANDMARK_TOMIOKA_SILK_MILL = landmarkDef({
  variant: 'tomioka_silk_mill',
  size: { w: [W, W], d: [D, D] },
  eaves: 10.6,
  top: 14.8,
  kind: 'warehouse',
  build,
});

/** The timber frame on a brick face: posts every `bay` m and a beam at each height, a little proud. */
function frameX(L: Lm, x0: number, x1: number, z: number, out: 1 | -1, ys: readonly number[], bay: number): void {
  const t = 0.12;
  const [za, zb] = out > 0 ? [z, z + t] : [z - t, z];
  for (let x = x0; x <= x1 + 0.01; x += bay) L.box(x - 0.15, 0.6, za, x + 0.15, ys[ys.length - 1]!, zb, 'paint', { paint: WOOD, solid: false });
  for (const y of ys) L.box(x0, y - 0.15, za, x1, y + 0.15, zb, 'paint', { paint: WOOD, solid: false });
}
function frameZ(L: Lm, z0: number, z1: number, x: number, out: 1 | -1, ys: readonly number[], bay: number): void {
  const t = 0.12;
  const [xa, xb] = out > 0 ? [x, x + t] : [x - t, x];
  for (let z = z0; z <= z1 + 0.01; z += bay) L.box(xa, 0.6, z - 0.15, xb, ys[ys.length - 1]!, z + 0.15, 'paint', { paint: WOOD, solid: false });
  for (const y of ys) L.box(xa, y - 0.15, z0, xb, y + 0.15, z1, 'paint', { paint: WOOD, solid: false });
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);

  // 繰糸所: the long hall along z, its windows, the gable roof and the raised ridge.
  const [mx0, mx1, mz0, mz1] = [3, 15.3, 6, 92];
  L.box(mx0, 0, mz0, mx1, 0.6, mz1, 'paint', { paint: 'stone' });
  L.box(mx0 + 0.1, 0.6, mz0 + 0.1, mx1 - 0.1, 7.2, mz1 - 0.1, 'paint', { paint: 'brickRed' });
  const n = Math.round((mz1 - mz0) / 3.45);
  L.windows('z', mx1 - 0.1, 1, mz0 + 1, mz1 - 1, n, 1.6, 6.2, 1.9, { paint: 'skyBlue', broken: 0.35, frame: 'white' });
  L.windows('z', mx0 + 0.1, -1, mz0 + 1, mz1 - 1, n, 1.6, 6.2, 1.9, { paint: 'skyBlue', broken: 0.35, frame: 'white' });
  frameZ(L, mz0 + 0.1, mz1 - 0.1, mx1 - 0.1, 1, [1.2, 6.8], (mz1 - mz0 - 0.2) / n);
  frameZ(L, mz0 + 0.1, mz1 - 0.1, mx0 + 0.1, -1, [1.2, 6.8], (mz1 - mz0 - 0.2) / n);
  L.shape('gable', mx0 - 0.9, 7.2, mz0 - 0.6, mx1 + 0.9, 10.6, mz1 + 0.6, 'paint', { paint: 'charcoal', axis: 'z' });
  const mx = (mx0 + mx1) / 2;
  L.box(mx - 1.6, 10, mz0 + 1, mx + 1.6, 11, mz1 - 1, 'woodDark');
  L.shape('gable', mx - 2.4, 11, mz0 + 0.6, mx + 2.4, 12.1, mz1 - 0.6, 'paint', { paint: 'charcoal', axis: 'z' });
  // The gable end towards the yard (brick with a round window).
  L.box(mx - 1, 8, mz1 - 0.15, mx + 1, 9.6, mz1 + 0.02, 'paint', { paint: 'white', solid: false });

  // 東置繭所: two storeys along x across the front, the arched passage in the middle.
  const [wx0, wx1, wz0, wz1] = [5, 65, 97, 109.3];
  const ax = (wx0 + wx1) / 2;
  L.box(wx0, 0, wz0, wx1, 0.6, wz1, 'paint', { paint: 'stone' });
  for (const [a, b] of [[wx0 + 0.1, ax - 2.6], [ax + 2.6, wx1 - 0.1]] as const) L.box(a, 0.6, wz0 + 0.1, b, 10.6, wz1 - 0.1, 'paint', { paint: 'brickRed' });
  L.box(ax - 2.6, 4.6, wz0 + 0.1, ax + 2.6, 10.6, wz1 - 0.1, 'paint', { paint: 'brickRed' });
  // The arch: dark passage, the stone voussoirs as a band, the keystone.
  L.box(ax - 2.5, 0, wz1 - 0.2, ax + 2.5, 4.4, wz1 - 0.05, 'paint', { paint: 'black', solid: false });
  L.box(ax - 3, 4.3, wz1 - 0.1, ax + 3, 4.8, wz1 + 0.06, 'paint', { paint: 'offWhite', solid: false });
  L.box(ax - 0.45, 4.3, wz1 - 0.1, ax + 0.45, 5.4, wz1 + 0.12, 'paint', { paint: 'stone', solid: false });
  const m = 14;
  for (const [y0, y1] of [[1.8, 4.2], [6.6, 9.2]] as const) {
    L.windows('x', wz1 - 0.1, 1, wx0 + 1.5, ax - 4, m / 2, y0, y1, 1.3, { paint: 'skyBlue', broken: 0.3 });
    L.windows('x', wz1 - 0.1, 1, ax + 4, wx1 - 1.5, m / 2, y0, y1, 1.3, { paint: 'skyBlue', broken: 0.3 });
    L.windows('x', wz0 + 0.1, -1, wx0 + 1.5, wx1 - 1.5, m, y0, y1, 1.3, { paint: 'skyBlue', broken: 0.3 });
  }
  frameX(L, wx0 + 0.1, wx1 - 0.1, wz1 - 0.1, 1, [0.9, 5.4, 10.3], (wx1 - wx0 - 0.2) / 16);
  L.shape('gable', wx0 - 0.9, 10.6, wz0 - 0.9, wx1 + 0.9, 14.8, wz1 + 0.9, 'paint', { paint: 'charcoal', axis: 'x' });

  // 90 days on: a relief tent and crates in the yard, a burnt car by the gate, a fallen sign.
  L.tent(40, 60, 'x', 8);
  L.tent(40, 70, 'x', 8);
  L.crates(52, 64, 5);
  L.car(60, 88, 'x', { burnt: true });
  L.fallenSign(28, 90, 'x');
  L.scorch(mx1 - 0.05, 1, 40, mx1 + 0.08, 6, 46);
}
