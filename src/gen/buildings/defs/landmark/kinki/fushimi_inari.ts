// L5: 伏見稲荷大社 千本鳥居 (Fushimi Inari Taisha and its thousand torii), Fushimi, Kyōto. From the great
// torii the approach climbs to the vermilion two-storey gate (楼門, 1589) with a stone fox on each side,
// the main hall (本殿) behind it under its long sweeping roof of cypress bark, and then into the woods of
// Mount Inari the two tunnels of the 千本鳥居: vermilion torii set side by side, black-topped, so close
// together that they make two parallel red corridors through the green.
//
// The tunnels are 36 torii each here (the real path climbs the mountain through about ten thousand);
// each torii is four boxes (parts.ts boxTorii). The real shrine faces west (towards the station); the
// front (local z = d, the great torii) is the west.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { torii } from '../chubu/parts.ts';
import { broadleaf } from '../kanto/parts.ts';
import { cedar } from '../tohoku/parts.ts';
import { boxTorii } from './parts.ts';

const W = 44;
const D = 100;
const CX = 22;
const RED: PaintName = 'intlOrange';
const ROOF: PaintName = 'hiwada';

export const LANDMARK_FUSHIMI_INARI = landmarkDef({
  variant: 'fushimi_inari',
  size: { w: [W, W], d: [D, D] },
  eaves: 10,
  top: 18,
  roof: 'gable',
  kind: 'house',
  build,
});

/** A stone fox on its pedestal (稲荷の狐), facing the approach. */
function fox(L: Lm, x: number, z: number): void {
  L.box(x - 0.8, 0, z - 0.8, x + 0.8, 1.6, z + 0.8, 'paint', { paint: 'stone' });
  L.box(x - 0.35, 1.6, z - 0.5, x + 0.35, 2.4, z + 0.3, 'paint', { paint: 'gray', solid: false });
  L.box(x - 0.25, 2.4, z - 0.1, x + 0.25, 3, z + 0.35, 'paint', { paint: 'gray', solid: false });
  for (const s of [-1, 1]) L.box(x + s * 0.17 - 0.06, 3, z + 0.05, x + s * 0.17 + 0.06, 3.3, z + 0.2, 'paint', { paint: 'gray', solid: false });
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[CX - 4, 56], [CX + 4, 56], [CX + 4, D], [CX - 4, D]]);
  L.ground('gravel', [[CX - 10, 60], [CX + 10, 60], [CX + 10, 80], [CX - 10, 80]]);

  // The great torii at the start of the approach.
  torii(L, CX, D - 3, 'z', 6.5, 9, RED, 'myojin');

  // The tower gate (楼門): vermilion posts and white walls, two storeys, the cypress-bark roofs.
  const [gz0, gz1] = [86, 92];
  const half = 8;
  for (const [a, b] of [[CX - half, CX - 2.2], [CX + 2.2, CX + half]] as const) {
    L.box(a, 0, gz0, b, 6.2, gz1, 'paint', { paint: RED });
    L.box(a + 0.8, 1.2, gz1 - 0.02, b - 0.8, 5, gz1 + 0.06, 'paint', { paint: 'white', solid: false });
  }
  L.box(CX - half, 5.2, gz0, CX + half, 6.4, gz1, 'paint', { paint: RED });
  L.shape('hip', CX - half - 1.8, 6.4, gz0 - 1.8, CX + half + 1.8, 8, gz1 + 1.8, 'paint', { paint: ROOF, axis: 'x' });
  L.box(CX - half + 1, 7.6, gz0 + 0.8, CX + half - 1, 11, gz1 - 0.8, 'paint', { paint: RED });
  L.box(CX - half + 1.6, 8.2, gz1 - 0.82, CX + half - 1.6, 10.4, gz1 - 0.72, 'paint', { paint: 'white', solid: false });
  L.shape('hip', CX - half - 2, 11, gz0 - 2, CX + half + 2, 13, gz1 + 2, 'paint', { paint: ROOF, axis: 'x' });
  L.shape('gable', CX - half + 2.5, 12.3, gz0 - 0.6, CX + half - 2.5, 15.5, gz1 + 0.6, 'paint', { paint: ROOF, axis: 'x' });
  L.box(CX - 1.2, 9, gz1 + 1.2, CX + 1.2, 10.4, gz1 + 1.35, 'paint', { paint: 'gold', solid: false });
  fox(L, CX - 5.5, gz1 + 4);
  fox(L, CX + 5.5, gz1 + 4);

  // The main hall (本殿): vermilion posts, white walls, the roof sweeping long over the front (流造).
  const [hz0, hz1] = [64, 76];
  L.box(CX - 9, 0, hz0 - 0.4, CX + 9, 1, hz1 + 0.4, 'paint', { paint: 'stone' });
  L.box(CX - 8, 1, hz0, CX + 8, 6.2, hz1 - 3, 'paint', { paint: 'white' });
  for (let i = 0; i <= 5; i++) {
    const x = CX - 8 + (16 * i) / 5;
    L.box(x - 0.3, 1, hz1 - 3.3, x + 0.3, 6.2, hz1 - 2.7, 'paint', { paint: RED });
    L.box(x - 0.25, 1, hz1 - 0.3, x + 0.25, 4.6, hz1 + 0.2, 'paint', { paint: RED });
  }
  L.box(CX - 8.3, 5.8, hz0 - 0.3, CX + 8.3, 6.4, hz1 - 2.7, 'paint', { paint: RED, solid: false });
  L.shape('gable', CX - 10, 6.2, hz0 - 2, CX + 10, 10, hz1 - 6, 'paint', { paint: ROOF, axis: 'x' });
  L.shape('wedge', CX - 10, 4.4, hz1 - 6.2, CX + 10, 10, hz1 + 2, 'paint', { paint: ROOF, slope: 'z-', solid: false });

  // The thousand torii: two tunnels side by side up into the woods.
  for (const x of [CX - 4.5, CX + 4.5]) {
    for (let i = 0; i < 36; i++) boxTorii(L, x, 10 + i * 1.25, 'z', 2.3, 3.2, RED, 0.4);
    L.ground('gravel', [[x - 1.2, 6], [x + 1.2, 6], [x + 1.2, 56], [x - 1.2, 56]]);
  }
  // The woods of the mountain round them.
  for (const [x, z, h, r] of [[5, 6, 14, 4.5], [5, 22, 15, 4.5], [5, 40, 13, 4.5], [39, 8, 14, 4.5], [39, 26, 15, 4.5], [39, 44, 13, 4.5], [CX, 3, 12, 3.6], [10, 54, 12, 4], [34, 56, 12, 4]] as const) broadleaf(L, x, z, h, r);
  for (const [x, z] of [[11, 14], [12, 32], [33, 18], [32, 38], [CX, 30]] as const) cedar(L, x, z, 18, 2.4);

  // 90 days on: a fallen sign on the approach, sandbags at the gate, relief crates.
  L.fallenSign(CX + 2.5, 82, 'z');
  L.sandbags(CX - 3.5, 84, CX + 3.5, 84);
  L.crates(CX + 10, 92, 4);
}
