// R1: 五稜郭タワー (Goryōkaku Tower, Hakodate, 2006) beside the star fort. A concrete shaft of 107 m with
// the two-storey star-shaped deck at about 90 m: here the deck fills the lot (glass all round) and
// the five points of the star are fins on the fascia; white concrete, a short mast on top. The
// deck's roof is a firing position (obs_tower.ts).

import type { Kit } from '../../../kit.ts';
import type { BuildingDef } from '../../../types.ts';
import { twoPass, type Fit } from '../../office/common.ts';
import { obsTower } from './obs_tower.ts';

export const LANDMARK_GORYOKAKU_TOWER: BuildingDef = {
  id: 'landmark.goryokaku_tower',
  category: 'landmark',
  variant: 'goryokaku_tower',
  kind: 'office',
  size: { w: [20, 22], d: [20, 22] },
  storeys: 20,
  storeyHeight: 4.5,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 16,
  lootable: true,
  generate(rng, params) {
    return twoPass(LANDMARK_GORYOKAKU_TOWER, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = 0.85 + k.rand() * 0.1;
  const t = obsTower(k, f, { shaft: 9, mat: 'concrete', tint, deckTint: 0.6 });
  const [sx0, sz0, sx1, sz1] = t.shaft;
  const yDeck = k.levelY(k.storeys - 1);
  const deco = { layer: 'shell' as const, tint, solid: false };
  // Vertical ribs up the shaft's corners.
  for (const [x, z] of [[sx0 - 0.4, sz0 - 0.4], [sx1, sz0 - 0.4], [sx0 - 0.4, sz1], [sx1, sz1]] as const) k.box(-1, x, 0, z, x + 0.4, yDeck - 1.4, z + 0.4, 'concrete', deco);
  // The star's points: five fins under the deck, a wedge each (two in front, one at the back, one per side).
  const y0 = yDeck - 5;
  const y1 = yDeck - 1.4;
  k.part({ shape: 'wedge', x0: w * 0.2, y0, z0: d - 3, x1: w * 0.2 + 1.2, y1, z1: d + 0.5, mat: 'concrete', slope: 'z-', ...deco });
  k.part({ shape: 'wedge', x0: w * 0.8 - 1.2, y0, z0: d - 3, x1: w * 0.8, y1, z1: d + 0.5, mat: 'concrete', slope: 'z-', ...deco });
  k.part({ shape: 'wedge', x0: w / 2 - 0.6, y0, z0: -0.5, x1: w / 2 + 0.6, y1, z1: 3, mat: 'concrete', slope: 'z+', ...deco });
  k.part({ shape: 'wedge', x0: -0.5, y0, z0: d * 0.4, x1: 3, y1, z1: d * 0.4 + 1.2, mat: 'concrete', slope: 'x+', ...deco });
  k.part({ shape: 'wedge', x0: w - 3, y0, z0: d * 0.4, x1: w + 0.5, y1, z1: d * 0.4 + 1.2, mat: 'concrete', slope: 'x-', ...deco });
  // A second, smaller glass band (the upper floor of the real deck) on the roof's front, and the mast.
  k.box(-1, 2, t.roof + 1.35, d - 0.6, w - 2, t.roof + 2.4, d - 0.35, 'glass', { layer: 'shell', solid: false, tint: 0.6 });
  const [cx0, cz0, cx1, cz1] = t.core;
  k.box(-1, (cx0 + cx1) / 2 - 0.3, t.house, (cz0 + cz1) / 2 - 0.3, (cx0 + cx1) / 2 + 0.3, t.house + 12, (cz0 + cz1) / 2 + 0.3, 'steel', { layer: 'shell', tint: 0.9 });
}
