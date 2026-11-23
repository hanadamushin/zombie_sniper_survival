// L3a: 東京ドーム (Tokyo Dome, 1988), Kōrakuen, Bunkyō. Japan's first air-supported dome: a low white
// membrane roof (the "Big Egg") held up by the air inside, about 200 m across and 56 m high at the
// crown, on a ring of light concrete walls with dark glass bands at the concourses.
//
// Its real 200 m do not fit the shrunk Kōrakuen: the area's point lies between the Marunouchi line
// (above ground at Kōrakuen) and the Chūō line, 60 m apart, and the nearest free ground for a 200 m
// lot is 230 m off. The dome is drawn 130 m across (its height real), which stands 136 m north.
//
// The round: two 12-sided prisms turned by 15° (24 sides) for each band; the roof three such bands
// narrowing to the crown. The membrane's cable net as a few dark lines over its top. A 12-sided prism
// stops people only at its inscribed square, so hidden boxes fill the circle (parts.ts roundSolid).
// The front (local z = d) faces south (the gates on Hakusan-dōri side).

import { landmarkDef, type Lm } from '../common.ts';
import { round, roundSolid } from './parts.ts';

const W = 130;
const C = W / 2;
const R = 63;
const WALL = 26;

export const LANDMARK_TOKYO_DOME = landmarkDef({
  variant: 'tokyo_dome',
  size: { w: [W, W], d: [W, W] },
  eaves: WALL,
  top: 56.2,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, W], [0, W]]);

  // The walls: a plinth, the ring, two dark glass bands (the concourses), the cornice.
  round(L, C, C, R + 1, 0, 3, 'gray', { solid: false });
  round(L, C, C, R, 3, WALL, 'offWhite', { solid: false });
  for (const [y0, y1] of [[7, 10], [15, 18]] as const) round(L, C, C, R + 0.3, y0, y1, 'deckGlass', { solid: false });
  round(L, C, C, R + 0.6, WALL - 1.2, WALL, 'silver', { solid: false });
  roundSolid(L, C, C, R + 1, 0, WALL, 5);

  // The roof: a low swell of white membrane in three bands to the crown.
  round(L, C, C, R - 1, WALL, 40, 'white', { taper: 0.88, solid: false });
  round(L, C, C, (R - 1) * 0.88, 40, 52, 'white', { taper: 0.72, solid: false });
  round(L, C, C, (R - 1) * 0.634, 52, 56, 'white', { taper: 0.6, solid: false });
  // The cable net: dark lines across the top, diagonal (the real net runs at 45°).
  for (const k of [-8, 0, 8]) {
    L.bar(C - 12 + k, C - 12 - k, C + 12 + k, C + 12 - k, 55.8, 56.2, 0.5, 'paint', { paint: 'gray', solid: false });
    L.bar(C - 12 - k, C + 12 - k, C + 12 - k, C - 12 - k, 55.8, 56.2, 0.5, 'paint', { paint: 'gray', solid: false });
  }

  // The gates on the front: dark openings with steel shutters down.
  for (const x of [C - 30, C, C + 30]) {
    const z = C + Math.sqrt(R * R - (x - C) ** 2);
    L.box(x - 5, 0, z - 1, x + 5, 5, z + 0.4, 'paint', { paint: 'charcoal' });
    L.box(x - 4.5, 0, z + 0.4, x + 4.5, 4.5, z + 0.5, 'shutter');
  }

  // 90 days on: the stadium was a shelter — rows of relief tents, crates, sandbags at a gate, a burnt bus.
  for (const [x, z] of [[16, 114], [114, 114], [114, 16]] as const) L.tent(x, z, 'x', 7);
  L.crates(24, 124, 6);
  L.crates(102, 124, 4);
  L.sandbags(C - 7, W - 0.6, C + 7, W - 0.6);
  L.box(100, 0.3, 4, 110.5, 3.2, 6.6, 'paint', { paint: 'charcoal' });
  L.car(14, 16, 'z', { burnt: true });
  L.fallenSign(116, 30, 'z');
}
