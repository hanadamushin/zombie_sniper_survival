// L5: 京都タワー (Kyōto Tower, 1964, Yamada Mamoru), across the road from Kyōto Station. 131 m: a white
// round shaft of welded steel plate (no lattice: a monocoque) rising from the roof of the nine-storey
// Kyōto Tower Building, narrowing like a candle to the drum of the observation floors (100 m) and
// on into the slim spire with the aviation light. The building below is long and low, its floors in
// horizontal bands.
//
// The shaft and the drum are round prisms of 24 sides (kanto parts.ts round). Firing position: the
// building's roof (31 m), by the maintenance ladder up its back wall. Real size: the building about
// 60 × 36 m here (shorter than the real one), the tower 100 m above its roof. The front (local z = d)
// faces south (the station).

import { landmarkDef, type Lm } from '../common.ts';
import { round } from '../kanto/parts.ts';

const W = 68;
const D = 44;
const CX = 34;
const CZ = 22;
/** The building's roof, the drum's floor and roof, the top. */
const R = 31;
const DRUM0 = 93;
const DRUM1 = 104;
const TOP = 131;

export const LANDMARK_KYOTO_TOWER = landmarkDef({
  variant: 'kyoto_tower',
  size: { w: [W, W], d: [D, D] },
  eaves: R,
  top: TOP,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The building: nine storeys, white, a dark band of windows on every floor, the ground floor's glass.
  const [x0, x1, z0, z1] = [4, W - 4, 4, D - 4];
  L.box(x0, 0, z0, x1, R, z1, 'paint', { paint: 'offWhite' });
  for (let f = 1; f < 9; f++) {
    const y = 3.6 + f * 3.05;
    L.box(x0 - 0.12, y, z0 - 0.12, x1 + 0.12, y + 1.5, z1 + 0.12, 'paint', { paint: 'windowDark', solid: false });
  }
  L.box(x0 - 0.12, 0.3, z0 - 0.12, x1 + 0.12, 4, z1 + 0.12, 'paint', { paint: 'skyBlue', solid: false });
  L.windows('x', z1 + 0.12, 1, x0 + 2, x1 - 2, 8, 0.3, 4, 3.2, { paint: 'black', broken: 0.5 });
  // The parapet round the roof (the ladder's landing at the back).
  for (const [a, b, c, d] of [[x0, z0, CX + 15.2, z0 + 0.3], [CX + 16.8, z0, x1, z0 + 0.3], [x0, z1 - 0.3, x1, z1], [x0, z0, x0 + 0.3, z1], [x1 - 0.3, z0, x1, z1]] as const) L.box(a, R, b, c, R + 1.1, d, 'paint', { paint: 'white' });

  // The tower: a skirt flaring onto the roof, the shaft narrowing up to the drum.
  round(L, CX, CZ, 7.2, R, R + 4, 'white', { taper: 0.75 });
  round(L, CX, CZ, 5.4, R + 4, 62, 'white', { taper: 0.78 });
  round(L, CX, CZ, 4.2, 62, DRUM0 - 4, 'white', { taper: 0.86 });
  // The drum: an underside flaring out, two glazed floors with a white band, the top floor, its roof.
  round(L, CX, CZ, 3.7, DRUM0 - 4, DRUM0, 'white', { taper: 2, solid: false });
  round(L, CX, CZ, 7.4, DRUM0, DRUM0 + 1.2, 'white');
  round(L, CX, CZ, 7.2, DRUM0 + 1.2, DRUM0 + 5.4, 'deckGlass', { solid: false });
  round(L, CX, CZ, 7.4, DRUM0 + 5.4, DRUM0 + 6.6, 'white', { solid: false });
  round(L, CX, CZ, 7, DRUM0 + 6.6, DRUM1 - 1, 'deckGlass', { solid: false });
  round(L, CX, CZ, 7.3, DRUM1 - 1, DRUM1, 'white', { taper: 0.92, solid: false });
  L.column(CX, CZ, 6.4, DRUM0 + 1.2, DRUM1 - 1, 'paint', { paint: 'white', hidden: true });
  // The spire: a short neck, the slim cone, the lamp and the red tip.
  round(L, CX, CZ, 4, DRUM1, DRUM1 + 5, 'white', { taper: 0.7 });
  round(L, CX, CZ, 2.8, DRUM1 + 5, 124, 'white', { taper: 0.25 });
  L.column(CX, CZ, 0.7, 124, 128, 'paint', { paint: 'white', taper: 0.6, solid: false });
  L.column(CX, CZ, 0.45, 128, 129.6, 'paint', { paint: 'red', solid: false });
  L.column(CX, CZ, 0.2, 129.6, TOP, 'steel', { solid: false });

  // The ladder up the back wall to the roof; the roof is the firing position (looking over the station).
  L.ladder(CX + 16, z0 - 0.45, 0, 1, 0, R);
  L.vantage(CX + 16, R, z1 - 1.2);

  // 90 days on: burnt cars and a bus stop's fallen sign on the street, sandbags at the doors, scorch.
  L.car(10, 42, 'x', { burnt: true });
  L.car(56, 1.8, 'x');
  L.sandbags(24, 41.5, 44, 41.5);
  L.fallenSign(50, 42, 'x');
  L.scorch(8, 4, z1 + 0.14, 14, 12, z1 + 0.2);
}
