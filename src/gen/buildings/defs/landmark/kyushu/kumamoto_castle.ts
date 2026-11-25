// L8: 熊本城 (Kumamoto Castle, "銀杏城"), Kumamoto. Katō Kiyomasa's castle (1607): the great keep (大天守, three
// tiers and six storeys) and the lesser keep (小天守) joined to its west, both of black lacquered boards
// under grey tiles with white-boarded gables on every side, the railed balcony round the great keep's
// top storey; under them the famous stone walls (武者返し) that rise gently and then curve up sheer like
// a fan. Rebuilt in 1960 and restored after the 2016 earthquake (the keeps reopened in 2021); some of
// the stone walls are still being rebuilt — a heap of fallen stones at a corner. The ginkgo that gives
// the castle its name stands before the keep, yellow in late November.
//
// Real size: the great keep about 29 m over its stone base, the lesser keep 19 m; the main enclosure's
// walls drawn 8 m with the keeps' bases on them. The enclosure is drawn small (72 × 64 m). The front
// (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { stoneBase } from '../tohoku/parts.ts';
import { blackTier, type BlackTierStyle } from '../chubu/parts.ts';
import { broadleaf, ginkgo } from '../kanto/parts.ts';
import { hafu } from '../kinki/parts.ts';
import { keepTop } from '../chugoku/parts.ts';
import { balcony, stepsUp, watari } from '../shikoku/parts.ts';

const W = 72;
const D = 64;
/** The main enclosure's wall, the keeps' stone bases. */
const H = 8;
const [GX, GZ, GB] = [45, 24, H + 4];
const [SX, SZ, SB] = [23, 27, H + 3];

export const LANDMARK_KUMAMOTO_CASTLE = landmarkDef({
  variant: 'kumamoto_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: GB + 23,
  top: GB + 29.4,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The fan-curved stone walls (武者返し): many courses, the upper ones drawn in hard.
  stoneBase(L, 3, 3, 69, 50, 0, H, 0.22, 6, 'gray');
  stoneBase(L, GX - 14, GZ - 12.5, GX + 14, GZ + 12.5, H, GB, 0.18, 3, 'gray');
  stoneBase(L, SX - 10, SZ - 9.5, SX + 10, SZ + 9.5, H, SB, 0.15, 2, 'gray');

  const s: BlackTierStyle = { roof: 'kawara', over: 1.9, rise: 2.8, wx: 6, wz: 5, white: 0.14, broken: 0.3 };
  // The great keep: the first tier of two storeys under a broad roof with big gables on all sides.
  const t = [[12.2, 10.6, 9.4], [9.4, 8.2, 5.4], [7.4, 6.4, 4.6], [6, 5, 4]] as const;
  let y = GB;
  const e: number[] = [];
  t.forEach(([hx, hz, h], i) => {
    const last = i === t.length - 1;
    y = blackTier(L, GX, GZ, hx, hz, y, h, { ...s, wx: 6 - i, wz: 5 - i, rise: last ? 0 : i === 0 ? 3.6 : s.rise, over: i === 0 ? 2.4 : s.over, white: last ? 0.3 : s.white });
    e.push(y);
  });
  balcony(L, GX, GZ, t[3][0], t[3][1], e[2]! + 0.4, 1.2, 'black');
  keepTop(L, GX, GZ, t[3][0], t[3][1], y, 1.7, 4.4, 'kawara', 'white', 'charcoal');
  for (const sz of [-1, 1] as const) hafu(L, sz > 0 ? 'z+' : 'z-', GZ + sz * t[0][1], GX, 6.6, e[0]! - 0.3, e[0]! + 4.8, 2.4, 'kawara', 'white');
  for (const sx of [-1, 1] as const) hafu(L, sx > 0 ? 'x+' : 'x-', GX + sx * t[0][0], GZ, 5.4, e[0]! - 0.3, e[0]! + 4.2, 2.4, 'kawara', 'white');
  for (const sz of [-1, 1] as const) hafu(L, sz > 0 ? 'z+' : 'z-', GZ + sz * t[1][1], GX - 3.4, 3, e[1]! - 0.2, e[1]! + 2.6, s.over, 'kawara', 'white');
  hafu(L, 'z+', GZ + t[1][1], GX + 3.4, 3, e[1]! - 0.2, e[1]! + 2.6, s.over, 'kawara', 'white');
  for (const sx of [-1, 1] as const) hafu(L, sx > 0 ? 'x+' : 'x-', GX + sx * t[2][0], GZ, 2.8, e[2]! - 0.2, e[2]! + 2.4, s.over, 'kawara', 'white');

  // The lesser keep on the west: two tiers (four storeys) and its top roof.
  const u = [[8.2, 7.6, 7.2], [6.2, 5.6, 4.4], [4.8, 4.2, 3.6]] as const;
  let v = SB;
  const f: number[] = [];
  u.forEach(([hx, hz, h], i) => {
    const last = i === u.length - 1;
    v = blackTier(L, SX, SZ, hx, hz, v, h, { ...s, wx: 4 - i, wz: 4 - i, rise: last ? 0 : i === 0 ? 3 : 2.4, over: i === 0 ? 2 : 1.6 });
    f.push(v);
  });
  keepTop(L, SX, SZ, u[2][0], u[2][1], v, 1.4, 3.4, 'kawara', 'white', 'charcoal');
  for (const sz of [-1, 1] as const) hafu(L, sz > 0 ? 'z+' : 'z-', SZ + sz * u[0][1], SX, 4.6, f[0]! - 0.3, f[0]! + 3.4, 2, 'kawara', 'white');
  hafu(L, 'x-', SX - u[0][0], SZ, 4, f[0]! - 0.3, f[0]! + 3, 2, 'kawara', 'white');

  // The long turret (多聞櫓) on the enclosure's east edge, the steps up the front wall.
  watari(L, 60, 10, 66, 44, H, 4, 0.3);
  stepsUp(L, 6, 11, 62, 0, 18, 0.44, 0.65);

  // The great ginkgo before the keep, camphor trees on the enclosure and below the walls.
  ginkgo(L, 33, 44, 18);
  for (const [x, z, h, r] of [[8, 8, 18, 4.6], [6, 44, 16, 4], [68, 58, 16, 3.8], [30, 59, 15, 3.6], [56, 58, 14, 3.4]] as const) broadleaf(L, x, z, h, r);

  // The quake's mark: a heap of fallen wall stones at the enclosure's front-right corner (still under repair).
  for (const [x, z, a, h] of [[62, 53, 0.3, 1.6], [66, 52.5, 1.1, 1.2], [64, 55.5, 0.7, 1], [68.5, 54, 0.2, 0.9], [60, 56.5, 1.3, 0.8]] as const) {
    L.box(x - 1.1, 0, z - 0.8, x + 1.1, h, z + 0.8, 'paint', { paint: 'gray', yaw: a });
  }
  // 90 days on: a relief tent and crates on the enclosure, a burnt car at the foot, a fallen sign, scorch.
  L.tent(12, 40, 'x', 7);
  L.crates(56, 41, 4);
  L.car(45, 60, 'x', { burnt: true });
  L.fallenSign(20, 61, 'x');
  L.scorch(GX + 12.22, GB + 0.6, GZ - 3, GX + 12.3, GB + 5, GZ + 3);
}
