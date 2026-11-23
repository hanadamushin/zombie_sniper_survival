// L1: 小樽運河 (the Otaru Canal, 1923) and its stone warehouses. The canal (about 20 m wide here; the
// real one runs 1.1 km along the port) with the warehouses of soft stone standing straight out of the
// water on the sea side, under dark and rust-red gable roofs with ridge ornaments; on the town side
// the stone-paved promenade with its row of gas lamps; a stone bridge (中央橋) over the canal at one
// end and two lighters moored in it. The front (local z = d) is the promenade, the canal runs along x.

import { landmarkDef, type Lm } from '../common.ts';
import type { PaintName } from '../../../../../data/render.ts';

const W = 150;
const D = 48;
const BACK = 2; // the warehouses' back wall (sea side)
const CANAL0 = 16; // the canal: between the warehouses' fronts and the promenade's edge
const CANAL1 = 36;
const DEPTH = 2.6;

export const LANDMARK_OTARU_CANAL = landmarkDef({
  variant: 'otaru_canal',
  size: { w: [W, W], d: [D, D] },
  eaves: 7.5,
  top: 12.5,
  roof: 'gable',
  kind: 'warehouse',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, CANAL1], [W, CANAL1], [W, D], [0, D]]);
  L.ground('water', [[0, CANAL0 + 0.3], [W, CANAL0 + 0.3], [W, CANAL1 - 0.4], [0, CANAL1 - 0.4]], DEPTH, 1.3);
  // The promenade's stone embankment and the curb along the water.
  L.box(0, -DEPTH, CANAL1 - 0.6, W, 0, CANAL1, 'paint', { paint: 'stone' });
  L.box(0, 0, CANAL1 - 0.6, W, 0.45, CANAL1 - 0.2, 'paint', { paint: 'gray' });

  // The warehouses: lengths along the canal, each its own roof colour; a gap for the bridge at the end.
  const lens = [22, 18, 24, 20, 17, 21];
  const roofs: PaintName[] = ['charcoal', 'brown', 'charcoal', 'roofRed', 'charcoal', 'brown'];
  let x = 2;
  lens.forEach((len, i) => {
    const x0 = x;
    const x1 = x + len;
    x = x1 + 1.2;
    const eaves = 6.8 + (i % 3) * 0.4;
    const ridge = eaves + 3.6;
    L.box(x0, -DEPTH, BACK, x1, eaves, CANAL0, 'paint', { paint: 'stone' });
    L.box(x0 - 0.1, -DEPTH, CANAL0 - 0.2, x1 + 0.1, 0.4, CANAL0 + 0.15, 'paint', { paint: 'gray' }); // wet foundation
    L.shape('gable', x0 - 0.5, eaves, BACK - 0.5, x1 + 0.5, ridge, CANAL0 + 0.5, 'paint', { paint: roofs[i]!, axis: 'x' });
    // Ridge ornaments (鯱) at both ends.
    for (const ex of [x0 + 0.2, x1 - 0.8]) L.box(ex, ridge - 0.2, (BACK + CANAL0) / 2 - 0.3, ex + 0.6, ridge + 0.9, (BACK + CANAL0) / 2 + 0.3, 'paint', { paint: 'black', solid: false });
    // Small iron-shuttered windows in two rows on the canal side, a big door at water level.
    L.windows('x', CANAL0, 1, x0 + 1.5, x1 - 1.5, Math.max(3, Math.round(len / 5)), 4.3, 5.5, 0.9, { paint: 'black' });
    L.windows('x', CANAL0, 1, x0 + 1.5, x1 - 1.5, Math.max(2, Math.round(len / 6)), 1.6, 2.8, 0.9, { paint: 'charcoal' });
    L.box((x0 + x1) / 2 - 1.5, 0.4, CANAL0, (x0 + x1) / 2 + 1.5, 3.4, CANAL0 + 0.12, 'rust');
    if (i === 2) L.scorch(x0 + 3, 2, CANAL0, x0 + 10, 7, CANAL0 + 0.15);
  });

  // The stone bridge (中央橋) over the canal at the end, on to the warehouses' street.
  const bx0 = x + 1;
  const bx1 = Math.min(W - 1, bx0 + 9);
  L.box(bx0, -0.4, BACK, bx1, 0.3, CANAL1, 'paint', { paint: 'stone' });
  for (const z of [CANAL0 - 1, CANAL1 - 1]) L.box(bx0 + 3, -DEPTH, z, bx1 - 3, -0.4, z + 1, 'paint', { paint: 'stone' });
  L.box(bx0, 0.3, BACK, bx0 + 0.4, 1.2, CANAL1, 'paint', { paint: 'stone' });
  L.box(bx1 - 0.4, 0.3, BACK, bx1, 1.2, CANAL1, 'paint', { paint: 'stone' });

  // Gas lamps along the promenade.
  for (let lx = 6; lx < bx0 - 2; lx += 11) {
    L.column(lx, CANAL1 + 1.2, 0.12, 0, 3.6, 'paint', { paint: 'black' });
    L.box(lx - 0.3, 3.6, CANAL1 + 0.9, lx + 0.3, 4.3, CANAL1 + 1.5, 'paint', { paint: 'lampGlass', solid: false });
    L.shape('hip', lx - 0.4, 4.3, CANAL1 + 0.8, lx + 0.4, 4.7, CANAL1 + 1.6, 'paint', { paint: 'black', solid: false });
  }
  // Two lighters moored at the warehouses.
  for (const lx of [30, 92]) {
    L.box(lx, -1.6, CANAL0 + 1.2, lx + 9, -0.6, CANAL0 + 4, 'paint', { paint: 'brown' });
    L.box(lx + 0.4, -0.6, CANAL0 + 1.6, lx + 8.6, -0.45, CANAL0 + 3.6, 'paint', { paint: 'charcoal', solid: false });
  }

  // 90 days on: an abandoned car and sandbags across the promenade, relief crates by the bridge.
  L.car(52, 42.5, 'x');
  L.sandbags(108, 39, 108, 46);
  L.crates(bx0 - 5, 44, 3);
}
