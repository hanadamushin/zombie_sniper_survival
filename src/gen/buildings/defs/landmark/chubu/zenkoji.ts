// L4: 善光寺 本堂と山門 (Zenkō-ji, Nagano: the main hall and the great gate). The main hall of 1707
// (a national treasure) is one of the largest wooden buildings of Japan: 24 m wide, 54 m deep and
// 29 m to its ridge, unpainted wood under a vast cypress-bark roof (檜皮葺) whose ridge is T-shaped
// (撞木造: the long ridge runs back from a cross ridge at the front), a skirt roof (裳階) all round.
// Before it, up the stone-paved approach, the two-storey gate (山門, 1750, 20 m) with the gold-edged
// plaque of the temple's name, and the great bronze incense burner where the pilgrims bathe in smoke.
//
// Real size (the hall, the gate); the approach between them is shortened. The front (local z = d)
// faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';
import { cedar } from '../tohoku/parts.ts';
import { lantern } from './parts.ts';

const W = 44;
const D = 104;
const HX0 = 10;
const HX1 = 34;
const HZ0 = 4;
const HZ1 = 58;

export const LANDMARK_ZENKOJI = landmarkDef({
  variant: 'zenkoji',
  size: { w: [W, W], d: [D, D] },
  eaves: 10,
  top: 29.5,
  roof: 'hip',
  kind: 'house',
  build,
});

function hall(L: Lm): void {
  L.box(HX0 - 2, 0, HZ0 - 2, HX1 + 2, 1.2, HZ1 + 2, 'paint', { paint: 'stone' });
  // The lower walls and the skirt roof.
  L.box(HX0, 1.2, HZ0, HX1, 8.4, HZ1, 'woodDark');
  L.windows('x', HZ1, 1, HX0 + 1, HX1 - 1, 7, 1.8, 7, 2.6, { paint: 'brown', broken: 0.15 });
  L.windows('z', HX1, 1, HZ0 + 2, HZ1 - 2, 9, 2.4, 6.6, 2.8, { paint: 'brown', broken: 0.15 });
  L.windows('z', HX0, -1, HZ0 + 2, HZ1 - 2, 9, 2.4, 6.6, 2.8, { paint: 'brown', broken: 0.15 });
  L.box(HX0 - 0.3, 7.6, HZ0 - 0.3, HX1 + 0.3, 8.4, HZ1 + 0.3, 'paint', { paint: 'offWhite', solid: false }); // the white beams under the eaves
  L.shape('hip', HX0 - 2.6, 8.4, HZ0 - 2.6, HX1 + 2.6, 11.6, HZ1 + 2.6, 'paint', { paint: 'hiwada', axis: 'z' });
  // The upper walls, then the great roof: the long hip-and-gable along z...
  L.box(HX0 + 3, 10.6, HZ0 + 3, HX1 - 3, 15.4, HZ1 - 3, 'woodDark');
  L.box(HX0 + 2.8, 14.4, HZ0 + 2.8, HX1 - 2.8, 15.4, HZ1 - 2.8, 'paint', { paint: 'offWhite', solid: false });
  L.shape('hip', HX0 - 1.5, 15.4, HZ0 - 1.5, HX1 + 1.5, 22.5, HZ1 - 14, 'paint', { paint: 'hiwada', axis: 'z' });
  L.shape('gable', HX0 + 4, 20.4, HZ0 + 1.5, HX1 - 4, 29, HZ1 - 16, 'paint', { paint: 'hiwada', axis: 'z' });
  L.shape('gable', HX0 + 4.6, 20.6, HZ0 + 1.44, HX1 - 4.6, 28.4, HZ0 + 1.56, 'paint', { paint: 'gold', axis: 'x', solid: false });
  // ... and the cross roof at the front (the bar of the T), its gables to east and west.
  L.shape('hip', HX0 - 2.2, 15.4, HZ1 - 17, HX1 + 2.2, 22.5, HZ1 + 1.5, 'paint', { paint: 'hiwada', axis: 'x' });
  L.shape('gable', HX0 - 0.5, 20.4, HZ1 - 13.5, HX1 + 0.5, 29, HZ1 - 2, 'paint', { paint: 'hiwada', axis: 'x' });
  for (const x of [HX0 - 0.44, HX1 + 0.44]) L.shape('gable', x - 0.06, 20.6, HZ1 - 12.8, x + 0.06, 28.4, HZ1 - 2.7, 'paint', { paint: 'gold', axis: 'z', solid: false });
  L.box(HX0 + 4, 28.6, HZ1 - 8.4, HX1 - 4, 29.4, HZ1 - 7.1, 'paint', { paint: 'hiwada', solid: false });
  L.box(17.6, 28.6, HZ0 + 1.5, 26.4, 29.4, HZ1 - 8.4, 'paint', { paint: 'hiwada', solid: false });
  // The porch (向拝) before the front steps.
  for (const x of [15, 29]) L.box(x - 0.4, 1.2, HZ1 + 2.2, x + 0.4, 8, HZ1 + 3, 'woodDark');
  L.shape('gable', 13.5, 8, HZ1 - 0.4, 30.5, 11, HZ1 + 4, 'paint', { paint: 'hiwada', axis: 'z' });
  for (let k = 0; k < 3; k++) L.box(16, 0, HZ1 + 2 + k * 0.8, 28, 1.2 - k * 0.4, HZ1 + 2.8 + k * 0.8, 'paint', { paint: 'stone' });
}

/** The two-storey gate: posts and the dark openings below, a balcony and the plaque above, two roofs. */
function gate(L: Lm, cz: number): void {
  const [x0, x1, z0, z1] = [11.75, 32.25, cz - 6.75, cz + 6.75];
  L.box(x0, 0, z0, x1, 0.8, z1, 'paint', { paint: 'stone' });
  for (const x of [x0, x0 + 6.4, x1 - 6.8, x1 - 0.6]) {
    L.box(x, 0.8, z0 + 1, x + 0.6, 8, z0 + 1.6, 'woodDark');
    L.box(x, 0.8, z1 - 1.6, x + 0.6, 8, z1 - 1, 'woodDark');
  }
  L.box(x0 + 0.6, 0.8, cz - 2, x0 + 6.4, 7.4, cz + 2, 'woodDark'); // the side bays (the guardian rooms)
  L.box(x1 - 6.8, 0.8, cz - 2, x1 - 0.6, 7.4, cz + 2, 'woodDark');
  L.box(x0, 7.4, z0 + 1, x1, 8.4, z1 - 1, 'woodDark');
  L.shape('hip', x0 - 2.4, 8.4, z0 - 1.6, x1 + 2.4, 10.8, z1 + 1.6, 'paint', { paint: 'hiwada', axis: 'x' });
  // The upper storey: the balcony's rail, the walls, the plaque, the hip-and-gable roof.
  L.box(x0 + 0.4, 10.2, z0 + 0.9, x1 - 0.4, 11, z1 - 0.9, 'woodDark');
  L.box(x0 + 0.4, 11, z1 - 0.95, x1 - 0.4, 11.9, z1 - 0.85, 'woodDark', { solid: false });
  L.box(x0 + 1.6, 11, z0 + 2, x1 - 1.6, 15.2, z1 - 2, 'woodDark');
  L.box(19.6, 12.2, z1 - 2.08, 24.4, 14.6, z1 - 1.92, 'paint', { paint: 'gold', solid: false });
  L.box(20, 12.5, z1 - 2.14, 24, 14.3, z1 - 2.06, 'paint', { paint: 'black', solid: false });
  L.shape('hip', x0 - 2, 15.2, z0 - 1.2, x1 + 2, 18.2, z1 + 1.2, 'paint', { paint: 'hiwada', axis: 'x' });
  L.shape('gable', x0 + 3, 17.2, z0 + 1.5, x1 - 3, 20, z1 - 1.5, 'paint', { paint: 'hiwada', axis: 'x' });
}

function build(L: Lm): void {
  L.ground('paved', [[17, HZ1 + 2], [27, HZ1 + 2], [27, D], [17, D]]);
  L.ground('paved', [[6, HZ1 + 4], [38, HZ1 + 4], [38, HZ1 + 16], [6, HZ1 + 16]]);
  hall(L);
  gate(L, 91);
  // The great incense burner, lanterns down the approach.
  L.column(22, HZ1 + 10, 1.6, 0, 1.2, 'paint', { paint: 'bronze' });
  L.column(22, HZ1 + 10, 1.4, 1.2, 2.8, 'paint', { paint: 'bronze', taper: 1.2 });
  L.shape('hip', 20, 2.8, HZ1 + 8, 24, 4.4, HZ1 + 12, 'paint', { paint: 'bronze', axis: 'x' });
  for (const z of [72, 78, 102]) for (const x of [15, 29]) lantern(L, x, z, 3);
  // Trees round the precinct.
  for (const [x, z] of [[4, 10], [4, 30], [40, 12], [40, 36], [4, 50], [40, 52]] as const) cedar(L, x, z, 22, 2.6);
  for (const [x, z] of [[5, 78], [39, 80], [5, 100], [39, 100]] as const) broadleaf(L, x, z, 12, 4);

  // 90 days on: relief tents in the court before the hall, crates, a fallen sign; scorch on the gate.
  L.tent(10, 68, 'z', 6);
  L.tent(34, 68, 'z', 6);
  L.crates(31, 74, 4);
  L.fallenSign(12, 84, 'x');
  L.car(31, 100, 'z', { burnt: true });
  L.scorch(12.2, 1.5, 97.76, 17, 6.5, 97.84);
}
