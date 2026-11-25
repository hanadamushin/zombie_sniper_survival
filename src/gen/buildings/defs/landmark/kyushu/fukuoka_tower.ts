// L8: 福岡タワー (Fukuoka Tower, 1989), Momochi seaside, Fukuoka. 234 m: Japan's tallest seaside tower, a
// slim prism on an equilateral triangle sheathed from the foot to the top in about 8,000 half-mirror
// panes (it shows the sky and Hakata Bay), the observation floors at 116–123 m behind clear glass, the
// broadcasting mast on its head. A low entrance hall at its foot, palms of the seaside park round it.
//
// The triangle (21 m a side) is three glass walls turned by 60° (kanto/parts.ts beam) round a hidden
// solid core. The front (local z = d, a flat face) faces south, to the city; the beach is behind.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { beam } from '../kanto/parts.ts';
import { palm } from './parts.ts';

const W = 44;
const D = 48;
const C = 22;
const CZ = 20;
/** Side of the triangle and its circumradius. */
const S = 21;
const R = S / Math.sqrt(3);
const GLASS = 226;
const TOP = 234;
const DECK = [114, 124] as const;

export const LANDMARK_FUKUOKA_TOWER = landmarkDef({
  variant: 'fukuoka_tower',
  size: { w: [W, W], d: [D, D] },
  eaves: GLASS,
  top: TOP,
  kind: 'tower',
  build,
});

/** The triangle's corners (back, front right, front left), pushed out by `out`. */
function corners(out = 0): [number, number][] {
  const r = R + out * 2;
  return [-90, 30, 150].map((a) => [C + Math.cos((a * Math.PI) / 180) * r, CZ - Math.sin((-a * Math.PI) / 180) * r] as [number, number]);
}

/** The three walls from y0 to y1. */
function prism(L: Lm, y0: number, y1: number, paint: PaintName, out = 0, thick = 0.5): void {
  const p = corners(out);
  for (let i = 0; i < 3; i++) {
    const [a, b] = [p[i]!, p[(i + 1) % 3]!];
    beam(L, a[0], a[1], b[0], b[1], y0, y1, thick, paint, false);
  }
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('grass', [[0, 0], [W, 0], [W, 6], [0, 6]]);
  // The solid core (hidden): three boxes stepping in towards the back corner (the triangle's half
  // width at z is (z - back) tan 30°).
  const r = R / 2;
  const half = (z: number): number => (z - (CZ - R)) * Math.tan(Math.PI / 6) - 0.3;
  for (const [za, zb] of [[CZ - 0.5, CZ + r * 0.95], [CZ - 5, CZ - 0.5], [CZ - R * 0.7, CZ - 5]] as const) {
    L.box(C - half(za), 0, za, C + half(za), GLASS, zb, 'paint', { paint: 'gray', hidden: true });
  }

  // The mirror glass to the observation floors, the floors' clear glass, the mirror again to the top.
  prism(L, 0, DECK[0], 'mirror');
  prism(L, DECK[0], DECK[1], 'deckGlass');
  for (const y of [DECK[0], 118, 121, DECK[1]]) prism(L, y - 0.35, y + 0.35, 'silver', 0.12, 0.3);
  prism(L, DECK[1], GLASS, 'mirror');
  // Faint bands of the frame every 30 m (the panes' joints read as lines from afar), the top's rim.
  for (let y = 30; y < GLASS - 10; y += 30) if (y < DECK[0] - 5 || y > DECK[1] + 5) prism(L, y - 0.2, y + 0.2, 'skyBlue', 0.08, 0.25);
  prism(L, GLASS - 0.8, GLASS, 'silver', 0.12, 0.4);
  // The roof slab over the triangle (a turned square covering most of it), the white corner edges.
  for (const [x, z] of corners()) L.box(x - 0.35, 0, z - 0.35, x + 0.35, GLASS, z + 0.35, 'paint', { paint: 'white', solid: false });
  L.box(C - r * 1.5, GLASS - 0.5, CZ - r * 0.9, C + r * 1.5, GLASS, CZ + r * 0.98, 'paint', { paint: 'silver', solid: false });
  // The mast: a steel post with its antenna rings and a red light.
  L.column(C, CZ - 1, 1.4, GLASS, GLASS + 3, 'paint', { paint: 'silver' });
  L.column(C, CZ - 1, 0.5, GLASS + 3, TOP - 0.6, 'steel', { taper: 0.5 });
  for (const y of [GLASS + 4.5, GLASS + 6.5]) L.column(C, CZ - 1, 0.9, y, y + 0.5, 'paint', { paint: 'white', solid: false });
  L.column(C, CZ - 1, 0.25, TOP - 0.6, TOP, 'paint', { paint: 'red', solid: false });

  // The entrance hall wrapped round the foot's front: two low storeys of glass under a white slab.
  const zf = CZ + R / 2;
  L.box(C - 14, 0, zf - 4, C + 14, 7.4, zf + 7, 'paint', { paint: 'offWhite' });
  L.box(C - 14.4, 7.4, zf - 4.4, C + 14.4, 8, zf + 7.4, 'paint', { paint: 'white' });
  L.windows('x', zf + 7, 1, C - 13, C + 13, 5, 0.8, 6.6, 4.4, { paint: 'skyBlue', broken: 0.5 });
  L.box(C - 2, 0, zf + 7, C + 2, 3, zf + 7.15, 'doorSteel');

  // Canary palms of the seaside park.
  for (const [x, z] of [[4, 6], [40, 6], [4, 26], [40, 26], [5, 44], [39, 44]] as const) palm(L, x, z, 8, 7, 3.2);

  // 90 days on: a relief tent and crates on the forecourt, a burnt car, a fallen sign, scorched glass.
  L.tent(10, 38, 'x', 7);
  L.crates(30, 40, 4);
  L.car(33, 46, 'x', { burnt: true });
  L.fallenSign(C + 4, D - 2.5, 'x');
  L.scorch(C - 10, 0.4, zf + 7.05, C - 5, 6.4, zf + 7.2);
}
