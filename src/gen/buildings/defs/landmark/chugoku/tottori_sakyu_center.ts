// L6: 鳥取砂丘 砂丘センター 見晴らしの丘 (the Dune Centre on the Miharashi hill), Tottori. The building on
// the high ground south of the Tottori Sand Dunes whose roof terrace looks out over the dunes and the
// Sea of Japan: three storeys of shops and a restaurant with a long glazed front towards the dunes,
// the observation terrace on its roof under a light canopy, and the chairlift running down from its
// station to the dunes' entrance. The dunes themselves are the area's ground, left as it is.
//
// Real size as far as known (the building about 34 × 18 m, the roof 11 m); the lift is drawn as far as
// the lot reaches. A firing position: the roof terrace, up the service ladder on the back wall (it
// looks over the open dunes). The front (local z = d) faces the dunes (the table turns it north).

import { landmarkDef, type Lm } from '../common.ts';
import { slant } from '../kanto/parts.ts';
import { pine } from '../tohoku/parts.ts';

const W = 52;
const D = 64;
const X0 = 8;
const X1 = 42;
const Z0 = 8;
const Z1 = 26;
const R = 11;

export const LANDMARK_TOTTORI_SAKYU_CENTER = landmarkDef({
  variant: 'tottori_sakyu_center',
  size: { w: [W, W], d: [D, D] },
  eaves: R,
  top: R + 4.2,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, Z1 + 6], [0, Z1 + 6]]);
  L.ground('gravel', [[0, Z1 + 6], [W, Z1 + 6], [W, D], [0, D]]);

  // The building: pale concrete, dark glass along the dune side on every floor, a band of shop windows behind.
  L.box(X0, 0, Z0, X1, R, Z1, 'paint', { paint: 'offWhite' });
  for (const f of [0, 1, 2]) {
    const y = 0.6 + f * 3.6;
    L.box(X0 + 1, y, Z1, X1 - 1, y + 2.6, Z1 + 0.1, 'paint', { paint: 'deckGlass', solid: false });
    L.windows('x', Z0, -1, X0 + 2, X1 - 2, 6, y + 0.4, y + 2.2, 2.4, { broken: 0.4 });
  }
  L.windows('x', Z1 + 0.1, 1, X0 + 2, X1 - 2, 6, 0.6, 3.2, 3.6, { paint: 'black', broken: 0.6 });
  // The roof terrace: the parapet (open over the ladder at the back), the canopy on slim posts.
  for (const [a, b, c, d] of [[X0, Z0, X0 + 8.2, Z0 + 0.3], [X0 + 9.8, Z0, X1, Z0 + 0.3], [X0, Z1 - 0.3, X1, Z1], [X0, Z0, X0 + 0.3, Z1], [X1 - 0.3, Z0, X1, Z1]] as const) {
    L.box(a, R, b, c, R + 1.1, d, 'paint', { paint: 'offWhite' });
  }
  for (const x of [X0 + 12, X0 + 22]) for (const z of [Z0 + 5, Z1 - 4]) L.box(x - 0.15, R, z - 0.15, x + 0.15, R + 3.6, z + 0.15, 'steel', { solid: false });
  L.box(X0 + 10, R + 3.6, Z0 + 3, X0 + 24, R + 4, Z1 - 2, 'paint', { paint: 'white', solid: false });
  L.box(X1 - 6, R, Z0 + 2, X1 - 1, R + 2.6, Z0 + 6, 'paint', { paint: 'offWhite' });

  // The chairlift: the top station beside the building, the cable down towards the dunes on two towers.
  const lx = 46;
  L.box(lx - 3, 0, 14, lx + 3, 5, 24, 'paint', { paint: 'gray' });
  L.box(lx - 3.6, 5, 13.4, lx + 3.6, 5.4, 24.6, 'paint', { paint: 'skyBlue', solid: false });
  for (const z of [40, 56]) {
    L.box(lx - 0.3, 0, z - 0.3, lx + 0.3, 6.4 - (z - 24) * 0.08, z + 0.3, 'steel');
    L.box(lx - 1.8, 6.4 - (z - 24) * 0.08, z - 0.2, lx + 1.8, 6.8 - (z - 24) * 0.08, z + 0.2, 'steel', { solid: false });
  }
  for (const s of [-1.6, 1.6]) slant(L, [lx + s, 6.2, 24], [lx + s, 6.2 - (D - 1 - 24) * 0.08, D - 1], 8, 0.1, 'charcoal');
  for (const z of [30, 36, 46, 52, 60]) {
    const y = 6.2 - (z - 24) * 0.08;
    const s = z % 12 === 0 ? -1.6 : 1.6;
    L.box(lx + s - 0.5, y - 2.4, z - 0.4, lx + s + 0.5, y - 1.6, z + 0.4, 'paint', { paint: 'navy', solid: false });
  }

  // The ladder up the back wall to the roof terrace; the terrace's dune edge is the firing position.
  L.ladder(X0 + 9, Z0 - 0.45, 0, 1, 0, R);
  L.vantage((X0 + X1) / 2, R, Z1 - 1.2);

  // Pines of the coast on the slope.
  for (const [x, z] of [[4, 40], [4, 54], [26, 60], [16, 46]] as const) pine(L, x, z, 8);

  // 90 days on: cars left in the car park, a relief tent, crates, a fallen sign.
  L.car(14, 3, 'x');
  L.car(22, 3, 'x', { burnt: true });
  L.car(36, 3, 'x');
  L.tent(24, 36, 'x', 7);
  L.crates(34, 34, 4);
  L.fallenSign(12, 32, 'x');
}
