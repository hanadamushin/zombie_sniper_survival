// L8: 大浦天主堂 (Ōura Church, the Basilica of the Twenty-Six Holy Martyrs of Japan, 1864/1879), Minamiyamate,
// Nagasaki. Japan's oldest standing church and a national treasure: white walls of a Gothic basilica,
// a nave and two lower aisles under grey tiles, pointed windows of stained glass, the bell tower over
// the door with its dark octagonal spire and the cross. It stands on a terrace up the hillside over the
// harbour, reached by a long flight of stone steps from the gate; the white statue of Mary over the door.
//
// Real size: about 30 × 18 m, the spire's cross some 25 m over the terrace. The terrace (4.4 m) and its
// flight of steps are drawn on the levelled lot. The front (local z = d, the door) faces west, to the harbour.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';
import { stepsUp } from '../shikoku/parts.ts';
import { palm } from './parts.ts';

const W = 30;
const D = 50;
const C = 15;
const T = 4.4;
/** The nave's walls (x) and the church's back and front (z). */
const [NX0, NX1, AX0, AX1, Z0, Z1] = [10, 20, 6, 24, 6, 32];

export const LANDMARK_OURA_CATHEDRAL = landmarkDef({
  variant: 'oura_cathedral',
  size: { w: [W, W], d: [D, D] },
  eaves: T + 8,
  top: T + 23,
  roof: 'gable',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The terrace with its stone face, and the flight of steps up from the gate.
  L.box(2, 0, 2, W - 2, T, 36, 'paint', { paint: 'granite' });
  stepsUp(L, C - 3, C + 3, 46, 0, 10, 0.44, 1);
  for (const s of [-1, 1]) L.box(C + s * 3.2 - 0.25, 0, 36, C + s * 3.2 + 0.25, T + 0.9, 46, 'paint', { paint: 'granite', solid: false });
  // The gate at the foot: two stone pillars and the iron gate (open).
  for (const s of [-1, 1]) L.box(C + s * 3.6 - 0.5, 0, 46.4, C + s * 3.6 + 0.5, 3.2, 47.4, 'paint', { paint: 'granite' });
  // The white fence along the terrace's edge, either side of the steps.
  for (const [a, b] of [[2, C - 3], [C + 3, W - 2]] as const) L.box(a, T, 35.6, b, T + 1, 35.9, 'paint', { paint: 'white', solid: false });

  // The aisles (low, shed roofs falling outwards), the nave (tall, gable), the grey tiles.
  L.box(AX0, T, Z0, AX1, T + 5, Z1, 'paint', { paint: 'white' });
  L.box(NX0, T, Z0, NX1, T + 8, Z1, 'paint', { paint: 'white' });
  L.shape('wedge', AX0 - 0.6, T + 5, Z0 - 0.4, NX0, T + 7.4, Z1 + 0.4, 'paint', { paint: 'kawara', slope: 'x+' });
  L.shape('wedge', NX1, T + 5, Z0 - 0.4, AX1 + 0.6, T + 7.4, Z1 + 0.4, 'paint', { paint: 'kawara', slope: 'x-' });
  L.shape('gable', NX0 - 0.5, T + 8, Z0 - 0.5, NX1 + 0.5, T + 11.2, Z1 + 0.3, 'paint', { paint: 'kawara', axis: 'z' });
  // Pointed windows of stained glass along the aisles and the clerestory; buttresses between them.
  for (const [x, out] of [[AX1, 1], [AX0, -1]] as const) {
    L.windows('z', x, out, Z0 + 1.5, Z1 - 1.5, 6, T + 1.2, T + 4.2, 1.2, { paint: 'deckGlass', broken: 0.3 });
    for (let i = 0; i <= 6; i++) {
      const z = Z0 + 0.5 + ((Z1 - Z0 - 1) * i) / 6;
      L.box(x + (out > 0 ? 0 : -0.5), T, z - 0.3, x + (out > 0 ? 0.5 : 0), T + 4.6, z + 0.3, 'paint', { paint: 'white', solid: false });
    }
  }
  for (const [x, out] of [[NX1, 1], [NX0, -1]] as const) L.windows('z', x, out, Z0 + 1.5, Z1 - 1.5, 6, T + 5.6, T + 7.4, 0.9, { paint: 'deckGlass', broken: 0.2 });

  // The front: the aisles' gable ends with their small pinnacles, the bell tower and its spire.
  for (const x of [AX0 + 0.4, AX1 - 0.4, NX0 + 0.3, NX1 - 0.3]) L.column(x, Z1 + 0.2, 0.35, T, T + (x > NX0 && x < NX1 ? 9 : 6.2), 'paint', { paint: 'white', taper: 0.5 });
  L.windows('x', Z1, 1, AX0 + 1, NX0 - 0.5, 1, T + 1.2, T + 4, 1.1, { paint: 'deckGlass', broken: 0 });
  L.windows('x', Z1, 1, NX1 + 0.5, AX1 - 1, 1, T + 1.2, T + 4, 1.1, { paint: 'deckGlass', broken: 0 });
  const [tx0, tx1, tz0, tz1] = [C - 2.8, C + 2.8, Z1 - 1.5, Z1 + 2.6];
  L.box(tx0, T, tz0, tx1, T + 12.6, tz1, 'paint', { paint: 'white' });
  L.box(C - 1.1, T, tz1, C + 1.1, T + 3.4, tz1 + 0.1, 'paint', { paint: 'brown' }); // the door
  L.shape('gable', C - 1.3, T + 3.4, tz1, C + 1.3, T + 4.4, tz1 + 0.12, 'paint', { paint: 'brown', axis: 'z', solid: false });
  // Mary in her niche over the door (a small white figure), the rose window, the belfry's openings.
  L.box(C - 0.7, T + 4.8, tz1, C + 0.7, T + 7.6, tz1 + 0.3, 'paint', { paint: 'charcoal', solid: false });
  L.column(C, tz1 + 0.35, 0.35, T + 5, T + 7, 'paint', { paint: 'white', taper: 0.6, solid: false });
  L.column(C, tz1 + 0.35, 0.18, T + 7, T + 7.4, 'paint', { paint: 'white', solid: false });
  L.windows('x', tz1, 1, C - 1.5, C + 1.5, 2, T + 9, T + 11.6, 0.9, { paint: 'black', broken: 0 });
  for (const [x, out] of [[tx1, 1], [tx0, -1]] as const) L.windows('z', x, out, tz0 + 0.8, tz1 - 0.8, 1, T + 9, T + 11.6, 1.2, { paint: 'black', broken: 0 });
  L.box(tx0 - 0.3, T + 12.6, tz0 - 0.3, tx1 + 0.3, T + 13.2, tz1 + 0.3, 'paint', { paint: 'white' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.column(C + sx * 2.6, (tz0 + tz1) / 2 + sz * 1.85, 0.3, T + 13.2, T + 15.4, 'paint', { paint: 'white', taper: 0.2, solid: false });
  // The octagonal spire (a 12-sided cone reads the same from afar), the gold cross.
  const mz = (tz0 + tz1) / 2;
  L.column(C, mz, 2.4, T + 13.2, T + 21.4, 'paint', { paint: 'charcoal', taper: 0.06 });
  L.box(C - 0.1, T + 21.2, mz - 0.1, C + 0.1, T + 23, mz + 0.1, 'paint', { paint: 'gold', solid: false });
  L.box(C - 0.55, T + 22.1, mz - 0.08, C + 0.55, T + 22.3, mz + 0.08, 'paint', { paint: 'gold', solid: false });

  // A camphor and a palm on the terrace, trees down the hillside.
  broadleaf(L, 4.5, 40, 11, 3.4);
  palm(L, W - 4, 41, 7, 6, 2.6);
  broadleaf(L, 25, 3.5, 12, 3.2);

  // 90 days on: relief crates by the gate, a fallen sign, a car left at the foot of the steps.
  L.crates(3.5, 47, 3);
  L.fallenSign(C + 8, D - 1.5, 'x');
  L.car(24.5, 48, 'x');
}
