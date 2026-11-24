// L5: 明石海峡大橋 主塔 (a main tower of the Akashi Kaikyō Bridge, 1998), the strait between Kōbe (Maiko)
// and Awaji Island. The longest suspension span of its time (1,991 m): two towers 298.3 m above the sea,
// painted green-grey, each two legs of cross-shaped section rising from a round caisson, tied by X
// braces in the plane across the bridge and a strut on top; the stiffening truss of the deck passes
// between the legs about 65 m above the water, hanging from the two main cables that leave the
// saddles on the towers' tops.
//
// As the Rainbow Bridge (L3a): the lot is the north tower with a stretch of its deck; the cables sag
// away both sides and leave the lot (the rest of the bridge is the area data's road). The lot is the
// sea (dug from the ground) round the caisson. The bridge runs from the north-east (Maiko) to the
// south-west (Awaji) across the shrunk strait, so here it runs along the lot's diagonal: from the
// local corner (0, D) to (W, 0) with the front (local z = d) facing south. Parts turned by 45° are
// beams (kanto parts.ts beam / slant), split so that each stays on the lot.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { beam, round, slant } from '../kanto/parts.ts';

const W = 120;
const C = W / 2;
/** Along the bridge (towards the north-east, local +x −z) and across it. */
const U: readonly [number, number] = [Math.SQRT1_2, -Math.SQRT1_2];
const V: readonly [number, number] = [Math.SQRT1_2, Math.SQRT1_2];
/** The legs (across), the deck (bottom and top of the truss, half width), the stretch drawn, the top. */
const LEG = 17;
const DECK0 = 60;
const DECK1 = 74;
const DW = 13;
const S = 66;
const TOP = 298.3;
const PAINT: PaintName = 'grayGreen';

export const LANDMARK_AKASHI_KAIKYO_BRIDGE = landmarkDef({
  variant: 'akashi_kaikyo_bridge',
  size: { w: [W, W], d: [W, W] },
  eaves: DECK1,
  top: TOP,
  kind: 'shed',
  build,
});

/** The plan point s along the bridge and t across it from the tower's middle. */
const p = (s: number, t: number): [number, number] => [C + U[0] * s + V[0] * t, C + U[1] * s + V[1] * t];

/** Height of a main cable s along the bridge: it hangs from the saddle and sags away both ways. */
const cable = (s: number): number => {
  const [len, low] = s >= 0 ? [960, DECK1 + 60] : [995, DECK1 + 3];
  const k = Math.max(0, len - Math.abs(s)) / len;
  return low + (TOP - 2 - low) * k * k;
};

function build(L: Lm): void {
  L.ground('water', [[0, 0], [W, 0], [W, W], [0, W]], 4, 1.2);
  // The caisson's top is dry ground (an octagon round the tower's middle).
  const oct: [number, number][] = [];
  for (let i = 0; i < 8; i++) oct.push([C + Math.cos(((i + 0.5) / 8) * Math.PI * 2) * 24, C + Math.sin(((i + 0.5) / 8) * Math.PI * 2) * 24]);
  L.ground('paved', oct);
  // The caisson (round, concrete) the two legs stand on.
  round(L, C, C, 25, -3, 4, 'offWhite');

  // The legs: cross-shaped (a box deep along the bridge and one broad across it), narrowing in 9
  // sections; turned 45° with the bridge.
  const segs = 9;
  for (const t of [-LEG, LEG]) {
    const [x, z] = p(0, t);
    for (let i = 0; i < segs; i++) {
      const y0 = 4 + ((TOP - 8 - 4) * i) / segs;
      const y1 = 4 + ((TOP - 8 - 4) * (i + 1)) / segs + 0.05;
      const k = i / segs;
      const [a, b] = [3.6 - 1.2 * k, 2.2 - 0.6 * k];
      L.box(x - a, y0, z - b, x + a, y1, z + b, 'paint', { paint: PAINT, yaw: Math.PI / 4 });
      L.box(x - b * 0.9, y0, z - a * 1.2, x + b * 0.9, y1, z + a * 1.2, 'paint', { paint: PAINT, yaw: Math.PI / 4 });
    }
    // The saddle on the leg's top (the cable's seat).
    L.box(x - 3, TOP - 8, z - 2.2, x + 3, TOP - 3, z + 2.2, 'paint', { paint: PAINT, yaw: Math.PI / 4 });
    L.box(x - 2.2, TOP - 3, z - 1.4, x + 2.2, TOP, z + 1.4, 'paint', { paint: 'gray', yaw: Math.PI / 4 });
  }
  // The struts across and the X braces between them (in the plane of the legs).
  const struts = [DECK0 - 4, 140, 215, TOP - 12];
  const [la, lb] = [p(0, -LEG + 2), p(0, LEG - 2)];
  for (const y of struts) beam(L, la[0], la[1], lb[0], lb[1], y - 3, y + 3, 4, PAINT);
  for (let i = 1; i < struts.length; i++) {
    const [ya, yb] = [struts[i - 1]! + 3, struts[i]! - 3];
    slant(L, [la[0], ya, la[1]], [lb[0], yb, lb[1]], 10, 1.6, PAINT);
    slant(L, [lb[0], ya, lb[1]], [la[0], yb, la[1]], 10, 1.6, PAINT);
  }

  // The deck: the truss's chords, the roadway (strips of asphalt), the diagonals of its two sides.
  for (const t of [-DW, DW]) {
    const [a, b] = [p(-S, t), p(S, t)];
    beam(L, a[0], a[1], b[0], b[1], DECK0, DECK0 + 1.6, 1.6, PAINT);
    beam(L, a[0], a[1], b[0], b[1], DECK1 - 1.6, DECK1, 1.6, PAINT);
    for (let s = -S; s < S - 1; s += 12) {
      const [c, d, e] = [p(s, t), p(s + 6, t), p(s + 12, t)];
      slant(L, [c[0], DECK0 + 1.6, c[1]], [d[0], DECK1 - 1.6, d[1]], 3, 0.9, PAINT);
      slant(L, [d[0], DECK1 - 1.6, d[1]], [e[0], DECK0 + 1.6, e[1]], 3, 0.9, PAINT);
    }
  }
  for (let t = -DW + 2; t <= DW - 2 + 0.01; t += 4.4) {
    const [a, b] = [p(-S, t), p(S, t)];
    beam(L, a[0], a[1], b[0], b[1], DECK1 - 0.8, DECK1, 4.6, 'charcoal');
  }

  // The main cables from the saddles, sagging away both ways, and the hangers down to the deck.
  for (const t of [-LEG, LEG]) {
    for (const dir of [-1, 1]) {
      const n = 8;
      for (let k = 0; k < n; k++) {
        const [sa, sb] = [(dir * S * k) / n, (dir * S * (k + 1)) / n];
        const [a, b] = [p(sa, t), p(sb, t)];
        slant(L, [a[0], cable(sa), a[1]], [b[0], cable(sb), b[1]], 3, 1.2, 'silver');
      }
    }
    for (let s = -S + 6; s < S; s += 12) {
      if (Math.abs(s) < 8) continue;
      const [x, z] = p(s, t);
      L.box(x - 0.08, DECK1, z - 0.08, x + 0.08, cable(s), z + 0.08, 'steel', { solid: false });
    }
  }
  // The aviation lamps on the towers' tops.
  for (const t of [-LEG, LEG]) {
    const [x, z] = p(0, t);
    L.box(x - 0.4, TOP - 0.2, z - 0.4, x + 0.4, TOP, z + 0.4, 'paint', { paint: 'red', solid: false });
  }

  // 90 days on: a burnt car and a stalled lorry left on the deck, sandbags across a lane.
  const [c1x, c1z] = p(-30, -4);
  L.box(c1x - 2.2, DECK1, c1z - 0.9, c1x + 2.2, DECK1 + 0.9, c1z + 0.9, 'paint', { paint: 'charcoal', yaw: Math.PI / 4 });
  const [c2x, c2z] = p(24, 5);
  L.box(c2x - 4, DECK1, c2z - 1.2, c2x + 4, DECK1 + 3.2, c2z + 1.2, 'paint', { paint: 'white', yaw: Math.PI / 4 });
  const [b0, b1] = [p(-8, -10), p(-8, 2)];
  beam(L, b0[0], b0[1], b1[0], b1[1], DECK1, DECK1 + 0.9, 0.7, 'gray');
}
