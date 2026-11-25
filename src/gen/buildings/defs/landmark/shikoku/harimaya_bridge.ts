// L7: はりまや橋 (Harimaya Bridge), at the crossing of the tram lines in the middle of Kōchi, of the folk
// song 「よさこい節」. Today a small vermilion arched bridge (1998, after the Edo-period wooden bridge) in
// the little park by the crossing, over a narrow stream with stone banks; vermilion rails with bronze
// onion caps (擬宝珠) on the posts.
//
// A rough shape (the bridge landmarks are rebuilt end to end by L9). Real size: about 20 m long and
// 4 m wide (from memory). The front (local z = d, the side seen from the crossing) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { pine } from '../tohoku/parts.ts';
import { along } from '../chugoku/parts.ts';
import { bridgeRail } from './parts.ts';

const W = 28;
const D = 16;
/** The bridge along x (its ends, its rise), the stream across it. */
const [BX0, BX1] = [4, 24];
const [Z0, Z1] = [6, 10];
const RISE = 1.3;
const [SX0, SX1] = [9, 19];

export const LANDMARK_HARIMAYA_BRIDGE = landmarkDef({
  variant: 'harimaya_bridge',
  size: { w: [W, W], d: [D, D] },
  eaves: 2.4,
  top: 6,
  roof: 'flat',
  kind: 'house',
  build,
});

const top = (x: number): number => 0.2 + RISE * Math.sin((Math.PI * Math.min(Math.max(x - BX0, 0), BX1 - BX0)) / (BX1 - BX0));

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The stream, round the stone pier under the bridge's middle (the lot's middle stays dry ground).
  const [px0, px1, pz0, pz1] = [W / 2 - 3, W / 2 + 3, D / 2 - 3, D / 2 + 3];
  for (const poly of [
    [[SX0, 0], [SX1, 0], [SX1, pz0], [SX0, pz0]],
    [[SX0, pz1], [SX1, pz1], [SX1, D], [SX0, D]],
    [[SX0, pz0], [px0, pz0], [px0, pz1], [SX0, pz1]],
    [[px1, pz0], [SX1, pz0], [SX1, pz1], [px1, pz1]],
  ] as [number, number][][]) L.ground('water', poly, 1.2, 0.8);
  L.box(px0 + 0.5, -1.2, pz0 + 0.5, px1 - 0.5, 0.2, pz1 - 0.5, 'paint', { paint: 'granite', solid: false });
  // The stream's stone banks.
  for (const x of [SX0, SX1]) L.box(x - 0.5, -1.2, 0, x + 0.5, 0.3, D, 'paint', { paint: 'granite', solid: false });

  // The deck (walkable, its steps under 0.5 m), the vermilion beams under it, the rails and posts.
  along(L, BX0, BX1, 22, top, 0.35, Z0, Z1, 'intlOrange');
  along(L, SX0 - 0.5, SX1 + 0.5, 12, (x) => top(x) - 0.35, 0.5, Z0 + 0.2, Z0 + 0.6, 'red', false);
  along(L, SX0 - 0.5, SX1 + 0.5, 12, (x) => top(x) - 0.35, 0.5, Z1 - 0.6, Z1 - 0.2, 'red', false);
  for (const z of [Z0 + 0.1, Z1 - 0.1]) bridgeRail(L, BX0 + 0.5, BX1 - 0.5, z, 14, top, 'intlOrange', 6);

  // The little park: a pine either side, a stone with the bridge's name.
  pine(L, 2, 2, 6);
  pine(L, 26, 14, 6);
  L.box(1.5, 0, 12, 3.2, 1.6, 13, 'paint', { paint: 'granite' });

  // 90 days on: a car left on the crossing's edge, a fallen sign.
  L.car(24, 2, 'x');
  L.fallenSign(5, 14, 'x');
}
