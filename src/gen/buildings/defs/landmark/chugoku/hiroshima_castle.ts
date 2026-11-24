// L6: 広島城 (Hiroshima Castle, the "carp castle" 鯉城). The five-tier keep of 1592 (rebuilt in concrete
// in 1958 after the bomb destroyed it) on the north-west corner of the main enclosure: black boards
// (下見板) up the lower part of each tier and white plaster above, grey tiled roofs with gables
// (千鳥破風) and a curved gable, the top storey's railed balcony (廻縁), on a tall leaning stone base
// over the broad moat that mirrors it.
//
// Real size: the keep 26.6 m on its 12.4 m stone base (39 m to the ridge fish), the first storey
// about 22 × 17 m. Only the keep, its base, the moat's corner and the pines are drawn (the enclosure is
// 200 m across). The front (local z = d) faces south, towards the moat.

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase } from '../tohoku/parts.ts';
import { blackTier, karahafu, type BlackTierStyle } from '../chubu/parts.ts';
import { ginkgo } from '../kanto/parts.ts';
import { keepTop } from './parts.ts';

const W = 84;
const D = 80;
const CX = 40;
const CZ = 32;
const BASE = 12.4;
/** The moat: south of MZ and west of MX. */
const MZ = 56;
const MX = 10;

export const LANDMARK_HIROSHIMA_CASTLE = landmarkDef({
  variant: 'hiroshima_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 32,
  top: 39.8,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[MX, 0], [W, 0], [W, MZ], [MX, MZ]]);
  L.ground('water', [[0, 0], [MX, 0], [MX, MZ], [W, MZ], [W, D], [0, D]], 2.6, 1.1);
  // The moat's stone edges (low walls out of the water).
  L.box(MX, -2.6, MZ - 1.2, W, 1.2, MZ, 'paint', { paint: 'gray' });
  L.box(MX, -2.6, 0, MX + 1.2, 1.2, MZ, 'paint', { paint: 'gray' });

  // The stone base: tall, leaning back, grey.
  stoneBase(L, CX - 14.5, CZ - 11.5, CX + 14.5, CZ + 11.5, 0, BASE, 0.12, 4, 'gray');
  const s: BlackTierStyle = { roof: 'kawara', over: 1.6, rise: 2, wx: 6, wz: 5, white: 0.3, broken: 0.3 };
  const hs: [number, number, number, number, number][] = [
    [11, 8.5, 5.4, 7, 5],
    [9.6, 7.2, 4.8, 6, 4],
    [8.1, 5.9, 4.5, 5, 4],
    [6.6, 4.7, 4.2, 4, 3],
    [5.1, 3.7, 4, 3, 2],
  ];
  let y = BASE;
  const e: number[] = [];
  hs.forEach(([hx, hz, h, wx, wz], i) => {
    const last = i === hs.length - 1;
    y = blackTier(L, CX, CZ, hx, hz, y, h, { ...s, wx, wz, rise: last ? 0 : s.rise, white: last ? 0.6 : s.white, over: i === 0 ? 2 : s.over });
    e.push(y);
  });
  // The top storey's balcony and its railing (廻縁・高欄), then the top roof with dark ridge ornaments.
  const [tx, tz] = [hs[4]![0], hs[4]![1]];
  const by = e[3]! + 0.6;
  L.box(CX - tx - 1, by - 0.25, CZ - tz - 1, CX + tx + 1, by, CZ + tz + 1, 'paint', { paint: 'black', solid: false });
  for (const sz of [-1, 1]) L.box(CX - tx - 1, by, CZ + sz * (tz + 1) - 0.06, CX + tx + 1, by + 0.9, CZ + sz * (tz + 1) + 0.06, 'paint', { paint: 'black', solid: false });
  for (const sx of [-1, 1]) L.box(CX + sx * (tx + 1) - 0.06, by, CZ - tz - 1, CX + sx * (tx + 1) + 0.06, by + 0.9, CZ + tz + 1, 'paint', { paint: 'black', solid: false });
  keepTop(L, CX, CZ, tx, tz, y, 1.6, 3.6, 'kawara', 'white', 'charcoal');

  // The gables: a big one on the first roof's long faces, two on the second's, a curved gable on the third's front.
  for (const sz of [-1, 1] as const) {
    const side = sz > 0 ? 'z+' : 'z-';
    chidori(L, side, CZ + sz * hs[0]![1], CX, 5, e[0]! - 0.2, e[0]! + 3.6, 2, 'kawara');
    chidori(L, side, CZ + sz * hs[1]![1], CX - 4.6, 2.8, e[1]! - 0.2, e[1]! + 2.4, s.over, 'kawara');
    chidori(L, side, CZ + sz * hs[1]![1], CX + 4.6, 2.8, e[1]! - 0.2, e[1]! + 2.4, s.over, 'kawara');
    if (sz > 0) karahafu(L, side, CZ + sz * hs[2]![1], CX, 3, e[2]! - 0.2, e[2]! + 2.2, s.over, 'kawara', 'white');
    else chidori(L, side, CZ + sz * hs[2]![1], CX, 3, e[2]! - 0.2, e[2]! + 2.4, s.over, 'kawara');
  }
  for (const sx of [-1, 1] as const) chidori(L, sx > 0 ? 'x+' : 'x-', CX + sx * hs[0]![0], CZ, 4.4, e[0]! - 0.2, e[0]! + 3.2, 2, 'kawara');

  // Pines on the enclosure's edge and a yellow ginkgo (late November).
  for (const [x, z, h] of [[16, 8, 11], [16, 46, 10], [68, 8, 12], [76, 46, 10], [62, 50, 9], [22, 52, 9]] as const) pine(L, x, z, h);
  ginkgo(L, 72, 24, 16);

  // 90 days on: relief tents and crates on the enclosure's lawn, a burnt car, a fallen sign, scorch on the base.
  L.tent(66, 36, 'z', 7);
  L.tent(74, 36, 'z', 7);
  L.crates(58, 50, 4);
  L.car(24, 14, 'x', { burnt: true });
  L.fallenSign(50, 52, 'x');
  L.scorch(CX + 14.4, 1, CZ - 3, CX + 14.6, 4, CZ + 3);
}
