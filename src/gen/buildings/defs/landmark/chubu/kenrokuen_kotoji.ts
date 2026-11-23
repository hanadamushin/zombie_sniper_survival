// L4: 兼六園 徽軫灯籠 (Kenroku-en, Kanazawa: the Kotoji stone lantern). The symbol of one of the
// three great gardens of Japan: a stone lantern of two legs of unequal length — one in the water of
// the Kasumi pond (霞ヶ池), one on a stone of the bank, like the bridge of a koto's string (琴柱) — under
// its broad stone hat, beside the arched stone slab of the Rainbow Bridge (虹橋) and a maple. Across
// the pond the Karasaki pine (唐崎松) spreads its branches low over the water, and from November its
// snow ropes (雪吊り) hang from a tall pole over it like the ribs of a tent.
//
// The lantern is 2.67 m: from afar the pond, the pine and its ropes tell the place. The garden
// (11 ha) is the lot round the lantern. The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { slant } from '../kanto/parts.ts';
import { pine } from '../tohoku/parts.ts';
import { lantern, maple } from './parts.ts';

const W = 48;
const D = 40;
/** The lantern's middle. */
const KX = 21;
const KZ = 23.4;

export const LANDMARK_KENROKUEN_KOTOJI = landmarkDef({
  variant: 'kenrokuen_kotoji',
  size: { w: [W, W], d: [D, D] },
  eaves: 3,
  top: 15,
  kind: 'house',
  build,
});

/** The Karasaki pine: a low trunk leaning out, its flat crowns spread wide, the snow ropes from a pole. */
function karasaki(L: Lm, x: number, z: number): void {
  L.column(x, z, 0.5, 0, 3.4, 'paint', { paint: 'brown' });
  for (const [dx, dz, r, y] of [[0, 0, 4.4, 3], [-4.6, 1.6, 3.2, 2.2], [4.2, -1.2, 3.4, 2.6], [1.5, 4.2, 2.8, 2], [-1.8, -4, 3, 3.6], [0, 0, 2.6, 5.4]] as const) {
    L.column(x + dx, z + dz, r, y, y + 1.3, 'paint', { paint: 'cedar', taper: 0.7, solid: false });
  }
  // The pole and its ropes (straw, pale): from the top to a ring round the crowns.
  const top = 14.6;
  L.column(x, z, 0.18, 5, top, 'paint', { paint: 'hinoki', solid: false });
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 6.2;
    slant(L, [x, top, z], [x + Math.cos(a) * r, 3.4, z + Math.sin(a) * r], 12, 0.07, 'thatch');
  }
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The pond, behind the lantern; the stream under the Rainbow Bridge into it.
  L.ground('water', [[0, 0], [W, 0], [W, 20], [36, 22], [24, 22.4], [18, 23.2], [8, 25], [0, 26]], 1.4, 0.7);
  L.ground('water', [[14, 23.8], [17, 23.4], [17.4, 32], [14.6, 32]], 0.8, 0.5);
  L.ground('gravel', [[8, 33], [W - 2, 33], [W - 2, 36], [8, 36]]);

  // The Kotoji lantern: the long leg in the water, the short one on a stone of the bank.
  L.shape('cyl', KX + 0.2, 0, KZ - 0.5, KX + 2.2, 0.75, KZ + 1.2, 'paint', { paint: 'gray' }).taper = 0.7;
  L.column(KX - 0.9, KZ - 0.2, 0.13, -0.7, 1.55, 'paint', { paint: 'stone' });
  L.column(KX + 1.2, KZ + 0.4, 0.13, 0.7, 1.55, 'paint', { paint: 'stone' });
  L.box(KX - 1.2, 1.55, KZ - 0.6, KX + 1.5, 1.75, KZ + 0.9, 'paint', { paint: 'stone' }); // the leg's tie (中台)
  L.box(KX - 0.4, 1.75, KZ - 0.25, KX + 0.7, 2.15, KZ + 0.55, 'paint', { paint: 'stone' }); // fire box
  L.box(KX - 1.25, 2.15, KZ - 1.1, KX + 1.55, 2.28, KZ + 1.4, 'paint', { paint: 'stone' }); // the broad hat
  L.shape('hip', KX - 1.15, 2.28, KZ - 1, KX + 1.45, 2.5, KZ + 1.3, 'paint', { paint: 'stone', axis: 'x' });
  L.column(KX + 0.15, KZ + 0.15, 0.14, 2.5, 2.67, 'paint', { paint: 'stone' });
  // The Rainbow Bridge: a stone slab arched over the stream (three steps).
  L.box(13.6, 0.1, 27.2, 18.4, 0.3, 28.6, 'paint', { paint: 'stone' });
  L.box(14.4, 0.3, 27.2, 17.6, 0.45, 28.6, 'paint', { paint: 'stone' });
  maple(L, 11, 28, 6.5, 3);

  karasaki(L, 33, 22.4);
  // Pines and more maples round the bank, a snow-lantern (雪見灯籠) on the far side.
  for (const [x, z, h] of [[4, 32, 8], [43, 28, 9], [28, 37, 7]] as const) pine(L, x, z, h);
  for (const [x, z] of [[36, 29], [20, 36.5]] as const) maple(L, x, z, 6, 2.6);
  lantern(L, 40, 24.5, 2.2);

  // 90 days on: a relief tent and crates on the lawn by the path, a fallen sign by the bridge.
  L.tent(30, 30.5, 'x', 6);
  L.crates(40, 31, 3);
  L.fallenSign(22, 30, 'x');
}
