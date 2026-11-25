// L7: 徳島城跡 鷲の門 (the Washi-no-mon gate of Tokushima Castle's ruins), Tokushima Central Park, by
// Tokushima Station. The great gate of the castle's front (a 薬医門: two main posts and two rear
// posts under one big gabled roof of grey tiles, heavy dark doors), burnt in the air raid of 1945 and
// rebuilt in 1989; it stands alone on the square before the park. Behind it, the inner moat and the
// castle's stone walls of the local green schist (青石), crossed by the stone bridge 下乗橋.
//
// Real size: the gate about 8 m high and 8 m wide (from memory). Only the gate, a reach of the moat and
// its walls and the bridge are drawn. The front (local z = d, the square) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { pine } from '../tohoku/parts.ts';

const W = 48;
const D = 40;
const [GX, GZ] = [24, 30];
/** The inner moat (z range), the castle's stone wall north of it, the bridge (x range). */
const [MZ0, MZ1] = [7, 15];
const [BX0, BX1] = [33, 38];

export const LANDMARK_TOKUSHIMA_WASHINOMON = landmarkDef({
  variant: 'tokushima_washinomon',
  size: { w: [W, W], d: [D, D] },
  eaves: 5.6,
  top: 10,
  roof: 'gable',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, MZ1], [W, MZ1], [W, D], [0, D]]);
  L.ground('paved', [[GX - 3, MZ1], [GX + 3, MZ1], [GX + 3, D], [GX - 3, D]]);
  L.ground('water', [[0, MZ0], [W, MZ0], [W, MZ1], [0, MZ1]], 2.2, 1.1);
  L.ground('gravel', [[0, 0], [W, 0], [W, MZ0], [0, MZ0]]);

  // The gate: the main posts, the rear posts, the lintel and its tie beams, the doors, the big roof
  // whose ridge stands forward of the middle (a 薬医門).
  for (const s of [-1, 1]) {
    L.box(GX + s * 3.4 - 0.4, 0, GZ - 0.4, GX + s * 3.4 + 0.4, 5.2, GZ + 0.4, 'woodDark');
    L.box(GX + s * 3.4 - 0.25, 0, GZ - 3.2, GX + s * 3.4 + 0.25, 4.4, GZ - 2.7, 'woodDark');
    L.box(GX + s * 3.4 - 0.15, 3.9, GZ - 2.9, GX + s * 3.4 + 0.15, 4.3, GZ, 'woodDark', { solid: false });
    L.box(GX + s * 2.1 - 1.2, 0.05, GZ - 0.12, GX + s * 2.1 + 1.2, 4.2, GZ + 0.12, 'paint', { paint: 'black' });
  }
  L.box(GX - 4.6, 4.4, GZ - 0.45, GX + 4.6, 5.2, GZ + 0.45, 'woodDark');
  L.box(GX - 4.2, 5.2, GZ - 3, GX + 4.2, 5.6, GZ + 0.6, 'woodDark', { solid: false });
  L.box(GX - 5.6, 5.4, GZ - 4.4, GX + 5.6, 5.7, GZ + 2.2, 'paint', { paint: 'white', solid: false });
  L.shape('gable', GX - 5.6, 5.7, GZ - 4.4, GX + 5.6, 8.4, GZ + 2.2, 'paint', { paint: 'kawara', axis: 'x' });
  L.box(GX - 5.7, 8.25, GZ - 1.3, GX + 5.7, 8.8, GZ - 0.9, 'paint', { paint: 'charcoal', solid: false });
  for (const s of [-1, 1]) L.box(GX + s * 5.7 - 0.3, 8.2, GZ - 1.5, GX + s * 5.7 + 0.3, 8.8, GZ - 0.7, 'paint', { paint: 'charcoal', solid: false });

  // The castle's stone wall of green schist north of the moat, rising from the water; the wall's
  // low white plaster fence on top.
  L.box(0, -2.2, MZ0 - 2.6, W, 4.6, MZ0, 'paint', { paint: 'grayGreen' });
  L.box(0, 4.6, MZ0 - 2, W, 5.8, MZ0 - 1.6, 'paint', { paint: 'white', solid: false });
  // The stone bridge 下乗橋 across the moat, on a pier.
  L.box(BX0, 0, MZ0, BX1, 0.6, MZ1, 'paint', { paint: 'granite' });
  for (const x of [BX0 + 0.15, BX1 - 0.15]) L.box(x - 0.15, 0.6, MZ0, x + 0.15, 1.5, MZ1, 'paint', { paint: 'granite', solid: false });
  L.box(BX0, -2.2, MZ0 + 3.6, BX1, 0, MZ0 + 4.4, 'paint', { paint: 'granite' });

  // Pines of the park and the square.
  for (const [x, z, h] of [[5, 22, 9], [43, 22, 9], [10, 36, 7], [40, 36, 7], [6, 3, 10], [42, 3, 10]] as const) pine(L, x, z, h);

  // 90 days on: relief tents and crates on the square, a car left by the gate, a fallen sign, scorch.
  L.tent(10, 28, 'z', 6);
  L.crates(36, 26, 4);
  L.car(36, 36, 'x', { burnt: true });
  L.fallenSign(15, 38, 'x');
  L.scorch(GX - 4.6, 4.45, GZ + 0.46, GX - 1, 5.15, GZ + 0.5);
}
