// L4: 熱田神宮 (Atsuta Jingū), Nagoya — the shrine of the sacred sword Kusanagi. In its forest of
// camphor trees (大楠, some over a thousand years old) the gravel approach passes the plain wooden
// torii of the shrine's own style (神明鳥居), the old roofed earthen wall given by Oda Nobunaga (信長塀),
// and comes to the worship hall (拝殿) and, behind its fence, the main hall (本宮) in the style of Ise
// (神明造, since 1893): unpainted cypress, a copper roof gone green, the crossed finials (千木) and the
// logs on the ridge (鰹木).
//
// The precinct is about 19 ha; the lot holds the approach's last stretch, the halls and the trees
// round them. The front (local z = d, the approach) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';
import { cedar } from '../tohoku/parts.ts';
import { lantern, torii } from './parts.ts';

const W = 64;
const D = 100;
const AX = 32; // the approach's middle

export const LANDMARK_ATSUTA_JINGU = landmarkDef({
  variant: 'atsuta_jingu',
  size: { w: [W, W], d: [D, D] },
  eaves: 8,
  top: 26,
  kind: 'house',
  build,
});

/** A hall in the Ise style along x: raised floor, cypress walls, a steep straight gable, 千木 and 鰹木. */
function shinmei(L: Lm, x0: number, z0: number, x1: number, z1: number, floor: number, wall: number, ridge: number, logs: number): void {
  L.box(x0, 0, z0, x1, floor, z1, 'paint', { paint: 'hinoki' });
  L.box(x0 + 0.4, floor, z0 + 0.4, x1 - 0.4, wall, z1 - 0.4, 'paint', { paint: 'hinoki' });
  L.box(x0 + 2, floor + 0.3, z1 - 0.38, x1 - 2, wall - 0.6, z1 - 0.3, 'paint', { paint: 'gold', solid: false }); // the doors' gilt fittings
  L.shape('gable', x0 - 1.2, wall, z0 - 1.4, x1 + 1.2, ridge, z1 + 1.4, 'paint', { paint: 'copper', axis: 'x' });
  L.box(x0 - 0.6, ridge - 0.2, (z0 + z1) / 2 - 0.5, x1 + 0.6, ridge + 0.5, (z0 + z1) / 2 + 0.5, 'paint', { paint: 'copper', solid: false });
  // 鰹木: logs across the ridge, gilt at their ends; 千木: the crossed boards at both ends.
  const zc = (z0 + z1) / 2;
  for (let i = 0; i < logs; i++) {
    const x = x0 + 1.5 + ((x1 - x0 - 3) * (i + 0.5)) / logs;
    L.column(x, zc, 0.45, ridge + 0.5, ridge + 1.3, 'paint', { paint: 'hinoki', solid: false });
    L.box(x - 0.48, ridge + 0.5, zc - 1.1, x + 0.48, ridge + 1.25, zc + 1.1, 'paint', { paint: 'hinoki', solid: false });
  }
  for (const x of [x0 - 1.1, x1 + 1.1]) {
    L.box(x - 0.15, ridge - 0.4, zc - 1.3, x + 0.15, ridge + 2.4, zc - 0.5, 'paint', { paint: 'hinoki', solid: false });
    L.box(x - 0.15, ridge - 0.4, zc + 0.5, x + 0.15, ridge + 2.4, zc + 1.3, 'paint', { paint: 'hinoki', solid: false });
  }
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[AX - 4, D], [AX + 4, D], [AX + 4, 52], [AX + 16, 52], [AX + 16, 30], [AX - 16, 30], [AX - 16, 52], [AX - 4, 52]]);

  // The torii of the approach (plain dark wood, straight lintels: 神明鳥居).
  torii(L, AX, 88, 'z', 7.5, 8.6, 'hinoki', 'shinmei');
  torii(L, AX, 60, 'z', 7.5, 8, 'hinoki', 'shinmei');
  // 信長塀: an earthen wall of stacked tiles under a little tiled roof, beside the approach.
  for (const [x0, x1] of [[AX + 7, AX + 25], [AX - 25, AX - 7]] as const) {
    L.box(x0, 0, 66, x1, 2.6, 67.4, 'paint', { paint: 'offWhite' });
    for (let y = 0.5; y < 2.5; y += 0.55) L.box(x0, y, 65.9, x1, y + 0.14, 67.5, 'paint', { paint: 'kawara', solid: false });
    L.shape('gable', x0 - 0.2, 2.6, 65.6, x1 + 0.2, 3.4, 67.8, 'paint', { paint: 'kawara', axis: 'x' });
  }
  for (const x of [AX - 5.5, AX + 5.5]) for (const z of [72, 80]) lantern(L, x, z, 2.8);

  // The worship hall (拝殿): a broad cypress hall, its long side (平入) towards the approach.
  shinmei(L, AX - 13, 36, AX + 13, 48, 1.4, 6.2, 12.5, 0);
  L.box(AX - 9, 1.4, 47.7, AX + 9, 5.4, 47.8, 'paint', { paint: 'offWhite', solid: false }); // white curtain
  // The fence (瑞垣) round the main hall, and the main hall itself behind.
  L.box(AX - 14, 0, 8, AX + 14, 2.4, 8.4, 'paint', { paint: 'hinoki' });
  L.box(AX - 14, 0, 30, AX - 2, 2.4, 30.4, 'paint', { paint: 'hinoki' });
  L.box(AX + 2, 0, 30, AX + 14, 2.4, 30.4, 'paint', { paint: 'hinoki' });
  L.box(AX - 14, 0, 8.4, AX - 13.6, 2.4, 30, 'paint', { paint: 'hinoki' });
  L.box(AX + 13.6, 0, 8.4, AX + 14, 2.4, 30, 'paint', { paint: 'hinoki' });
  shinmei(L, AX - 7, 14, AX + 7, 23, 2.2, 7.4, 13.8, 7);

  // The forest: great camphors along both sides, cedars behind the halls.
  for (const [x, z, h, r] of [[7, 94, 18, 5.5], [57, 92, 19, 5.5], [6, 70, 20, 5.5], [58, 72, 18, 5.5], [6, 46, 20, 5.5], [58, 46, 19, 5.5], [6, 22, 21, 5.5], [58, 20, 20, 5.5]] as const) broadleaf(L, x, z, h, r);
  for (const x of [8, 20, 32, 44, 56]) cedar(L, x, 3.5, 24, 3);

  // 90 days on: a relief post on the approach — sandbags, crates and a fallen sign (the shrine itself untouched).
  L.sandbags(AX - 10, 94, AX - 5, 94);
  L.crates(AX + 8, 78, 4);
  L.fallenSign(AX + 6.5, 92, 'z');
}
