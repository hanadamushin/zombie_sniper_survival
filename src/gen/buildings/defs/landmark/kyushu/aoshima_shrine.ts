// L8: 青島神社 (Aoshima Shrine), on the small island of Aoshima off Miyazaki. The island is ringed by the
// "devil's washboard" (鬼の洗濯板: ridges of rock in the shallows — left to the area's ground) and grown
// over with a subtropical forest of fan palms (ビロウ); from the bridge a path leads under a great red
// torii to the vermilion shrine among the palms, its roofs green with copper.
//
// Real size: the island 1.5 km round; the shrine about 13 m. Only the shrine, its torii and the palm
// forest round it are drawn. The front (local z = d, the torii) faces west, to the bridge and the shore.

import { landmarkDef, type Lm } from '../common.ts';
import { torii } from '../chubu/parts.ts';
import { keepTop } from '../chugoku/parts.ts';
import { palm } from './parts.ts';

const W = 40;
const D = 48;
const C = 20;

export const LANDMARK_AOSHIMA_SHRINE = landmarkDef({
  variant: 'aoshima_shrine',
  size: { w: [W, W], d: [D, D] },
  eaves: 6,
  top: 13,
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[C - 2.5, 22], [C + 2.5, 22], [C + 2.5, D], [C - 2.5, D]]);
  // The great red torii on the path, a second smaller one before the shrine.
  torii(L, C, 43, 'z', 6.4, 8.2, 'intlOrange');
  torii(L, C, 28, 'z', 4.2, 5.4, 'intlOrange');

  // The worship hall (拝殿): vermilion posts and walls on a stone base, the copper roof with its gable
  // over the front and a curved porch; the main hall (本殿) behind, joined to it.
  L.box(C - 8, 0, 8, C + 8, 0.8, 22, 'paint', { paint: 'granite' });
  L.box(C - 6.5, 0.8, 13, C + 6.5, 5.6, 20, 'paint', { paint: 'intlOrange' });
  L.windows('x', 20, 1, C - 5.5, C + 5.5, 4, 1.4, 4.4, 1.8, { paint: 'white', broken: 0.2 });
  L.box(C - 6.6, 4.6, 12.9, C + 6.6, 5.1, 20.1, 'paint', { paint: 'black', solid: false });
  keepTop(L, C, 16.5, 6.5, 3.5, 5.6, 1.8, 4.4, 'copper', 'gold', 'gold');
  for (const x of [C - 3, C + 3]) L.box(x - 0.25, 0.8, 21.2, x + 0.25, 4.6, 21.7, 'paint', { paint: 'intlOrange' });
  L.shape('wedge', C - 4, 4.2, 20, C + 4, 6, 22.4, 'paint', { paint: 'copper', slope: 'z-' });
  L.box(C - 4.5, 0.8, 9, C + 4.5, 5, 13, 'paint', { paint: 'intlOrange' });
  L.shape('gable', C - 5.4, 5, 8.2, C + 5.4, 8.6, 13.4, 'paint', { paint: 'copper', axis: 'z' });
  for (const z of [8.6, 12.8]) L.box(C - 0.25, 8.4, z - 0.25, C + 0.25, 9.4, z + 0.25, 'paint', { paint: 'gold', solid: false });

  // The palm forest (ビロウ) all round, closest behind the shrine.
  const palms: [number, number, number][] = [
    [3, 3, 9], [10, 2.5, 11], [20, 3, 10], [29, 2.5, 11], [37, 4, 9], [3, 12, 10], [37, 13, 11], [4, 22, 9],
    [36, 22, 10], [6, 31, 11], [34, 32, 9], [11, 38, 8], [29, 38, 9], [4, 45, 8], [36, 45, 9], [12, 20, 7], [28, 25, 8],
  ];
  for (const [x, z, h] of palms) palm(L, x, z, h, 6, 2.8);

  // 90 days on: relief crates under the palms, a fallen sign on the path, sandbags before the hall.
  L.crates(9, 28, 3);
  L.fallenSign(C + 6, 40, 'z');
  L.sandbags(C - 5, 24, C + 5, 24);
}
