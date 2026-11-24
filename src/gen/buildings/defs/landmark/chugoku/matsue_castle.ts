// L6: 松江城 (Matsue Castle, the "plover castle" 千鳥城), Matsue, Shimane, a national treasure. One of
// the twelve keeps standing since the Edo period (1611): four tiers outside (five storeys and a
// basement), black boards (下見板) over the lower walls and white plaster above, grey tiled roofs whose
// many gables (千鳥破風) spread like a plover's wings, bell-shaped windows (花頭窓) on the lookout storey
// at the top, plain dark ridge fish; the attached entrance turret (附櫓) on the south, on a stone base
// on the hilltop of Kameda-yama among pines.
//
// Real size: the keep 22.4 m on an 8 m stone base (30 m), the first storey about 25 × 21 m (drawn a
// little smaller). The front (local z = d) faces south, with the entrance turret.

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase } from '../tohoku/parts.ts';
import { blackTier, type BlackTierStyle } from '../chubu/parts.ts';
import { keepTop } from './parts.ts';

const W = 64;
const D = 60;
const CX = 32;
const CZ = 24;
const BASE = 7.6;

export const LANDMARK_MATSUE_CASTLE = landmarkDef({
  variant: 'matsue_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 24,
  top: BASE + 23.4,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  stoneBase(L, CX - 13.5, CZ - 11.5, CX + 13.5, CZ + 11.5, 0, BASE, 0.12, 3, 'gray');
  // The entrance turret's lower base on the south.
  stoneBase(L, CX - 6, CZ + 10, CX + 6, CZ + 20, 0, BASE - 2.6, 0.1, 2, 'gray');

  const s: BlackTierStyle = { roof: 'kawara', over: 1.7, rise: 2.4, wx: 7, wz: 6, white: 0.32, broken: 0.3 };
  // The first tier (two storeys under one roof), three tiers above, the lookout storey with its bell windows.
  let y = blackTier(L, CX, CZ, 11.5, 9.5, BASE, 7.4, { ...s, rise: 3 });
  const e1 = y;
  y = blackTier(L, CX, CZ, 9, 7.4, y, 4.2, { ...s, wx: 5, wz: 4 });
  const e2 = y;
  y = blackTier(L, CX, CZ, 7.2, 5.8, y, 3.9, { ...s, wx: 4, wz: 3 });
  y = blackTier(L, CX, CZ, 5.8, 4.8, y, 3.6, { ...s, wx: 0, wz: 0, rise: 0, white: 0.55 });
  // The bell-shaped windows: dark with a pointed top, two on each long face.
  for (const sz of [-1, 1] as const) {
    for (const u of [-2.4, 2.4]) {
      const z = CZ + sz * 4.8 + sz * 0.04;
      L.box(CX + u - 0.7, y - 3.2, Math.min(z, z + sz * 0.08), CX + u + 0.7, y - 1.4, Math.max(z, z + sz * 0.08), 'paint', { paint: 'charcoal', solid: false });
      L.shape('gable', CX + u - 0.7, y - 1.4, Math.min(z, z + sz * 0.08), CX + u + 0.7, y - 0.8, Math.max(z, z + sz * 0.08), 'paint', { paint: 'charcoal', axis: 'z', solid: false });
    }
  }
  keepTop(L, CX, CZ, 5.8, 4.8, y, 1.5, 3.4, 'kawara', 'white', 'charcoal');

  // The plover gables: big ones on all four faces of the first roof, a pair on the second.
  for (const sz of [-1, 1] as const) {
    chidori(L, sz > 0 ? 'z+' : 'z-', CZ + sz * 9.5, CX, 5.4, e1 - 0.2, e1 + 3.8, 2, 'kawara');
    chidori(L, sz > 0 ? 'z+' : 'z-', CZ + sz * 7.4, CX - 3.6, 2.6, e2 - 0.2, e2 + 2.4, 1.7, 'kawara');
    chidori(L, sz > 0 ? 'z+' : 'z-', CZ + sz * 7.4, CX + 3.6, 2.6, e2 - 0.2, e2 + 2.4, 1.7, 'kawara');
  }
  for (const sx of [-1, 1] as const) chidori(L, sx > 0 ? 'x+' : 'x-', CX + sx * 11.5, CZ, 4.6, e1 - 0.2, e1 + 3.4, 2, 'kawara');

  // The entrance turret (附櫓): one black storey under its own hipped roof, against the keep's south face.
  const k = blackTier(L, CX, CZ + 15, 5.2, 4.4, BASE - 2.6, 5.6, { ...s, wx: 3, wz: 2, rise: 0, white: 0.3 });
  L.box(CX - 6.6, k - 0.25, CZ + 9, CX + 6.6, k, CZ + 20.9, 'paint', { paint: 'white', solid: false });
  L.shape('hip', CX - 6.6, k, CZ + 9, CX + 6.6, k + 3, CZ + 20.9, 'paint', { paint: 'kawara', axis: 'z' });

  // The pines of Kameda-yama, the stone steps up from the south.
  for (const [x, z, h] of [[6, 6, 12], [58, 6, 11], [6, 40, 12], [58, 40, 11], [12, 54, 10], [52, 54, 10], [32, 4, 11]] as const) pine(L, x, z, h);
  L.box(CX - 3, 0, 46, CX + 3, 0.3, D, 'paint', { paint: 'stone', solid: false });

  // 90 days on: a relief tent and crates on the hilltop, a burnt car, a fallen sign, scorch on the base.
  L.tent(12, 30, 'z', 7);
  L.crates(52, 28, 4);
  L.car(46, 52, 'x', { burnt: true });
  L.fallenSign(24, 52, 'x');
  L.scorch(CX - 13.55, 1, CZ - 4, CX - 13.4, 4, CZ + 2);
}
