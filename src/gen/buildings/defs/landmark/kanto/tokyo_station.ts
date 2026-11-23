// L3a: 東京駅丸の内駅舎 (Tokyo Station, Marunouchi building, 1914, Tatsuno Kingo; restored to its
// three storeys and domes in 2012). Red brick banded with white stone (辰野式), slate roofs, a long
// symmetric front facing west towards the Imperial Palace: an octagonal pavilion at each end crowned
// by a dark dome (the south and north domes, about 35 m), a central pavilion (the imperial entrance)
// with a steep roof, and smaller bays along the wings.
//
// The real front is 335 m long: in an area that is the city shrunk ten times it would wall off the
// whole Marunouchi. The wings are drawn shorter (the front is 184 m; the domes, the central pavilion
// and the height are real) — the shape that tells the building is its two domes and the central
// roof between long brick wings. The tracks are behind it (local z = 0); the front (local z = d)
// faces the station square (west).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { round } from './parts.ts';

const W = 184;
const D = 40;
/** The wings' back and front, their eaves. */
const BACK = 4;
const FRONT = 24;
const EAVES = 17;
const DOMES = [18, W - 18];
const MID = W / 2;
const BRICK: PaintName = 'brickRed';
const ROOF: PaintName = 'slateBlue';

export const LANDMARK_TOKYO_STATION = landmarkDef({
  variant: 'tokyo_station',
  size: { w: [W, W], d: [D, D] },
  eaves: EAVES,
  top: 38.5,
  kind: 'office',
  build,
});

/** White stone bands round a block (the base course, the string courses, the cornice). */
function bands(L: Lm, x0: number, z0: number, x1: number, z1: number, ys: readonly number[]): void {
  for (const y of ys) L.box(x0 - 0.15, y, z0 - 0.15, x1 + 0.15, y + 0.6, z1 + 0.15, 'paint', { paint: 'white', solid: false });
}

function build(L: Lm): void {
  L.ground('paved', [[0, FRONT], [W, FRONT], [W, D], [0, D]]);

  // The wings: three storeys of brick, the white bands, a slate hipped roof, three rows of windows.
  for (const [x0, x1] of [[33, MID - 15], [MID + 15, W - 33]] as const) {
    L.box(x0, 0, BACK, x1, EAVES, FRONT, 'paint', { paint: BRICK });
    L.box(x0 - 0.1, 0, BACK - 0.1, x1 + 0.1, 1.4, FRONT + 0.1, 'paint', { paint: 'granite' });
    bands(L, x0, BACK, x1, FRONT, [5.6, 11.2, EAVES - 0.6]);
    L.shape('hip', x0 - 0.3, EAVES, BACK - 0.6, x1 + 0.3, EAVES + 5.2, FRONT + 0.6, 'paint', { paint: ROOF, axis: 'x' });
    const n = Math.round((x1 - x0) / 4);
    for (const [y0, y1] of [[2.2, 4.8], [7, 10.2], [12.6, 15.6]] as const) L.windows('x', FRONT, 1, x0 + 1, x1 - 1, n, y0, y1, 1.3, { broken: 0.35, frame: 'white' });
    L.windows('x', BACK, -1, x0 + 1, x1 - 1, n, 7, 10.2, 1.3, { broken: 0.4 });
    // A bay in the middle of the wing, a little forward and higher, under its own small roof.
    const bx = (x0 + x1) / 2;
    L.box(bx - 5, 0, FRONT - 1, bx + 5, EAVES + 2, FRONT + 1.6, 'paint', { paint: BRICK });
    bands(L, bx - 5, FRONT - 1, bx + 5, FRONT + 1.6, [5.6, 11.2, EAVES + 1.4]);
    L.shape('hip', bx - 5.5, EAVES + 2, FRONT - 3, bx + 5.5, EAVES + 6.5, FRONT + 2.1, 'paint', { paint: ROOF, axis: 'x' });
    L.windows('x', FRONT + 1.6, 1, bx - 4, bx + 4, 2, 12.6, 15.6, 1.4, { broken: 0.3 });
  }

  // The domed pavilions at the ends: an octagon-ish block of brick, a drum, the dark dome and its lantern.
  for (const cx of DOMES) {
    L.box(cx - 15, 0, BACK - 2, cx + 15, 20, FRONT + 4, 'paint', { paint: BRICK });
    L.box(cx - 15.1, 0, BACK - 2.1, cx + 15.1, 1.4, FRONT + 4.1, 'paint', { paint: 'granite' });
    bands(L, cx - 15, BACK - 2, cx + 15, FRONT + 4, [5.6, 11.2, 19.4]);
    // Small dark turret roofs on the front corners.
    for (const sx of [-1, 1]) {
      L.column(cx + sx * 12.5, FRONT + 1.5, 2.4, 20, 24.5, 'paint', { paint: ROOF, taper: 0.1 });
    }
    for (const [y0, y1] of [[2.2, 4.8], [7, 10.2], [12.6, 15.6]] as const) L.windows('x', FRONT + 4, 1, cx - 13, cx + 13, 5, y0, y1, 1.4, { broken: 0.35 });
    // The drum (brick and white) and the steep dark dome.
    round(L, cx, (BACK + FRONT) / 2 + 1, 11, 20, 25, BRICK);
    L.column(cx, (BACK + FRONT) / 2 + 1, 11.3, 24.4, 25.2, 'paint', { paint: 'white', solid: false });
    const cz = (BACK + FRONT) / 2 + 1;
    round(L, cx, cz, 11.6, 25.2, 29.5, ROOF, { taper: 0.84 });
    round(L, cx, cz, 9.75, 29.5, 33.4, ROOF, { taper: 0.6 });
    L.column(cx, cz, 5.85, 33.4, 35.2, 'paint', { paint: ROOF, taper: 0.45 });
    L.column(cx, cz, 1.6, 35.2, 37.2, 'paint', { paint: 'white' });
    L.column(cx, cz, 0.9, 37.2, 38.5, 'paint', { paint: 'copper', taper: 0.2 });
  }

  // The central pavilion (the imperial entrance): forward of the wings, a steep roof with a gable to the front.
  L.box(MID - 15, 0, BACK - 1, MID + 15, 21, FRONT + 6, 'paint', { paint: BRICK });
  L.box(MID - 15.1, 0, BACK - 1.1, MID + 15.1, 1.4, FRONT + 6.1, 'paint', { paint: 'granite' });
  bands(L, MID - 15, BACK - 1, MID + 15, FRONT + 6, [5.6, 11.2, 20.4]);
  L.shape('hip', MID - 15.5, 21, BACK - 1.5, MID + 15.5, 30, FRONT + 6.5, 'paint', { paint: ROOF, axis: 'x' });
  L.shape('gable', MID - 7, 18, FRONT + 2, MID + 7, 27.5, FRONT + 6.4, 'paint', { paint: BRICK, axis: 'z' });
  L.shape('gable', MID - 7.6, 27.3, FRONT + 1.5, MID + 7.6, 28.6, FRONT + 6.9, 'paint', { paint: 'white', axis: 'z', solid: false });
  L.box(MID - 4.5, 0, FRONT + 6, MID + 4.5, 7.5, FRONT + 6.15, 'paint', { paint: 'windowDark' }); // the shut entrance
  for (const [y0, y1] of [[9, 12], [13, 17]] as const) L.windows('x', FRONT + 6, 1, MID - 13, MID + 13, 6, y0, y1, 1.5, { broken: 0.35 });
  L.column(MID, (BACK + FRONT) / 2, 0.35, 30, 36, 'paint', { paint: 'gray' }); // the flagpole

  // 90 days on: the square was an evacuation point — tents, crates, sandbags; a burnt-out taxi.
  L.tent(56, 33, 'x', 8);
  L.tent(128, 33, 'x', 8);
  L.crates(70, 34, 5);
  L.sandbags(MID - 12, D - 2, MID + 12, D - 2);
  L.car(150, 35, 'x', { paint: 'black', burnt: true });
  L.fallenSign(40, 36, 'x');
  L.scorch(MID + 16, 1.5, FRONT + 0.05, MID + 22, 9, FRONT + 0.15);
}
