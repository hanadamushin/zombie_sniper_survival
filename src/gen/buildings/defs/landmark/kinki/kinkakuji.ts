// L5: 鹿苑寺 金閣 (Rokuon-ji, the Golden Pavilion), Kita, Kyōto. Rebuilt in 1955 after the arson of 1950
// to the shape of 1397: three storeys on the north shore of the Mirror Pond (鏡湖池) — the first in
// plain wood with white paper shutters (the palace style), the second and third covered in gold leaf,
// the third square under a pyramid roof of wooden shingles (杮葺) with the gold phoenix on its top. A
// small annex (漱清) juts over the water on the west. The pond has islands of pines and rocks.
//
// Real size: 12.5 m to the roof's peak (13.5 m with the phoenix), the first storey about 17 × 13 m.
// The front (local z = d, across the pond) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { pine } from '../tohoku/parts.ts';
import { maple } from '../chubu/parts.ts';

const W = 64;
const D = 56;
const CX = 32;
const CZ = 27;

export const LANDMARK_KINKAKUJI = landmarkDef({
  variant: 'kinkakuji',
  size: { w: [W, W], d: [D, D] },
  eaves: 8.6,
  top: 13.6,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The pond before the pavilion (its middle stays on dry ground: the lot's middle is the pavilion's).
  L.ground('water', [[2, 36], [W - 2, 36], [W - 2, D - 2], [2, D - 2]], 1.6, 0.6);
  L.ground('water', [[CX - 13, 33.5], [CX + 13, 33.5], [CX + 13, 36.5], [CX - 13, 36.5]], 1.6, 0.6);
  L.ground('water', [[4, 28], [CX - 9, 28], [CX - 9, 36.5], [4, 36.5]], 1.6, 0.6);
  // The stone footing at the water's edge.
  L.box(CX - 9.5, -0.6, CZ - 7, CX + 9.5, 0.6, CZ + 7, 'paint', { paint: 'stone' });

  // First storey (法水院): plain wood, white paper shutters, a veranda; its roof a shingle skirt.
  const [ax, az] = [8.5, 6.4];
  L.box(CX - ax, 0.6, CZ - az, CX + ax, 4.6, CZ + az, 'paint', { paint: 'hinoki' });
  L.windows('x', CZ + az, 1, CX - ax + 1, CX + ax - 1, 6, 1.2, 4, 2.2, { paint: 'offWhite', broken: 0.15 });
  L.windows('z', CX - ax, -1, CZ - az + 1, CZ + az - 1, 4, 1.2, 4, 2.2, { paint: 'offWhite', broken: 0.15 });
  L.windows('z', CX + ax, 1, CZ - az + 1, CZ + az - 1, 4, 1.2, 4, 2.2, { paint: 'offWhite', broken: 0.15 });
  L.box(CX - ax - 1.2, 0.6, CZ + az, CX + ax + 1.2, 1, CZ + az + 1.2, 'paint', { paint: 'hinoki', solid: false });
  L.box(CX - ax - 2.4, 4.6, CZ - az - 2.4, CX + ax + 2.4, 4.85, CZ + az + 2.4, 'paint', { paint: 'hiwada', solid: false });
  L.shape('hip', CX - ax - 2.4, 4.85, CZ - az - 2.4, CX + ax + 2.4, 5.9, CZ + az + 2.4, 'paint', { paint: 'hiwada', axis: 'x' });

  // Second storey (潮音洞): gold walls, a balcony rail, its own shingle roof.
  const [bx, bz] = [8, 6];
  L.box(CX - bx, 5.3, CZ - bz, CX + bx, 8.6, CZ + bz, 'paint', { paint: 'gold' });
  L.windows('x', CZ + bz, 1, CX - bx + 1, CX + bx - 1, 5, 5.8, 8, 2.2, { paint: 'gold', broken: 0 });
  L.box(CX - bx - 0.9, 5.3, CZ + bz + 0.7, CX + bx + 0.9, 6.3, CZ + bz + 0.85, 'paint', { paint: 'gold', solid: false });
  L.box(CX - bx - 2.6, 8.6, CZ - bz - 2.6, CX + bx + 2.6, 8.85, CZ + bz + 2.6, 'paint', { paint: 'hiwada', solid: false });
  L.shape('hip', CX - bx - 2.6, 8.85, CZ - bz - 2.6, CX + bx + 2.6, 9.6, CZ + bz + 2.6, 'paint', { paint: 'hiwada', axis: 'x' });

  // Third storey (究竟頂): square, gold, the bell-shaped windows (dark), the pyramid roof, the phoenix.
  const c = 3.8;
  L.box(CX - c, 9.2, CZ - c, CX + c, 11.6, CZ + c, 'paint', { paint: 'gold' });
  for (const s of [-1, 1] as const) {
    L.windows('x', CZ + s * c, s, CX - c + 0.8, CX + c - 0.8, 2, 9.6, 11.1, 1.2, { paint: 'charcoal', broken: 0 });
    L.windows('z', CX + s * c, s, CZ - c + 0.8, CZ + c - 0.8, 2, 9.6, 11.1, 1.2, { paint: 'charcoal', broken: 0 });
  }
  L.box(CX - c - 2.3, 11.6, CZ - c - 2.3, CX + c + 2.3, 11.85, CZ + c + 2.3, 'paint', { paint: 'hiwada', solid: false });
  L.shape('hip', CX - c - 2.3, 11.85, CZ - c - 2.3, CX + c + 2.3, 12.5, CZ + c + 2.3, 'paint', { paint: 'hiwada', axis: 'x' });
  L.column(CX, CZ, 0.25, 12.5, 12.8, 'paint', { paint: 'gold', solid: false });
  L.box(CX - 0.6, 12.8, CZ - 0.2, CX + 0.6, 13.6, CZ + 0.2, 'paint', { paint: 'gold', solid: false });
  L.box(CX - 0.15, 12.8, CZ - 0.5, CX + 0.15, 13.3, CZ + 0.5, 'paint', { paint: 'gold', solid: false });

  // The annex over the water on the west (漱清): a small roofed deck on posts.
  L.box(CX - ax - 5, 0.4, CZ + 2, CX - ax, 0.8, CZ + 6, 'paint', { paint: 'hinoki' });
  for (const [x, z] of [[CX - ax - 4.8, CZ + 2.2], [CX - ax - 4.8, CZ + 5.8]] as const) L.box(x - 0.15, -0.6, z - 0.15, x + 0.15, 3, z + 0.15, 'paint', { paint: 'hinoki' });
  L.shape('hip', CX - ax - 5.8, 3, CZ + 1.2, CX - ax + 0.4, 4, CZ + 6.8, 'paint', { paint: 'hiwada', axis: 'z', solid: false });

  // The islands with their pines, rocks in the water.
  for (const [x, z, r, h] of [[18, 45, 4, 6], [44, 47, 3, 5], [30, 51, 2.2, 4]] as const) {
    L.column(x, z, r, -0.6, 0.5, 'paint', { paint: 'green' });
    pine(L, x, z, h);
  }
  for (const [x, z] of [[24, 40], [38, 41], [52, 39], [10, 50]] as const) L.box(x - 0.8, -0.6, z - 0.6, x + 0.8, 0.4, z + 0.6, 'paint', { paint: 'gray' });
  // The garden: pines and maples round the pavilion, the hill's forest behind it.
  for (const [x, z, h] of [[6, 8, 9], [58, 10, 9], [14, 3, 8], [52, 3, 8]] as const) pine(L, x, z, h);
  for (const [x, z] of [[5, 20], [59, 24], [44, 8], [22, 10]] as const) maple(L, x, z, 7, 2.8);

  // 90 days on: a fallen sign on the north bank, crates left on the path.
  L.fallenSign(50, 22, 'z');
  L.crates(30, 6, 3);
}
