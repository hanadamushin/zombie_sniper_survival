// L5: 太陽の塔 (the Tower of the Sun, Okamoto Tarō, 1970), the Expo '70 Commemorative Park, Suita. 70 m:
// a white body flaring like a bell to its foot (20 m across), two short arms raised to the sides (25 m
// from tip to tip), and three faces: the golden face (黄金の顔, 10.6 m) at the top looking south, the
// grey face of the present (太陽の顔) on the belly, the black sun (黒い太陽) on the back. Red zigzags run
// along the arms and down the front.
//
// The body is stacked round prisms (24 sides) narrowing upwards; the faces are discs in the upright
// plane (parts.ts disc), the arms steps of boxes. It stands on the park's lawn; the front (local
// z = d, the golden face) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf, round, roundSolid } from '../kanto/parts.ts';
import { disc } from './parts.ts';

const W = 48;
const C = W / 2;
const TOP = 70;
const BODY: PaintName = 'offWhite';
/** Radius of the body at height y. */
const PROFILE: readonly [number, number][] = [[0, 10], [6, 8.6], [16, 7], [30, 5.9], [44, 5.2], [54, 4.4], [64, 3.9], [70, 2.2]];
const radius = (y: number): number => {
  for (let i = 1; i < PROFILE.length; i++) {
    const [y0, r0] = PROFILE[i - 1]!;
    const [y1, r1] = PROFILE[i]!;
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return PROFILE[PROFILE.length - 1]![1];
};

export const LANDMARK_TOWER_OF_THE_SUN = landmarkDef({
  variant: 'tower_of_the_sun',
  size: { w: [W, W], d: [W, W] },
  eaves: 54,
  top: TOP,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, W], [0, W]]);
  L.ground('paved', [[C - 14, C - 14], [C + 14, C - 14], [C + 14, C + 14], [C - 14, C + 14]]);

  // The body: round sections, each tapering to the next one's radius.
  for (let i = 1; i < PROFILE.length; i++) {
    const [y0, r0] = PROFILE[i - 1]!;
    const [y1, r1] = PROFILE[i]!;
    round(L, C, C, r0, y0, y1, BODY, { taper: r1 / r0, solid: i < PROFILE.length - 1 });
  }
  roundSolid(L, C, C, 8.6, 0, 6);

  // The arms: from the shoulders (42 m) out and up to the tips, thick steps of boxes, a red zigzag on top.
  for (const s of [-1, 1]) {
    const steps: [number, number, number, number][] = [
      // distance from the axis, bottom, top, half depth
      [5, 38, 46, 3],
      [7.5, 39.5, 46.5, 2.6],
      [10, 41, 47.5, 2.3],
      [12.5, 43, 49, 2],
    ];
    let prev = 3.5;
    for (const [d, y0, y1, hz] of steps) {
      const [a, b] = s < 0 ? [C - d, C - prev] : [C + prev, C + d];
      L.box(a, y0, C - hz, b, y1, C + hz, 'paint', { paint: BODY });
      prev = d;
    }
    // The raised tip, and the red zigzag along the arm's front.
    L.box(s < 0 ? C - 12.5 : C + 10.8, 49, C - 1.6, s < 0 ? C - 10.8 : C + 12.5, 52, C + 1.6, 'paint', { paint: BODY });
    for (let k = 0; k < 4; k++) {
      const x = C + s * (5 + k * 2.2);
      L.box(Math.min(x, x + s * 1.6), 44 + (k % 2) * 1.4, C + 2.2, Math.max(x, x + s * 1.6), 44.6 + (k % 2) * 1.4 + 0.7, C + 2.8, 'paint', { paint: 'red', solid: false });
    }
  }
  // The red zigzags down the front, from the shoulders to the belly's face.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const y = 41 - k * 2.2;
      const x = C + s * (2.4 + (k % 2) * 1.2);
      const z = C + radius(y) - 0.15;
      L.box(x - 0.45, y - 2.4, z, x + 0.45, y, z + 0.4, 'paint', { paint: 'red', solid: false });
    }
  }

  // The grey face of the present on the belly: a disc with a raised rim, the eyes and the mouth.
  const fy = 25;
  const fz = C + radius(fy);
  disc(L, C, fy, 6, 6, fz - 0.6, fz + 0.4, 'gray', 7);
  disc(L, C, fy, 4.8, 4.8, fz + 0.3, fz + 0.6, 'silver', 6);
  for (const s of [-1, 1]) L.box(C + s * 2.2 - 1, fy + 1, fz + 0.55, C + s * 2.2 + 1, fy + 1.8, fz + 0.75, 'paint', { paint: 'charcoal', solid: false });
  L.box(C - 1.6, fy - 2.6, fz + 0.55, C + 1.6, fy - 1.9, fz + 0.75, 'paint', { paint: 'charcoal', solid: false });

  // The golden face at the top: a gold disc and its rays, the black eyes and mouth, the nose.
  const gy = 60;
  const gz = C + radius(gy) + 0.4;
  disc(L, C, gy, 5.3, 5.3, gz - 1.2, gz, 'gold', 8);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [x, y] = [C + Math.cos(a) * 5.9, gy + Math.sin(a) * 5.9];
    L.box(x - 0.45, y - 0.45, gz - 1, x + 0.45, y + 0.45, gz - 0.2, 'paint', { paint: 'gold', solid: false });
  }
  for (const s of [-1, 1]) L.box(C + s * 2 - 1, gy + 0.8, gz, C + s * 2 + 1, gy + 1.5, gz + 0.15, 'paint', { paint: 'black', solid: false });
  L.box(C - 0.4, gy - 1.2, gz, C + 0.4, gy + 0.6, gz + 0.4, 'paint', { paint: 'gold', solid: false });
  L.box(C - 1.7, gy - 2.8, gz, C + 1.7, gy - 2.2, gz + 0.15, 'paint', { paint: 'black', solid: false });

  // The black sun on the back: a black disc and its rays.
  const by = 42;
  const bz = C - radius(by);
  disc(L, C, by, 4.6, 4.6, bz - 0.4, bz + 0.6, 'black', 7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const [x, y] = [C + Math.cos(a) * 5.3, by + Math.sin(a) * 5.3];
    L.box(x - 0.5, y - 0.5, bz - 0.5, x + 0.5, y + 0.5, bz + 0.3, 'paint', { paint: 'black', solid: false });
  }

  // The park round it: the walk, trees.
  for (const [x, z] of [[4, 4], [44, 4], [4, 44], [44, 44], [4, 24], [44, 24]] as const) broadleaf(L, x, z, 9, 3.5);

  // 90 days on: relief tents on the lawn, crates, a fallen sign by the walk.
  L.tent(10, 38, 'z', 7);
  L.crates(16, 42, 4);
  L.fallenSign(36, 40, 'x');
  L.sandbags(30, 44, 40, 44);
}
