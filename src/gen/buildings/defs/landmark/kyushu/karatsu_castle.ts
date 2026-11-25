// L8: 唐津城 (Karatsu Castle, "舞鶴城"), on Mt Mitsushima at the mouth of the Matsuura River, Karatsu, Saga.
// The keep of 1966 (a reconstruction in the manner of the early Edo period) stands on the hilltop over
// the sea: five tiers of white plaster under grey tiles, slim and tall, plover gables (千鳥破風) and a
// curved gable (唐破風) on its front, on a stone base over the hill's stone walls; a small corner
// turret on the enclosure's edge, pines all round (the castle's wings are the pine beaches either side).
//
// Real size: the keep about 22 m on its stone base. The hilltop is levelled (the area is shrunk) into
// an enclosure 4.5 m high with stone walls and a flight of steps. The front (local z = d) faces south,
// over the town.

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase, tier, topRoof, type TierStyle } from '../tohoku/parts.ts';
import { karahafu } from '../chubu/parts.ts';
import { stepsUp, turret } from '../shikoku/parts.ts';

const W = 48;
const D = 48;
const [KX, KZ] = [24, 19];
const H = 4.4;
const BASE = H + 2.6;

export const LANDMARK_KARATSU_CASTLE = landmarkDef({
  variant: 'karatsu_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: BASE + 17,
  top: BASE + 22,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The enclosure's stone walls on the hilltop, the keep's stone base on it.
  stoneBase(L, 6, 5, 42, 35, 0, H, 0.08, 3, 'gray');
  stoneBase(L, KX - 9.4, KZ - 8.4, KX + 9.4, KZ + 8.4, H, BASE, 0.1, 2, 'gray');

  // The keep: five tiers of white plaster, grey tiles, each a size smaller.
  const s: TierStyle = { wall: 'white', roof: 'kawara', over: 1.5, rise: 2, wx: 5, wz: 4, broken: 0.3 };
  const t = [[8, 7, 4.4], [6.6, 5.8, 3.6], [5.4, 4.7, 3.3], [4.4, 3.8, 3.1], [3.6, 3.1, 2.9]] as const;
  let y = BASE;
  const e: number[] = [];
  t.forEach(([hx, hz, h], i) => {
    const last = i === t.length - 1;
    y = tier(L, KX, KZ, hx, hz, y, h, { ...s, wx: Math.max(2, 5 - i), wz: Math.max(2, 4 - i), rise: last ? 0 : i === 0 ? 2.6 : s.rise, over: i === 0 ? 1.8 : s.over });
    e.push(y);
  });
  topRoof(L, KX, KZ, t[4][0], t[4][1], y, 1.4, 3.2, 'kawara', 'charcoal');
  // The gables: plover gables on the first roof (front and back), a curved one on the second's front,
  // plover gables on the third roof's sides.
  for (const sz of [-1, 1] as const) chidori(L, sz > 0 ? 'z+' : 'z-', KZ + sz * t[0][1], KX, 4.6, e[0]! - 0.2, e[0]! + 3.2, 1.8, 'kawara');
  karahafu(L, 'z+', KZ + t[1][1], KX, 2.8, e[1]! - 0.2, e[1]! + 2.2, s.over, 'kawara', 'white');
  for (const sx of [-1, 1] as const) chidori(L, sx > 0 ? 'x+' : 'x-', KX + sx * t[2][0], KZ, 2.6, e[2]! - 0.2, e[2]! + 2.1, s.over, 'kawara');

  // A small corner turret on the enclosure's front edge, a white wall along it.
  turret(L, 11.5, 30, 3.4, 2.8, H, 2, 3.2, 0.92);
  L.box(16, H, 33.6, 21, H + 2, 34.4, 'paint', { paint: 'white' });
  L.box(27, H, 33.6, 40, H + 2, 34.4, 'paint', { paint: 'white' });
  // The steps up the enclosure's front.
  stepsUp(L, 22, 26, 44.4, 0, 10, 0.44, 0.94);

  // Pines on the hill round the enclosure.
  for (const [x, z, h] of [[2.5, 4, 9], [45, 4, 10], [2.5, 22, 10], [45.5, 20, 9], [3, 40, 8], [45, 40, 9], [14, 44, 8], [34, 44, 8], [24, 2, 9]] as const) pine(L, x, z, h);

  // 90 days on: a relief tent and crates in the enclosure, a burnt car at the foot, a fallen sign.
  L.tent(36, 9, 'z', 6);
  L.crates(33, 29, 4);
  L.car(38, 45, 'x', { burnt: true });
  L.fallenSign(10, 45, 'x');
  L.scorch(KX + 8.02, BASE + 0.6, KZ - 2, KX + 8.1, BASE + 3.4, KZ + 2.5);
}
