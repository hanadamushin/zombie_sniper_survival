// L5: 和歌山城 (Wakayama Castle), on Torafusu hill in the middle of Wakayama. The keep group burnt in
// the air raid of 1945 and was rebuilt in concrete in 1958 to its old shape: a linked group (連立式) of
// the three-tier great keep and the two-tier small keep joined by single-storey corridor turrets
// (多聞櫓) and corner turrets round a small courtyard, white walls and grey tiles on high stone walls,
// among the hill's camphor and pine trees.
//
// Real size: the great keep about 23 m on its stone base; the hilltop drawn as a stone-walled platform
// (6 m). The front (local z = d) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase, tier, topRoof, type TierStyle } from '../tohoku/parts.ts';
import { karahafu } from '../chubu/parts.ts';
import { broadleaf } from '../kanto/parts.ts';
import { hafu } from './parts.ts';

const W = 68;
const D = 60;
const P = 6;
const ROOF: PaintName = 'kawara';
const S: TierStyle = { wall: 'white', roof: ROOF, over: 1.7, rise: 2.4, wx: 5, wz: 4, broken: 0.2 };

export const LANDMARK_WAKAYAMA_CASTLE = landmarkDef({
  variant: 'wakayama_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: P + 16,
  top: P + 25,
  roof: 'hip',
  kind: 'house',
  build,
});

/** A single-storey corridor turret from (x0, z0) to (x1, z1) on the platform. */
function tamon(L: Lm, x0: number, z0: number, x1: number, z1: number): void {
  const along = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  L.box(x0, P, z0, x1, P + 4.2, z1, 'paint', { paint: 'white' });
  if (along === 'x') L.windows('x', z1, 1, x0 + 1, x1 - 1, Math.max(2, Math.round((x1 - x0) / 3)), P + 1.6, P + 3, 0.9, { broken: 0.2 });
  else L.windows('z', x1, 1, z0 + 1, z1 - 1, Math.max(2, Math.round((z1 - z0) / 3)), P + 1.6, P + 3, 0.9, { broken: 0.2 });
  L.shape('hip', x0 - 1.2, P + 4.2, z0 - 1.2, x1 + 1.2, P + 6.4, z1 + 1.2, 'paint', { paint: ROOF, axis: along });
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  stoneBase(L, 8, 6, 60, 52, 0, P, 0.16, 3, 'gray');

  // The great keep (north-west corner): its base, three tiers, the top roof.
  const [mx, mz] = [22, 20];
  stoneBase(L, mx - 10, mz - 9, mx + 10, mz + 9, P, P + 3, 0.08, 2, 'gray');
  const e1 = tier(L, mx, mz, 8.6, 7.4, P + 3, 5.4, S);
  const e2 = tier(L, mx, mz, 7, 5.8, e1, 4.8, { ...S, wx: 4, wz: 3 });
  const e3 = tier(L, mx, mz, 5.2, 4.2, e2, 4.4, { ...S, wx: 3, wz: 2, rise: 0 });
  topRoof(L, mx, mz, 5.2, 4.2, e3, 1.7, 4.2, ROOF, 'charcoal');
  for (const sz of [-1, 1] as const) {
    const side = sz > 0 ? 'z+' : 'z-';
    hafu(L, side, mz + sz * 7.4, mx, 4, e1 - 0.2, e1 + 3.2, S.over, ROOF, 'white');
    karahafu(L, side, mz + sz * 5.8, mx, 2.8, e2 - 0.2, e2 + 2.2, S.over, ROOF, 'white');
  }
  for (const sx of [-1, 1] as const) hafu(L, sx > 0 ? 'x+' : 'x-', mx + sx * 8.6, mz, 3.6, e1 - 0.2, e1 + 3, S.over, ROOF, 'white');

  // The small keep (south-east corner): two tiers.
  const [sx0, sz0] = [46, 38];
  const k1 = tier(L, sx0, sz0, 6, 5, P, 4.8, { ...S, wx: 3, wz: 3 });
  const k2 = tier(L, sx0, sz0, 4.4, 3.6, k1, 4, { ...S, wx: 2, wz: 2, rise: 0 });
  topRoof(L, sx0, sz0, 4.4, 3.6, k2, 1.5, 3.4, ROOF, 'charcoal');
  hafu(L, 'z+', sz0 + 5, sx0, 3, k1 - 0.2, k1 + 2.6, S.over, ROOF, 'white');

  // The corridor turrets round the courtyard and the two corner turrets.
  tamon(L, mx + 8.6, mz - 3, sx0 + 3, mz + 3);
  tamon(L, sx0 - 3, mz + 3, sx0 + 3, sz0 - 5);
  tamon(L, mx - 3, mz + 7.4, mx + 3, sz0 + 3);
  tamon(L, mx + 3, sz0 - 3, sx0 - 6, sz0 + 3);
  for (const [x, z] of [[sx0, mz], [mx, sz0]] as const) {
    L.box(x - 4, P, z - 4, x + 4, P + 7, z + 4, 'paint', { paint: 'white' });
    L.shape('hip', x - 5.4, P + 7, z - 5.4, x + 5.4, P + 9.6, z + 5.4, 'paint', { paint: ROOF, axis: 'x' });
  }

  // The hill's trees round the platform.
  for (const [x, z, h] of [[3, 4, 10], [64, 6, 10], [3, 56, 9], [64, 56, 10]] as const) pine(L, x, z, h);
  for (const [x, z] of [[5, 30], [63, 30]] as const) broadleaf(L, x, z, 14, 4.4);

  // 90 days on: relief tents and crates below the stone walls, a fallen sign, scorch on a turret.
  L.tent(16, 57, 'x', 7);
  L.crates(48, 56, 4);
  L.fallenSign(24, 56, 'x');
  L.scorch(sx0 + 6.02, P + 0.5, sz0 - 2, sx0 + 6.1, P + 3.2, sz0 + 2);
}
