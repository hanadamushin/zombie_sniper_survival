// L8: 端島 (Hashima, "軍艦島" the Battleship Island), off the Nagasaki peninsula. A coal-mining island
// walled in concrete and built over with Japan's first reinforced-concrete blocks of flats (from
// 1916), up to ten storeys, home to 5,000 people until the mine closed in 1974 — a ruin long before
// the fall. From the sea: the grey sea wall like a hull, the blocks packed along it (65 at the north
// end round its courtyard, the school, the long 9-storey company flats down the west side, the oldest
// block 30), the rock ridge in the middle with the shrine and the small white lighthouse on top, and at
// the south end the mine's ruins — the brick walls of its office, the stumps of the coal conveyor.
//
// Real size: the island is 480 × 160 m. It does not fit the shrunk sea off the area's edge, so it is
// drawn at about a quarter (120 × 40 m) with its blocks at their real height. The lot stands in the sea
// (the table drains it): the sea round the island is dug back in. Nobody lands; no firing position.
// Local x runs along the island from south to north (the table turns it: rot 1), the front (z = d) faces
// east, to the peninsula.

import { landmarkDef, type Lm } from '../common.ts';
import { beam } from '../kanto/parts.ts';
import { flats } from './parts.ts';

const W = 128;
const D = 52;
/** The island's outline: a long octagon. */
const [X0, Z0, X1, Z1, CH] = [4, 6, 124, 46, 9];
/** The island's ground over the sea (the top of the fill inside the sea wall). */
const G = 4.6;

export const LANDMARK_HASHIMA = landmarkDef({
  variant: 'hashima',
  size: { w: [W, W], d: [D, D] },
  eaves: 30,
  top: G + 32,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  // The sea round the island (four pieces of the lot outside the octagon).
  const A: [number, number] = [X0 + CH, Z0];
  const B: [number, number] = [X1 - CH, Z0];
  const C: [number, number] = [X1, Z0 + CH];
  const Dd: [number, number] = [X1, Z1 - CH];
  const E: [number, number] = [X1 - CH, Z1];
  const F: [number, number] = [X0 + CH, Z1];
  const Gp: [number, number] = [X0, Z1 - CH];
  const H: [number, number] = [X0, Z0 + CH];
  const sea = (poly: [number, number][]): void => L.ground('water', poly, 4, 1.2);
  sea([[0, 0], [W, 0], [W, Z0 + CH], C, B, A, H, [0, Z0 + CH]]);
  sea([[0, D], [W, D], [W, Z1 - CH], Dd, E, F, Gp, [0, Z1 - CH]]);
  sea([[0, Z0 + CH], H, Gp, [0, Z1 - CH]]);
  sea([[W, Z0 + CH], C, Dd, [W, Z1 - CH]]);

  // The fill and the sea wall (the hull): a thick grey wall round the octagon, a little over the ground.
  L.box(X0 + 1, 0, Z0 + CH, X1 - 1, G, Z1 - CH, 'paint', { paint: 'hashima' });
  L.box(X0 + CH, 0, Z0 + 1, X1 - CH, G, Z1 - 1, 'paint', { paint: 'hashima' });
  const ring = [A, B, C, Dd, E, F, Gp, H];
  for (let i = 0; i < 8; i++) {
    const [a, b] = [ring[i]!, ring[(i + 1) % 8]!];
    beam(L, a[0], a[1], b[0], b[1], -2, G + 1.2, 1.6, 'gray');
  }

  // The rock ridge in the middle, the shrine on it and the small white lighthouse.
  const r1 = L.shape('cyl', 38, G, 19, 86, G + 14, 35, 'paint', { paint: 'grayGreen' });
  r1.taper = 0.62;
  const r2 = L.shape('cyl', 50, G + 13, 22, 76, G + 22, 32, 'paint', { paint: 'grayGreen' });
  r2.taper = 0.45;
  L.box(64, G + 21, 25, 68, G + 24, 28, 'paint', { paint: 'gray' });
  L.column(56, 27, 1.1, G + 20, G + 27, 'paint', { paint: 'white' });
  L.column(56, 27, 1.4, G + 27, G + 28.4, 'paint', { paint: 'charcoal', taper: 0.5, solid: false });

  // Block 65 round its courtyard at the north end, the school beside it.
  flats(L, 98, 9, 122, 17, G, 10, 2.9, 'hashima', { skip: 2, gone: 0.25 });
  flats(L, 114, 17, 122, 40, G, 9, 2.9, 'hashima');
  flats(L, 98, 32, 114, 40, G, 7, 2.9, 'hashima', { skip: 1, gone: 0.4 });
  flats(L, 84, 8, 96, 19, G, 7, 3.2, 'gray');
  // The long company flats (日給社宅) down the west side, block 30 and its neighbours further south.
  flats(L, 66, 8, 82, 17, G, 9, 2.9, 'hashima');
  flats(L, 50, 8, 64, 17, G, 9, 2.9, 'hashima', { skip: 3, gone: 0.3 });
  flats(L, 36, 8, 47, 17, G, 7, 3, 'charcoal', { skip: 2, gone: 0.5 });
  flats(L, 24, 9, 34, 17, G, 5, 3, 'hashima');
  // Lower blocks on the east side under the ridge.
  flats(L, 56, 37, 76, 44, G, 6, 2.9, 'hashima');
  flats(L, 78, 36, 94, 44, G, 5, 2.9, 'gray', { skip: 2, gone: 0.35 });
  flats(L, 40, 37, 52, 44, G, 4, 3, 'hashima');

  // The mine at the south end: the brick shell of its office, the conveyor's stumps, a pithead's base.
  for (const [a, b, c, d, h] of [[10, 32, 22, 33, 9], [10, 32, 11, 42, 7], [21, 32, 22, 38, 8], [14, 41.5, 22, 42.5, 5]] as const) {
    L.box(a, G, b, c, G + h, d, 'paint', { paint: 'brickRed' });
  }
  for (let x = 9; x <= 33; x += 4) L.box(x - 0.8, G, 22, x + 0.8, G + 7.5, 24, 'paint', { paint: 'gray' });
  L.box(26, G, 28, 34, G + 3.5, 36, 'paint', { paint: 'gray' });
  L.box(28, G + 3.5, 30, 32, G + 9, 34, 'paint', { paint: 'charcoal', solid: false });
}
