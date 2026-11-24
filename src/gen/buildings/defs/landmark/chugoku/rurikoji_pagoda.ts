// L6: 瑠璃光寺五重塔 (the five-storey pagoda of Rurikō-ji), Yamaguchi, a national treasure (1442) and
// one of the three great pagodas of Japan. Plain unpainted wood under five roofs of cypress bark
// (檜皮葺) that reach far out and grow only a little smaller upwards, so the slender tower looks light;
// the bronze finial on top. It stands on the slope of Kōzan Park above a pond, among maples that are
// red in late November.
//
// Real size: 31.2 m to the top of the finial, the first storey about 6.6 m square. The front (local
// z = d) faces south, across the pond. (Under re-roofing from 2020 to 2026; drawn as it is known.)
// L6: in place of the Tsunoshima Bridge, whose cell is not a land cell of the game (PROGRESS.md).

import { landmarkDef, type Lm } from '../common.ts';
import { lantern, maple } from '../chubu/parts.ts';
import { cedar } from '../tohoku/parts.ts';
import { pagoda } from '../kinki/parts.ts';

const W = 44;
const D = 52;
const CX = 22;
const CZ = 18;

export const LANDMARK_RURIKOJI_PAGODA = landmarkDef({
  variant: 'rurikoji_pagoda',
  size: { w: [W, W], d: [D, D] },
  eaves: 20,
  top: 31.2,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('water', [[6, 34], [20, 32], [36, 34], [40, 42], [32, 49], [14, 49], [4, 43]], 1.4, 0.5);
  L.ground('gravel', [[CX - 6, CZ - 6], [CX + 6, CZ - 6], [CX + 6, CZ + 6], [CX - 6, CZ + 6]]);

  pagoda(L, CX, CZ, {
    tiers: [[3.3, 3.9], [2.95, 2.6], [2.65, 2.5], [2.35, 2.4], [2.05, 2.3]],
    frame: 'brown',
    panel: 'hinoki',
    roof: 'hiwada',
    finial: 'bronze',
    over: [3.1, 3, 2.9, 2.8, 2.7],
    rise: 1.5,
    plinth: [4.6, 0.9],
    top: 31.2,
  });

  // Maples round the pond and on the slope, cedars behind, a stone lantern by the water.
  for (const [x, z] of [[4, 30], [40, 30], [8, 10], [36, 8], [40, 47], [4, 48]] as const) maple(L, x, z, 7, 3);
  for (const [x, z] of [[4, 2], [16, 2], [30, 2], [42, 4]] as const) cedar(L, x, z, 20, 2.4);
  lantern(L, 12, 30, 2.4);

  // 90 days on: a fallen sign by the pond, relief crates and a tent on the grass.
  L.fallenSign(28, 31, 'x');
  L.crates(36, 20, 3);
  L.tent(8, 20, 'z', 6);
}
