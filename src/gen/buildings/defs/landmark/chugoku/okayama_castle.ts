// L6: 岡山城 (Okayama Castle, the "crow castle" 烏城), Okayama. The keep of 1597 (rebuilt in 1966) on
// the west bank of the Asahi River across from Kōraku-en: walls almost wholly of black lacquered boards
// (黒漆の下見板), grey tile roofs with gold-leafed ridge ends and the golden ridge fish (金鯱); the first
// two storeys under one great hipped roof with big gables, three smaller tiers on it; the low salt
// store (塩蔵) attached on the west. Its first storey is an irregular five-sided plan (drawn as two
// overlapping blocks).
//
// Real size: the keep 20.3 m on a 5.5 m stone base (the ridge fish 29.7 m); the lot is kept small (56 × 48 m) so that the prefectural office 40 m south in the shrunk area keeps its site. The front (local z = d) faces
// south.

import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase } from '../tohoku/parts.ts';
import { blackTier, shachi, type BlackTierStyle } from '../chubu/parts.ts';
import { ginkgo } from '../kanto/parts.ts';
import { hafu } from '../kinki/parts.ts';

const W = 56;
const D = 48;
const CX = 30;
const CZ = 21;
const BASE = 5.5;

export const LANDMARK_OKAYAMA_CASTLE = landmarkDef({
  variant: 'okayama_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 22,
  top: BASE + 24.2,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  stoneBase(L, CX - 14, CZ - 11, CX + 14, CZ + 11, 0, BASE, 0.12, 3, 'gray');
  // The salt store's lower base on the west.
  stoneBase(L, CX - 24, CZ - 6, CX - 13, CZ + 6, 0, BASE - 1.5, 0.1, 2, 'gray');

  const s: BlackTierStyle = { roof: 'kawara', over: 1.7, rise: 2.4, wx: 7, wz: 5, white: 0.1, broken: 0.3 };
  // The first two storeys: the irregular block (a second, shifted block under the same roof).
  L.box(CX - 11.5, BASE, CZ - 8.5, CX + 3, BASE + 7.2, CZ + 9.5, 'paint', { paint: 'black' });
  let y = blackTier(L, CX, CZ, 12, 9, BASE, 7.2, { ...s, rise: 3.2, over: 2.2 });
  // The great hipped roof's big gables (front and back, gold-edged boards), smaller ones on the sides.
  for (const sz of [-1, 1] as const) hafu(L, sz > 0 ? 'z+' : 'z-', CZ + sz * 9, CX, 7, y - 0.2, y + 5.2, 2.2, 'kawara', 'black');
  for (const sx of [-1, 1] as const) hafu(L, sx > 0 ? 'x+' : 'x-', CX + sx * 12, CZ, 4.2, y - 0.2, y + 3.4, 2.2, 'kawara', 'black');
  y = blackTier(L, CX, CZ, 8.6, 6.4, y, 4.2, { ...s, wx: 5, wz: 4 });
  hafu(L, 'z+', CZ + 6.4, CX, 3.2, y - 0.2, y + 2.6, s.over, 'kawara', 'black');
  y = blackTier(L, CX, CZ, 7, 5.2, y, 3.8, { ...s, wx: 4, wz: 3 });
  y = blackTier(L, CX, CZ, 5.6, 4.2, y, 3.4, { ...s, wx: 3, wz: 3, rise: 0, white: 0.3 });
  // The top roof (入母屋) with its gold-edged ends and the golden fish.
  L.box(CX - 7, y - 0.25, CZ - 5.6, CX + 7, y, CZ + 5.6, 'paint', { paint: 'gold', solid: false });
  L.shape('hip', CX - 7, y, CZ - 5.6, CX + 7, y + 2, CZ + 5.6, 'paint', { paint: 'kawara', axis: 'x' });
  L.shape('gable', CX - 4.8, y + 1.5, CZ - 3, CX + 4.8, y + 3.4, CZ + 3, 'paint', { paint: 'kawara', axis: 'x' });
  for (const sx of [-1, 1]) L.shape('gable', CX + sx * 4.8 - 0.05, y + 1.6, CZ - 2.4, CX + sx * 4.8 + 0.05, y + 3.2, CZ + 2.4, 'paint', { paint: 'gold', axis: 'z', solid: false });
  shachi(L, CX, CZ, y + 3.4, 'x', 4.2, 2.2);

  // The salt store (塩蔵): one black storey under a hipped roof.
  const k = blackTier(L, CX - 18.5, CZ, 4.6, 5.2, BASE - 1.5, 4.2, { ...s, wx: 2, wz: 3, rise: 0, white: 0.15 });
  L.box(CX - 24.6, k - 0.25, CZ - 6.6, CX - 12.4, k, CZ + 6.6, 'paint', { paint: 'white', solid: false });
  L.shape('hip', CX - 24.6, k, CZ - 6.6, CX - 12.4, k + 2.6, CZ + 6.6, 'paint', { paint: 'kawara', axis: 'z' });

  // The enclosure: pines and a ginkgo; the stone wall's edge on the south.
  for (const [x, z, h] of [[4, 4, 8], [52, 5, 9], [51, 38, 8], [5, 40, 8]] as const) pine(L, x, z, h);
  ginkgo(L, 50, 22, 13);
  L.box(2, 0, D - 3, W - 2, 1.4, D - 1.8, 'paint', { paint: 'gray' });

  // 90 days on: a relief tent and crates, a burnt car, a fallen sign, scorch on the stone base.
  L.tent(14, 40, 'x', 7);
  L.crates(24, 41, 4);
  L.car(40, 42, 'x', { burnt: true });
  L.fallenSign(32, 37, 'x');
  L.scorch(CX + 13.9, 1, CZ - 2, CX + 14.05, 4, CZ + 3);
}
