// L5: 彦根城 (Hikone Castle, 1606), Hikone, Shiga — one of the five keeps that are national treasures.
// A small keep of three tiers on its stone base at the top of Konki hill, made rich by its gables: 18
// of them of three kinds on the roofs (切妻・入母屋・唐破風), the bell-shaped windows (花頭窓) of the
// upper floors with gilded frames, and round the top floor the black rail of a balcony (廻縁, for show).
// White walls, grey tiles. The single-storey corridor turret (多聞櫓) and the entrance turret (附櫓)
// run east from it.
//
// Real size: the keep 15.5 m above its 5 m stone base, the first floor about 18 × 12 m. The front
// (local z = d) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase, tier, topRoof, type TierStyle } from '../tohoku/parts.ts';
import { karahafu } from '../chubu/parts.ts';
import { hafu } from './parts.ts';

const W = 64;
const D = 48;
const CX = 24;
const CZ = 22;
const BASE = 5;
const ROOF: PaintName = 'kawara';

export const LANDMARK_HIKONE_CASTLE = landmarkDef({
  variant: 'hikone_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: BASE + 12,
  top: BASE + 17.2,
  roof: 'hip',
  kind: 'house',
  build,
});

/** Bell-shaped windows (花頭窓): dark arches with a gold frame, `n` along a face. */
function bellWindows(L: Lm, face: 'x' | 'z', at: number, out: 1 | -1, u0: number, u1: number, n: number, y0: number, y1: number): void {
  L.windows(face, at, out, u0, u1, n, y0, y1, 1.3, { paint: 'gold', broken: 0 });
  L.windows(face, at + out * 0.08, out, u0, u1, n, y0 + 0.15, y1 - 0.35, 0.9, { paint: 'black', broken: 0 });
  L.windows(face, at + out * 0.08, out, u0, u1, n, y1 - 0.35, y1 - 0.1, 0.5, { paint: 'black', broken: 0 });
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  stoneBase(L, CX - 11.5, CZ - 8, CX + 11.5, CZ + 8, 0, BASE, 0.1, 3, 'gray');
  const s: TierStyle = { wall: 'white', roof: ROOF, over: 1.5, rise: 2.1, wx: 6, wz: 4, broken: 0.2 };
  const e1 = tier(L, CX, CZ, 9.6, 6.2, BASE, 5, s);
  const e2 = tier(L, CX, CZ, 7.4, 4.8, e1, 4.2, { ...s, wx: 0, wz: 0 });
  const e3 = tier(L, CX, CZ, 5.4, 3.6, e2, 3.6, { ...s, wx: 0, wz: 0, rise: 0 });
  // The bell windows of the second and third floors.
  for (const sz of [-1, 1] as const) {
    bellWindows(L, 'x', CZ + sz * 4.8, sz, CX - 6, CX + 6, 3, e1 + 1.3, e1 + 3.2);
    bellWindows(L, 'x', CZ + sz * 3.6, sz, CX - 4, CX + 4, 3, e2 + 0.9, e2 + 2.8);
  }
  // The top floor's balcony rail (black), then the top roof (入母屋) with its ridge fish.
  L.box(CX - 6.2, e2 + 0.1, CZ - 4.4, CX + 6.2, e2 + 0.3, CZ + 4.4, 'paint', { paint: 'black', solid: false });
  for (const sz of [-1, 1]) L.box(CX - 6.2, e2 + 0.3, CZ + sz * 4.4 - 0.06, CX + 6.2, e2 + 1.1, CZ + sz * 4.4 + 0.06, 'paint', { paint: 'black', solid: false });
  for (const sx of [-1, 1]) L.box(CX + sx * 6.2 - 0.06, e2 + 0.3, CZ - 4.4, CX + sx * 6.2 + 0.06, e2 + 1.1, CZ + 4.4, 'paint', { paint: 'black', solid: false });
  topRoof(L, CX, CZ, 5.4, 3.6, e3, 1.5, 3.4, ROOF, 'charcoal');

  // The gables: on the first roof two plain gables (切妻) on each long face and great gables on the ends;
  // on the second roof a curved gable (唐破風) in the middle of each long face and gables either side
  // on the south; gables on the ends of the second roof.
  for (const sz of [-1, 1] as const) {
    const side = sz > 0 ? 'z+' : 'z-';
    hafu(L, side, CZ + sz * 6.2, CX - 4.8, 2.4, e1 - 0.2, e1 + 2.4, s.over, ROOF, 'white');
    hafu(L, side, CZ + sz * 6.2, CX + 4.8, 2.4, e1 - 0.2, e1 + 2.4, s.over, ROOF, 'white');
    karahafu(L, side, CZ + sz * 4.8, CX, 2.6, e2 - 0.2, e2 + 2, s.over, ROOF, 'gold');
  }
  hafu(L, 'z+', CZ + 4.8, CX - 5, 1.8, e2 - 0.2, e2 + 1.9, s.over, ROOF, 'white');
  hafu(L, 'z+', CZ + 4.8, CX + 5, 1.8, e2 - 0.2, e2 + 1.9, s.over, ROOF, 'white');
  for (const sx of [-1, 1] as const) {
    const side = sx > 0 ? 'x+' : 'x-';
    hafu(L, side, CX + sx * 9.6, CZ, 3.6, e1 - 0.2, e1 + 2.8, s.over, ROOF, 'gold');
    hafu(L, side, CX + sx * 7.4, CZ, 2.6, e2 - 0.2, e2 + 2.2, s.over, ROOF, 'white');
  }

  // The entrance turret and the corridor turret running east, on a lower stone base.
  stoneBase(L, CX + 11.5, CZ - 4, 60, CZ + 4, 0, BASE - 1.5, 0.06, 2, 'gray');
  L.box(CX + 11.5, BASE - 1.5, CZ - 3.2, 59, BASE + 2.6, CZ + 3.2, 'paint', { paint: 'white' });
  L.windows('x', CZ + 3.2, 1, CX + 13, 58, 7, BASE + 0.2, BASE + 1.6, 0.9, { broken: 0.2 });
  L.shape('hip', CX + 11, BASE + 2.6, CZ - 4.4, 59.8, BASE + 5, CZ + 4.4, 'paint', { paint: ROOF, axis: 'x' });

  // Pines on the hilltop, the low wall of the enclosure.
  for (const [x, z, h] of [[4, 4, 10], [4, 40, 11], [60, 6, 10], [44, 42, 9], [56, 38, 9]] as const) pine(L, x, z, h);
  L.box(0.4, 0, D - 1.4, 36, 1.6, D - 0.6, 'paint', { paint: 'white' });

  // 90 days on: a relief tent and crates in the enclosure, a fallen sign, scorch on the turret.
  L.tent(46, 36, 'x', 7);
  L.crates(38, 40, 4);
  L.fallenSign(14, 40, 'x');
  L.scorch(50, BASE - 1, CZ + 3.22, 54, BASE + 2, CZ + 3.3);
}
