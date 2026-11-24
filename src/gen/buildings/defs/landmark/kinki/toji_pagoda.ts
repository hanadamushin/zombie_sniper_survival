// L5: 東寺 五重塔 (the five-storey pagoda of Tō-ji), Minami, Kyōto. 54.8 m, the tallest wooden pagoda in
// Japan (rebuilt 1644): five storeys of dark timber and white plaster, the roofs reaching far out and
// shrinking little from the bottom to the top (the tall, even silhouette seen from the trains at Kyōto
// Station), the bronze finial with its nine rings. It stands in the south-east corner of the precinct
// over the gourd-shaped pond (瓢箪池), among pines and maples.
//
// Real size: the first storey 9.5 m square, the finial about a quarter of the height. The front
// (local z = d, the pond) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { maple } from '../chubu/parts.ts';
import { pine } from '../tohoku/parts.ts';
import { pagoda } from './parts.ts';

const W = 52;
const D = 52;
const CX = 30;
const CZ = 20;

export const LANDMARK_TOJI_PAGODA = landmarkDef({
  variant: 'toji_pagoda',
  size: { w: [W, W], d: [D, D] },
  eaves: 30,
  top: 54.8,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('water', [[4, 34], [22, 32], [30, 38], [44, 36], [48, 44], [40, 50], [20, 49], [6, 46]], 1.4, 0.5);
  L.ground('gravel', [[CX - 7, CZ - 7], [CX + 7, CZ - 7], [CX + 7, CZ + 7], [CX - 7, CZ + 7]]);

  pagoda(L, CX, CZ, {
    tiers: [[4.75, 5.6], [4.4, 4.6], [4.05, 4.4], [3.7, 4.2], [3.35, 4]],
    frame: 'brown',
    panel: 'hinoki',
    roof: 'kawara',
    finial: 'bronze',
    over: [3.7, 3.6, 3.5, 3.4, 3.3],
    rise: 3.2,
    plinth: [7, 1.5],
    top: 54.8,
  });

  // The pond's stone edge and a little island, pines and maples round it, the precinct's earthen wall (築地塀) on the east.
  L.column(26, 42, 2.4, -0.5, 0.4, 'paint', { paint: 'green' });
  pine(L, 26, 42, 6);
  for (const [x, z, h] of [[6, 8, 10], [8, 26, 9], [46, 10, 10]] as const) pine(L, x, z, h);
  for (const [x, z] of [[14, 30], [42, 28], [12, 12], [44, 46], [4, 40]] as const) maple(L, x, z, 7, 3);
  L.box(W - 1.6, 0, 1, W - 0.4, 3, D - 1, 'paint', { paint: 'offWhite' });
  L.shape('gable', W - 2, 3, 1, W, 3.8, D - 1, 'paint', { paint: 'kawara', axis: 'z', solid: false });
  for (const y of [0.8, 1.7, 2.6]) L.box(W - 0.42, y, 1, W - 0.36, y + 0.12, D - 1, 'paint', { paint: 'white', solid: false });

  // 90 days on: a fallen sign by the pond, crates and a relief tent on the grass.
  L.fallenSign(18, 26, 'x');
  L.tent(40, 6, 'x', 6);
  L.crates(32, 4, 3);
}
