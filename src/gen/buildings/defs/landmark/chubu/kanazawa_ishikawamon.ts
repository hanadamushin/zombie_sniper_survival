// L4: 金沢城 石川門 (Kanazawa Castle: the Ishikawa Gate, 1788, an Important Cultural Property). The
// castle's back gate towards Kenroku-en: a square gate court (枡形) entered through the small front
// gate (一の門, 高麗門), turning to the great gate house over the passage (二の門, 櫓門), its sides
// closed by the long turret (続櫓) and the two-storey corner turret (二重櫓). White plaster above walls
// of grey tiles set in white lattices (海鼠壁), on tall stone walls, under the pale grey roofs of lead
// tiles (鉛瓦) that make the castle look white from afar. Before it, the stone bridge (石川橋) over the
// old moat (百間堀, a road now).
//
// Real size (the gate court is about 26 m square, the corner turret about 17 m from the road). The
// front (local z = d, the front gate and the bridge) faces east, towards Kenroku-en.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase } from '../tohoku/parts.ts';
import { maple } from './parts.ts';

const W = 60;
const D = 50;
const SW = 6.4; // the stone walls' height
const ROOF: PaintName = 'lead';

export const LANDMARK_KANAZAWA_ISHIKAWAMON = landmarkDef({
  variant: 'kanazawa_ishikawamon',
  size: { w: [W, W], d: [D, D] },
  eaves: 12,
  top: SW + 12,
  roof: 'hip',
  kind: 'house',
  build,
});

/** A white wall over the tile-and-lattice wall below (海鼠壁): box from y0 to y1, the lower `low` share grey. */
function namako(L: Lm, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, low = 0.5): void {
  const ym = y0 + (y1 - y0) * low;
  L.box(x0, y0, z0, x1, ym, z1, 'paint', { paint: 'gray' });
  L.box(x0, ym, z0, x1, y1, z1, 'paint', { paint: 'white' });
  // The lattice: two white lines along the grey, a hair proud of it.
  for (const t of [0.25, 0.5, 0.75]) {
    const y = y0 + (ym - y0) * t;
    L.box(x0 - 0.04, y - 0.09, z0 - 0.04, x1 + 0.04, y + 0.09, z1 + 0.04, 'paint', { paint: 'white', solid: false });
  }
}

/** A lead-tiled hip roof over (x0, z0)–(x1, z1) at y, `over` out, `rise` high, with its white eaves line. */
function roof(L: Lm, x0: number, z0: number, x1: number, z1: number, y: number, over: number, rise: number): void {
  L.box(x0 - over, y - 0.22, z0 - over, x1 + over, y, z1 + over, 'paint', { paint: 'white', solid: false });
  L.shape('hip', x0 - over, y, z0 - over, x1 + over, y + rise, z1 + over, 'paint', { paint: ROOF, axis: x1 - x0 >= z1 - z0 ? 'x' : 'z' });
}

function build(L: Lm): void {
  L.ground('gravel', [[12, 14], [40, 14], [40, 40], [12, 40]]);
  L.ground('paved', [[20, 40], [30, 40], [30, D], [20, D]]);
  L.ground('grass', [[0, 0], [W, 0], [W, 12], [0, 12]]);

  // The stone walls round the gate court (open where the gates are), leaning back.
  stoneBase(L, 2, 6, 12, 44, 0, SW, 0.06, 3, 'granite'); // left (north) side
  stoneBase(L, 40, 6, 58, 46, 0, SW, 0.06, 3, 'granite'); // right (south): under the long and the corner turret
  stoneBase(L, 12, 40, 20, 44, 0, SW, 0.06, 2, 'granite'); // front, left of the front gate
  stoneBase(L, 30, 40, 40, 44, 0, SW, 0.06, 2, 'granite'); // front, right of the front gate
  stoneBase(L, 12, 6, 21, 14, 0, SW, 0.06, 2, 'granite'); // back, left of the great gate's passage
  stoneBase(L, 29, 6, 40, 14, 0, SW, 0.06, 2, 'granite'); // back, right of it

  // The earthen walls on the front stones (white over 海鼠壁, a tiled coping).
  for (const [x0, x1] of [[2.6, 20], [30, 40]] as const) {
    namako(L, x0, 41.6, x1, 42.6, SW, SW + 2.4, 0.45);
    L.shape('gable', x0 - 0.3, SW + 2.4, 41.2, x1 + 0.3, SW + 3.1, 43, 'paint', { paint: ROOF, axis: 'x' });
  }
  namako(L, 2.6, 6.5, 3.6, 41.6, SW, SW + 2.4, 0.45);
  L.shape('gable', 2.2, SW + 2.4, 6.5, 4, SW + 3.1, 41.6, 'paint', { paint: ROOF, axis: 'z' });

  // 一の門 (高麗門): two posts, shut iron-studded doors, a small roof over the gate and its back posts.
  for (const x of [20, 29.4]) L.box(x, 0, 41.4, x + 0.6, 6.6, 42.4, 'woodDark');
  L.box(20.6, 0, 41.75, 29.4, 5.6, 42.05, 'paint', { paint: 'black' });
  for (const y of [1.2, 2.6, 4]) L.box(20.6, y, 42.05, 29.4, y + 0.15, 42.12, 'paint', { paint: 'gray', solid: false });
  L.box(19.4, 6.6, 41, 30.6, 7.2, 42.8, 'woodDark');
  L.shape('gable', 18.6, 7.2, 40.4, 31.4, 9, 43.4, 'paint', { paint: ROOF, axis: 'x' });

  // 二の門 (櫓門): the great gate house on the back stones, over the passage, two storeys high.
  L.box(21, 0, 9.4, 29, 5.4, 9.8, 'paint', { paint: 'black' }); // its shut doors
  L.box(21, 5.4, 6.4, 29, SW, 13.6, 'woodDark'); // the beam over the passage
  namako(L, 12, 6.4, 40, 13.6, SW, SW + 5, 0.4);
  L.windows('x', 13.6, 1, 14, 38, 7, SW + 2.6, SW + 4, 0.9, { broken: 0.3 });
  L.windows('x', 6.4, -1, 14, 38, 7, SW + 2.6, SW + 4, 0.9, { broken: 0.2 });
  roof(L, 12, 6.4, 40, 13.6, SW + 5, 1.5, 2.2);
  L.shape('gable', 16, SW + 6.2, 8, 36, SW + 8.6, 12, 'paint', { paint: ROOF, axis: 'x' });

  // 続櫓: the long turret down the south side of the court; 二重櫓 at its front corner.
  namako(L, 41, 7, 48, 33, SW, SW + 4, 0.45);
  L.windows('z', 41, -1, 8, 32, 6, SW + 2, SW + 3.3, 0.9, { broken: 0.3 });
  roof(L, 41, 7, 48, 33, SW + 4, 1.2, 2);
  const [tx0, tz0, tx1, tz1] = [41, 33, 57, 45.4];
  namako(L, tx0, tz0, tx1, tz1, SW, SW + 4.6, 0.4);
  L.windows('x', tz1, 1, tx0 + 1.5, tx1 - 1.5, 4, SW + 2.2, SW + 3.6, 0.9, { broken: 0.3 });
  L.windows('z', tx1, 1, tz0 + 1.5, tz1 - 1.5, 3, SW + 2.2, SW + 3.6, 0.9, { broken: 0.3 });
  roof(L, tx0, tz0, tx1, tz1, SW + 4.6, 1.2, 1.5);
  // Its gable on the lower roof (towards the bridge), then the upper storey and its hip-and-gable.
  L.shape('gable', 46, SW + 4.4, tz1 - 1, 52, SW + 6.6, tz1 + 1.1, 'paint', { paint: ROOF, axis: 'z', solid: false });
  namako(L, tx0 + 3, tz0 + 2.5, tx1 - 3, tz1 - 2.5, SW + 5.6, SW + 9.2, 0.25);
  L.windows('x', tz1 - 2.5, 1, tx0 + 4, tx1 - 4, 3, SW + 6.8, SW + 8.2, 0.9, { broken: 0.3 });
  L.box(tx0 + 1.8, SW + 9, tz0 + 1.3, tx1 - 1.8, SW + 9.2, tz1 - 1.3, 'paint', { paint: 'white', solid: false });
  L.shape('hip', tx0 + 1.8, SW + 9.2, tz0 + 1.3, tx1 - 1.8, SW + 10.8, tz1 - 1.3, 'paint', { paint: ROOF, axis: 'x' });
  L.shape('gable', tx0 + 5, SW + 10, tz0 + 3, tx1 - 5, SW + 11.8, tz1 - 3, 'paint', { paint: ROOF, axis: 'x' });
  for (const x of [tx0 + 5.2, tx1 - 5.2]) L.box(x - 0.2, SW + 11.6, (tz0 + tz1) / 2 - 0.2, x + 0.2, SW + 12, (tz0 + tz1) / 2 + 0.2, 'paint', { paint: 'charcoal', solid: false });

  // The stone bridge's parapets on the approach.
  for (const x of [20, 29.4]) L.box(x, 0, 44.6, x + 0.6, 1.1, D, 'paint', { paint: 'stone' });
  // Trees inside the castle (behind the gate) and a maple in its autumn red.
  for (const [x, z, h] of [[6, 3, 9], [52, 3, 10]] as const) pine(L, x, z, h);
  maple(L, 32, 3.4, 6, 2.8);

  // 90 days on: a checkpoint at the front gate — sandbags and crates in the court, a burnt-out car on
  // the bridge, a fallen sign; scorch on the great gate's doors.
  L.sandbags(14, 30, 26, 30);
  L.crates(34, 20, 4);
  L.tent(18, 22, 'x', 6);
  L.car(25, 47.4, 'x', { burnt: true });
  L.fallenSign(16, 37, 'x');
  L.scorch(22, 0.6, 9.82, 27, 4.4, 9.9);
}
