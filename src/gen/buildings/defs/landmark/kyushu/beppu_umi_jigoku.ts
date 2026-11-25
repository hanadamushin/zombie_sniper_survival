// L8: 海地獄 (Umi Jigoku, "the sea hell"), Kannawa, Beppu, Ōita. The greatest of Beppu's "hells": a hot
// spring pond of 98 °C, its water a milky cobalt blue like the sea, under a column of steam that
// still rises over the abandoned town — with the plumes from the vents and the bath-houses' stacks round
// it, Beppu's 湯けむり (the steam of the hot springs). By the pond the lotus pond (大鬼蓮) and a small red
// torii; the visitors' hall behind under grey tiles.
//
// Real size: the pond about 200 m round. The steam plumes (drawn only) widen as they rise to 30 m.
// The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { torii } from '../chubu/parts.ts';
import { broadleaf } from '../kanto/parts.ts';
import { pine } from '../tohoku/parts.ts';
import { steam } from './parts.ts';

const W = 56;
const D = 48;
const [PX, PZ] = [26, 25];

export const LANDMARK_BEPPU_UMI_JIGOKU = landmarkDef({
  variant: 'beppu_umi_jigoku',
  size: { w: [W, W], d: [D, D] },
  eaves: 6,
  top: 34,
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[PX - 3, PZ + 9], [PX + 3, PZ + 9], [PX + 3, D], [PX - 3, D]]);
  L.ground('gravel', [[PX - 15, PZ - 10], [PX + 15, PZ - 10], [PX + 15, PZ + 10], [PX - 15, PZ + 10]]);
  // The pond: a rim of grey rock, the cobalt water (an oval slab: the water stands still, steaming).
  L.shape('cyl', PX - 13, 0, PZ - 8.5, PX + 13, 0.35, PZ + 8.5, 'paint', { paint: 'gray', solid: false });
  L.shape('cyl', PX - 12, 0.3, PZ - 7.6, PX + 12, 0.42, PZ + 7.6, 'paint', { paint: 'jigoku', solid: false });
  // The low wooden fence round it (open at the front).
  for (const [a, b, c, d] of [[PX - 14.5, PZ - 9.5, PX + 14.5, PZ - 9.3], [PX - 14.5, PZ - 9.5, PX - 14.3, PZ + 9.5], [PX + 14.3, PZ - 9.5, PX + 14.5, PZ + 9.5], [PX - 14.5, PZ + 9.3, PX - 3, PZ + 9.5], [PX + 3, PZ + 9.3, PX + 14.5, PZ + 9.5]] as const) {
    L.box(a, 0, b, c, 1, d, 'wood', { solid: false });
  }
  // The steam: the great column over the pond and its drift, the vents' plumes, the stacks.
  steam(L, PX - 2, PZ, 0.4, 30, 2.6, 0.16, 5);
  steam(L, PX + 6, PZ + 2, 0.4, 20, 1.6, 0.2, 3);
  steam(L, PX - 8, PZ - 3, 0.4, 16, 1.4, 0.18, 3);
  for (const [x, z, h] of [[6, 20, 7], [50, 30, 9]] as const) {
    L.column(x, z, 0.9, 0, h, 'paint', { paint: 'granite', taper: 0.85 });
    steam(L, x, z, h, 16, 0.9, 0.25, 3);
  }
  for (const [x, z] of [[46, 42], [9, 9]] as const) {
    L.box(x - 1.6, 0, z - 1.2, x + 1.6, 1, z + 1.2, 'paint', { paint: 'gray', yaw: 0.4 });
    steam(L, x, z, 1, 10, 0.9, 0.3, 2);
  }

  // The lotus pond (green leaves on dark water) in the front-left corner.
  L.ground('water', [[3, 35], [15, 35], [15, 45], [3, 45]], 1, 0.3);
  for (const [x, z, r] of [[6, 38, 1.4], [11, 37.5, 1.2], [8.5, 42, 1.6], [12.5, 42.5, 1]] as const) L.column(x, z, r, -0.28, -0.22, 'paint', { paint: 'green', solid: false });
  // A small red torii and its shrine behind the pond.
  torii(L, 8, 12, 'z', 2.6, 3.4, 'intlOrange');
  L.box(6.4, 0, 3, 9.6, 2.2, 6, 'paint', { paint: 'intlOrange' });
  L.shape('gable', 5.8, 2.2, 2.5, 10.2, 3.6, 6.6, 'paint', { paint: 'kawara', axis: 'z' });

  // The visitors' hall behind: wood and white plaster under grey tiles, its glass front.
  L.box(32, 0, 2, 53, 4.6, 10, 'paint', { paint: 'white' });
  L.box(32, 0, 9.9, 53, 3.4, 10.1, 'wood', { solid: false });
  L.windows('x', 10.1, 1, 34, 51, 5, 0.6, 3, 3, { paint: 'skyBlue', broken: 0.5 });
  L.shape('hip', 31.2, 4.6, 1.2, 53.8, 7.2, 10.8, 'paint', { paint: 'kawara', axis: 'x' });

  // Trees round the grounds.
  for (const [x, z, h] of [[3, 3, 9], [53, 45, 8], [20, 3, 8]] as const) pine(L, x, z, h);
  for (const [x, z] of [[52, 18], [4, 28]] as const) broadleaf(L, x, z, 10, 3);

  // 90 days on: relief crates and a tent on the forecourt, a burnt car at the gate, a fallen sign.
  L.tent(42, 37, 'x', 6);
  L.crates(34, 43, 3);
  L.car(16, 46, 'x', { burnt: true });
  L.fallenSign(PX + 6, D - 2, 'x');
}
