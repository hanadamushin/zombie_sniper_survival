// L7: 高知城 (Kōchi Castle), on Ōtakasaka-yama in the middle of Kōchi. One of the twelve keeps standing
// since the Edo period (1747), and the only castle whose main palace (本丸御殿, 懐徳館) still stands
// joined to its keep. The keep has four tiers (six storeys): white plaster under grey tiles, a big
// hip-and-gable first roof with plover gables (千鳥破風), and round the top storey the railed balcony
// (廻縁高欄) that marks it from afar. Below, at the foot of the hill, the gate tower 追手門 (Ōtemon)
// between its stone walls, with the keep seen over it — the castle's best-known view.
//
// Real size: the keep 18.5 m on the main enclosure (本丸), 44 m up the hill, the Ōtemon 260 m east of
// it. The hill is levelled (the area is shrunk): the enclosure is drawn as a terrace 10 m high with
// stone walls and steps, the Ōtemon in front of it. The front (local z = d, the Ōtemon) faces east.

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase, tier, type TierStyle } from '../tohoku/parts.ts';
import { karahafu } from '../chubu/parts.ts';
import { broadleaf } from '../kanto/parts.ts';
import { keepTop } from '../chugoku/parts.ts';
import { balcony, stepsUp, watari } from './parts.ts';

const W = 56;
const D = 64;
/** The main enclosure: a terrace with stone walls. */
const H = 10;
const [EX0, EZ0, EX1, EZ1] = [4, 4, 52, 40];
const [KX, KZ] = [21, 18];
/** The Ōtemon's stone walls (z) and its passage (x). */
const GZ = 53;
const [GX0, GX1] = [23, 33];

export const LANDMARK_KOCHI_CASTLE = landmarkDef({
  variant: 'kochi_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: H + 14,
  top: H + 19.6,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  stoneBase(L, EX0, EZ0, EX1, EZ1, 0, H, 0.08, 3, 'gray');

  // The keep: four tiers of white plaster, grey tiles.
  const s: TierStyle = { wall: 'white', roof: 'kawara', over: 1.6, rise: 2.1, wx: 5, wz: 4, broken: 0.3 };
  const t = [[7.2, 6.2, 5.6], [5.8, 5, 3.2], [4.7, 4, 3.1], [3.9, 3.3, 3]] as const;
  let y = H;
  const e: number[] = [];
  t.forEach(([hx, hz, h], i) => {
    const last = i === t.length - 1;
    y = tier(L, KX, KZ, hx, hz, y, h, { ...s, wx: 5 - i, wz: 4 - i, rise: last ? 0 : i === 0 ? 2.8 : s.rise, over: i === 0 ? 2 : s.over });
    e.push(y);
  });
  // The railed balcony round the top storey (floor at the third roof's eaves), the top roof.
  balcony(L, KX, KZ, t[3][0], t[3][1], e[2]! + 0.5, 1.1, 'charcoal');
  keepTop(L, KX, KZ, t[3][0], t[3][1], y, 1.5, 3.2, 'kawara', 'white', 'charcoal');
  // The big gables of the first roof (its hip-and-gable shape), the curved gable over its front.
  for (const sz of [-1, 1] as const) chidori(L, sz > 0 ? 'z+' : 'z-', KZ + sz * t[0][1], KX, 5.2, e[0]! - 0.2, e[0]! + 3.6, 2, 'kawara');
  karahafu(L, 'x+', KX + t[0][0], KZ, 3.2, e[0]! - 0.2, e[0]! + 2.4, 2, 'kawara', 'white');
  chidori(L, 'x-', KX - t[0][0], KZ, 3.6, e[0]! - 0.2, e[0]! + 3, 2, 'kawara');
  chidori(L, 'x+', KX + t[1][0], KZ, 2.6, e[1]! - 0.2, e[1]! + 2.2, s.over, 'kawara');

  // The main palace (懐徳館) joined to the keep's east side: one storey of white walls under grey tiles.
  L.box(KX + 7.2, H, KZ - 5, KX + 22, H + 4.2, KZ + 6, 'paint', { paint: 'white' });
  L.windows('x', KZ + 6, 1, KX + 8.5, KX + 21, 5, H + 1, H + 3.2, 1.8, { paint: 'brown', broken: 0.3 });
  L.shape('hip', KX + 6.4, H + 4.2, KZ - 6.2, KX + 23.2, H + 6.6, KZ + 7.2, 'paint', { paint: 'kawara', axis: 'x' });
  L.shape('gable', KX + 9, H + 5.6, KZ - 3.6, KX + 20.6, H + 7.6, KZ + 4.6, 'paint', { paint: 'kawara', axis: 'x' });
  // The enclosure's low turret walls (多聞櫓) along its north edge, white plaster.
  watari(L, EX0 + 2, EZ0 + 1, EX0 + 22, EZ0 + 5, H, 3.4, 1);

  // The steps up the enclosure's front, between the gate and the terrace.
  stepsUp(L, 26, 31, GZ - 3, 0, 23, 0.44, 0.42);

  // The Ōtemon: stone walls either side of the passage, the gate tower over it (black boards, white
  // plaster, grey tiles).
  stoneBase(L, 6, GZ - 3, GX0, GZ + 3, 0, 5.2, 0.05, 2, 'gray');
  stoneBase(L, GX1, GZ - 3, 50, GZ + 3, 0, 5.2, 0.05, 2, 'gray');
  for (const x of [GX0 + 0.6, GX1 - 0.6]) L.box(x - 0.45, 0, GZ - 1.2, x + 0.45, 5.2, GZ + 1.2, 'woodDark');
  L.box(GX0 + 1, 0.2, GZ + 0.6, GX1 - 1, 4.6, GZ + 0.8, 'doorSteel');
  watari(L, GX0 - 5, GZ - 3, GX1 + 5, GZ + 3, 5.2, 3.8, 0.55);

  // Pines and camphor trees on the hill, round the enclosure and by the gate.
  for (const [x, z, h] of [[3.6, 45, 10], [53, 45, 9], [10, 60, 8], [46, 60, 8]] as const) pine(L, x, z, h);
  for (const [x, z] of [[2.4, 10], [53.6, 8], [53.6, 30], [2.4, 32]] as const) broadleaf(L, x, z, 15, 2.6);

  // 90 days on: relief tents and crates on the enclosure, a burnt car before the gate, a fallen sign.
  L.tent(42, 32, 'x', 7);
  L.crates(34, 34, 4);
  L.car(44, 61, 'x', { burnt: true });
  L.fallenSign(14, 59, 'x');
  L.scorch(GX1 + 0.02, 0.6, GZ + 3.02, GX1 + 4, 3.6, GZ + 3.1);
}
