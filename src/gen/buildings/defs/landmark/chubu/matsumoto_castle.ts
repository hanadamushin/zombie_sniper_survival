// L4: 松本城 (Matsumoto Castle, the "crow castle" 烏城). The oldest standing five-tier keep in Japan
// (about 1594, a national treasure): black lacquered boards (黒漆の下見板) up its walls, a white plaster
// band under each eave, grey tile roofs; joined to it the small keep to the north-west (乾小天守) by
// the two-storey passage (渡櫓), and on the south-east the attached turret (辰巳附櫓) and the open
// moon-viewing pavilion (月見櫓) with its vermilion railings. They stand on low stone walls straight
// out of the wide inner moat (内堀), which mirrors them; the vermilion bridge (埋橋) crosses the west moat.
//
// Real size: the keep 29.4 m from the water's edge to the ridge (stone base 4.5 m, five tiers), the
// first floor about 16 × 14 m. The moat is narrowed to 32 m (south) and 12 m (west). The front
// (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase } from '../tohoku/parts.ts';
import { blackTier, karahafu, maple, type BlackTierStyle } from './parts.ts';

const W = 80;
const D = 72;
const BASE = 4.5;
const MOAT_Z = 40; // the south moat from here to the lot's edge
const MOAT_X = 12; // the west moat from the lot's edge to here
const CX = 44;
const CZ = 30;

export const LANDMARK_MATSUMOTO_CASTLE = landmarkDef({
  variant: 'matsumoto_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 20,
  top: BASE + 25,
  roof: 'hip',
  kind: 'house',
  build,
});

/** The top roof of a black keep: hip, the gable ridge on it, the small ridge ornaments. */
function top(L: Lm, cx: number, cz: number, hx: number, hz: number, y: number, over: number, rise: number): number {
  const axis = hx >= hz ? 'x' : 'z';
  L.box(cx - hx - over, y - 0.25, cz - hz - over, cx + hx + over, y, cz + hz + over, 'paint', { paint: 'white', solid: false });
  L.shape('hip', cx - hx - over, y, cz - hz - over, cx + hx + over, y + rise * 0.55, cz + hz + over, 'paint', { paint: 'kawara', axis });
  const [gx, gz] = axis === 'x' ? [hx * 0.85, hz * 0.55] : [hx * 0.55, hz * 0.85];
  L.shape('gable', cx - gx, y + rise * 0.4, cz - gz, cx + gx, y + rise, cz + gz, 'paint', { paint: 'kawara', axis });
  for (const s of [-1, 1]) {
    if (axis === 'x') L.shape('gable', cx + s * gx - 0.05, y + rise * 0.42, cz - gz * 0.8, cx + s * gx + 0.05, y + rise - 0.2, cz + gz * 0.8, 'paint', { paint: 'black', axis: 'z', solid: false });
    else L.shape('gable', cx - gx * 0.8, y + rise * 0.42, cz + s * gz - 0.05, cx + gx * 0.8, y + rise - 0.2, cz + s * gz + 0.05, 'paint', { paint: 'black', axis: 'x', solid: false });
    const [fx, fz] = axis === 'x' ? [cx + s * (gx - 0.3), cz] : [cx, cz + s * (gz - 0.3)];
    L.box(fx - 0.22, y + rise - 0.1, fz - 0.22, fx + 0.22, y + rise + 0.7, fz + 0.22, 'paint', { paint: 'charcoal', solid: false });
  }
  return y + rise + 0.7;
}

function build(L: Lm): void {
  L.ground('grass', [[MOAT_X, 0], [W, 0], [W, MOAT_Z], [MOAT_X, MOAT_Z]]);
  L.ground('water', [[0, 0], [MOAT_X, 0], [MOAT_X, MOAT_Z], [W, MOAT_Z], [W, D], [0, D]], 2.4, 1);

  const s: BlackTierStyle = { roof: 'kawara', over: 1.5, rise: 1.7, wx: 5, wz: 4, white: 0.3, broken: 0.25 };
  // The stone walls out of the moat: under the keep, the passage and the small keep, the turrets.
  stoneBase(L, CX - 10, CZ - 9, CX + 10, MOAT_Z - 0.5, 0, BASE, 0.12, 3, 'gray');
  stoneBase(L, 18, 8, 31, 21, 0, BASE, 0.12, 3, 'gray');
  stoneBase(L, 28, 14, CX - 9, 26, 0, BASE, 0.12, 3, 'gray');
  stoneBase(L, CX + 9, 30, 74, MOAT_Z - 0.5, 0, BASE, 0.12, 3, 'gray');

  // The keep: five tiers (the third floor hides under the second roof).
  const hs: [number, number, number, number, number][] = [
    [8.2, 7.2, 4.4, 5, 4],
    [7.2, 6.3, 4.2, 4, 4],
    [6.0, 5.2, 4.0, 4, 3],
    [4.9, 4.2, 3.7, 3, 3],
    [4.0, 3.4, 3.5, 3, 2],
  ];
  let y = BASE;
  const eaves: number[] = [];
  hs.forEach(([hx, hz, h, wx, wz], i) => {
    y = blackTier(L, CX, CZ, hx, hz, y, h, { ...s, wx, wz, rise: i === hs.length - 1 ? 0 : s.rise, white: i === hs.length - 1 ? 0.45 : s.white });
    eaves.push(y);
  });
  top(L, CX, CZ, hs[4]![0], hs[4]![1], y, 1.4, 4.0);
  // The keep's gables: the second roof's on the south and north faces, a curved one on the fourth's south.
  const e = eaves;
  for (const [side, at] of [['z+', CZ + hs[1]![1]], ['z-', CZ - hs[1]![1]]] as const) {
    L.shape('gable', CX - 3.4, e[1]! - 0.2, Math.min(at, at + (side === 'z+' ? 1.4 : -1.4)), CX + 3.4, e[1]! + 2.6, Math.max(at, at + (side === 'z+' ? 1.4 : -1.4)), 'paint', { paint: 'kawara', axis: 'z', solid: false });
  }
  karahafu(L, 'z+', CZ + hs[3]![1], CX, 2.6, e[3]! - 0.2, e[3]! + 2, s.over, 'kawara');

  // The small keep (乾小天守): three tiers, north-west.
  const [kx, kz] = [24.5, 14.5];
  let k = blackTier(L, kx, kz, 5, 4.4, BASE, 3.8, { ...s, wx: 3, wz: 3 });
  k = blackTier(L, kx, kz, 4.2, 3.7, k, 3.3, { ...s, wx: 2, wz: 2 });
  k = blackTier(L, kx, kz, 3.5, 3, k, 3.1, { ...s, wx: 2, wz: 2, rise: 0, white: 0.45 });
  top(L, kx, kz, 3.5, 3, k, 1.2, 3);
  // The passage (渡櫓) between them: two storeys, one roof.
  const p = blackTier(L, 32.5, 20, 3.5, 4.5, BASE, 5.2, { ...s, wx: 2, wz: 3, rise: 0 });
  L.box(28, p - 0.25, 14.5, 37, p, 25.5, 'paint', { paint: 'white', solid: false });
  L.shape('hip', 28, p, 14.5, 37, p + 2.4, 25.5, 'paint', { paint: 'kawara', axis: 'z' });

  // The attached turret (辰巳附櫓, two tiers) and the moon-viewing pavilion (月見櫓, open, vermilion rails).
  const [tx, tz] = [CX + 13.5, CZ + 4];
  let t = blackTier(L, tx, tz, 4.5, 4.2, BASE, 3.8, { ...s, wx: 3, wz: 3 });
  t = blackTier(L, tx, tz, 3.6, 3.4, t, 3.2, { ...s, wx: 2, wz: 2, rise: 0, white: 0.45 });
  top(L, tx, tz, 3.6, 3.4, t, 1.2, 2.8);
  const [mx, mz] = [67, 34];
  L.box(mx - 5.5, BASE, mz - 5, mx + 5.5, BASE + 0.6, mz + 5, 'woodDark');
  for (const [x, z] of [[mx - 5.2, mz - 4.7], [mx + 4.9, mz - 4.7], [mx - 5.2, mz + 4.7], [mx + 4.9, mz + 4.7], [mx - 0.15, mz + 4.7], [mx - 0.15, mz - 4.7]] as const) L.box(x, BASE + 0.6, z - 0.3, x + 0.3, BASE + 4, z, 'woodDark');
  for (const [x0, z0, x1, z1] of [[mx - 5.5, mz + 4.6, mx + 5.5, mz + 5], [mx - 5.5, mz - 5, mx + 5.5, mz - 4.6], [mx + 5.1, mz - 5, mx + 5.5, mz + 5]] as const) {
    L.box(x0, BASE + 1.3, z0, x1, BASE + 1.55, z1, 'paint', { paint: 'red' });
    L.box(x0, BASE + 0.6, z0, x1, BASE + 0.8, z1, 'paint', { paint: 'red' });
  }
  L.box(mx - 6.4, BASE + 4, mz - 5.9, mx + 6.4, BASE + 4.25, mz + 5.9, 'paint', { paint: 'white', solid: false });
  L.shape('hip', mx - 6.4, BASE + 4.25, mz - 5.9, mx + 6.4, BASE + 6.6, mz + 5.9, 'paint', { paint: 'kawara', axis: 'x' });

  // The vermilion bridge across the west moat, on its two piers.
  L.box(0, 1.3, 29, MOAT_X, 1.7, 32.2, 'paint', { paint: 'red' });
  for (const z of [29, 31.9]) L.box(0, 1.7, z, MOAT_X, 2.6, z + 0.3, 'paint', { paint: 'red' });
  for (const x of [4, 8]) L.box(x - 0.3, -1, 29.4, x + 0.3, 1.3, 31.8, 'woodDark');

  // Pines and maples on the banks.
  for (const [x, z, h] of [[16, 37, 9], [16, 27, 8], [16, 3, 10], [77, 26, 9], [64, 4, 10]] as const) pine(L, x, z, h);
  for (const [x, z] of [[36, 4], [50, 6], [74, 14]] as const) maple(L, x, z, 7, 3);

  // 90 days on: the enclosure's lawn behind the keep — relief tents and crates, a burnt-out car,
  // a fallen sign by the moat; a scorch on the small keep.
  L.tent(56, 12, 'x', 7);
  L.tent(56, 20, 'x', 7);
  L.crates(66, 18, 4);
  L.car(44, 9, 'x', { burnt: true });
  L.fallenSign(14.5, 33, 'z');
  L.scorch(29.52, BASE + 0.4, 12, 29.6, BASE + 3, 16);
}
