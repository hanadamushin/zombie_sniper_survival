// L5: 姫路城 (Himeji Castle, the White Heron Castle 白鷺城), a World Heritage site. The keep group of 1609
// on the top of Himeyama: the great keep (大天守, five tiers outside) and three small keeps (the west,
// the north-west 乾 and the east 小天守) joined by two-storey corridor turrets (渡櫓) round a courtyard
// (the linked style, 連立式). Everything is white: the plastered walls, and the white mortar of the tile
// joints that makes the grey roofs look pale from afar; the roofs pile gable on gable (千鳥破風・唐破風).
//
// Real size: the great keep 31.5 m on a 14.85 m stone base (46.4 m); the first storey about 25 × 21 m.
// The hilltop is drawn as the stone-walled platform the keeps stand on (6 m), the great keep's own base
// on it; the lower enclosure before them. The keeps are about where they stand round the courtyard
// (the great keep south-east). The front (local z = d) faces south (the town and the station).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase, tier, topRoof, type TierStyle } from '../tohoku/parts.ts';
import { karahafu } from '../chubu/parts.ts';
import { hafu } from './parts.ts';

const W = 100;
const D = 92;
/** The platform's top. */
const P = 6;
const ROOF: PaintName = 'lead';
const STYLE: TierStyle = { wall: 'white', roof: ROOF, over: 1.9, rise: 2.8, wx: 6, wz: 5, broken: 0.2 };

export const LANDMARK_HIMEJI_CASTLE = landmarkDef({
  variant: 'himeji_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 36,
  top: 47.2,
  roof: 'hip',
  kind: 'house',
  build,
});

/** A small keep: its base, `hs` tiers (half x, half z, height), the top roof; returns the eaves heights. */
function keep(L: Lm, cx: number, cz: number, y0: number, hs: readonly (readonly [number, number, number])[], s: TierStyle): number[] {
  let y = y0;
  const eaves: number[] = [];
  hs.forEach(([hx, hz, h], i) => {
    const last = i === hs.length - 1;
    y = tier(L, cx, cz, hx, hz, y, h, { ...s, rise: last ? 0 : s.rise, wx: Math.max(2, Math.round(hx * 0.6)), wz: Math.max(2, Math.round(hz * 0.6)) });
    eaves.push(y);
  });
  const [hx, hz] = [hs[hs.length - 1]![0], hs[hs.length - 1]![1]];
  topRoof(L, cx, cz, hx, hz, y, s.over, s.rise * 1.6, s.roof, 'charcoal');
  return eaves;
}

/** A corridor turret (渡櫓): two storeys of white wall under a hipped roof, from (x0, z0) to (x1, z1). */
function corridor(L: Lm, x0: number, z0: number, x1: number, z1: number): void {
  L.box(x0, P, z0, x1, P + 7.5, z1, 'paint', { paint: 'white' });
  const along = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  if (along === 'x') {
    L.windows('x', z1, 1, x0 + 1, x1 - 1, Math.round((x1 - x0) / 3.2), P + 4, P + 5.8, 0.9, { broken: 0.2 });
    L.windows('x', z0, -1, x0 + 1, x1 - 1, Math.round((x1 - x0) / 3.2), P + 4, P + 5.8, 0.9, { broken: 0.2 });
  } else {
    L.windows('z', x1, 1, z0 + 1, z1 - 1, Math.round((z1 - z0) / 3.2), P + 4, P + 5.8, 0.9, { broken: 0.2 });
    L.windows('z', x0, -1, z0 + 1, z1 - 1, Math.round((z1 - z0) / 3.2), P + 4, P + 5.8, 0.9, { broken: 0.2 });
  }
  L.box(x0 - 1.4, P + 7.3, z0 - 1.4, x1 + 1.4, P + 7.5, z1 + 1.4, 'paint', { paint: ROOF, solid: false });
  L.shape('hip', x0 - 1.4, P + 7.5, z0 - 1.4, x1 + 1.4, P + 10.5, z1 + 1.4, 'paint', { paint: ROOF, axis: along });
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The hilltop's stone-walled platform (grey stone leaning back), the courtyard on it.
  stoneBase(L, 12, 4, 92, 70, 0, P, 0.18, 3, 'gray');

  // The corridors round the courtyard, then the three small keeps at three corners.
  const [wx, wz] = [32, 48]; // west small keep
  const [nx, nz] = [32, 18]; // the north-west (乾) small keep
  const [ex, ez] = [62, 14]; // east small keep
  const [mx, mz] = [64, 44]; // the great keep
  corridor(L, wx - 3.5, nz + 5, wx + 3.5, wz - 5);
  corridor(L, nx + 6, nz - 3.5, ex - 5, nz + 3.5);
  corridor(L, ex - 3.5, ez + 5, ex + 3.5, mz - 12);
  corridor(L, wx + 5, wz - 3.5, mx - 13, wz + 3.5);
  const small: TierStyle = { ...STYLE, over: 1.5, rise: 2.2 };
  keep(L, wx, wz, P, [[6.5, 5.5, 4.8], [5.4, 4.4, 4.2], [4, 3.2, 3.8]], small);
  const ne = keep(L, nx, nz, P, [[7, 6, 4.8], [6, 5, 4.4], [4.8, 3.8, 4], [3.6, 2.8, 3.4]], small);
  hafu(L, 'z+', nz + 6, nx, 3.4, ne[0]! - 0.2, ne[0]! + 2.6, small.over, ROOF, 'white');
  keep(L, ex, ez, P, [[6, 5, 4.6], [5, 4, 4.2], [3.8, 3, 3.8]], small);

  // The great keep: its own stone base, five tiers, the top roof (入母屋) with the ridge fish.
  const B = P + 9;
  stoneBase(L, mx - 15, mz - 13, mx + 15, mz + 13, P, B, 0.14, 3, 'gray');
  const hs: [number, number, number][] = [[12.5, 10.5, 6.2], [11.8, 9.8, 5.8], [10, 8, 5.2], [8, 6.2, 4.8], [6.2, 4.8, 4.4]];
  let y = B;
  const e: number[] = [];
  hs.forEach(([hx, hz, h], i) => {
    const last = i === hs.length - 1;
    y = tier(L, mx, mz, hx, hz, y, h, { ...STYLE, rise: last ? 0 : STYLE.rise, over: i === 0 ? 2.3 : STYLE.over, wx: Math.round(hx * 0.6), wz: Math.round(hz * 0.6) });
    e.push(y);
  });
  topRoof(L, mx, mz, 6.2, 4.8, y, 2, 4.8, ROOF, 'charcoal');
  // The gables, white-boarded: a great one on each face of the first roof, two on the long faces of the
  // second, a curved gable with gables either side on the third's south face, gables on the fourth.
  for (const sz of [-1, 1] as const) {
    const side = sz > 0 ? 'z+' : 'z-';
    hafu(L, side, mz + sz * hs[0]![1], mx, 6.5, e[0]! - 0.2, e[0]! + 4.4, 2.3, ROOF, 'white');
    hafu(L, side, mz + sz * hs[1]![1], mx - 5.5, 3.6, e[1]! - 0.2, e[1]! + 3, STYLE.over, ROOF, 'white');
    hafu(L, side, mz + sz * hs[1]![1], mx + 5.5, 3.6, e[1]! - 0.2, e[1]! + 3, STYLE.over, ROOF, 'white');
    if (sz > 0) karahafu(L, side, mz + sz * hs[2]![1], mx, 3.4, e[2]! - 0.2, e[2]! + 2.6, STYLE.over, ROOF, 'white');
    else hafu(L, side, mz + sz * hs[2]![1], mx, 3.6, e[2]! - 0.2, e[2]! + 3, STYLE.over, ROOF, 'white');
    hafu(L, side, mz + sz * hs[3]![1], mx, 3, e[3]! - 0.2, e[3]! + 2.6, STYLE.over, ROOF, 'white');
  }
  for (const sx of [-1, 1] as const) {
    const side = sx > 0 ? 'x+' : 'x-';
    hafu(L, side, mx + sx * hs[0]![0], mz, 6, e[0]! - 0.2, e[0]! + 4.2, 2.3, ROOF, 'white');
    hafu(L, side, mx + sx * hs[2]![0], mz, 3.6, e[2]! - 0.2, e[2]! + 3, STYLE.over, ROOF, 'white');
  }

  // The lower enclosure before the platform: a white earthen wall with a tiled top, pines.
  L.box(4, 0, 84, 70, 1.8, 85, 'paint', { paint: 'white' });
  L.shape('gable', 4, 1.8, 83.6, 70, 2.5, 85.4, 'paint', { paint: ROOF, axis: 'x', solid: false });
  for (const [x, z, h] of [[6, 8, 10], [6, 40, 11], [6, 66, 9], [96, 20, 10], [96, 56, 11], [80, 78, 9], [20, 76, 9]] as const) pine(L, x, z, h);

  // 90 days on: relief tents and crates in the lower enclosure, a burnt car, a fallen sign, scorch.
  L.tent(44, 78, 'x', 8);
  L.tent(56, 78, 'x', 8);
  L.crates(84, 86, 5);
  L.car(90, 76, 'z', { burnt: true });
  L.fallenSign(30, 88, 'x');
  L.scorch(wx - 6.52, P + 0.5, wz - 2, wx - 6.48, P + 3.5, wz + 2);
}
