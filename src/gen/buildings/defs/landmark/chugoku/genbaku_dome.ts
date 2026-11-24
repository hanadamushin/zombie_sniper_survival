// L6: 原爆ドーム (the Atomic Bomb Dome), Hiroshima, a World Heritage site. The ruin of the Hiroshima
// Prefectural Industrial Promotion Hall (Jan Letzel, 1915) as it has been kept since 1945: the brick
// and plaster walls of the three-storey wings standing in jagged pieces, their arched window openings
// empty; the five-storey stair tower in the middle, and on it the bare steel frame of the oval dome
// (the copper sheets burnt away), 25 m at its top. Rubble lies inside; a low fence keeps people out;
// lawn round it on the bank of the Motoyasu River.
//
// A place of remembrance (the landmark table's `memorial`): drawn as it stands today, nothing of the
// game's fall added — no wrecked cars, tents, sandbags, scorch or broken panes; no ladder, no firing
// position; no zombie is placed within 60 m of it and nothing there is searched (common.ts, zombies.ts,
// gen/index.ts). Real size. The front (local z = d) is the side of the dome; the table turns it to the
// river (west).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { polyRing, slant } from '../kanto/parts.ts';

const W = 56;
const D = 46;
/** The front wall's outer face, the back wall's, the wings' ends. */
const FZ = 34;
const BZ = 13;
const X0 = 8;
const X1 = 48;
/** The stair tower's middle and the radius to its walls' middle; the drum's top. */
const CX = 28;
const CZ = 31;
const TR = 5.6;
const TOP = 17.2;
const WALL: PaintName = 'ruinBrick';
const T = 0.8;

export const LANDMARK_GENBAKU_DOME = landmarkDef({
  variant: 'genbaku_dome',
  size: { w: [W, W], d: [D, D] },
  eaves: 13.5,
  top: 25,
  kind: 'office',
  memorial: true,
  build,
});

/**
 * A piece of the front or back wall from x0 to x1 at z (the outer face; the wall goes in towards
 * the middle), `h` high: the arched openings of each storey it still reaches, the stone bands.
 */
function frontPiece(L: Lm, x0: number, x1: number, z: number, out: 1 | -1, h: number): void {
  const zi = out > 0 ? z - T : z;
  L.box(x0, 0, zi, x1, h, zi + T, 'paint', { paint: WALL });
  const n = Math.max(1, Math.round((x1 - x0) / 3.2));
  for (const [y0, y1] of [[1.2, 3.6], [5.6, 8.1], [9.8, 12.1]] as const) {
    if (h < y1 + 0.6) break;
    L.windows('x', z, out, x0 + 0.4, x1 - 0.4, n, y0, y1, 1.3, { paint: 'black' });
  }
  for (const y of [4.6, 9.1]) if (h > y + 0.5) L.box(x0, y, zi - (out > 0 ? 0 : 0.18), x1, y + 0.35, zi + T + (out > 0 ? 0.18 : 0), 'paint', { paint: 'offWhite', solid: false });
}

/** A piece of a side wall (along z) at x, from z0 to z1, `h` high, its openings facing `out`. */
function sidePiece(L: Lm, z0: number, z1: number, x: number, out: 1 | -1, h: number): void {
  const xi = out > 0 ? x - T : x;
  L.box(xi, 0, z0, xi + T, h, z1, 'paint', { paint: WALL });
  const n = Math.max(1, Math.round((z1 - z0) / 3.2));
  for (const [y0, y1] of [[1.2, 3.6], [5.6, 8.1], [9.8, 12.1]] as const) {
    if (h < y1 + 0.6) break;
    L.windows('z', x, out, z0 + 0.4, z1 - 0.4, n, y0, y1, 1.3, { paint: 'black' });
  }
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[X0 - 2, BZ - 2], [X1 + 2, BZ - 2], [X1 + 2, FZ + 4], [X0 - 2, FZ + 4]]);

  // The wings' front wall: highest beside the tower (three storeys and the parapet), broken lower
  // in places towards the ends (a gap through the east wing).
  const front: [number, number, number][] = [
    [X0, 11, 7.6], [11, 14.5, 12.4], [14.5, 18.5, 13.4], [18.5, CX - TR, 12.8],
    [CX + TR, 37, 13.6], [37, 40.5, 12.2], [40.5, 44, 5.6], [44, X1, 8.2],
  ];
  for (const [a, b, h] of front) frontPiece(L, a, b, FZ, 1, h);
  // The side walls back from the front, the back wall in a few low pieces with gaps.
  const west: [number, number, number][] = [[FZ - 6, FZ, 4.6], [FZ - 12, FZ - 6, 8.4], [FZ - 16, FZ - 12, 5.4], [BZ, BZ + 3, 2.2]];
  for (const [a, b, h] of west) sidePiece(L, a, b, X0, -1, h);
  const east: [number, number, number][] = [[FZ - 5, FZ, 3.4], [FZ - 13, FZ - 9, 6.8], [BZ, BZ + 5, 3]];
  for (const [a, b, h] of east) sidePiece(L, a, b, X1, 1, h);
  for (const [a, b, h] of [[X0, 15, 2.8], [19, 25, 5.6], [31, 36, 4.2], [41, X1, 1.8]] as const) frontPiece(L, a, b, BZ, -1, h);
  // The walls inside that still stand: the tower's sides going back, a cross wall.
  for (const [a, b, h] of [[CX - TR - 0.4, CX - TR + 0.4, 12.6], [CX + TR - 0.4, CX + TR + 0.4, 13.2]] as const) L.box(a, 0, BZ + 6, b, h, CZ - 3, 'paint', { paint: WALL });
  L.box(14.5, 0, 22, 18.5, 7.8, 22.8, 'paint', { paint: WALL });
  for (const [x, z, h] of [[12, 27, 5.5], [41, 26, 4]] as const) L.box(x - 0.45, 0, z - 0.45, x + 0.45, h, z + 0.45, 'paint', { paint: WALL });

  // The stair tower: an octagon of brick walls, five storeys with their openings, the drum's band.
  polyRing(L, CX, CZ, TR, 0, TOP, T, 8, WALL);
  const face = TR * Math.tan(Math.PI / 8) - 0.3;
  for (let k = 0; k < 5; k++) {
    const y0 = 1.2 + k * 3.25;
    const y1 = y0 + 2.1;
    L.windows('x', CZ + TR + T / 2, 1, CX - face, CX + face, 1, y0, y1, 1.4, { paint: 'black' });
    L.windows('z', CX + TR + T / 2, 1, CZ - face, CZ + face, 1, y0, y1, 1.4, { paint: 'black' });
    L.windows('z', CX - TR - T / 2, -1, CZ - face, CZ + face, 1, y0, y1, 1.4, { paint: 'black' });
  }
  L.column(CX, CZ, TR + 0.75, TOP - 0.6, TOP, 'paint', { paint: 'offWhite', solid: false });

  // The dome's bare steel frame: twelve ribs curving up from the drum to the lantern ring, three rings
  // across them. Thin and rust-dark (the sky shows through); drawn only.
  const ribs = 12;
  const prof: [number, number][] = [[TR + 0.1, TOP], [TR - 0.25, TOP + 2.6], [TR - 1.2, TOP + 4.8], [TR - 2.8, TOP + 6.6], [1.1, TOP + 7.6]];
  for (let i = 0; i < ribs; i++) {
    const a = ((i + 0.5) / ribs) * Math.PI * 2;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    for (let k = 0; k + 1 < prof.length; k++) {
      const [r0, y0] = prof[k]!;
      const [r1, y1] = prof[k + 1]!;
      slant(L, [CX + ca * r0, y0, CZ + sa * r0], [CX + ca * r1, y1, CZ + sa * r1], 2, 0.22, 'rust');
    }
  }
  for (const k of [1, 2, 3]) {
    const [r, y] = prof[k]!;
    polyRing(L, CX, CZ, r, y - 0.12, y + 0.12, 0.18, 12, 'rust', false);
  }
  polyRing(L, CX, CZ, 1.1, TOP + 7.4, TOP + 7.8, 0.2, 8, 'rust', false);

  // Rubble inside the walls (brick and plaster heaped where the floors fell).
  for (const [x0, z0, x1, z1, h] of [[10, 15, 17, 21, 1.6], [19, 16, 22, 24, 2.2], [34, 15, 40, 22, 1.4], [41, 24, 47, 31, 1.1], [10, 24, 15, 31, 1.2], [CX - 3, CZ - 2, CX + 3, CZ + 2, 2.6]] as const) {
    L.box(x0, 0, z0, x1, h, z1, 'paint', { paint: 'gray' });
    L.box(x0 + 1, h, z0 + 1, x1 - 1, h + 0.7, z1 - 1, 'paint', { paint: WALL, solid: false });
  }

  // The low iron fence round the ruin (it keeps people out), the paths of the lawn.
  const [f0, f1, g0, g1] = [X0 - 3, X1 + 3, BZ - 3, FZ + 5];
  for (const z of [g0, g1]) L.box(f0, 0, z - 0.06, f1, 1.1, z + 0.06, 'paint', { paint: 'charcoal' });
  for (const x of [f0, f1]) L.box(x - 0.06, 0, g0, x + 0.06, 1.1, g1, 'paint', { paint: 'charcoal' });
  L.ground('paved', [[0, D - 4], [W, D - 4], [W, D], [0, D]]);
}
