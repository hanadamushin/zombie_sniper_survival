// L3a: レインボーブリッジ (Rainbow Bridge, 1993), the suspension bridge over the inner harbour from
// Shibaura to Daiba: 798 m, a main span of 570 m between two white towers 126 m high above the sea.
// The deck is a double-decked truss (the Shuto expressway above, the waterfront road, the Yurikamome
// and the walkways below), 52 m of clearance under it. The towers are slim white frames: two legs, a
// strut under the deck, one high up and the top beam, the legs ending in short pinnacles.
//
// Like the Aomori Bay Bridge (L2), the lot is one tower with 100 m of its deck; the main cables sag
// away to both sides and leave the lot (the rest of the bridge is the area data's own road). The
// lot is water (dug from the ground: the tower stands in the harbour on its concrete footing). The
// deck runs along local x.

import { landmarkDef, type Lm } from '../common.ts';
import { slant } from './parts.ts';

const W = 100;
const D = 56;
const CX = W / 2;
/** The legs (z middles), the deck (lower and upper levels), the tower's top. */
const LEGS = [7, D - 7];
const LOW = 52;
const UP = 61;
const TOP = 126;

export const LANDMARK_RAINBOW_BRIDGE = landmarkDef({
  variant: 'rainbow_bridge',
  size: { w: [W, W], d: [D, D] },
  eaves: UP + 1.5,
  top: TOP,
  kind: 'shed',
  build,
});

/** Height of a main cable at x (it hangs from the saddle at the tower and sags away both ways). */
const cable = (x: number): number => {
  const d = Math.abs(x - CX);
  // Main span (to +x): the lowest point 285 m away at the deck; side span (to -x): 115 m to the anchorage.
  const [len, low] = x >= CX ? [285, UP + 3] : [175, UP + 6];
  const s = Math.max(0, len - d) / len;
  return low + (TOP - 3 - low) * s * s;
};

function build(L: Lm): void {
  // The harbour on both sides of the tower's footing (an island of concrete in the lot's middle).
  L.ground('water', [[0, 0], [CX - 10, 0], [CX - 10, D], [0, D]], 3, 1);
  L.ground('water', [[CX + 10, 0], [W, 0], [W, D], [CX + 10, D]], 3, 1);
  L.ground('paved', [[CX - 10, 0], [CX + 10, 0], [CX + 10, D], [CX - 10, D]]);

  // The tower's footing in the water, the legs narrowing a little to the top, the struts, the pinnacles.
  L.box(CX - 9, -2.5, 1, CX + 9, 2.5, D - 1, 'paint', { paint: 'offWhite' });
  const segs = 6;
  for (const z of LEGS) {
    for (let i = 0; i < segs; i++) {
      const y0 = 2.5 + ((TOP - 6 - 2.5) * i) / segs;
      const y1 = 2.5 + ((TOP - 6 - 2.5) * (i + 1)) / segs;
      const hx = 3.6 - (1.2 * i) / segs;
      const hz = 3 - (0.8 * i) / segs;
      L.box(CX - hx, y0, z - hz, CX + hx, y1 + 0.05, z + hz, 'paint', { paint: 'white' });
    }
    L.box(CX - 2.2, TOP - 6, z - 1.9, CX + 2.2, TOP - 1, z + 1.9, 'paint', { paint: 'white' });
    L.column(CX, z, 1.4, TOP - 1, TOP, 'paint', { paint: 'white', taper: 0.5 });
    L.box(CX - 0.3, TOP - 0.2, z - 0.3, CX + 0.3, TOP, z + 0.3, 'paint', { paint: 'red', solid: false });
  }
  for (const [y0, y1, inset] of [[LOW - 5, LOW, 0], [97, 101, 0.4], [TOP - 9, TOP - 5, 0.8]] as const) {
    L.box(CX - 2.4 + inset, y0, LEGS[0]!, CX + 2.4 - inset, y1, LEGS[1]!, 'paint', { paint: 'white' });
  }

  // The deck: the lower and upper levels, the truss's chords and posts on both sides, its diagonals.
  L.box(0, LOW, 9, W, LOW + 1.6, D - 9, 'paint', { paint: 'gray' });
  L.box(0, UP, 9, W, UP + 1.5, D - 9, 'paint', { paint: 'gray' });
  for (const z of [9, D - 9.6]) {
    L.box(0, LOW - 0.4, z, W, LOW + 0.6, z + 0.6, 'paint', { paint: 'white' });
    L.box(0, UP - 0.2, z, W, UP + 0.8, z + 0.6, 'paint', { paint: 'white' });
    for (let x = 2; x < W; x += 12) {
      L.box(x - 0.3, LOW + 0.6, z, x + 0.3, UP - 0.2, z + 0.6, 'paint', { paint: 'white', solid: false });
      if (x + 12 < W) slant(L, [x, LOW + 0.6, z + 0.3], [x + 12, UP - 0.2, z + 0.3], 3, 0.45, 'white');
    }
    L.box(0, UP + 1.5, z, W, UP + 2.6, z + 0.6, 'paint', { paint: 'silver' }); // the expressway's parapet
  }
  // The lanes' lines on the upper deck.
  for (const z of [D / 2 - 0.15, 19, D - 19]) L.box(0, UP + 1.5, z - 0.1, W, UP + 1.52, z + 0.1, 'paint', { paint: 'white', solid: false });

  // The main cables (one over each leg) and their hangers down to the deck.
  for (const z of LEGS) {
    const xs = [0, 12, 24, 36, CX - 3, CX + 3, 64, 76, 88, W];
    for (let i = 1; i < xs.length; i++) {
      const xa = xs[i - 1]!;
      const xb = xs[i]!;
      if (xa === CX - 3) continue; // over the tower: the saddle
      slant(L, [xa, cable(xa), z], [xb, cable(xb), z], 4, 0.7, 'silver');
    }
    for (let x = 6; x < W; x += 10) if (Math.abs(x - CX) > 5) L.box(x - 0.08, UP + 2.6, z - 0.08, x + 0.08, cable(x), z + 0.08, 'steel', { solid: false });
  }

  // 90 days on: two cars stopped on the upper deck, nobody in them; a third burnt out.
  for (const [x, z, col] of [[22, D / 2 + 5, 'white'], [70, D / 2 - 5, 'silver']] as const) {
    L.box(x - 2.2, UP + 1.75, z - 0.85, x + 2.2, UP + 2.45, z + 0.85, 'paint', { paint: col });
    L.box(x - 1.2, UP + 2.45, z - 0.78, x + 1.2, UP + 2.95, z + 0.78, 'paint', { paint: 'windowDark' });
  }
  L.box(84 - 2.2, UP + 1.75, D / 2 + 9 - 0.85, 84 + 2.2, UP + 2.45, D / 2 + 9 + 0.85, 'paint', { paint: 'charcoal' });
}
