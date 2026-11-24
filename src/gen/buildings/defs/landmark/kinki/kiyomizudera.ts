// L5: 清水寺 本堂（清水の舞台） (Kiyomizu-dera: the main hall and its stage), Higashiyama, Kyōto. The main
// hall (1633, a national treasure) stands on the edge of the Otowa hillside under one great roof of
// cypress bark (檜皮葺) with the gabled wings (翼廊) at its front corners; before it the stage (舞台)
// juts out over the slope, 13 m up on a scaffold of tall zelkova pillars tied by beams (懸造). West of
// the hall on the hilltop the vermilion three-storey pagoda (三重塔, 31 m) and the vermilion Deva gate
// (仁王門). Late November: the maples below the stage are red.
//
// The slope is the hill drawn as a block (the terrace the hall stands on, 12 m high) whose front is
// a cliff: the stage stands out from it on its pillars over the lot's ground. Real size: the hall
// about 36 × 30 m, its roof 18 m above the floor; the stage 190 m². The front (local z = d, the stage)
// faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from '../tohoku/parts.ts';
import { maple } from '../chubu/parts.ts';
import { pagoda } from './parts.ts';

const W = 84;
const D = 84;
/** The terrace: its top and its front (the cliff). */
const T = 12;
const CLIFF = 44;
/** The stage: x range, how far it reaches. */
const SX0 = 30;
const SX1 = 54;
const SZ1 = 55;
const ROOF: PaintName = 'hiwada';
const RED: PaintName = 'intlOrange';

export const LANDMARK_KIYOMIZUDERA = landmarkDef({
  variant: 'kiyomizudera',
  size: { w: [W, W], d: [D, D] },
  eaves: T + 9,
  top: T + 31.2,
  roof: 'hip',
  kind: 'house',
  build,
});

/** A pillar of the scaffold, ground to the stage. */
function post(L: Lm, x: number, z: number, top: number): void {
  L.box(x - 0.5, 0, z - 0.5, x + 0.5, top, z + 0.5, 'paint', { paint: 'hinoki' });
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);

  // The hillside terrace, the cliff under the hall.
  L.box(0, 0, 0, W, T, CLIFF, 'paint', { paint: 'poplar' });

  // The main hall: plain dark wood, a row of shut doors (white paper behind lattices), the great roof.
  const [hx0, hx1, hz0, hz1] = [24, 60, 10, CLIFF - 1];
  L.box(hx0, T, hz0, hx1, T + 8, hz1, 'woodDark');
  L.windows('x', hz1, 1, hx0 + 2, hx1 - 2, 8, T + 1, T + 6.5, 2.6, { paint: 'offWhite', broken: 0.35 });
  L.box(hx0 - 0.5, T + 7.4, hz0 - 0.5, hx1 + 0.5, T + 8.2, hz1 + 0.5, 'paint', { paint: 'brown', solid: false });
  L.box(hx0 - 4, T + 8, hz0 - 4, hx1 + 4, T + 8.6, hz1 + 4, 'paint', { paint: ROOF, solid: false });
  L.shape('hip', hx0 - 4, T + 8.6, hz0 - 4, hx1 + 4, T + 16, hz1 + 4, 'paint', { paint: ROOF, axis: 'x' });
  L.shape('gable', hx0 + 6, T + 13.5, hz0 + 4, hx1 - 6, T + 19, hz1 - 4, 'paint', { paint: ROOF, axis: 'x' });
  L.box(hx0 + 6, T + 18.6, (hz0 + hz1) / 2 - 0.6, hx1 - 6, T + 19, (hz0 + hz1) / 2 + 0.6, 'paint', { paint: 'charcoal', solid: false });
  // The wings at the front corners: gabled roofs facing the stage, on their own pillars.
  for (const [x0, x1] of [[hx0, SX0], [SX1, hx1]] as const) {
    L.box(x0, T, CLIFF - 1, x1, T + 6, SZ1 - 2, 'woodDark');
    L.windows('x', SZ1 - 2, 1, x0 + 1, x1 - 1, 2, T + 1, T + 5, 2, { paint: 'offWhite', broken: 0.3 });
    L.shape('gable', x0 - 1.4, T + 6, CLIFF - 2, x1 + 1.4, T + 10.5, SZ1 - 0.5, 'paint', { paint: ROOF, axis: 'z' });
    L.shape('gable', x0 - 0.4, T + 6.1, SZ1 - 0.62, x1 + 0.4, T + 9.8, SZ1 - 0.52, 'paint', { paint: 'hinoki', axis: 'z', solid: false });
    for (const x of [x0 + 0.5, (x0 + x1) / 2, x1 - 0.5]) for (const z of [47.5, SZ1 - 2.5]) post(L, x, z, T);
  }

  // The stage: the floor of boards, a low rail round its edge, the scaffold of pillars and their ties.
  L.box(SX0, T - 0.6, CLIFF, SX1, T, SZ1, 'paint', { paint: 'hinoki' });
  L.box(SX0, T, SZ1 - 0.2, SX1, T + 1, SZ1, 'paint', { paint: 'hinoki' });
  const xs = [SX0 + 0.5, 35, 39.5, 44.5, 49, SX1 - 0.5];
  const zs = [46.5, 50.8, SZ1 - 0.5];
  for (const x of xs) for (const z of zs) post(L, x, z, T - 0.6);
  for (const y of [3.4, 7.2, 10.4]) {
    for (const z of zs) L.box(hx0, y, z - 0.2, hx1, y + 0.45, z + 0.2, 'paint', { paint: 'hinoki', solid: false });
    for (const x of xs) L.box(x - 0.2, y, CLIFF, x + 0.2, y + 0.45, SZ1, 'paint', { paint: 'hinoki', solid: false });
  }

  // The three-storey pagoda on the hilltop west of the hall (vermilion, white panels, tiled roofs).
  pagoda(L, 11, 18, {
    tiers: [[3.3, 4.6], [2.9, 3.8], [2.6, 3.6]],
    frame: RED,
    panel: 'white',
    roof: 'kawara',
    finial: 'bronze',
    over: [2.6, 2.5, 2.4],
    rise: 1.6,
    plinth: [5, 1],
    top: T + 31,
    base: T,
  });
  // The Deva gate west of the pagoda on the hilltop (two storeys, vermilion), facing the approach.
  const [gx0, gx1, gz0, gz1] = [2, 18, 32, 39];
  L.box(gx0, T, gz0, gx1, T + 6, gz1, 'paint', { paint: RED });
  L.box(gx0 + 6, T, gz1 - 0.02, gx1 - 6, T + 4.6, gz1 + 0.06, 'paint', { paint: 'black', solid: false });
  L.shape('hip', gx0 - 1.6, T + 6, gz0 - 1.6, gx1 + 1.6, T + 7.8, gz1 + 1.6, 'paint', { paint: 'kawara', axis: 'x' });
  L.box(gx0 + 1, T + 7.4, gz0 + 1, gx1 - 1, T + 11, gz1 - 1, 'paint', { paint: RED });
  L.shape('hip', gx0 - 1.8, T + 11, gz0 - 1.8, gx1 + 1.8, T + 13, gz1 + 1.8, 'paint', { paint: 'kawara', axis: 'x' });
  L.shape('gable', gx0 + 3, T + 12.4, gz0 - 0.4, gx1 - 3, T + 14.6, gz1 + 0.4, 'paint', { paint: 'kawara', axis: 'x' });

  // Maples below the stage and along the foot, cedars on the hill behind the hall.
  for (const [x, z, h] of [[22, 60, 7], [62, 58, 8], [70, 66, 8], [78, 52, 9], [8, 52, 8], [14, 62, 7], [26, 74, 6], [58, 74, 6], [74, 78, 7], [6, 76, 7]] as const) maple(L, x, z, h, 3.2);
  for (const [x, z] of [[4, 4], [20, 3], [66, 3], [80, 8], [78, 26], [4, 34]] as const) {
    L.column(x, z, 0.5, T, T + 6, 'paint', { paint: 'brown' });
    L.column(x, z, 2.6, T + 4, T + 16, 'paint', { paint: 'cedar', taper: 0.12, solid: false });
  }
  cedar(L, 80, 46, 14);

  // 90 days on: a relief tent and crates by the gate, a fallen sign on the approach, sandbags.
  L.tent(40, 78, 'x', 7);
  L.crates(48, 70, 4);
  L.fallenSign(34, 68, 'x');
  L.sandbags(30, 62, 54, 62);
}
