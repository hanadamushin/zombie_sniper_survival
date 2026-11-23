// L4: 北口本宮冨士浅間神社 (Kitaguchi Hongū Fuji Sengen Jinja, Fujiyoshida) — the shrine at the foot
// of the Yoshida trail up Mount Fuji. Down an avenue of giant cedars (杉並木) lined with stone lanterns
// stands the Great Torii of Mount Fuji (富士山大鳥居, about 18 m: the largest wooden torii in Japan,
// vermilion, rebuilt every sixty years) with its plaque 「富士山」, then the vermilion gate of the
// guardian gods (随神門), the open dance hall (神楽殿) and the vermilion worship hall and main hall
// (拝殿・本殿, 1615) under green copper roofs, their eaves carved and painted.
//
// L4 put this shrine here in place of the 忠霊塔 of Arakurayama Sengen Park, which the commission's
// list named: that pagoda is a memorial to the war dead, and the commission's own rule keeps memorials
// out of the game (PROGRESS.md L4). The approach is shortened (the lot is 44 × 84 m: the shrunk
// town round the shrine is a knot of national roads). The front (local z = d) faces the
// approach's start.

import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from '../tohoku/parts.ts';
import { lantern, torii } from './parts.ts';

const W = 44;
const D = 84;
const AX = 22;

export const LANDMARK_FUJI_SENGEN_JINJA = landmarkDef({
  variant: 'fuji_sengen_jinja',
  size: { w: [W, W], d: [D, D] },
  eaves: 9,
  top: 40.5,
  kind: 'house',
  build,
});

/** A vermilion hall with white walls between the posts, a painted eaves band, a copper hip-and-gable roof. */
function hall(L: Lm, x0: number, z0: number, x1: number, z1: number, wall: number, rise: number): void {
  L.box(x0, 0, z0, x1, 1, z1, 'paint', { paint: 'stone' });
  L.box(x0 + 0.5, 1, z0 + 0.5, x1 - 0.5, wall, z1 - 0.5, 'paint', { paint: 'white' });
  for (let x = x0 + 0.5; x <= x1 - 0.9; x += (x1 - x0 - 1.4) / 4) {
    L.box(x, 1, z1 - 0.6, x + 0.45, wall, z1 - 0.4, 'paint', { paint: 'red' });
    L.box(x, 1, z0 + 0.4, x + 0.45, wall, z0 + 0.6, 'paint', { paint: 'red' });
  }
  L.box(x0 + 0.3, wall - 1.1, z0 + 0.3, x1 - 0.3, wall, z1 - 0.3, 'paint', { paint: 'copper', solid: false });
  L.box(x0 + 0.2, wall - 1.35, z0 + 0.2, x1 - 0.2, wall - 1.1, z1 - 0.2, 'paint', { paint: 'gold', solid: false });
  L.shape('hip', x0 - 1.6, wall, z0 - 1.6, x1 + 1.6, wall + rise * 0.6, z1 + 1.6, 'paint', { paint: 'copper', axis: x1 - x0 >= z1 - z0 ? 'x' : 'z' });
  const ax = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  const [gx, gz] = ax === 'x' ? [(x1 - x0) * 0.32, (z1 - z0) * 0.22] : [(x1 - x0) * 0.22, (z1 - z0) * 0.32];
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  L.shape('gable', cx - gx, wall + rise * 0.45, cz - gz, cx + gx, wall + rise, cz + gz, 'paint', { paint: 'copper', axis: ax });
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[AX - 4, D], [AX + 4, D], [AX + 4, 38], [AX + 14, 38], [AX + 14, 3], [AX - 14, 3], [AX - 14, 38], [AX - 4, 38]]);

  // The worship hall with its porch (向拝) and the main hall behind.
  hall(L, AX - 9, 16, AX + 9, 27, 6.8, 6);
  for (const x of [AX - 3.6, AX + 3.2]) L.box(x, 1, 27, x + 0.45, 6, 29.6, 'paint', { paint: 'red' });
  L.shape('gable', AX - 4.6, 6, 26, AX + 4.6, 8.8, 30.2, 'paint', { paint: 'copper', axis: 'z' });
  L.box(AX - 4.4, 5.2, 29.9, AX + 4.4, 6, 30.1, 'paint', { paint: 'gold', solid: false });
  hall(L, AX - 5.5, 4, AX + 5.5, 12, 6.4, 5.2);
  L.box(AX - 1.5, 1, 12, AX + 1.5, 5.4, 16, 'paint', { paint: 'red' }); // the passage between them
  // The dance hall (神楽殿) to the side: open sides, posts, a copper roof.
  for (const [x, z] of [[AX + 11, 30], [AX + 17.4, 30], [AX + 11, 35.4], [AX + 17.4, 35.4]] as const) L.box(x, 0, z, x + 0.5, 4.6, z + 0.5, 'paint', { paint: 'red' });
  L.box(AX + 10.6, 0.9, 29.6, AX + 18.3, 1.2, 36.3, 'woodDark');
  L.shape('hip', AX + 9.6, 4.6, 28.6, AX + 19.4, 7.4, 37.3, 'paint', { paint: 'copper', axis: 'x' });
  // The gate of the guardian gods (随神門): vermilion, the side bays shut, a copper roof.
  L.box(AX - 7, 0, 40, AX + 7, 0.6, 46, 'paint', { paint: 'stone' });
  L.box(AX - 6.6, 0.6, 41, AX - 2.4, 5.6, 45, 'paint', { paint: 'red' });
  L.box(AX + 2.4, 0.6, 41, AX + 6.6, 5.6, 45, 'paint', { paint: 'red' });
  L.box(AX - 2.4, 4.8, 41, AX + 2.4, 5.6, 45, 'paint', { paint: 'red' });
  L.box(AX - 2.4, 0.6, 42.8, AX + 2.4, 4.8, 43.2, 'paint', { paint: 'black' }); // its shut doors
  L.box(AX - 7, 5.6, 40.4, AX + 7, 6.3, 45.6, 'paint', { paint: 'copper', solid: false });
  L.shape('hip', AX - 8.2, 6.3, 39.2, AX + 8.2, 8.8, 46.8, 'paint', { paint: 'copper', axis: 'x' });
  L.shape('gable', AX - 5, 7.8, 41.4, AX + 5, 10.4, 44.6, 'paint', { paint: 'copper', axis: 'x' });

  // The Great Torii of Mount Fuji, its plaque.
  torii(L, AX, 53, 'z', 10, 17.6, 'red', 'myojin');
  L.box(AX - 1.1, 13.6, 52.3, AX + 1.1, 15.8, 52.5, 'paint', { paint: 'black', solid: false });
  L.box(AX - 0.8, 13.9, 52.25, AX + 0.8, 15.5, 52.3, 'paint', { paint: 'gold', solid: false });

  // The cedar avenue and its stone lanterns.
  for (const z of [60, 69, 78]) {
    for (const x of [AX - 10, AX + 10]) cedar(L, x + (z % 2 === 0 ? 0.6 : -0.6), z, 36 + ((z * 7) % 5), 3.4);
    for (const x of [AX - 6, AX + 6]) lantern(L, x, z + 4.5, 2.4);
  }
  for (const [x, z] of [[4, 10], [40, 12], [4, 36], [40.4, 46], [4, 50], [40, 58]] as const) cedar(L, x, z, 34, 3.4);

  // 90 days on: a relief post at the torii — sandbags and crates, a fallen sign on the approach.
  L.sandbags(AX - 9, 58, AX - 5, 58);
  L.crates(AX + 6, 56.5, 4);
  L.fallenSign(AX + 2.5, 70, 'z');
}
