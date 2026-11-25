// L8: アミュラン (Amu Run), the big wheel on the roof of the station building at Kagoshima-Chūō, Kagoshima
// (2004). A red wheel 60 m across standing on the six-storey station building, its top 91 m over the
// street — the city's landmark by day and night, with Sakurajima seen from its gondolas.
//
// Real size: the wheel 60 m across on a building of about 27 m. The wheel is drawn (kanto/parts.ts wheel:
// a staircase of boxes in its upright plane) on two A-frames on the roof; only the building, the roof
// station and the legs stop bullets. The front (local z = d) faces east, over the station's east plaza.

import { landmarkDef, type Lm } from '../common.ts';
import { slant, wheel } from '../kanto/parts.ts';

const W = 72;
const D = 44;
const [X0, X1, Z0, Z1] = [4, 68, 4, 36];
/** The roof, the wheel's axle (its centre), the radius. */
const R0 = 27;
const [CX, CY, CZ, RR] = [36, 60.9, 20, 29.4];

export const LANDMARK_KAGOSHIMA_AMU_RUN = landmarkDef({
  variant: 'kagoshima_amu_run',
  size: { w: [W, W], d: [D, D] },
  eaves: R0,
  top: 91,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The station building: pale walls, a band of dark glass on each floor, the glass entrance front.
  L.box(X0, 0, Z0, X1, R0, Z1, 'paint', { paint: 'offWhite' });
  for (let f = 0; f < 6; f++) {
    const y = 1.2 + f * 4.4;
    L.box(X0 + 1, y, Z1, X1 - 1, y + 2.4, Z1 + 0.08, 'paint', { paint: 'deckGlass', solid: false });
    L.box(X0 + 1, y, Z0 - 0.08, X1 - 1, y + 2.4, Z0, 'paint', { paint: 'deckGlass', solid: false });
  }
  L.windows('x', Z1 + 0.08, 1, CX - 12, CX + 12, 4, 0.4, 5, 5.6, { paint: 'skyBlue', broken: 0.6 });
  L.box(X0 - 0.3, R0, Z0 - 0.3, X1 + 0.3, R0 + 1.2, Z1 + 0.3, 'paint', { paint: 'gray' });
  // The canopy over the entrance.
  L.box(CX - 14, 5.6, Z1, CX + 14, 6.2, Z1 + 4, 'paint', { paint: 'white', solid: false });

  // The boarding station on the roof, the two A-frames up to the axle.
  L.box(CX - 9, R0, CZ - 6, CX + 9, R0 + 4, CZ + 6, 'paint', { paint: 'white' });
  L.box(CX - 9.3, R0 + 4, CZ - 6.3, CX + 9.3, R0 + 4.5, CZ + 6.3, 'paint', { paint: 'red' });
  for (const s of [-1, 1]) {
    for (const sx of [-1, 1]) slant(L, [CX + sx * 13, R0, CZ + s * 8], [CX + sx * 1, CY, CZ + s * 2.6], 12, 1.4, 'white', true);
    L.box(CX - 7, R0 + 16, CZ + s * 5.4 - 0.4, CX + 7, R0 + 17, CZ + s * 5.4 + 0.4, 'paint', { paint: 'white', solid: false });
  }
  L.box(CX - 1.2, CY - 1.2, CZ - 3.2, CX + 1.2, CY + 1.2, CZ + 3.2, 'paint', { paint: 'silver' });
  wheel(L, CX, CY, CZ, RR, 2.6, {
    rim: 'red', spoke: 'white', cars: ['red', 'white', 'red', 'skyBlue'], spokes: 16, cars_n: 32, sides: 40, hub: 3.6, hubPaint: 'red',
  });

  // 90 days on: a gondola fallen on the roof, a relief tent and crates on the plaza, a burnt bus, a sign down.
  L.box(CX + 16, R0 + 1.2, CZ + 4, CX + 18.4, R0 + 3.4, CZ + 6.4, 'paint', { paint: 'red', yaw: 0.6, solid: false });
  L.tent(12, D - 4, 'x', 7);
  L.crates(24, D - 3, 4);
  L.box(46, 0.3, D - 5.5, 58, 3.2, D - 2.9, 'paint', { paint: 'charcoal' });
  L.fallenSign(64, D - 2, 'x');
}
