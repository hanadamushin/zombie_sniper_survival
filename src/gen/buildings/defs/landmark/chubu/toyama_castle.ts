// L4: 富山城 (Toyama Castle). The keep in the castle park was built in 1954 (concrete; the castle had
// no keep of record) to the look of a late castle: a three-tier main keep with a two-tier small keep
// (小天守) to its east, white walls and grey tiles, a curved gable (唐破風) over the main keep's first
// roof and gables (千鳥破風) above it; they stand on the stone wall of the main enclosure that rises out
// of the moat (内堀) south of it, the city's main street beyond.
//
// Real size: about 21 m from the moat's water to the top of the ridge fish. The front (local z = d,
// the moat) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase, tier, topRoof, type TierStyle } from '../tohoku/parts.ts';
import { karahafu, maple } from './parts.ts';

const W = 60;
const D = 52;
const MOAT_Z = 38;
const BASE = 5;
const CX = 26;
const CZ = 24;

export const LANDMARK_TOYAMA_CASTLE = landmarkDef({
  variant: 'toyama_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 15,
  top: BASE + 17.8,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, MOAT_Z], [0, MOAT_Z]]);
  L.ground('water', [[0, MOAT_Z], [W, MOAT_Z], [W, D], [0, D]], 2.2, 1);

  // The enclosure's stone wall along the moat, and the keep's base on it.
  stoneBase(L, 0, MOAT_Z - 5, W, MOAT_Z, 0, BASE - 1.2, 0.06, 3, 'gray');
  stoneBase(L, CX - 9.5, CZ - 8.5, 52, CZ + 8.5, 0, BASE, 0.08, 3, 'gray');

  const s: TierStyle = { wall: 'white', roof: 'kawara', over: 1.4, rise: 1.7, wx: 4, wz: 3, broken: 0.3 };
  const y1 = tier(L, CX, CZ, 7.8, 6.8, BASE, 4.8, { ...s, wx: 5, wz: 4 });
  karahafu(L, 'z+', CZ + 6.8, CX, 3.2, y1 - 0.2, y1 + 2.6, s.over, 'kawara');
  const y2 = tier(L, CX, CZ, 6.2, 5.3, y1, 4.4, s);
  chidori(L, 'z+', CZ + 5.3, CX, 3, y2 - 0.2, y2 + 2.6, s.over, 'kawara');
  chidori(L, 'x-', CX - 6.2, CZ, 2.8, y2 - 0.2, y2 + 2.4, s.over, 'kawara');
  const y3 = tier(L, CX, CZ, 4.5, 3.8, y2, 3.8, { ...s, rise: 0, wx: 3, wz: 2 });
  topRoof(L, CX, CZ, 4.5, 3.8, y3, 1.3, 3.8, 'kawara', 'charcoal');

  // The small keep to the east: two tiers, lower, joined to the main keep's side.
  const [kx, kz] = [42, CZ + 1];
  const k1 = tier(L, kx, kz, 6, 5.4, BASE, 4.2, { ...s, wx: 4, wz: 3 });
  chidori(L, 'z+', kz + 5.4, kx, 2.6, k1 - 0.2, k1 + 2.3, s.over, 'kawara');
  const k2 = tier(L, kx, kz, 4.2, 3.8, k1, 3.4, { ...s, rise: 0, wx: 2, wz: 2 });
  topRoof(L, kx, kz, 4.2, 3.8, k2, 1.2, 3, 'kawara', 'charcoal');

  // Pines along the moat's wall, a maple in the park, a bench of the park.
  for (const [x, z, h] of [[4, 30, 9], [56, 30, 10], [8, 6, 10], [54, 6, 9]] as const) pine(L, x, z, h);
  maple(L, 14, 10, 7, 3);

  // 90 days on: the park was a relief site — tents and crates behind the keep, a burnt-out car, a
  // fallen sign; scorch on the small keep's wall.
  L.tent(26, 6, 'x', 7);
  L.tent(36, 6, 'x', 7);
  L.crates(46, 8, 4);
  L.car(6, 19, 'z', { burnt: true });
  L.fallenSign(10, 31, 'x');
  L.scorch(kx + 6.02, BASE + 0.4, kz - 3, kx + 6.1, BASE + 3.4, kz + 1);
}
