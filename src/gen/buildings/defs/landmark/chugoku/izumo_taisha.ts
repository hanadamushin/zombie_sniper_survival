// L6: 出雲大社 (Izumo Taisha), Izumo, Shimane. At the back the main hall (本殿, 1744, a national
// treasure): the oldest shrine style (大社造), a square hall raised high on nine great posts, entered
// at its gable end, under a steep curved roof of cypress bark (檜皮葺) with the crossed boards (千木)
// and three logs (勝男木) on its ridge, 24 m high, inside its fence (瑞垣) and the eight-legged gate
// (八足門). Before it the worship hall (拝殿) with its straw rope (しめ縄, 6.5 m) under the front eave;
// on the west the Kagura hall (神楽殿) with the great rope (大しめ縄, 13.6 m long, 5.2 t), the
// shrine's best-known sight; the bronze torii and the pine-lined approach in front.
//
// Real size for the halls and the ropes; the precinct is drawn closer together than it is. The front
// (local z = d) faces south, down the approach.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { lantern, torii } from '../chubu/parts.ts';
import { xyLine } from '../kanto/parts.ts';
import { pine } from '../tohoku/parts.ts';
import { shimenawa } from './parts.ts';

const W = 84;
const D = 104;
const WOOD: PaintName = 'hinoki';
const BARK: PaintName = 'hiwada';

export const LANDMARK_IZUMO_TAISHA = landmarkDef({
  variant: 'izumo_taisha',
  size: { w: [W, W], d: [D, D] },
  eaves: 13,
  top: 24,
  roof: 'gable',
  kind: 'house',
  build,
});

/**
 * A gable-entry hall (妻入): walls x0..x1 × z0..z1 from y0 to y1, a gable roof whose ridge runs along z
 * (the triangle faces the front), `over` past the walls, its ridge at `ridge`.
 */
function hall(L: Lm, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, ridge: number, over: number, wall: PaintName, roof: PaintName): void {
  L.box(x0, y0, z0, x1, y1, z1, 'paint', { paint: wall });
  // The roof's edge, then the roof: a steep upper gable over a flatter skirt (the curve of the bark roof).
  L.box(x0 - over, y1 - 0.3, z0 - over, x1 + over, y1, z1 + over, 'paint', { paint: roof, solid: false });
  const mid = y1 + (ridge - y1) * 0.35;
  L.shape('gable', x0 - over, y1, z0 - over, x1 + over, mid, z1 + over, 'paint', { paint: roof, axis: 'z' });
  const inset = (x1 - x0 + 2 * over) * 0.2;
  L.shape('gable', x0 - over + inset, mid - 0.4, z0 - over, x1 + over - inset, ridge, z1 + over, 'paint', { paint: roof, axis: 'z' });
}

/** The crossed boards (千木) at a ridge end (z), rising `h` over the ridge at height y, centred on x. */
function chigi(L: Lm, x: number, y: number, z: number, h: number): void {
  for (const s of [-1, 1]) xyLine(L, x - s * h * 0.5, y - h * 0.3, x + s * h * 0.45, y + h, z - 0.2, z + 0.2, 0.35, 'charcoal', { step: 0.5 });
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[38, 64], [46, 64], [46, D], [38, D]]);

  // ---- The main hall (本殿) in its fence ----
  const [hx0, hz0, hx1, hz1] = [36.5, 12, 47.5, 23];
  // The fence (瑞垣) and its tiled top; the eight-legged gate on its south side.
  for (const [x0, z0, x1, z1] of [[24, 4, 60, 5], [24, 35, 39, 36], [45, 35, 60, 36], [24, 4, 25, 36], [59, 4, 60, 36]] as const) {
    L.box(x0, 0, z0, x1, 2.6, z1, 'paint', { paint: WOOD });
    L.box(x0 - 0.4, 2.6, z0 - 0.4, x1 + 0.4, 3, z1 + 0.4, 'paint', { paint: BARK, solid: false });
  }
  hall(L, 38, 34, 46, 37, 0, 4.4, 7.4, 1.2, WOOD, BARK);
  // Nine great posts, the raised floor and its railed veranda, the hall's walls, the roof.
  for (const fx of [0, 0.5, 1]) for (const fz of [0, 0.5, 1]) L.column(hx0 + (hx1 - hx0) * fx, hz0 + (hz1 - hz0) * fz, 0.55, 0, 6.6, 'paint', { paint: WOOD });
  L.box(hx0 - 1.4, 6.2, hz0 - 1.4, hx1 + 1.4, 6.8, hz1 + 1.4, 'paint', { paint: WOOD });
  for (const z of [hz0 - 1.35, hz1 + 1.35]) L.box(hx0 - 1.4, 6.8, z - 0.06, hx1 + 1.4, 7.7, z + 0.06, 'paint', { paint: 'brown', solid: false });
  hall(L, hx0, hz0, hx1, hz1, 6.8, 12.6, 24 - 3, 3.6, WOOD, BARK);
  // The ridge's three logs and the crossed boards at both gable ends.
  const ry = 24 - 3;
  for (const f of [0.25, 0.5, 0.75]) L.column((hx0 + hx1) / 2, hz0 - 3.6 + (hz1 - hz0 + 7.2) * f, 0.55, ry - 0.1, ry + 0.9, 'paint', { paint: 'charcoal', solid: false });
  chigi(L, (hx0 + hx1) / 2, ry, hz0 - 3.4, 2.8);
  chigi(L, (hx0 + hx1) / 2, ry, hz1 + 3.4, 2.8);
  // The roofed stair up to the floor (階隠), on the front's east side.
  L.shape('wedge', 43, 0, hz1 + 1.4, 46, 6.5, hz1 + 8, 'paint', { paint: WOOD, slope: 'z-' });
  L.box(42.6, 7.6, hz1 + 1, 46.4, 8, hz1 + 7, 'paint', { paint: BARK, solid: false });

  // ---- The worship hall (拝殿) and its rope ----
  L.box(31, 0, 46, 53, 0.8, 64, 'paint', { paint: 'stone' });
  hall(L, 33, 48, 51, 62, 0.8, 7.4, 13.6, 2.2, WOOD, BARK);
  L.windows('x', 62, 1, 35, 49, 5, 1.6, 6.2, 2, { paint: 'brown' });
  shimenawa(L, 42, 6.6, 64.6, 3.3, 1.1, 3);

  // ---- The Kagura hall (神楽殿) and the great rope ----
  L.box(3, 0, 50, 31, 0.7, 76, 'paint', { paint: 'stone' });
  L.box(5, 0.7, 52, 29, 8.2, 74, 'paint', { paint: WOOD });
  L.windows('x', 74, 1, 7, 27, 6, 1.5, 7, 2.4, { paint: 'brown' });
  L.box(2.6, 7.9, 49.6, 31.4, 8.4, 76.4, 'paint', { paint: 'kawara', solid: false });
  L.shape('hip', 2.6, 8.4, 49.6, 31.4, 12.8, 76.4, 'paint', { paint: 'kawara', axis: 'x' });
  L.shape('gable', 8, 11.4, 56, 26, 16.6, 70, 'paint', { paint: 'kawara', axis: 'x' });
  // The porch it hangs from: posts and a beam out in front.
  for (const x of [8, 26]) L.column(x, 79.5, 0.4, 0.7, 8.8, 'paint', { paint: WOOD });
  L.box(7, 8.8, 78.6, 27, 9.6, 80.4, 'paint', { paint: WOOD, solid: false });
  L.box(6, 9.6, 74, 28, 10, 81.4, 'paint', { paint: 'kawara', solid: false });
  shimenawa(L, 17, 7.6, 80, 6.8, 2.6, 5);

  // ---- The approach: the bronze torii, the pines, lanterns ----
  torii(L, 42, 92, 'z', 9, 8.8, 'bronze');
  for (const z of [84, 96]) for (const x of [30, 54]) pine(L, x, z, 12);
  for (const z of [66, 84]) for (const x of [36, 48]) lantern(L, x, z, 3);
  for (const [x, z] of [[8, 12], [12, 32], [72, 12], [74, 36], [76, 80], [76, 98]] as const) pine(L, x, z, 14);

  // 90 days on: relief crates and sandbags by the Kagura hall, a fallen sign on the approach.
  L.crates(64, 54, 5);
  L.sandbags(60, 64, 70, 64);
  L.fallenSign(56, 96, 'z');
}
