// L5: 興福寺 五重塔 (the five-storey pagoda of Kōfuku-ji, rebuilt 1426), Nara. 50.1 m, the second tallest
// wooden pagoda in Japan: dark timber and white plaster, grey tiled roofs narrowing more towards the top
// than Tō-ji's, the bronze finial. Beside it to the north the East Golden Hall (東金堂), a broad tiled
// hall; below them to the south, down the 52 steps, Sarusawa Pond, where the pagoda is reflected. Deer
// of Nara Park everywhere. (The pagoda has been under a scaffolding roof for its repair since 2023;
// it is drawn as it is known.)
//
// Real size: the first storey 8.7 m square. The front (local z = d, the pond) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { pine } from '../tohoku/parts.ts';
import { maple } from '../chubu/parts.ts';
import { deer, pagoda } from './parts.ts';

const W = 60;
const D = 60;
const PX = 18;
const PZ = 28;

export const LANDMARK_KOFUKUJI_PAGODA = landmarkDef({
  variant: 'kofukuji_pagoda',
  size: { w: [W, W], d: [D, D] },
  eaves: 28,
  top: 50.1,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, 46], [0, 46]]);
  L.ground('water', [[0, 50], [W, 50], [W, D], [0, D]], 1.6, 0.8);
  L.box(0, -0.8, 47, W, 0.3, 50, 'paint', { paint: 'stone' });

  pagoda(L, PX, PZ, {
    tiers: [[4.35, 5.2], [4, 4.4], [3.6, 4.2], [3.25, 4], [2.9, 3.8]],
    frame: 'brown',
    panel: 'hinoki',
    roof: 'kawara',
    finial: 'bronze',
    over: [3.5, 3.3, 3.1, 2.9, 2.7],
    rise: 3,
    plinth: [6.5, 1.4],
    top: 50.1,
  });

  // The East Golden Hall: a stone platform, white walls and dark timber, seven bays of doors, the hipped roof.
  const [x0, x1, z0, z1] = [32, 56, 6, 22];
  L.box(x0 - 1.5, 0, z0 - 1.5, x1 + 1.5, 1.2, z1 + 1.5, 'paint', { paint: 'stone' });
  L.box(x0, 1.2, z0, x1, 9, z1, 'paint', { paint: 'offWhite' });
  for (let i = 0; i <= 7; i++) {
    const x = x0 + ((x1 - x0) * i) / 7;
    L.box(x - 0.35, 1.2, z1, x + 0.35, 9, z1 + 0.25, 'paint', { paint: 'brown', solid: false });
  }
  L.windows('x', z1, 1, x0 + 1, x1 - 1, 7, 1.6, 6.8, 2, { paint: 'brickRed', broken: 0.2 });
  L.box(x0 - 0.4, 8, z0 - 0.4, x1 + 0.4, 9.4, z1 + 0.4, 'paint', { paint: 'brown', solid: false });
  L.shape('hip', x0 - 3.5, 9.2, z0 - 3.5, x1 + 3.5, 17.5, z1 + 3.5, 'paint', { paint: 'kawara', axis: 'x' });
  for (const s of [-1, 1]) L.box((x0 + x1) / 2 + s * 5.5 - 0.5, 16.8, (z0 + z1) / 2 - 0.4, (x0 + x1) / 2 + s * 5.5 + 0.5, 18.6, (z0 + z1) / 2 + 0.4, 'paint', { paint: 'charcoal', solid: false });

  // Pines and a maple, deer on the gravel.
  for (const [x, z, h] of [[4, 6, 10], [4, 44, 9], [56, 36, 10], [30, 42, 8]] as const) pine(L, x, z, h);
  maple(L, 42, 34, 7, 3);
  deer(L, 34, 30, 'x', 1);
  deer(L, 46, 40, 'z', 1);
  deer(L, 8, 22, 'x', -1);

  // 90 days on: a fallen sign by the steps, a relief tent and crates on the gravel.
  L.fallenSign(26, 44, 'x');
  L.tent(48, 28, 'x', 7);
  L.crates(54, 44, 3);
}
