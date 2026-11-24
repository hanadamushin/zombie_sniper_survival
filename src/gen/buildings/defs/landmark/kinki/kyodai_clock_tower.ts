// L5: 京都大学 百周年時計台記念館 (the clock tower of Kyōto University, 1925, Takeda Goichi), Yoshida
// campus, Sakyō. A long two-storey building in pale tile and stone with the square clock tower rising
// from its middle: tall windows between vertical piers up the tower, the round clock under its
// stepped top. Before it, inside the main gate, the great camphor tree (楠) in its round bed.
//
// Real size: the building about 72 m long, the tower about 26 m. The tower faces the main gate on
// Higashiōji-dōri (west): the front (local z = d) is the west.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';
import { ginkgo } from '../kanto/parts.ts';
import { disc } from './parts.ts';

const W = 80;
const D = 60;
const CX = 40;
/** The wings: front face, back face, height. */
const F = 30;
const B = 14;
const H = 11;
/** The tower: half width, front face, top. */
const TH = 8;
const TF = 32;
const TOP = 26;

export const LANDMARK_KYODAI_CLOCK_TOWER = landmarkDef({
  variant: 'kyodai_clock_tower',
  size: { w: [W, W], d: [D, D] },
  eaves: H,
  top: TOP + 4,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, F], [W, F], [W, D], [0, D]]);
  L.ground('paved', [[CX - 6, F], [CX + 6, F], [CX + 6, D], [CX - 6, D]]);
  // The wings: pale walls, the stone base course, two rows of windows, the cornice.
  L.box(4, 0, B, W - 4, H, F, 'paint', { paint: 'stone' });
  L.box(3.8, 0, B - 0.2, W - 3.8, 1.2, F + 0.2, 'paint', { paint: 'granite', solid: false });
  L.box(3.7, H - 0.8, B - 0.3, W - 3.7, H, F + 0.3, 'paint', { paint: 'granite', solid: false });
  for (const [u0, u1] of [[5, CX - TH - 1], [CX + TH + 1, W - 5]] as const) {
    for (const y of [2, 6.4]) L.windows('x', F, 1, u0, u1, 9, y, y + 2.8, 1.3, { broken: 0.4 });
    for (let i = 0; i <= 9; i++) {
      const x = u0 + ((u1 - u0) * i) / 9;
      L.box(x - 0.35, 1.2, F, x + 0.35, H - 0.8, F + 0.25, 'paint', { paint: 'brickBrown', solid: false });
    }
  }
  // The tower: piers up the front, tall windows between them, the clock, the stepped top, the flagpole.
  L.box(CX - TH, 0, B - 2, CX + TH, TOP, TF, 'paint', { paint: 'stone' });
  for (const x of [CX - TH, CX - 2.8, CX + 2.8, CX + TH]) L.box(x - 0.8, 0, TF, x + 0.8, TOP - 2, TF + 0.6, 'paint', { paint: 'brickBrown' });
  for (const x of [CX - 5.4, CX + 5.4]) L.box(x - 1, 3, TF + 0.02, x + 1, 17, TF + 0.1, 'paint', { paint: 'windowDark', solid: false });
  L.box(CX - 1.6, 0, TF + 0.02, CX + 1.6, 4, TF + 0.1, 'doorSteel');
  L.box(CX - 1.4, 6, TF + 0.02, CX + 1.4, 15, TF + 0.1, 'paint', { paint: 'windowDark', solid: false });
  disc(L, CX, 20.6, 2.2, 2.2, TF + 0.05, TF + 0.3, 'white', 6);
  disc(L, CX, 20.6, 2.5, 2.5, TF - 0.05, TF + 0.15, 'brickBrown', 6);
  L.box(CX - 0.12, 20.4, TF + 0.3, CX + 0.12, 22.2, TF + 0.4, 'paint', { paint: 'black', solid: false });
  L.box(CX - 0.1, 20.4, TF + 0.3, CX + 1.3, 20.7, TF + 0.4, 'paint', { paint: 'black', solid: false });
  L.box(CX - TH - 0.3, TOP - 2, B - 2.3, CX + TH + 0.3, TOP, TF + 0.6, 'paint', { paint: 'granite' });
  L.box(CX - TH + 1.5, TOP, B, CX + TH - 1.5, TOP + 1.4, TF - 2, 'paint', { paint: 'stone' });
  L.box(CX - 0.1, TOP + 1.4, 22, CX + 0.1, TOP + 4, 22.2, 'steel', { solid: false });
  // The side windows of the tower.
  for (const s of [-1, 1] as const) L.windows('z', CX + s * TH, s, B, TF - 1, 3, 12, 17, 1.4, { broken: 0.3 });

  // The camphor tree in its round bed before the tower, ginkgoes along the walk.
  L.column(CX, 50, 7, 0, 0.5, 'paint', { paint: 'stone' });
  broadleaf(L, CX, 50, 12, 9);
  for (const z of [36, 56]) for (const x of [12, 68]) ginkgo(L, x, z, 14);

  // 90 days on: a relief tent and crates on the lawn, a burnt car, sandbags at the door, a fallen sign.
  L.tent(20, 44, 'x', 8);
  L.crates(26, 52, 4);
  L.car(62, 46, 'z', { burnt: true });
  L.sandbags(CX - 3, TF + 1.6, CX + 3, TF + 1.6);
  L.fallenSign(CX + 4, 56, 'x');
}
