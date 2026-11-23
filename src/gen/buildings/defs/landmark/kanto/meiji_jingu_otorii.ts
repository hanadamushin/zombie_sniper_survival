// L3a: 明治神宮 大鳥居 (the great torii of Meiji Jingū, 1975), where the south and north approaches meet
// in the shrine's forest: the largest wooden torii of the 明神 style, 12 m high, its top lintel
// (笠木) 17.1 m long and swept up at the ends, the pillars 1.2 m thick, of unpainted 1,500-year-old
// Taiwanese cypress gone silver-brown. The gravel approach runs through the man-made forest of
// evergreen broadleaves (camphor, oak) planted a century ago.
//
// The shrine itself is not drawn (a place of worship deep in the forest; the torii is its image
// from outside). The front (local z = d) faces south, down the approach.

import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from '../tohoku/parts.ts';
import { broadleaf } from './parts.ts';

const W = 40;
const D = 56;
const CX = W / 2;
/** The torii's line (z). */
const TZ = 30;

export const LANDMARK_MEIJI_JINGU_OTORII = landmarkDef({
  variant: 'meiji_jingu_otorii',
  size: { w: [W, W], d: [D, D] },
  eaves: 12,
  top: 26,
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[CX - 7, 0], [CX + 7, 0], [CX + 7, D], [CX - 7, D]]);
  L.ground('grass', [[0, 0], [CX - 7, 0], [CX - 7, D], [0, D]]);
  L.ground('grass', [[CX + 7, 0], [W, 0], [W, D], [CX + 7, D]]);

  const wood = { paint: 'hinoki' as const };
  // The pillars (a slight taper, the dark root collars).
  for (const x of [CX - 4.55, CX + 4.55]) {
    L.column(x, TZ, 0.62, 0, 10.2, 'paint', { ...wood, taper: 0.88 });
    L.column(x, TZ, 0.78, 0, 1.1, 'paint', { paint: 'charcoal' });
    L.column(x, TZ, 0.62, 7.3, 7.7, 'paint', { paint: 'charcoal', solid: false });
  }
  // 貫 (the tie beam, through the pillars and past them), 島木 and 笠木 (the lintel, swept up at its ends).
  L.box(CX - 6.4, 7.4, TZ - 0.35, CX + 6.4, 8.3, TZ + 0.35, 'paint', wood);
  L.box(CX - 0.35, 8.3, TZ - 0.3, CX + 0.35, 10.2, TZ + 0.3, 'paint', wood); // 額束 (the strut)
  L.box(CX - 7.4, 10.2, TZ - 0.6, CX + 7.4, 10.9, TZ + 0.6, 'paint', wood);
  L.box(CX - 8.1, 10.9, TZ - 0.75, CX + 8.1, 11.6, TZ + 0.75, 'paint', wood);
  for (const s of [-1, 1]) {
    L.box(CX + s * 6.6 - 1.2, 11.5, TZ - 0.72, CX + s * 6.6 + 1.2, 11.85, TZ + 0.72, 'paint', wood);
    L.box(CX + s * 7.9 - 0.65, 11.7, TZ - 0.7, CX + s * 7.9 + 0.65, 12, TZ + 0.7, 'paint', wood);
    L.box(CX + s * 8.35 - 0.2, 11.9, TZ - 0.68, CX + s * 8.35 + 0.2, 12.2, TZ + 0.68, 'paint', wood);
  }

  // The forest along both sides (camphor and oak, a few cedars), the canopy higher than the torii.
  const trees: [number, number, number, number][] = [
    [7, 7, 22, 5.5], [7.5, 18, 25, 5.8], [7, 29, 21, 5], [7.5, 39, 24, 5.8], [7, 49, 20, 5],
    [33, 7, 23, 5.5], [33, 18, 20, 5], [32.5, 41, 25, 5.8], [33, 49, 22, 5.5], [13, 46, 18, 4], [27, 10, 19, 4.5],
  ];
  for (const [x, z, h, r] of trees) broadleaf(L, x, z, h, r, 'cedar');
  for (const [x, z, h] of [[11, 20, 26], [30, 30, 24], [10, 34, 22]] as const) cedar(L, x, z, h, 2.4);
  // Wooden fences (low, along the approach).
  for (const s of [-1, 1]) {
    for (const [z0, z1] of [[0, TZ - 3], [TZ + 3, D]] as const) L.box(CX + s * 7.2 - 0.1, 0, z0, CX + s * 7.2 + 0.1, 0.9, z1, 'paint', { paint: 'brown', solid: false });
  }

  // 90 days on: a fallen board by the torii, a line of sandbags across the approach and crates left behind it.
  L.fallenSign(CX + 4, TZ + 6, 'z');
  L.sandbags(CX - 5.5, TZ + 12, CX + 5.5, TZ + 12);
  L.crates(CX - 4, TZ - 10, 3);
}
