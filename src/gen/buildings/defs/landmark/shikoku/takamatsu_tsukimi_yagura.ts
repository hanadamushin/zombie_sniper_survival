// L7: 高松城（玉藻城）月見櫓 (the Moon-viewing Turret of Takamatsu Castle, "Tamamo Castle"), Tamamo Park,
// Takamatsu, Kagawa. One of Japan's three great sea castles: its moats are filled by the sea. The
// three-tier corner turret of 1676 (an important cultural property) stands on the stone wall at the
// water's edge, with the water gate (水手御門) beside it, where boats came in from the sea, and the
// single-storey long turret (渡櫓) beyond it. White plaster over black boards at the foot of the walls,
// grey tiled roofs, a curved gable (唐破風) and plover gables (千鳥破風) on the first roof.
//
// Real size: the turret about 13 m on its stone wall; the three together about 45 m along the water.
// Only the turret, the gate, the long turret, their stone wall and the strip of sea moat are drawn
// (the park is 300 m across). The front (local z = d, the moat and the sea) faces north.

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase } from '../tohoku/parts.ts';
import { blackTier, karahafu, type BlackTierStyle } from '../chubu/parts.ts';
import { keepTop } from '../chugoku/parts.ts';
import { watari } from './parts.ts';

const W = 48;
const D = 40;
/** The water's edge (the stone wall's face) and the moat beyond it. */
const EDGE = 29;
const B = 3.4;
const [TX, TZ] = [13, 21];

export const LANDMARK_TAKAMATSU_TSUKIMI_YAGURA = landmarkDef({
  variant: 'takamatsu_tsukimi_yagura',
  size: { w: [W, W], d: [D, D] },
  eaves: B + 10.6,
  top: B + 14.4,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, EDGE], [0, EDGE]]);
  L.ground('water', [[0, EDGE], [W, EDGE], [W, D], [0, D]], 2.6, 1.2);
  // The stone wall along the water (from the moat's bottom), the turret's own stone base.
  L.box(0, -2.6, EDGE - 2, W, B, EDGE, 'paint', { paint: 'gray' });
  stoneBase(L, TX - 7.4, TZ - 7, TX + 7.4, EDGE, 0, B, 0.06, 2, 'gray');

  // The turret: three tiers, white plaster over a band of black boards at the foot.
  const s: BlackTierStyle = { roof: 'kawara', over: 1.5, rise: 1.9, wx: 4, wz: 4, white: 0.72, broken: 0.3 };
  let y = blackTier(L, TX, TZ, 6, 5.6, B, 4.4, { ...s, over: 1.7 });
  const e1 = y;
  y = blackTier(L, TX, TZ, 4.6, 4.3, y, 3.3, { ...s, wx: 3, wz: 3 });
  const e2 = y;
  y = blackTier(L, TX, TZ, 3.6, 3.3, y, 3, { ...s, wx: 2, wz: 2, rise: 0, white: 0.8 });
  keepTop(L, TX, TZ, 3.6, 3.3, y, 1.3, 2.9, 'kawara', 'white', 'charcoal');
  karahafu(L, 'z+', TZ + 5.6, TX, 3.2, e1 - 0.2, e1 + 2.2, 1.7, 'kawara', 'white');
  for (const sx of [-1, 1] as const) chidori(L, sx > 0 ? 'x+' : 'x-', TX + sx * 6, TZ, 3.2, e1 - 0.2, e1 + 2.6, 1.7, 'kawara');
  chidori(L, 'z+', TZ + 4.3, TX, 2.4, e2 - 0.2, e2 + 1.9, 1.5, 'kawara');

  // The water gate (水手御門): a roofed gate in the wall with stone steps down into the moat.
  const [gx0, gx1] = [21, 28];
  for (const x of [gx0 + 0.5, gx1 - 0.5]) L.box(x - 0.35, B, EDGE - 2.2, x + 0.35, B + 3.6, EDGE - 1.5, 'woodDark');
  L.box(gx0 + 0.9, B + 0.2, EDGE - 2.1, gx1 - 0.9, B + 3.2, EDGE - 1.95, 'doorSteel');
  L.shape('gable', gx0 - 0.6, B + 3.6, EDGE - 3.4, gx1 + 0.6, B + 5.4, EDGE - 0.4, 'paint', { paint: 'kawara', axis: 'x' });
  for (let i = 0; i < 6; i++) L.box(gx0 + 1, -1.2 + i * 0.4, EDGE, gx1 - 1, -0.8 + i * 0.4, EDGE + 3 - i * 0.5, 'paint', { paint: 'granite', solid: false });
  // The long turret beyond it (渡櫓).
  watari(L, gx1, EDGE - 8, 45, EDGE - 1.2, B, 4.2, 0.72);
  // The white plaster wall (土塀) on the stone wall to the corner.
  L.box(1.2, B, EDGE - 1.6, TX - 7.4, B + 2.2, EDGE - 1.2, 'paint', { paint: 'white' });

  // Pines along the inner side, the stone lanterns of the park.
  for (const [x, z, h] of [[4, 4, 10], [22, 5, 11], [38, 4, 10], [44, 14, 9], [30, 12, 8]] as const) pine(L, x, z, h);

  // 90 days on: relief crates and a tent on the gravel, a boat left upside down in the moat, a fallen sign.
  L.crates(34, 6, 4);
  L.tent(24, 14, 'x', 6);
  L.box(36, -0.6, EDGE + 4, 42, 0.3, EDGE + 6, 'paint', { paint: 'offWhite', solid: false });
  L.fallenSign(6, 12, 'z');
  L.scorch(TX + 6.02, B + 0.6, TZ - 3, TX + 6.1, B + 3.6, TZ + 1);
}
