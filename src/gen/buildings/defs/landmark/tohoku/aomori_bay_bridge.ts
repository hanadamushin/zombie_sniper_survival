// L2: 青森ベイブリッジ (Aomori Bay Bridge, 1992), the cable-stayed bridge over the inner port by
// Aomori Station: 1,219 m long, a 240 m main span on two white concrete towers shaped as an inverted
// Y — the "A" of Aomori — whose single mast carries one plane of fanned stays down to the middle of
// the deck (一面吊り). The tower's height is not in the sources at hand; about 80 m from the ground
// is read from photographs (the deck about a third of the way up).
//
// The whole bridge does not fit a shrunk area (it would cross 120 m of the 1/10 port), so the lot is
// one tower with a 100 m stretch of its deck on two piers, the stays fanning out both ways. The
// deck runs along local x; the front (local z = d) is one side of the bridge.

import { landmarkDef, type Lm } from '../common.ts';

const W = 100;
const D = 40;
const CX = W / 2;
const CZ = D / 2;
/** Underside and top of the deck; its half width (z). */
const DECK0 = 24;
const DECK1 = 26.6;
const HALF = 9;
/** Where the legs meet, and the mast's top. */
const MEET = 64;
const TOP = 80;
/** The legs' half spread at the ground. */
const SPREAD = 18.5;

export const LANDMARK_AOMORI_BAY_BRIDGE = landmarkDef({
  variant: 'aomori_bay_bridge',
  size: { w: [W, W], d: [D, D] },
  eaves: DECK1,
  top: TOP + 1.5,
  kind: 'shed',
  build,
});

/** A slanted line from (ax, ay, az) to (bx, by, bz) in `n` short boxes, `t` thick (stays, legs). */
function slant(L: Lm, a: [number, number, number], b: [number, number, number], n: number, t: number, solid: boolean): void {
  for (let i = 0; i < n; i++) {
    const p = (k: number): [number, number, number] => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n];
    const [x0, y0, z0] = p(i);
    const [x1, y1, z1] = p(i + 1);
    L.box(Math.min(x0, x1) - t / 2, Math.min(y0, y1), Math.min(z0, z1) - t / 2, Math.max(x0, x1) + t / 2, Math.max(y0, y1) + 0.02, Math.max(z0, z1) + t / 2, 'paint', { paint: 'white', solid });
  }
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);

  // The tower: two legs leaning in from the ground to MEET (3.4 m along the bridge, 2.6 m across),
  // the mast above, a cross beam under the deck.
  const legs = 16;
  for (const s of [-1, 1]) {
    for (let i = 0; i < legs; i++) {
      const ya = (MEET * i) / legs;
      const yb = (MEET * (i + 1)) / legs;
      const off = SPREAD * (1 - (ya + yb) / 2 / MEET);
      const half = 1.3 + 0.3 * (1 - i / legs); // a little thicker at the foot
      L.box(CX - 1.7, ya, CZ + s * off - half, CX + 1.7, yb + 0.05, CZ + s * off + half, 'paint', { paint: 'white' });
    }
  }
  L.box(CX - 1.9, DECK0 - 2.2, CZ - 12.5, CX + 1.9, DECK0, CZ + 12.5, 'paint', { paint: 'white' });
  L.box(CX - 1.8, MEET - 2, CZ - 1.6, CX + 1.8, TOP - 6, CZ + 1.6, 'paint', { paint: 'white' });
  L.box(CX - 1.5, TOP - 6, CZ - 1.3, CX + 1.5, TOP, CZ + 1.3, 'paint', { paint: 'white' });
  L.box(CX - 1.7, TOP, CZ - 1.5, CX + 1.7, TOP + 0.5, CZ + 1.5, 'paint', { paint: 'silver' });
  // The aircraft warning lamp and the floodlights (the tower is lit at night).
  L.box(CX - 0.3, TOP + 0.5, CZ - 0.3, CX + 0.3, TOP + 1.5, CZ + 0.3, 'paint', { paint: 'red', solid: false });
  for (const s of [-1, 1]) L.box(CX - 0.5, DECK1, CZ + s * 2 - 0.4, CX + 0.5, DECK1 + 0.8, CZ + s * 2 + 0.4, 'paint', { paint: 'lampGlass', solid: false });

  // The deck: a concrete box girder with white fascias, the median where the stays land, rails.
  L.box(0, DECK0, CZ - HALF, W, DECK1, CZ + HALF, 'paint', { paint: 'gray' });
  for (const s of [-1, 1]) {
    L.box(0, DECK0 + 0.3, CZ + s * HALF - 0.1, W, DECK1 + 0.2, CZ + s * HALF + 0.1, 'paint', { paint: 'white', solid: false });
    L.box(0, DECK1, CZ + s * (HALF - 0.3) - 0.15, W, DECK1 + 1.1, CZ + s * (HALF - 0.3) + 0.15, 'paint', { paint: 'silver' });
  }
  L.box(0, DECK1, CZ - 1.2, W, DECK1 + 0.8, CZ + 1.2, 'paint', { paint: 'offWhite' });
  // Lane lines.
  for (const s of [-1, 1]) L.box(0, DECK1, CZ + s * 5 - 0.1, W, DECK1 + 0.02, CZ + s * 5 + 0.1, 'paint', { paint: 'white', solid: false });
  // Two piers carry the deck's ends (the rest of the bridge is beyond the lot).
  for (const x of [7, W - 7]) {
    L.box(x - 1.6, 0, CZ - 4, x + 1.6, DECK0, CZ + 4, 'paint', { paint: 'offWhite' });
    L.box(x - 2, DECK0 - 1.4, CZ - 7, x + 2, DECK0, CZ + 7, 'paint', { paint: 'offWhite' });
  }

  // The stays: one plane over the median, four each way, fanned from the mast (semi-fan).
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const top = 67 + k * 3.4;
      const reach = 12 + k * 11;
      slant(L, [CX + s * 1.8, top, CZ], [CX + s * reach, DECK1 + 0.8, CZ], 26, 0.35, false);
    }
  }

  // 90 days on: two cars stopped on the deck (doors open, nobody), one burnt under it, a fallen sign.
  for (const [x, z, col] of [[30, CZ + 3, 'silver'], [73, CZ - 3.5, 'navy']] as const) {
    L.box(x - 2.2, DECK1 + 0.25, z - 0.85, x + 2.2, DECK1 + 0.95, z + 0.85, 'paint', { paint: col });
    L.box(x - 1.2, DECK1 + 0.95, z - 0.78, x + 1.2, DECK1 + 1.45, z + 0.78, 'paint', { paint: 'windowDark' });
  }
  L.car(CX - 18, CZ + 13, 'x', { burnt: true });
  L.fallenSign(CX + 14, D - 3, 'x');
  L.sandbags(CX - 6, D - 4, CX + 6, D - 4);
}
