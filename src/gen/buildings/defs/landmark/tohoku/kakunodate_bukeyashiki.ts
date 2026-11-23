// L2: 角館 武家屋敷通り (the samurai street of Kakunodate). A broad straight street of the 1620 town
// plan, lined on both sides by black board fences (黒板塀) with roofed gates (薬医門), the old houses
// behind them in their gardens — thatched (青柳家, 石黒家) or shingled — and above it all the weeping
// cherries (枝垂れ桜, planted from the 17th century) hanging pink over the fences, with dark firs (樅).
//
// The lot is 110 m of the street: four houses behind their fences and gates, six weeping cherries.
// The street runs along local z; the front (local z = d) is its south end.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { cedar, weepingCherry } from './parts.ts';

const W = 48;
const D = 110;
/** The street between the fences (x). */
const SX0 = 18.6;
const SX1 = 29.4;

export const LANDMARK_KAKUNODATE_BUKEYASHIKI = landmarkDef({
  variant: 'kakunodate_bukeyashiki',
  size: { w: [W, W], d: [D, D] },
  eaves: 3.6,
  top: 22,
  roof: 'hip',
  kind: 'house',
  build,
});

/** A black board fence along z at x (the street side is `side`), with gaps for the gates, under a little roof. */
function fence(L: Lm, x: number, gates: number[]): void {
  const cuts = [...gates].sort((a, b) => a - b);
  let z = 0.5;
  const run = (z0: number, z1: number): void => {
    if (z1 - z0 < 0.5) return;
    L.box(x - 0.15, 0, z0, x + 0.15, 2.1, z1, 'paint', { paint: 'black' });
    L.box(x - 0.1, 0, z0, x + 0.1, 0.5, z1, 'paint', { paint: 'stone', solid: false }); // the stone footing
    L.shape('gable', x - 0.45, 2.1, z0, x + 0.45, 2.45, z1, 'paint', { paint: 'charcoal', axis: 'z', solid: false });
  };
  for (const g of cuts) {
    run(z, g - 2);
    z = g + 2;
  }
  run(z, D - 0.5);
}

/** A roofed gate (薬医門) in a fence at x: two posts, the shut leaves, its gable roof along the fence. */
function gate(L: Lm, x: number, z: number): void {
  for (const s of [-1, 1]) L.box(x - 0.2, 0, z + s * 2 - 0.2, x + 0.2, 3, z + s * 2 + 0.2, 'woodDark');
  L.box(x - 0.08, 0, z - 1.8, x + 0.08, 2.6, z + 1.8, 'paint', { paint: 'brown' });
  L.box(x - 0.6, 2.9, z - 2.3, x + 0.6, 3.15, z + 2.3, 'woodDark', { solid: false });
  L.shape('gable', x - 1.6, 3.15, z - 2.8, x + 1.6, 4.4, z + 2.8, 'paint', { paint: 'charcoal', axis: 'z', solid: false });
}

/** A house in its garden: plaster and timber walls on a stone footing, a thatched hip or a shingled gable roof. */
function house(L: Lm, x0: number, z0: number, x1: number, z1: number, roof: 'thatch' | 'shingle', streetX: number): void {
  L.box(x0 - 0.3, 0, z0 - 0.3, x1 + 0.3, 0.5, z1 + 0.3, 'paint', { paint: 'stone' });
  L.box(x0, 0.5, z0, x1, 3.6, z1, 'paint', { paint: 'offWhite' });
  // Timber frame on the street face: posts and the shut sliding doors (dark wood), the veranda.
  const fx = streetX > x1 ? x1 : x0;
  const out = streetX > x1 ? 1 : -1;
  for (let z = z0; z <= z1 + 0.01; z += 1.8) L.box(fx - 0.08, 0.5, z - 0.1, fx + 0.08, 3.6, z + 0.1, 'woodDark', { solid: false });
  L.windows('z', fx, out, z0 + 1, z1 - 1, Math.max(2, Math.round((z1 - z0) / 2.5)), 0.9, 2.9, 1.4, { paint: 'brown', broken: 0.2 });
  const wood: PaintName = roof === 'thatch' ? 'thatch' : 'charcoal';
  if (roof === 'thatch') {
    L.shape('hip', x0 - 1.2, 3.4, z0 - 1.2, x1 + 1.2, 9.6, z1 + 1.2, 'paint', { paint: wood, axis: 'z' });
    L.box((x0 + x1) / 2 - 0.4, 9.3, z0 + 3, (x0 + x1) / 2 + 0.4, 9.8, z1 - 3, 'paint', { paint: 'charcoal', solid: false }); // the ridge
  } else {
    L.shape('gable', x0 - 1, 3.6, z0 - 1, x1 + 1, 7.2, z1 + 1, 'paint', { paint: wood, axis: 'z' });
  }
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[SX0, 0], [SX1, 0], [SX1, D], [SX0, D]]);

  // The fences and their gates, both sides.
  const left = [30, 72];
  const right = [34, 82];
  fence(L, SX0, left);
  fence(L, SX1, right);
  for (const z of left) gate(L, SX0, z);
  for (const z of right) gate(L, SX1, z);
  // The houses: thatched ones (the 青柳家 and 石黒家 kind) and shingled ones.
  house(L, 3, 62, 14, 80, 'thatch', SX0);
  house(L, 34, 74, 45, 92, 'thatch', SX1);
  house(L, 4, 20, 13.5, 36, 'shingle', SX0);
  house(L, 34.5, 25, 44, 41, 'shingle', SX1);
  // The gardens' stone paths from the gates.
  for (const z of left) L.box(13.5, 0, z - 0.8, SX0, 0.05, z + 0.8, 'paint', { paint: 'stone', solid: false });
  for (const z of right) L.box(SX1, 0, z - 0.8, 34.5, 0.05, z + 0.8, 'paint', { paint: 'stone', solid: false });

  // The weeping cherries just inside the fences, hanging over the street; dark firs behind.
  for (const [x, z, h] of [[15.2, 10, 18], [15.2, 48, 20], [15.2, 94, 17], [32.8, 12, 19], [32.8, 56, 17], [32.8, 102, 18]] as const) weepingCherry(L, x, z, h, 6.4);
  for (const [x, z] of [[6, 4], [7, 50], [42, 60], [41, 8], [8, 100]] as const) cedar(L, x, z, 21, 2.4);

  // 90 days on: a car left in the street, a barricade of sandbags across half of it, a fallen board.
  L.car(24, 64, 'z');
  L.sandbags(SX0 + 0.5, 20, 24, 20);
  L.fallenSign(26.5, 44, 'z');
  L.crates(SX1 - 2, 90, 3);
}
