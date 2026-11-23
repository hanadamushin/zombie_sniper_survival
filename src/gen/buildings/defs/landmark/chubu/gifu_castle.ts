// L4: 岐阜城 (Gifu Castle) on the summit of Mount Kinka (329 m), Oda Nobunaga's castle over the Nōbi
// plain. The keep of 1956 (concrete, after the old one burnt in 1943): three tiers and four floors,
// about 18 m, white walls and grey tiles, the top floor ringed by its railed gallery (廻縁と高欄) looking
// over the plain; it sits on a low stone base among the rocks and the evergreen woods of the summit,
// with the small white storehouse of the castle's museum (資料館) below it.
//
// Real size. The summit is the area's hill top, levelled under the lot. The front (local z = d)
// faces south-west over the city — here south.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';
import { pine, stoneBase, tier, topRoof, type TierStyle } from '../tohoku/parts.ts';
import { karahafu } from './parts.ts';

const W = 44;
const D = 44;
const CX = 22;
const CZ = 18;
const BASE = 2.6;

export const LANDMARK_GIFU_CASTLE = landmarkDef({
  variant: 'gifu_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 12,
  top: BASE + 18.6,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[8, 6], [36, 6], [36, 34], [8, 34]]);
  // Rocks of the summit (chert), half buried round the stone base.
  for (const [x0, z0, x1, z1, h] of [[2, 4, 8, 11, 2.6], [34, 30, 41, 37, 2.6], [2, 30, 7, 38, 2], [39, 18, 43.4, 24, 2.8]] as const) {
    L.shape('cyl', x0, 0, z0, x1, h, z1, 'paint', { paint: 'gray' }).taper = 0.6;
  }
  stoneBase(L, CX - 9, CZ - 8, CX + 9, CZ + 8, 0, BASE, 0.08, 2, 'gray');
  const s: TierStyle = { wall: 'white', roof: 'kawara', over: 1.3, rise: 1.6, wx: 4, wz: 3, broken: 0.3 };
  const y1 = tier(L, CX, CZ, 7.6, 6.6, BASE, 4.6, { ...s, wx: 5, wz: 4 });
  karahafu(L, 'z+', CZ + 6.6, CX, 2.8, y1 - 0.2, y1 + 2.2, s.over, 'kawara');
  const y2 = tier(L, CX, CZ, 6.2, 5.2, y1, 4.2, s);
  L.shape('gable', CX - 6.6, y2 - 0.2, CZ - 2.6, CX - 5, y2 + 2.4, CZ + 2.6, 'paint', { paint: 'kawara', axis: 'x', solid: false });
  L.shape('gable', CX + 5, y2 - 0.2, CZ - 2.6, CX + 6.6, y2 + 2.4, CZ + 2.6, 'paint', { paint: 'kawara', axis: 'x', solid: false });
  const y3 = tier(L, CX, CZ, 4.4, 3.8, y2, 3.6, { ...s, rise: 0, wx: 3, wz: 3 });
  // The top floor's gallery: a ledge round it with a black railing, above the second roof.
  L.box(CX - 5.6, y3 - 2, CZ - 5, CX + 5.6, y3 - 1.75, CZ + 5, 'woodDark');
  for (const [x0, z0, x1, z1] of [[CX - 5.6, CZ - 5, CX + 5.6, CZ - 4.85], [CX - 5.6, CZ + 4.85, CX + 5.6, CZ + 5], [CX - 5.6, CZ - 5, CX - 5.45, CZ + 5], [CX + 5.45, CZ - 5, CX + 5.6, CZ + 5]] as const) {
    L.box(x0, y3 - 1.75, z0, x1, y3 - 0.9, z1, 'paint', { paint: 'black', solid: false });
  }
  topRoof(L, CX, CZ, 4.4, 3.8, y3, 1.3, 3.6, 'kawara', 'charcoal');

  // The museum's white storehouse (資料館) north-east behind the keep, its tile roof.
  L.box(32, 0, 1.5, 42, 5, 8.5, 'paint', { paint: 'white' });
  L.box(32, 0, 1.5, 42, 1.4, 8.5, 'paint', { paint: 'kawara' });
  L.shape('gable', 31.4, 5, 0.9, 42.6, 7.4, 9.1, 'paint', { paint: 'kawara', axis: 'x' });
  L.box(35.5, 0, 8.5, 38.5, 2.8, 8.6, 'doorSteel');

  // The summit's evergreen woods (シイ・カシ) and a few pines.
  for (const [x, z, h, r] of [[4, 18, 9, 3], [40, 12, 9, 3], [4, 41, 8, 2.8], [41, 41, 8, 2.8], [16, 3, 9, 2.8], [26, 3, 8, 2.6]] as const) broadleaf(L, x, z, h, r);
  pine(L, 6, 26, 9);
  pine(L, 38, 26, 8);

  // 90 days on: the last refuge on the summit — a tent and crates on the gravel, sandbags at the
  // path's head, a fallen sign; broken windows and a scorch on the keep.
  L.tent(14, 30, 'x', 6);
  L.crates(22, 31, 3);
  L.sandbags(2, 42, 9, 42);
  L.fallenSign(26, 40, 'x');
  L.scorch(CX - 7.65, BASE + 0.5, CZ - 2, CX - 7.57, BASE + 3.8, CZ + 3);
}
