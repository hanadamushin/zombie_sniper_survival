// L6: 岡山後楽園 延養亭 (the Enyō-tei of Kōraku-en), Okayama, one of the three great gardens of Japan
// (1700). The lord's low wooden hall (rebuilt 1960) looking south over the garden: tiled hipped-and-
// gabled roofs over white paper doors and a wooden veranda, a smaller wing to the east; before it the
// wide lawn (芝生), the pond Sawa-no-ike with its little islands, and the grass-covered hill Yuishin-zan
// with its path; pines and maples (late November). Okayama Castle's black keep is the borrowed
// scenery across the river.
//
// The garden is 13 ha; only the hall and the part of the garden it looks over are drawn (the pond and
// the hill brought closer). The hall is real size. The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { lantern, maple } from '../chubu/parts.ts';
import { pine } from '../tohoku/parts.ts';

const W = 52;
const D = 44;

export const LANDMARK_KORAKUEN_ENYOTEI = landmarkDef({
  variant: 'korakuen_enyotei',
  size: { w: [W, W], d: [D, D] },
  eaves: 3.4,
  top: 9.2,
  roof: 'hip',
  kind: 'house',
  build,
});

/** A low hall: plinth, walls of paper doors between dark posts, the veranda, the hipped-and-gabled roof. */
function hall(L: Lm, x0: number, z0: number, x1: number, z1: number, eaves: number, rise: number): void {
  L.box(x0 - 1.6, 0, z0 - 1.6, x1 + 1.6, 0.6, z1 + 1.6, 'wood', {});
  L.box(x0, 0.6, z0, x1, eaves, z1, 'paint', { paint: 'offWhite' });
  // The paper doors' frames: dark posts every 1.8 m on the long faces, a rail under the eaves.
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.round((x1 - x0) / 1.8)) {
    for (const z of [z0, z1]) L.box(x - 0.1, 0.6, z - 0.1, x + 0.1, eaves, z + 0.1, 'paint', { paint: 'brown', solid: false });
  }
  for (const z of [z0, z1]) L.box(x0, eaves - 0.5, z - 0.12, x1, eaves - 0.3, z + 0.12, 'paint', { paint: 'brown', solid: false });
  for (const x of [x0, x1]) L.box(x - 0.12, eaves - 0.5, z0, x + 0.12, eaves - 0.3, z1, 'paint', { paint: 'brown', solid: false });
  const over = 1.8;
  L.box(x0 - over, eaves - 0.2, z0 - over, x1 + over, eaves, z1 + over, 'paint', { paint: 'brown', solid: false });
  const axis = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  L.shape('hip', x0 - over, eaves, z0 - over, x1 + over, eaves + rise * 0.6, z1 + over, 'paint', { paint: 'kawara', axis });
  const [gx, gz] = axis === 'x' ? [(x1 - x0) * 0.4, (z1 - z0) * 0.3] : [(x1 - x0) * 0.3, (z1 - z0) * 0.4];
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  L.shape('gable', cx - gx, eaves + rise * 0.45, cz - gz, cx + gx, eaves + rise, cz + gz, 'paint', { paint: 'kawara', axis });
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The pond (Sawa-no-ike) south-east of the hall, its islands; the gravel path across the lawn.
  L.ground('water', [[30, 26], [40, 24], [49, 27], [50, 34], [45, 41], [35, 42], [29, 37]], 1.4, 0.5);
  L.ground('gravel', [[3, 21], [W - 3, 21], [W - 3, 23], [3, 23]]);
  L.column(39, 33, 2.4, -0.5, 0.5, 'paint', { paint: 'lawn' });
  pine(L, 39, 33, 6);
  L.column(45, 29, 1.3, -0.5, 0.45, 'paint', { paint: 'lawn' });

  // The hall (延養亭): the main block, the east wing a little forward, a covered link.
  hall(L, 8, 5, 28, 15, 3.4, 4.6);
  hall(L, 31, 8, 41, 16, 3.2, 4);
  L.box(28, 0.6, 8, 31, 3, 13, 'paint', { paint: 'offWhite' });

  // The hill Yuishin-zan on the west: a grassy mound with a pine on top.
  L.column(9, 34, 8, 0, 2, 'paint', { paint: 'lawn', taper: 0.72 });
  L.column(9, 34, 5.8, 2, 3.6, 'paint', { paint: 'lawn', taper: 0.55 });
  L.column(9, 34, 3.2, 3.6, 4.6, 'paint', { paint: 'lawn', taper: 0.4 });
  for (const [x, z, h] of [[9, 34, 9], [20, 2, 9], [3, 2, 8], [49, 3, 9], [24, 42, 7]] as const) pine(L, x, z, h);
  for (const [x, z] of [[28, 20], [17, 24], [48, 20], [26, 38]] as const) maple(L, x, z, 6, 2.6);
  lantern(L, 32, 23.8, 2.4);
  lantern(L, 18, 19, 2.2);

  // 90 days on: evacuation tents on the lawn, relief crates by the path, a fallen sign.
  L.tent(20, 30, 'x', 6);
  L.tent(22, 36, 'x', 6);
  L.crates(12, 24, 4);
  L.fallenSign(42, 22, 'x');
}
