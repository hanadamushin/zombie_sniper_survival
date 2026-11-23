// L3b: 日光東照宮 陽明門 (Yōmeimon, the Sunlight Gate of Nikkō Tōshō-gū, 1636), Nikkō. A two-storey gate
// 11.1 m high, 7 m across and 4.4 m deep on twelve white-painted posts, covered in carvings (over 500)
// in gold, black lacquer, vermilion, green and blue: the dense bracket clusters under each roof, the
// railed gallery round the upper storey, the 入母屋 roof of dark copper with a curved 唐破風 gable
// on front and back. From its sides the 回廊 (corridors) run off, vermilion with a band of carved and
// painted panels under their tiled roofs. Before it the stone steps and the stone lanterns; the tall
// cedars of the precinct round it.
//
// The gate is real size; the corridors run 24 m either side. A shrine: 90 days on only a fallen sign
// and a few relief crates, as at Zuihōden (L2). The front (local z = d, the steps) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from '../tohoku/parts.ts';

const W = 56;
const D = 44;
const X = 28;
const Z = 18;
const HX = 3.5;
const HZ = 2.2;

export const LANDMARK_NIKKO_YOMEIMON = landmarkDef({
  variant: 'nikko_yomeimon',
  size: { w: [W, W], d: [D, D] },
  eaves: 7,
  top: 30,
  kind: 'house',
  build,
});

/** A band of the carvings: stripes of gold, green, vermilion and blue round a box. */
function carvings(L: Lm, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): void {
  const cols: PaintName[] = ['gold', 'copper', 'red', 'skyBlue'];
  const h = (y1 - y0) / cols.length;
  cols.forEach((c, i) => L.box(x0, y0 + i * h, z0, x1, y0 + (i + 1) * h, z1, 'paint', { paint: c, solid: false }));
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[X - 5, Z], [X + 5, Z], [X + 5, D], [X - 5, D]]);
  // The stone platform and the steps before it.
  L.box(X - 6.5, 0, Z - 4.5, X + 6.5, 1, Z + 4.5, 'paint', { paint: 'stone' });
  for (let k = 0; k < 4; k++) L.box(X - 4.5, 0, Z + 4.5 + k * 0.8, X + 4.5, 1 - k * 0.25, Z + 4.5 + (k + 1) * 0.8, 'paint', { paint: 'stone' });

  // The lower storey: twelve white posts (the side bays closed by white walls and gilded grilles).
  const y0 = 1;
  for (const px of [-HX, -1.2, 1.2, HX]) for (const pz of [-HZ, 0, HZ]) {
    L.box(X + px - 0.25, y0, Z + pz - 0.25, X + px + 0.25, y0 + 4.6, Z + pz + 0.25, 'paint', { paint: 'white' });
  }
  for (const s of [-1, 1]) {
    const [a, b] = s < 0 ? [X - HX, X - 1.2] : [X + 1.2, X + HX];
    L.box(a, y0, Z - HZ + 0.2, b, y0 + 4.6, Z + HZ - 0.2, 'paint', { paint: 'white' });
    L.box(a + 0.3, y0 + 1.2, Z + HZ - 0.2, b - 0.3, y0 + 3.8, Z + HZ - 0.1, 'paint', { paint: 'gold', solid: false });
  }
  // The passage's doors (open frames of black lacquer beams).
  L.box(X - HX - 0.3, y0 + 4.6, Z - HZ - 0.3, X + HX + 0.3, y0 + 5.2, Z + HZ + 0.3, 'paint', { paint: 'black' });
  // The bracket clusters under the gallery (dense, gilded and painted), the gallery and its rail.
  carvings(L, X - HX - 0.6, X + HX + 0.6, Z - HZ - 0.6, Z + HZ + 0.6, y0 + 5.2, y0 + 6.4);
  L.box(X - HX - 1.2, y0 + 6.4, Z - HZ - 1.2, X + HX + 1.2, y0 + 6.7, Z + HZ + 1.2, 'paint', { paint: 'black' });
  for (const s of [-1, 1]) {
    L.box(X - HX - 1.2, y0 + 6.7, Z + s * (HZ + 1.1) - 0.08, X + HX + 1.2, y0 + 7.4, Z + s * (HZ + 1.1) + 0.08, 'paint', { paint: 'red', solid: false });
    L.box(X + s * (HX + 1.1) - 0.08, y0 + 6.7, Z - HZ - 1.2, X + s * (HX + 1.1) + 0.08, y0 + 7.4, Z + HZ + 1.2, 'paint', { paint: 'red', solid: false });
    L.box(X - HX - 1.2, y0 + 7.4, Z + s * (HZ + 1.1) - 0.1, X + HX + 1.2, y0 + 7.55, Z + s * (HZ + 1.1) + 0.1, 'paint', { paint: 'gold', solid: false });
  }
  // The upper storey: white walls with gilded panels, the second band of brackets.
  L.box(X - HX + 0.3, y0 + 6.7, Z - HZ + 0.3, X + HX - 0.3, y0 + 8.4, Z + HZ - 0.3, 'paint', { paint: 'white' });
  L.windows('x', Z + HZ - 0.3, 1, X - HX + 0.6, X + HX - 0.6, 3, y0 + 7, y0 + 8.1, 1.6, { paint: 'gold' });
  L.windows('x', Z - HZ + 0.3, -1, X - HX + 0.6, X + HX - 0.6, 3, y0 + 7, y0 + 8.1, 1.6, { paint: 'gold' });
  carvings(L, X - HX - 0.2, X + HX + 0.2, Z - HZ - 0.2, Z + HZ + 0.2, y0 + 8.4, y0 + 9.2);
  // The roof: hipped and gabled, dark copper, a gold ridge; the curved gables (唐破風) front and back.
  const ry = y0 + 9.2;
  L.box(X - HX - 2.2, ry - 0.1, Z - HZ - 2.2, X + HX + 2.2, ry + 0.25, Z + HZ + 2.2, 'paint', { paint: 'gold', solid: false });
  L.shape('hip', X - HX - 2.2, ry + 0.25, Z - HZ - 2.2, X + HX + 2.2, ry + 1.6, Z + HZ + 2.2, 'paint', { paint: 'charcoal', axis: 'x' });
  L.shape('gable', X - HX + 0.4, ry + 1.2, Z - HZ - 0.8, X + HX - 0.4, 11.1 - 0.3, Z + HZ + 0.8, 'paint', { paint: 'charcoal', axis: 'x' });
  L.box(X - HX + 0.3, 11.1 - 0.35, Z - 0.15, X + HX - 0.3, 11.1, Z + 0.15, 'paint', { paint: 'gold', solid: false });
  for (const s of [-1, 1]) {
    // The 唐破風: a low curved hood (a cylinder lying along x, half above the eaves) over the front, gold edge.
    const z = Z + s * (HZ + 1.6);
    L.shape('cyl', X - 2.1, ry + 0.3, z - 0.9, X + 2.1, ry + 1.7, z + 0.9, 'paint', { paint: 'charcoal', solid: false }).taper = 0.35;
    L.box(X - 2.2, ry - 0.1, z - 0.1, X + 2.2, ry + 0.3, z + 0.1, 'paint', { paint: 'gold', solid: false });
    L.box(X - 0.35, ry - 0.6, z - 0.12, X + 0.35, ry + 0.2, z + 0.12, 'paint', { paint: 'gold', solid: false });
  }

  // The corridors (回廊): vermilion walls, a band of painted panels, tiled roofs, off to both sides.
  for (const s of [-1, 1]) {
    const [a, b] = s < 0 ? [2, X - HX - 0.4] : [X + HX + 0.4, W - 2];
    L.box(a, 0, Z - 1.6, b, 3.6, Z + 1.6, 'paint', { paint: 'red' });
    carvings(L, a, b, Z - 1.7, Z + 1.7, 3.6, 4.6);
    L.box(a, 4.6, Z - 1.7, b, 4.9, Z + 1.7, 'paint', { paint: 'black', solid: false });
    L.shape('gable', a - 0.2, 4.9, Z - 2.6, b + 0.2, 6.6, Z + 2.6, 'paint', { paint: 'charcoal', axis: 'x' });
    // The white plaster panel line along the front.
    L.box(a + 0.5, 0.9, Z + 1.6, b - 0.5, 3, Z + 1.7, 'paint', { paint: 'offWhite', solid: false });
  }

  // Stone lanterns before the gate, cedars round the precinct.
  for (const x of [X - 9, X - 14, X + 9, X + 14]) {
    L.box(x - 0.5, 0, 30 - 0.5, x + 0.5, 1.8, 30 + 0.5, 'paint', { paint: 'stone' });
    L.box(x - 0.85, 1.8, 30 - 0.85, x + 0.85, 2.7, 30 + 0.85, 'paint', { paint: 'stone' });
    L.shape('hip', x - 1.1, 2.7, 30 - 1.1, x + 1.1, 3.4, 30 + 1.1, 'paint', { paint: 'stone', axis: 'x' });
  }
  for (const [x, z, h] of [[4, 5, 30], [14, 4, 28], [42, 4, 29], [52, 5, 30], [3.5, 38, 26], [52.5, 38, 27]] as const) cedar(L, x, z, h);

  // 90 days on (a shrine: kept to little): a fallen sign, relief crates by a lantern.
  L.fallenSign(X + 8, 38, 'x');
  L.crates(X - 20, 34, 3);
}
