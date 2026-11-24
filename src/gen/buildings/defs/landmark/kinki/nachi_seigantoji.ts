// L5: 那智山青岸渡寺 三重塔と那智の滝 (the three-storey pagoda of Seiganto-ji and the Nachi Falls), Nachi-
// Katsuura, Wakayama (part of the Kumano pilgrimage World Heritage). The vermilion pagoda (rebuilt 1972,
// 25 m) stands on the mountainside among cedars, and behind it across the valley the Nachi Falls drop
// 133 m in one white column down a dark cliff in the forest: the view of the two together is the
// picture of Kumano. Beside the pagoda, the temple's main hall under its cypress-bark roof.
//
// The real falls are about 400 m from the pagoda; here the cliff stands at the back of the lot (the
// mountain as one dark block, its forest on top, the water a white strip with the spray and the pool
// at its foot). The drop is 96 m, not 133 m: the shrunk area's mountains round the temple rise only
// about 30 m above it, and a 140 m cliff stood over them like a tower (PROGRESS.md L5). The front (local z = d, the pagoda) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from '../tohoku/parts.ts';
import { maple } from '../chubu/parts.ts';
import { pagoda } from './parts.ts';

const W = 64;
const D = 100;
/** The cliff: its face (z), the fall's lip, the water's x range. */
const FACE = 12;
const LIP = 96;
const FX0 = 29;
const FX1 = 35;
const RED: PaintName = 'intlOrange';

export const LANDMARK_NACHI_SEIGANTOJI = landmarkDef({
  variant: 'nachi_seigantoji',
  size: { w: [W, W], d: [D, D] },
  eaves: LIP,
  top: 106,
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('water', [[22, FACE], [42, FACE], [44, 24], [20, 24]], 2, 0.8);
  L.ground('paved', [[34, 60], [56, 60], [56, 84], [34, 84]]);

  // The mountain: forested flanks rising steeply towards the back (ramps of the cedar forest), the dark
  // rock face between them behind the fall, the forest over its top.
  L.shape('wedge', 0, 0, 0, 23, 84, 38, 'paint', { paint: 'cedar', slope: 'z-' });
  L.shape('wedge', 41, 0, 0, W, 76, 36, 'paint', { paint: 'cedar', slope: 'z-' });
  L.box(0, 0, 0, 16, 92, 8, 'paint', { paint: 'cedar' });
  L.box(48, 0, 0, W, 84, 8, 'paint', { paint: 'cedar' });
  L.box(21, 0, 0, 43, 46, FACE, 'paint', { paint: 'charcoal' });
  L.box(22, 46, 0, 42, LIP, FACE - 1.5, 'paint', { paint: 'slateBlue' });
  L.box(16, LIP, 0, 48, 101, FACE - 1, 'paint', { paint: 'cedar', solid: false });
  for (const [x, h] of [[8, 98], [20, 106], [44, 105], [56, 92]] as const) L.column(x, 5, 4, h - 10, h, 'paint', { paint: 'cedar', taper: 0.2, solid: false });
  // The water: the white column from the lip, spreading a little lower down; the spray at its foot.
  L.box(FX0, 46, FACE - 1.4, FX1, LIP + 0.5, FACE - 1.2, 'paint', { paint: 'white', solid: false });
  L.box(FX0 - 1, 0, FACE, FX1 + 1, 46, FACE + 0.3, 'paint', { paint: 'white', solid: false });
  L.box(FX0 + 1, LIP - 1, FACE - 5, FX1 - 1, LIP + 0.5, FACE - 1.4, 'paint', { paint: 'skyBlue', solid: false });
  L.column(32, FACE + 3, 6, -0.8, 5, 'paint', { paint: 'white', taper: 0.5, solid: false });
  // Rocks round the pool, the sacred rope's posts at the viewing place.
  for (const [x, z] of [[21, 20], [43, 18], [26, 25], [40, 25]] as const) L.box(x - 1.2, -0.8, z - 1, x + 1.2, 1.2, z + 1, 'paint', { paint: 'gray' });

  // The pagoda: vermilion posts and walls, dark copper roofs.
  pagoda(L, 46, 72, {
    tiers: [[3.3, 4.8], [2.9, 3.8], [2.6, 3.6]],
    frame: RED,
    panel: RED,
    roof: 'charcoal',
    finial: 'bronze',
    over: [2.7, 2.6, 2.5],
    rise: 1.7,
    plinth: [5.2, 1.4],
    top: 25,
  });
  // The main hall (本堂): plain dark wood, the great cypress-bark roof.
  const [hx0, hx1, hz0, hz1] = [4, 26, 74, 94];
  L.box(hx0, 0, hz0, hx1, 6.5, hz1, 'woodDark');
  L.windows('x', hz1, 1, hx0 + 1, hx1 - 1, 5, 1, 5.5, 2.6, { paint: 'offWhite', broken: 0.3 });
  L.shape('hip', hx0 - 2.5, 6.5, hz0 - 2.5, hx1 + 2.5, 11, hz1 + 2.5, 'paint', { paint: 'hiwada', axis: 'x' });
  L.shape('gable', hx0 + 4, 9.5, hz0 + 2, hx1 - 4, 14, hz1 - 2, 'paint', { paint: 'hiwada', axis: 'x' });

  // The cedar forest of the mountainside, maples in their colour.
  for (const [x, z, h] of [[6, 44, 30], [16, 46, 28], [58, 44, 30], [50, 48, 26], [26, 56, 26], [6, 60, 28], [60, 92, 24], [28, 96, 22]] as const) cedar(L, x, z, h, 3);
  for (const [x, z] of [[18, 40], [46, 40], [30, 66], [58, 64]] as const) maple(L, x, z, 7, 3);

  // 90 days on: a fallen sign at the viewing place, crates and a relief tent by the hall.
  L.fallenSign(36, 58, 'x');
  L.crates(30, 82, 3);
  L.tent(16, 66, 'x', 6);
}
