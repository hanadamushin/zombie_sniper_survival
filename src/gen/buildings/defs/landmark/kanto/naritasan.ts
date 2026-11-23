// L3b: 成田山新勝寺 (Naritasan Shinshō-ji), Narita — the 三重塔 (three-storey pagoda, 1712, 25 m) before
// the 大本堂 (Great Main Hall, 1968). The pagoda: vermilion posts and walls, every bracket cluster and
// rafter end painted in green, blue and gold (the carved clouds and dragons under its eaves), three
// broad dark copper roofs and the bronze finial. Behind it, on its stone terrace up the steps, the
// great hall: vermilion posts, a skirt roof and the big hipped-and-gabled roof of grey-green copper.
//
// The hall is real size in height (about 28 m) and narrowed to 44 m; the precinct's other halls and
// the hill behind are left out. The front (local z = d, the steps) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from './parts.ts';

const W = 64;
const D = 62;
const RED: PaintName = 'red';

export const LANDMARK_NARITASAN = landmarkDef({
  variant: 'naritasan',
  size: { w: [W, W], d: [D, D] },
  eaves: 12,
  top: 28,
  kind: 'house',
  build,
});

/** The pagoda at (ox, oz) on its stone base: three storeys, the colour bands under each roof, the finial. */
function pagoda(L: Lm, ox: number, oz: number): void {
  L.box(ox - 5.6, 0, oz - 5.6, ox + 5.6, 1.2, oz + 5.6, 'paint', { paint: 'stone' });
  let y = 1.2;
  const tiers = [[3.3, 5.2], [2.95, 3.9], [2.6, 3.7]] as const;
  tiers.forEach(([hw, h], i) => {
    L.box(ox - hw, y, oz - hw, ox + hw, y + h, oz + hw, 'paint', { paint: RED });
    // The doors (dark) in the middle bay of each face, the white wall boards beside them.
    for (const s of [-1, 1]) {
      L.box(ox - hw * 0.35, y + 0.4, oz + s * hw - 0.04, ox + hw * 0.35, y + h - 1.4, oz + s * hw + 0.04, 'paint', { paint: 'black', solid: false });
      L.box(ox + s * hw - 0.04, y + 0.4, oz - hw * 0.35, ox + s * hw + 0.04, y + h - 1.4, oz + hw * 0.35, 'paint', { paint: 'black', solid: false });
    }
    // The painted bracket band under the eaves: green and gold.
    L.box(ox - hw - 0.25, y + h - 1.3, oz - hw - 0.25, ox + hw + 0.25, y + h - 0.65, oz + hw + 0.25, 'paint', { paint: 'copper', solid: false });
    L.box(ox - hw - 0.5, y + h - 0.65, oz - hw - 0.5, ox + hw + 0.5, y + h, oz + hw + 0.5, 'paint', { paint: 'gold', solid: false });
    const over = 2.7 - i * 0.15;
    const rise = i === 2 ? 2.3 : 1.7;
    // Gold rafter ends (the carved clouds) round the roof's edge, then the dark roof.
    L.box(ox - hw - over + 0.3, y + h - 0.05, oz - hw - over + 0.3, ox + hw + over - 0.3, y + h + 0.25, oz + hw + over - 0.3, 'paint', { paint: 'gold', solid: false });
    L.box(ox - hw - over, y + h + 0.25, oz - hw - over, ox + hw + over, y + h + 0.55, oz + hw + over, 'paint', { paint: 'charcoal', solid: false });
    L.shape('hip', ox - hw - over, y + h + 0.55, oz - hw - over, ox + hw + over, y + h + 0.55 + rise, oz + hw + over, 'paint', { paint: 'charcoal', axis: 'x' });
    y += h + (i === 2 ? 0.55 + rise : 1.3);
  });
  // The finial (相輪): base, the pole with nine rings, the water flame.
  L.box(ox - 1.1, y - 0.3, oz - 1.1, ox + 1.1, y + 0.8, oz + 1.1, 'paint', { paint: 'bronze' });
  L.column(ox, oz, 0.4, y + 0.8, 24.2, 'paint', { paint: 'bronze' });
  for (let i = 0; i < 9; i++) L.column(ox, oz, 0.95 - i * 0.03, y + 1.3 + i * 0.4, y + 1.55 + i * 0.4, 'paint', { paint: 'bronze', solid: false });
  L.column(ox, oz, 0.7, 24.2, 25, 'paint', { paint: 'gold', taper: 0.3, solid: false });
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The great hall's terrace and the steps up to it.
  L.box(6, 0, 3, 58, 2.4, 34, 'paint', { paint: 'stone' });
  for (let k = 0; k < 4; k++) L.box(22, 0, 34 + k * 0.9, 42, 2.4 - k * 0.6, 34 + (k + 1) * 0.9, 'paint', { paint: 'stone' });
  // The hall: vermilion posts round dark lattice doors, the skirt roof, the great roof.
  const [hx0, hx1, hz0, hz1] = [10, 54, 6, 30];
  L.box(hx0 + 2, 2.4, hz0 + 2, hx1 - 2, 15, hz1 - 2, 'woodDark');
  for (let x = hx0 + 2; x <= hx1 - 2.6; x += 4) L.box(x, 2.4, hz1 - 2.6, x + 0.6, 10, hz1 - 2, 'paint', { paint: RED });
  L.windows('x', hz1 - 2, 1, hx0 + 4, hx1 - 4, 9, 3.2, 8.6, 2.6, { paint: 'brown' });
  L.box(hx0, 9.6, hz0, hx1, 10.2, hz1, 'paint', { paint: 'gold', solid: false });
  L.shape('hip', hx0 - 1.5, 10.2, hz0 - 1.5, hx1 + 1.5, 13.4, hz1 + 1.5, 'paint', { paint: 'grayGreen', axis: 'x' });
  L.box(hx0 + 4, 13, hz0 + 4, hx1 - 4, 17.5, hz1 - 4, 'paint', { paint: RED });
  L.box(hx0 + 3.6, 16.5, hz0 + 3.6, hx1 - 3.6, 17.5, hz1 - 3.6, 'paint', { paint: 'copper', solid: false });
  L.shape('hip', hx0 - 0.8, 17.5, hz0 - 0.8, hx1 + 0.8, 23.5, hz1 + 0.8, 'paint', { paint: 'grayGreen', axis: 'x' });
  L.shape('gable', hx0 + 9, 21.5, hz0 + 3, hx1 - 9, 28, hz1 - 3, 'paint', { paint: 'grayGreen', axis: 'x' });
  for (const s of [-1, 1]) {
    const x = s < 0 ? hx0 + 9.2 : hx1 - 9.2;
    L.shape('gable', x - 0.06, 22, hz0 + 4, x + 0.06, 27.6, hz1 - 4, 'paint', { paint: 'gold', axis: 'z', solid: false });
  }

  // The pagoda before the hall (to its right as one comes up), lanterns, the incense burner.
  pagoda(L, 52, 47);
  L.column(32, 44, 1.6, 0, 1.2, 'paint', { paint: 'bronze' });
  L.column(32, 44, 1.2, 1.2, 2.6, 'paint', { paint: 'bronze', taper: 0.6 });
  for (const x of [18, 46]) for (const z of [40, 54]) {
    if (x === 46 && z === 40) continue;
    L.box(x - 0.5, 0, z - 0.5, x + 0.5, 1.6, z + 0.5, 'paint', { paint: 'stone' });
    L.box(x - 0.8, 1.6, z - 0.8, x + 0.8, 2.4, z + 0.8, 'paint', { paint: 'stone' });
    L.shape('hip', x - 1, 2.4, z - 1, x + 1, 3, z + 1, 'paint', { paint: 'stone', axis: 'x' });
  }
  for (const [x, z, h] of [[3.5, 40, 14], [4, 52, 12], [3.6, 6, 16]] as const) broadleaf(L, x, z, h, 3.2);

  // 90 days on: a relief tent and crates by the steps, a fallen sign, scorch on the hall's doors.
  L.tent(12, 58, 'x', 7);
  L.crates(24, 57, 4);
  L.fallenSign(38, 58, 'x');
  L.scorch(hx0 + 14, 2.6, hz1 - 1.95, hx0 + 20, 7, hz1 - 1.85);
}
