// L5: 神戸ポートタワー (Kobe Port Tower, 1963), Meriken Park, Chūō, Kōbe. 108 m: a hyperboloid of red steel
// pipes (a drum, 鼓, narrow at the waist and wide at both ends) — straight members leaning both ways
// round the axis, which make the curved outline — round a lift shaft; the observation floors are the
// glazed drum inside the top of the lattice, the roof deck (opened in the 2024 renewal) over them, the
// antenna on top. At the foot a low round hall.
//
// Each straight member is a staircase of short boxes (kanto parts.ts slant): 12 leaning one way (solid)
// and 12 the other (drawn only), rings at four levels. Firing position: the roof deck (98 m), by the
// maintenance ladder up the lift shaft and through hatches in the drum's floors. The front (local
// z = d) faces south (the harbour).

import type { PaintName } from '../../../../../data/render.ts';
import { subtractRects, type Rect } from '../../../kit.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { polyRing, round, slant } from '../kanto/parts.ts';

const W = 40;
const C = W / 2;
/** The lattice's foot and top radius, the twist of each member (radians), the top. */
const R0 = 10.5;
const R1 = 9;
const TWIST = (110 * Math.PI) / 180;
const LTOP = 98;
const DECK0 = 80;
const ROOF = 98;
const TOP = 108;
const SHAFT = 2.2;
const RED: PaintName = 'red';

export const LANDMARK_KOBE_PORT_TOWER = landmarkDef({
  variant: 'kobe_port_tower',
  size: { w: [W, W], d: [W, W] },
  eaves: ROOF,
  top: TOP,
  kind: 'tower',
  build,
});

/** The point of a member at fraction t of the height: from (R0, a) at the foot to (R1, a ± TWIST) at the top. */
function at(a: number, dir: 1 | -1, t: number): [number, number, number] {
  const p0 = [Math.cos(a) * R0, Math.sin(a) * R0];
  const b = a + dir * TWIST;
  const p1 = [Math.cos(b) * R1, Math.sin(b) * R1];
  return [C + p0[0]! + (p1[0]! - p0[0]!) * t, LTOP * t, C + p0[1]! + (p1[1]! - p0[1]!) * t];
}

/** Radius of the lattice at fraction t (the distance of a member from the axis). */
function radiusAt(t: number): number {
  const [x, , z] = at(0, 1, t);
  return Math.hypot(x - C, z - C);
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, W], [0, W]]);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (const dir of [1, -1] as const) {
      // In pieces (each a straight staircase), so that the steps follow the member closely.
      const k = 5;
      for (let j = 0; j < k; j++) slant(L, at(a, dir, j / k), at(a, dir, (j + 1) / k), 2, dir > 0 ? 0.55 : 0.4, RED, dir > 0);
    }
  }
  // The rings: at the foot, the waist, under the drum and at the top.
  for (const t of [0.02, 0.3, 0.55, DECK0 / LTOP, 1]) {
    const r = radiusAt(t);
    polyRing(L, C, C, r * Math.cos(Math.PI / n), LTOP * t - 0.8, LTOP * t, 0.6, n, RED, false);
  }

  // The hall at the foot, the lift shaft up the middle.
  round(L, C, C, 7.5, 0, 6, 'offWhite', { solid: false });
  L.box(C - 6, 0, C - 6, C + 6, 6, C + 2, 'paint', { paint: 'offWhite', hidden: true });
  L.box(C - 6, 0, C + 2, C - 1.4, 6, C + 6, 'paint', { paint: 'offWhite', hidden: true });
  L.box(C + 1.4, 0, C + 2, C + 6, 6, C + 6, 'paint', { paint: 'offWhite', hidden: true });
  L.column(C, C, 7.8, 6, 6.6, 'paint', { paint: RED, solid: false });
  L.box(C - 1.3, 0, C + 7.4, C + 1.3, 3.2, C + 7.6, 'paint', { paint: 'black', solid: false });
  L.column(C, C, SHAFT, 0, DECK0, 'paint', { paint: 'white' });

  // The drum of the observation floors: white bands, dark glass, solid slabs with hatches; the roof deck.
  const hatch: Rect = [C - 0.55, C + SHAFT - 0.05, C + 0.55, C + SHAFT + 0.95];
  const half = 5.6;
  for (const [y0, y1] of [[DECK0, DECK0 + 1.2], [ROOF - 0.8, ROOF]] as const) {
    for (const r of subtractRects([C - half, C - half, C + half, C + half], [hatch])) L.box(r[0], y0, r[1], r[2], y1, r[3], 'paint', { paint: 'white', hidden: true });
  }
  const rd = radiusAt(DECK0 / LTOP) - 1;
  round(L, C, C, rd, DECK0, DECK0 + 1.2, 'white', { solid: false });
  round(L, C, C, rd - 0.3, DECK0 + 1.2, DECK0 + 8, 'deckGlass', { solid: false, taper: 1.04 });
  round(L, C, C, rd + 0.2, DECK0 + 8, DECK0 + 9, 'white', { solid: false });
  round(L, C, C, rd, DECK0 + 9, ROOF - 0.8, 'deckGlass', { solid: false, taper: 1.03 });
  round(L, C, C, radiusAt(1) - 0.8, ROOF - 0.8, ROOF, 'white', { solid: false });
  L.box(hatch[0] - 0.1, DECK0, hatch[1], hatch[0], ROOF - 0.8, hatch[3], 'steel');
  L.box(hatch[2], DECK0, hatch[1], hatch[2] + 0.1, ROOF - 0.8, hatch[3], 'steel');
  const rail = ROOF + 1.1;
  const [e0, e1] = [C - half, C + half];
  L.box(e0, ROOF, e0, e1, rail, e0 + 0.08, 'steel');
  L.box(e0, ROOF, e1 - 0.08, e1, rail, e1, 'steel');
  L.box(e0, ROOF, e0, e0 + 0.08, rail, e1, 'steel');
  L.box(e1 - 0.08, ROOF, e0, e1, rail, e1, 'steel');
  // The antenna.
  L.column(C, C, 0.9, ROOF, ROOF + 3, 'paint', { paint: 'white' });
  L.column(C, C, 0.3, ROOF + 3, TOP, 'steel', { taper: 0.4, solid: false });

  // The ladder up the shaft's front, through the hatches; the roof deck is the firing position.
  L.ladder(C, C + SHAFT + 0.45, 0, -1, 0, ROOF);
  L.vantage(C, ROOF, e1 - 0.7);

  // 90 days on: crates and a relief tent on the quay, a burnt car, a fallen sign.
  L.tent(6, 34, 'x', 7);
  L.crates(32, 34, 4);
  L.car(34, 6, 'z', { burnt: true });
  L.fallenSign(10, 4, 'x');
}
