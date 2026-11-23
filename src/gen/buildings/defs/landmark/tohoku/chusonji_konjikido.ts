// L2: 中尊寺 金色堂 (Chūson-ji's Golden Hall, Hiraizumi, 1124) and the way up to it, 月見坂.
//
// The Golden Hall itself (5.5 m square, gold leaf over lacquer) has stood since 1965 inside its
// concrete cover hall (新覆堂): a plain, broad hall under a pyramid roof (宝形造) with a gold jewel
// (宝珠) on top, on a stone platform. Its glass front is broken now, and through the empty frame the
// gold of the hall inside catches the light (it stays shut behind the frame: nobody goes in). The old
// wooden cover hall (旧覆堂, Muromachi period) stands beside the path. 月見坂 is the cedar avenue
// (杉並木, trees of 300 years, 30–40 m) climbing to the temple; the lot keeps its last 70 m.
//
// The front (local z = d) is the foot of the avenue; the cover hall is at the back.

import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from './parts.ts';

const W = 44;
const D = 104;
const CX = 22;

export const LANDMARK_CHUSONJI_KONJIKIDO = landmarkDef({
  variant: 'chusonji_konjikido',
  size: { w: [W, W], d: [D, D] },
  eaves: 9.8,
  top: 38,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[CX - 2.8, 30], [CX + 2.8, 30], [CX + 2.8, D], [CX - 2.8, D]]);
  L.ground('gravel', [[10, 26], [34, 26], [34, 31], [10, 31]]);

  // 新覆堂: the stone platform, the hall's walls (a deep back block, the two front walls and the
  // lintel round the opening), the pyramid roof, the jewel.
  const [x0, x1, z0, z1] = [13.5, 30.5, 7, 25];
  const P = 0.8;
  const E = 9.8;
  L.box(x0 - 1.2, 0, z0 - 1.2, x1 + 1.2, P, z1 + 1.2, 'paint', { paint: 'gray' });
  L.box(x0, P, z0, x1, E, z1 - 6, 'paint', { paint: 'offWhite' });
  L.box(x0, P, z1 - 6, CX - 3.6, E, z1, 'paint', { paint: 'offWhite' });
  L.box(CX + 3.6, P, z1 - 6, x1, E, z1, 'paint', { paint: 'offWhite' });
  L.box(CX - 3.6, E - 1.5, z1 - 6, CX + 3.6, E, z1, 'paint', { paint: 'offWhite' });
  // Pilasters and a dark plinth band, the side windows (high, slit).
  for (const x of [x0, x1 - 0.5]) L.box(x - 0.05, P, z0 - 0.05, x + 0.55, E, z1 + 0.05, 'paint', { paint: 'gray', solid: false });
  L.box(x0 - 0.05, P, z0 - 0.05, x1 + 0.05, P + 0.6, z1 + 0.05, 'paint', { paint: 'charcoal', solid: false });
  L.windows('z', x0, -1, z0 + 2, z1 - 2, 4, E - 3, E - 1.2, 1.2, { broken: 0.5 });
  L.windows('z', x1, 1, z0 + 2, z1 - 2, 4, E - 3, E - 1.2, 1.2, { broken: 0.5 });
  L.box(x0 - 2.6, E - 0.3, z0 - 2.6, x1 + 2.6, E, z1 + 2.6, 'paint', { paint: 'charcoal', solid: false });
  L.shape('hip', x0 - 2.6, E, z0 - 2.6, x1 + 2.6, E + 5.2, z1 + 2.6, 'paint', { paint: 'charcoal', axis: 'x' });
  L.column(CX, (z0 + z1) / 2, 0.9, E + 4.6, E + 5.6, 'paint', { paint: 'gold' });
  L.column(CX, (z0 + z1) / 2, 0.55, E + 5.6, E + 6.6, 'paint', { paint: 'gold', taper: 0.2 });

  // The Golden Hall in the opening: a black lacquer base, gold walls and pillars, its gold pyramid roof.
  const gz0 = z1 - 5.8;
  const gz1 = z1 - 0.6;
  L.box(CX - 3.3, P, gz0, CX + 3.3, P + 0.7, gz1, 'paint', { paint: 'black' });
  L.box(CX - 2.7, P + 0.7, gz0 + 0.4, CX + 2.7, P + 5.6, gz1 - 0.4, 'paint', { paint: 'gold' });
  for (const x of [CX - 2.7, CX - 0.9, CX + 0.9, CX + 2.7]) L.box(x - 0.2, P + 0.7, gz1 - 0.5, x + 0.2, P + 5.6, gz1 - 0.3, 'paint', { paint: 'yellow', solid: false });
  L.box(CX - 0.7, P + 0.9, gz1 - 0.4, CX + 0.7, P + 4.2, gz1 - 0.3, 'paint', { paint: 'brown', solid: false }); // the shut doors
  L.shape('hip', CX - 3.4, P + 5.6, gz0 - 0.3, CX + 3.4, E - 1.6, gz1 + 0.3, 'paint', { paint: 'gold', solid: false });
  // The broken glass front: only its frame is left (a barrier stays in it).
  for (const x of [CX - 3.6, CX - 1.2, CX + 1.2, CX + 3.6]) L.box(x - 0.12, P, z1 - 0.15, x + 0.12, E - 1.5, z1, 'paint', { paint: 'charcoal', solid: false });
  L.box(CX - 3.6, P + 2.6, z1 - 0.15, CX + 3.6, P + 2.8, z1, 'paint', { paint: 'charcoal', solid: false });
  L.box(CX - 3.6, P, z1 - 0.15, CX + 3.6, E - 1.5, z1, 'paint', { paint: 'charcoal', hidden: true });
  // Steps up to the platform.
  L.box(CX - 4, 0, z1 + 1.2, CX + 4, P * 0.5, z1 + 2.2, 'paint', { paint: 'gray' });

  // 旧覆堂: the old wooden cover hall, west of the path: dark timber, a shingled pyramid roof.
  const [ox, oz] = [6.5, 40];
  L.box(ox - 4, 0, oz - 4, ox + 4, 0.6, oz + 4, 'paint', { paint: 'stone' });
  L.box(ox - 3.4, 0.6, oz - 3.4, ox + 3.4, 4.6, oz + 3.4, 'paint', { paint: 'brown' });
  for (const x of [ox - 3.4, ox - 1.1, ox + 1.1, ox + 3.2]) L.box(x - 0.1, 0.6, oz + 3.4, x + 0.3, 4.6, oz + 3.5, 'paint', { paint: 'black', solid: false });
  L.shape('hip', ox - 4.4, 4.6, oz - 4.4, ox + 4.4, 7.6, oz + 4.4, 'paint', { paint: 'charcoal', axis: 'x' });
  L.column(ox, oz, 0.3, 7.4, 8.3, 'paint', { paint: 'black', taper: 0.3 });

  // 月見坂: the cedars both sides of the path, from the foot up to the hall, and round the hall.
  for (let z = 34, i = 0; z < D - 2; z += 6.4, i++) {
    const h = 31 + ((i * 7) % 5) * 1.6;
    cedar(L, CX - 6.6 - (i % 2) * 0.8, z, h);
    if (Math.abs(z - oz) > 6) cedar(L, CX + 6.6 + ((i + 1) % 2) * 0.8, z, h - 1.5);
    else cedar(L, CX + 7, z, h - 1.5);
  }
  for (const [x, z] of [[4, 6], [40, 6], [4, 20], [40, 20], [39, 36], [3, 52], [40, 60], [3, 78], [40, 88]] as const) cedar(L, x, z, 33 + ((x + z) % 4));
  // The stone post at the foot of the avenue (月見坂).
  L.box(CX + 3.6, 0, D - 3.5, CX + 4.4, 2.2, D - 2.7, 'paint', { paint: 'gray' });

  // 90 days on: relief tents and crates at the foot, a fallen guide board.
  L.tent(9, D - 10, 'z', 6);
  L.crates(12, D - 18, 3);
  L.fallenSign(CX - 4.4, D - 6, 'z');
  L.car(35, D - 6, 'z');
}
