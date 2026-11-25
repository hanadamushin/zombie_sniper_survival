// L8: 西郷隆盛像 (the statue of Saigō Takamori, 1937, by Andō Teru), at the foot of Shiroyama, Kagoshima. The
// bronze stands in the uniform of an army general — the long buttoned coat, the epaulettes, the sword
// at the left hip under his hand — broad and heavy, the big head with its short-cropped hair, looking
// over the city to Sakurajima; the stone pedestal, the forest of Shiroyama behind.
//
// Real size: the figure 5.25 m on a pedestal of 2.75 m (8 m in all). The figure is a stack of oval
// prisms (the legs, the coat's skirt, the body, the shoulders, the head). The front (local z = d, the
// way he looks) faces south-east in reality; here south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';

const W = 30;
const D = 30;
const [X, Z] = [15, 13];
/** The pedestal's top: the figure's feet. */
const B = 2.75;
const BR: PaintName = 'bronze';

export const LANDMARK_SAIGO_STATUE = landmarkDef({
  variant: 'saigo_statue',
  size: { w: [W, W], d: [D, D] },
  eaves: B,
  top: 16,
  kind: 'tower',
  build,
});

function oval(L: Lm, x: number, z: number, w: number, d: number, y0: number, y1: number, taper = 1, solid = true): void {
  const p = L.shape('cyl', x - w / 2, y0, z - d / 2, x + w / 2, y1, z + d / 2, 'paint', { paint: BR, solid });
  if (taper !== 1) p.taper = taper;
}

function build(L: Lm): void {
  L.ground('paved', [[0, 12], [W, 12], [W, D], [0, D]]);
  L.ground('grass', [[0, 0], [W, 0], [W, 12], [0, 12]]);
  // The pedestal: a broad low step, the dressed stone block with its dark name plate, the cap.
  L.box(X - 4, 0, Z - 3.6, X + 4, 0.6, Z + 3.6, 'paint', { paint: 'granite' });
  L.box(X - 2.8, 0.6, Z - 2.5, X + 2.8, B - 0.3, Z + 2.5, 'paint', { paint: 'granite' });
  L.box(X - 1.3, 0.9, Z + 2.5, X + 1.3, 1.9, Z + 2.56, 'paint', { paint: 'charcoal', solid: false });
  L.box(X - 3, B - 0.3, Z - 2.7, X + 3, B, Z + 2.7, 'paint', { paint: 'gray' });

  // The legs in their trousers and the boots, a little apart.
  for (const s of [-1, 1]) {
    oval(L, X + s * 0.42, Z, 0.62, 0.66, B + 0.05, B + 2.2, 0.95);
    L.box(X + s * 0.42 - 0.3, B, Z - 0.3, X + s * 0.42 + 0.3, B + 0.35, Z + 0.62, 'paint', { paint: 'black', solid: false });
  }
  // The coat's skirt to the thigh, the broad body buttoned down the front, the belt.
  oval(L, X, Z, 2.2, 1.35, B + 1.6, B + 2.8, 0.82);
  oval(L, X, Z, 1.85, 1.2, B + 2.7, B + 4.3, 1.08);
  L.box(X - 0.95, B + 2.7, Z - 0.62, X + 0.95, B + 2.9, Z + 0.62, 'paint', { paint: 'charcoal', solid: false });
  for (let i = 0; i < 4; i++) L.box(X - 0.07, B + 3 + i * 0.32, Z + 0.6, X + 0.07, B + 3.12 + i * 0.32, Z + 0.66, 'paint', { paint: 'gold', solid: false });
  // The shoulders with their epaulettes, the collar, the neck, the big head and its cropped hair.
  oval(L, X, Z, 2.3, 1.15, B + 4.25, B + 4.6, 0.7);
  for (const s of [-1, 1]) L.box(X + s * 0.95 - 0.28, B + 4.45, Z - 0.3, X + s * 0.95 + 0.28, B + 4.62, Z + 0.3, 'paint', { paint: 'gold', solid: false });
  L.column(X, Z, 0.34, B + 4.5, B + 4.72, 'paint', { paint: BR });
  oval(L, X, Z + 0.04, 0.68, 0.74, B + 4.68, B + 5.18, 0.92);
  oval(L, X, Z - 0.02, 0.72, 0.78, B + 5.05, B + 5.25, 0.7, false);
  // The arms: the right hanging at his side, the left bent with the hand on the sword's hilt.
  L.box(X - 1.25, B + 2.7, Z - 0.32, X - 0.9, B + 4.4, Z + 0.3, 'paint', { paint: BR });
  L.box(X - 1.22, B + 2.4, Z - 0.16, X - 0.94, B + 2.75, Z + 0.16, 'paint', { paint: BR, solid: false });
  L.box(X + 0.9, B + 3.4, Z - 0.3, X + 1.3, B + 4.4, Z + 0.3, 'paint', { paint: BR });
  L.box(X + 0.85, B + 3.0, Z - 0.1, X + 1.35, B + 3.45, Z + 0.55, 'paint', { paint: BR });
  // The sword at the left hip, hanging back and down.
  L.box(X + 1.12, B + 0.9, Z - 0.55, X + 1.24, B + 3.1, Z - 0.35, 'paint', { paint: 'charcoal', solid: false });

  // The forest of Shiroyama behind, the plaza's low stone fence in front.
  for (const [x, z, h, r] of [[3.5, 3.5, 14, 3.4], [10, 4, 16, 3.8], [20, 4, 15, 3.6], [26.5, 3.5, 14, 3.2], [3, 11, 12, 3], [27, 11, 12, 3]] as const) broadleaf(L, x, z, h, r);
  L.box(4, 0, D - 3, W - 4, 0.6, D - 2.6, 'paint', { paint: 'granite' });

  // 90 days on: a fallen information board, relief crates by the fence, a car left on the road.
  L.fallenSign(X + 8, Z + 8, 'x');
  L.crates(4, 22, 3);
  L.car(22, D - 1.2, 'x');
}
