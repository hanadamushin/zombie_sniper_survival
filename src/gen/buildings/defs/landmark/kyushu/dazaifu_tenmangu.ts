// L8: 太宰府天満宮 本殿 (the main hall of Dazaifu Tenmangū, 1591), Dazaifu, Fukuoka. The shrine of Sugawara
// no Michizane: a hall of five bays in the Momoyama manner, vermilion posts and walls with black and
// gold, under a great cypress-bark roof (檜皮葺) whose front sweeps down over the worship porch, and on
// the porch the big curved gable (唐破風). Before it the two-storey gate (楼門) in the vermilion
// cloister, and in front of the gate the heart-shaped pond (心字池) crossed by the steep drum bridge
// (太鼓橋). The flying plum (飛梅) stands to the right of the hall, camphor trees behind.
//
// Real size: the hall about 24 × 14 m (13.5 m to the ridge), the gate 12.5 m. The precinct is drawn
// small (48 × 64 m: the pond, the bridge, the gate and its cloister, the hall). The front (local
// z = d, the approach) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { karahafu } from '../chubu/parts.ts';
import { broadleaf } from '../kanto/parts.ts';
import { keepTop } from '../chugoku/parts.ts';
import { alongZ } from './parts.ts';

const W = 48;
const D = 64;
const CX = 24;
/** The pond (z) and the drum bridge's rise. */
const [PZ0, PZ1] = [49, 59];
const HUMP = 2.2;
/** The gate and cloister (z), the hall (x, z). */
const GZ = 42;
const [HX0, HX1, HZ0, HZ1] = [12, 36, 11, 25];

export const LANDMARK_DAZAIFU_TENMANGU = landmarkDef({
  variant: 'dazaifu_tenmangu',
  size: { w: [W, W], d: [D, D] },
  eaves: 6.6,
  top: 24,
  roof: 'gable',
  kind: 'house',
  build,
});

const hump = (z: number): number => 0.25 + HUMP * Math.sin((Math.PI * Math.min(Math.max(z - PZ0 + 0.6, 0), PZ1 - PZ0 + 1.2)) / (PZ1 - PZ0 + 1.2));

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The heart-shaped pond (its shore in curls), the drum bridge across it.
  L.ground('water', [[3, PZ0 + 1], [14, PZ0 - 1], [CX, PZ0 + 1], [34, PZ0 - 1], [W - 4, PZ0], [W - 3, PZ1], [CX + 6, PZ1 + 1], [CX, PZ1 - 0.5], [CX - 8, PZ1 + 1], [5, PZ1]], 1.6, 0.6);
  alongZ(L, PZ0 - 0.6, PZ1 + 0.6, 18, hump, 0.5, CX - 1.6, CX + 1.6, 'intlOrange');
  for (const s of [-1, 1]) {
    // bridgeRail runs along x: the rail is drawn here along z by boxes following the hump.
    for (let i = 0; i < 10; i++) {
      const z0 = PZ0 - 0.6 + ((PZ1 - PZ0 + 1.2) * i) / 10;
      const z1 = z0 + (PZ1 - PZ0 + 1.2) / 10;
      const y = hump((z0 + z1) / 2);
      L.box(CX + s * 1.6 - 0.09, y + 0.7, z0, CX + s * 1.6 + 0.09, y + 0.9, z1, 'paint', { paint: 'intlOrange', solid: false });
    }
    for (const z of [PZ0 - 0.6, (PZ0 + PZ1) / 2, PZ1 + 0.6]) L.box(CX + s * 1.6 - 0.12, hump(z), z - 0.12, CX + s * 1.6 + 0.12, hump(z) + 1.1, z + 0.12, 'paint', { paint: 'intlOrange', solid: false });
  }
  // The stone-paved approach to the gate.
  L.ground('paved', [[CX - 2, PZ1 + 1], [CX + 2, PZ1 + 1], [CX + 2, D], [CX - 2, D]]);
  L.ground('paved', [[CX - 2, GZ + 3], [CX + 2, GZ + 3], [CX + 2, PZ0 - 1], [CX - 2, PZ0 - 1]]);

  // The cloister (回廊): a vermilion wall under a cypress-bark roof round the court, open at the gate.
  const cl = (x0: number, z0: number, x1: number, z1: number): void => {
    L.box(x0, 0, z0, x1, 3.6, z1, 'paint', { paint: 'intlOrange' });
    L.box(x0 + 0.1, 0.9, z0 - 0.06, x1 - 0.1, 2.8, z1 + 0.06, 'paint', { paint: 'white', solid: false });
    L.shape('gable', x0 - 0.8, 3.6, z0 - 0.8, x1 + 0.8, 5.2, z1 + 0.8, 'paint', { paint: 'hiwada', axis: x1 - x0 > z1 - z0 ? 'x' : 'z' });
  };
  cl(2, GZ - 1.2, CX - 6.5, GZ + 1.2);
  cl(CX + 6.5, GZ - 1.2, W - 2, GZ + 1.2);
  cl(2, 4, 4.4, GZ - 1.2);
  cl(W - 4.4, 4, W - 2, GZ - 1.2);

  // The two-storey gate (楼門): vermilion posts (its middle bay open), white side bays, the skirt roof,
  // the upper storey and its hip-and-gable roof of cypress bark.
  const [g0, g1] = [CX - 6.5, CX + 6.5];
  for (const x of [g0 + 0.4, CX - 2.1, CX + 2.1, g1 - 0.4]) for (const z of [GZ - 2.6, GZ + 2.6]) L.box(x - 0.35, 0, z - 0.35, x + 0.35, 5.2, z + 0.35, 'paint', { paint: 'intlOrange' });
  for (const s of [-1, 1]) L.box(CX + s * 2.1, 0.4, GZ - 0.2, CX + s * 6.2, 4.6, GZ + 0.2, 'paint', { paint: 'white' });
  L.box(g0, 4.6, GZ - 3, g1, 5.6, GZ + 3, 'paint', { paint: 'black', solid: false });
  L.shape('hip', g0 - 1.6, 5.6, GZ - 4.4, g1 + 1.6, 7.2, GZ + 4.4, 'paint', { paint: 'hiwada', axis: 'x' });
  L.box(CX - 5, 6.4, GZ - 2.2, CX + 5, 9.4, GZ + 2.2, 'paint', { paint: 'intlOrange' });
  L.windows('x', GZ + 2.2, 1, CX - 4, CX + 4, 3, 7.2, 8.8, 1.4, { paint: 'white', broken: 0 });
  keepTop(L, CX, GZ, 5, 2.2, 9.4, 1.8, 3.1, 'hiwada', 'gold', 'gold');

  // The main hall on its stone platform: vermilion posts and walls, black tie beams, gold fittings.
  L.box(HX0 - 1.5, 0, HZ0 - 1.5, HX1 + 1.5, 0.9, HZ1 + 7, 'paint', { paint: 'granite' });
  L.box(HX0, 0.9, HZ0, HX1, 6.6, HZ1, 'paint', { paint: 'intlOrange' });
  L.box(HX0 - 0.05, 5, HZ0 - 0.05, HX1 + 0.05, 5.6, HZ1 + 0.05, 'paint', { paint: 'black', solid: false });
  L.windows('x', HZ1, 1, HX0 + 1, HX1 - 1, 5, 1.6, 4.6, 3.4, { paint: 'gold', broken: 0 });
  for (let i = 0; i <= 5; i++) {
    const x = HX0 + ((HX1 - HX0) * i) / 5;
    L.box(x - 0.3, 0.9, HZ1 + 0.02, x + 0.3, 6.6, HZ1 + 0.3, 'paint', { paint: 'intlOrange', solid: false });
  }
  // The great roof: the gable over the hall, its long front slope over the worship porch (流造).
  L.shape('gable', HX0 - 2.2, 6.6, HZ0 - 2.6, HX1 + 2.2, 13.5, HZ1 + 1.4, 'paint', { paint: 'hiwada', axis: 'x' });
  L.shape('wedge', HX0 - 2.2, 4.8, HZ1 + 1.2, HX1 + 2.2, 7.2, HZ1 + 6.4, 'paint', { paint: 'hiwada', slope: 'z-' });
  L.box(HX0 - 2.3, 13.3, (HZ0 + HZ1) / 2 - 0.9, HX1 + 2.3, 14, (HZ0 + HZ1) / 2 + 0.9, 'paint', { paint: 'black', solid: false });
  for (const s of [-1, 1]) L.box(CX + s * 12.5 - 0.3, 13.6, (HZ0 + HZ1) / 2 - 0.3, CX + s * 12.5 + 0.3, 14.6, (HZ0 + HZ1) / 2 + 0.3, 'paint', { paint: 'gold', solid: false });
  // The worship porch's posts and the big curved gable (唐破風) over its middle.
  for (const x of [HX0 + 0.5, CX - 5, CX + 5, HX1 - 0.5]) L.box(x - 0.3, 0.9, HZ1 + 5.2, x + 0.3, 5, HZ1 + 5.8, 'paint', { paint: 'intlOrange' });
  karahafu(L, 'z+', HZ1 + 5.8, CX, 5.4, 6.2, 9.8, 0.8, 'hiwada', 'gold');
  L.box(CX - 3, 2.4, HZ1 + 5.4, CX + 3, 3.4, HZ1 + 5.6, 'paint', { paint: 'white', solid: false }); // the curtain

  // The flying plum (bare in November) to the right of the hall, the tachibana to the left, the camphors behind.
  L.column(38, 33, 0.25, 0, 2, 'paint', { paint: 'brown' });
  L.column(38, 33, 2.4, 1.8, 3.8, 'paint', { paint: 'brown', taper: 1.3, solid: false });
  L.column(10, 33, 0.2, 0, 1.6, 'paint', { paint: 'brown' });
  L.column(10, 33, 1.6, 1.4, 3.6, 'paint', { paint: 'green', taper: 0.5, solid: false });
  for (const [x, z, h] of [[6, 6, 22], [42, 6, 24], [24, 5.8, 20]] as const) broadleaf(L, x, z, h, 5.2);
  for (const [x, z] of [[6, 60], [42, 60]] as const) broadleaf(L, x, z, 14, 3.6);

  // 90 days on: a relief tent and crates in the court, a burnt car on the approach, a fallen sign.
  L.tent(32, 34, 'x', 6);
  L.crates(13, 35, 4);
  L.car(36, 62, 'x', { burnt: true });
  L.fallenSign(18, 61, 'x');
  L.scorch(g1 + 0.2, 0.4, GZ + 1.22, g1 + 4, 3, GZ + 1.3);
}
