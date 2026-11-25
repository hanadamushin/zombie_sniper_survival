// L7: 松山城 (Matsuyama Castle), on the top of Katsuyama in the middle of Matsuyama, Ehime. One of the
// twelve keeps standing since the Edo period (rebuilt 1854): a connected keep (連立式天守) — the main keep
// of three tiers on its own stone base, linked by long single-storey turrets (渡櫓) to the small keep
// (小天守) and the corner turrets (隅櫓) round a closed courtyard, all on the high stone walls of the
// keep enclosure (本壇). Black boards (下見板) up the lower walls and white plaster above, grey tiled
// roofs; the main keep's first roof has a curved gable (唐破風) over the front and plover gables (千鳥破風)
// on the other faces. Pines on the hill.
//
// Real size: the main keep about 20 m on its 天守台, the 本壇's stone walls about 8 m; the enclosure
// about 45 × 40 m. The hill is levelled (the area is shrunk): only the 本壇 and the hilltop are drawn.
// The front (local z = d) faces south, towards the main enclosure (本丸).

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase } from '../tohoku/parts.ts';
import { blackTier, karahafu, type BlackTierStyle } from '../chubu/parts.ts';
import { keepTop } from '../chugoku/parts.ts';
import { turret, watari } from './parts.ts';

const W = 64;
const D = 60;
/** The 本壇 (its stone walls) and its top. */
const B = 8;
const [BX0, BZ0, BX1, BZ1] = [8, 6, 56, 44];
/** The main keep (north-east of the courtyard) and its own stone base. */
const [KX, KZ] = [42, 17];
const KB = B + 2.4;

export const LANDMARK_MATSUYAMA_CASTLE = landmarkDef({
  variant: 'matsuyama_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 24,
  top: KB + 20.6,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[BX0 - 2, BZ1], [BX1 + 2, BZ1], [BX1 + 2, D - 2], [BX0 - 2, D - 2]]);
  // The high stone walls of the 本壇, the courtyard's stone floor on top.
  stoneBase(L, BX0, BZ0, BX1, BZ1, 0, B, 0.1, 4, 'gray');
  stoneBase(L, KX - 8.6, KZ - 7.4, KX + 8.6, KZ + 7.4, B - 0.2, KB, 0.08, 2, 'gray');

  // The main keep: three tiers, black boards up half the wall.
  const s: BlackTierStyle = { roof: 'kawara', over: 1.6, rise: 2.2, wx: 5, wz: 4, white: 0.5, broken: 0.3 };
  const t = [[7.4, 6.2, 6.2], [6, 5, 4.7], [4.8, 4, 4.3]] as const;
  let y = KB;
  const e: number[] = [];
  t.forEach(([hx, hz, h], i) => {
    const last = i === t.length - 1;
    y = blackTier(L, KX, KZ, hx, hz, y, h, { ...s, wx: 5 - i, wz: 4 - i, rise: last ? 0 : s.rise, white: last ? 0.62 : s.white, over: i === 0 ? 1.9 : s.over });
    e.push(y);
  });
  keepTop(L, KX, KZ, t[2][0], t[2][1], y, 1.5, 3.6, 'kawara', 'white', 'charcoal');
  // The curved gable over the front of the first roof, plover gables on its other faces and on the second.
  karahafu(L, 'z+', KZ + t[0][1], KX, 3.6, e[0]! - 0.2, e[0]! + 2.6, 1.9, 'kawara', 'white');
  chidori(L, 'z-', KZ - t[0][1], KX, 4.2, e[0]! - 0.2, e[0]! + 3.2, 1.9, 'kawara');
  for (const sx of [-1, 1] as const) chidori(L, sx > 0 ? 'x+' : 'x-', KX + sx * t[0][0], KZ, 3.8, e[0]! - 0.2, e[0]! + 3, 1.9, 'kawara');
  chidori(L, 'z+', KZ + t[1][1], KX, 3, e[1]! - 0.2, e[1]! + 2.4, s.over, 'kawara');

  // The small keep (north-west), the corner turrets (south-west, south-east), the long turrets between
  // them round the courtyard.
  turret(L, 15, 14, 4.4, 4, B, 2, 4.2);
  turret(L, 15, 38, 3.6, 3.4, B, 2, 4);
  turret(L, 48, 38, 3.4, 3.2, B, 2, 3.8);
  watari(L, 19.4, 11.5, KX - 7.4, 16.5, B, 3.8);
  watari(L, 12.5, 18, 17.5, 34.6, B, 3.6);
  watari(L, 18.6, 35.5, 44.6, 40.5, B, 3.6);
  watari(L, 45.5, 24, 50.5, 34.8, B, 3.6);

  // Pines on the hilltop round the 本壇, the stone path up from the south.
  for (const [x, z, h] of [[3, 4, 11], [61, 4, 12], [3, 30, 10], [61, 30, 11], [4, 54, 9], [60, 54, 10], [24, 56, 9]] as const) pine(L, x, z, h);
  L.box(28, 0, BZ1, 36, 0.25, D, 'paint', { paint: 'stone', solid: false });

  // 90 days on: a relief tent and crates in front of the 本壇, a burnt car, a fallen sign, scorch.
  L.tent(16, 51, 'x', 7);
  L.crates(42, 49, 4);
  L.car(52, 55, 'x', { burnt: true });
  L.fallenSign(32, 52, 'x');
  L.scorch(BX1 - 0.05, 1, 20, BX1 + 0.1, 4.5, 27);
}
