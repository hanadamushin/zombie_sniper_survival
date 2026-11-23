// L2: 山寺（宝珠山 立石寺） (Yamadera, Risshaku-ji, 860), the temple on the rock cliffs above the
// Yamadera valley that Bashō climbed. At the top of the thousand steps: 五大堂, the open hall on stilts
// at the cliff edge from which the whole valley is seen; beside it 開山堂 on its ledge, and the tiny
// vermilion 納経堂 standing alone on a pinnacle of rock — the picture everyone knows.
//
// The real cliffs rise some 160 m over the valley; an area is the real ground shrunk 1/10, so the
// rock here is a 38 m crag (the halls on it keep their true size). The front (local z = d) is the
// valley side. Firing position: 五大堂's stage (22 m), reached by an outside ladder up the face of
// its ledge (the stone steps are not climbable here).

import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from './parts.ts';

const W = 56;
const D = 48;
/** The stage of 五大堂 (the top of its ledge). */
const FLOOR = 22;

export const LANDMARK_YAMADERA = landmarkDef({
  variant: 'yamadera',
  size: { w: [W, W], d: [D, D] },
  eaves: FLOOR,
  top: 46,
  roof: 'hip',
  kind: 'house',
  build,
});

/** A cedar standing on a rock at height y. */
function cedarOn(L: Lm, x: number, z: number, y: number, h: number): void {
  L.column(x, z, 0.4, y, y + h * 0.4, 'paint', { paint: 'brown' });
  L.column(x, z, 2, y + h * 0.3, y + h, 'paint', { paint: 'cedar', taper: 0.12, solid: false });
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  const rock = { paint: 'gray' as const };
  const rock2 = { paint: 'stone' as const };
  // The crag: rounded masses of tuff leaning in as they rise (ellipses in plan, tapering), the ledges
  // the halls stand on, boulders turned askew, the woods clinging to the shoulders.
  const crag = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, taper: number, paint: 'gray' | 'stone'): void => {
    L.shape('cyl', x0, y0, z0, x1, y1, z1, 'paint', { paint }).taper = taper;
  };
  crag(1, 0, 27, 21, 0, 30, 0.55, 'gray');
  crag(17, 0, 47, 16, 0, 38, 0.5, 'gray');
  crag(37, 0, 55.4, 19, 0, 27, 0.55, 'gray');
  crag(6, 3, 22, 15, 26, 33, 0.6, 'stone');
  crag(24, 2, 40, 12, 33, 41, 0.55, 'stone');
  crag(41, 4, 52, 14, 24, 30, 0.6, 'stone');
  L.box(24, 0, 12, 42, FLOOR, 22, 'paint', rock); // 五大堂's ledge (its face cut flat by the steps)
  crag(13, 14, 28, 28, 0, 24, 0.85, 'stone'); // 開山堂's ledge
  crag(40, 12, 54, 26, 0, 13, 0.6, 'stone');
  L.box(44, 0, 22, 50, 6, 30, 'paint', rock).yaw = 0.35;
  L.box(3, 0, 19, 11, 8, 26, 'paint', rock2).yaw = -0.3;
  L.box(40.5, 0, 19, 44.5, 9, 23, 'paint', rock2).yaw = 0.6;
  // The weathered faces: dark hollows in the cliffs (the caves and niches of the rock).
  for (const [x, y0, y1, z] of [[9, 12, 24, 19.3], [19, 6, 20, 19.3], [30, 24, 33, 15.4], [36, 25, 34, 15.4], [47, 12, 20, 17.4]] as const) {
    L.box(x - 1.2, y0, z - 0.05, x + 1.2, y1, z + 0.1, 'paint', { paint: 'charcoal', solid: false });
  }
  // The woods on the shoulders (broad dark-green crowns).
  for (const [x, z, y, r] of [[5, 8, 22, 4], [22, 3, 30, 4.5], [45, 6, 20, 4], [51, 15, 11, 3.5], [16, 12, 27, 3], [14, 9, 32, 5], [32, 7, 40, 5.5], [46.5, 9, 29, 4.5], [27, 5, 38, 3.5]] as const) {
    L.column(x, z, r, y, y + r * 1.3, 'paint', { paint: 'green', taper: 0.4, solid: false });
  }

  // 納経堂 on its pinnacle: a column of rock, the little vermilion hall with its pyramid roof.
  const [nx, nz] = [11, 31];
  L.column(nx, nz, 4.2, 0, 26, 'paint', { ...rock, taper: 0.62 });
  L.box(nx - 1.4, 26, nz - 1.4, nx + 1.4, 28.4, nz + 1.4, 'paint', { paint: 'red' });
  L.box(nx - 0.5, 26.2, nz + 1.4, nx + 0.5, 27.9, nz + 1.48, 'paint', { paint: 'brown', solid: false });
  L.shape('hip', nx - 2.1, 28.4, nz - 2.1, nx + 2.1, 30.1, nz + 2.1, 'paint', { paint: 'charcoal', axis: 'x' });
  L.column(nx, nz, 0.15, 29.9, 30.6, 'paint', { paint: 'gold' });

  // 開山堂: a dark wooden hall with vermilion posts and a hip-and-gable roof, on its ledge.
  const [kx, kz, ky] = [20.2, 21, 24];
  L.box(kx - 3.2, ky, kz - 3, kx + 3.2, ky + 3.4, kz + 3, 'paint', { paint: 'brown' });
  for (const x of [kx - 3.2, kx - 1.1, kx + 1.1, kx + 3.2]) L.box(x - 0.15, ky, kz + 2.95, x + 0.15, ky + 3.4, kz + 3.1, 'paint', { paint: 'red', solid: false });
  L.shape('hip', kx - 4.2, ky + 3.4, kz - 4, kx + 4.2, ky + 5.4, kz + 4, 'paint', { paint: 'charcoal', axis: 'x' });
  L.shape('gable', kx - 2.6, ky + 4.6, kz - 2, kx + 2.6, ky + 6.4, kz + 2, 'paint', { paint: 'charcoal', axis: 'x' });

  // 五大堂: the stage (its front on stilts over the drop), the open hall's posts and roof, the rail.
  const [x0, x1, z0, z1] = [28, 40, 14, 28];
  L.box(x0, FLOOR - 0.4, z0, x1, FLOOR, z1, 'woodDark');
  for (let x = x0 + 0.3; x <= x1 - 0.29; x += (x1 - x0 - 0.6) / 4) {
    for (const z of [23, 27.6]) L.box(x - 0.2, 0, z - 0.2, x + 0.2, FLOOR - 0.4, z + 0.2, 'woodDark'); // 懸造の柱
  }
  for (const y of [7, 14]) L.box(x0 + 0.1, y, 22.9, x1 - 0.1, y + 0.3, 27.8, 'woodDark', { solid: false }); // the stilts' ties
  // The rail round the stage's open sides (front, and both sides beyond the ledge).
  L.box(x0, FLOOR, z1 - 0.15, x1, FLOOR + 1.0, z1, 'woodDark');
  L.box(x0, FLOOR, 22, x0 + 0.15, FLOOR + 1.0, z1, 'woodDark');
  L.box(x1 - 0.15, FLOOR, 22, x1, FLOOR + 1.0, z1, 'woodDark');
  // Posts and the roof (hip and gable, weathered shingles), the hall open on three sides.
  for (const [x, z] of [[x0 + 0.5, z0 + 0.5], [x1 - 0.5, z0 + 0.5], [x0 + 0.5, z1 - 1.2], [x1 - 0.5, z1 - 1.2], [(x0 + x1) / 2, z1 - 1.2]] as const) {
    L.box(x - 0.2, FLOOR, z - 0.2, x + 0.2, FLOOR + 3.4, z + 0.2, 'woodDark');
  }
  L.box(x0, FLOOR + 3.2, z0, x1, FLOOR + 3.6, z1 - 0.8, 'woodDark', { solid: false });
  L.shape('hip', x0 - 1.4, FLOOR + 3.6, z0 - 0.5, x1 + 1.4, FLOOR + 6.2, z1 + 0.6, 'paint', { paint: 'charcoal', axis: 'x' });
  L.shape('gable', x0 + 2, FLOOR + 5.2, z0 + 2, x1 - 2, FLOOR + 7.4, z1 - 3, 'paint', { paint: 'charcoal', axis: 'x' });
  // The ladder up the face of the ledge, west of the stage; the firing position at the stage's rail.
  L.ladder(26, 22.45, 0, -1, 0, FLOOR);
  L.vantage(34, FLOOR, z1 - 0.7);

  // The stone steps at the foot and the gate (山門) where the climb begins.
  for (let i = 0; i < 4; i++) L.box(42, 0, 40 + i * 1.2, 48, 0.2 + i * 0.2, 41.2 + i * 1.2, 'paint', { paint: 'stone' });
  L.box(43, 0, 45.5, 43.4, 3.2, 45.9, 'woodDark');
  L.box(46.6, 0, 45.5, 47, 3.2, 45.9, 'woodDark');
  L.shape('gable', 41.8, 3.2, 44.6, 48.2, 4.6, 46.8, 'paint', { paint: 'charcoal', axis: 'x', solid: false });

  // Cedars at the foot and on the crag.
  for (const [x, z, h] of [[2, 40, 26], [20, 42, 24], [30, 44, 22], [52, 34, 25], [54, 44, 23], [36, 36, 20]] as const) cedar(L, x, z, h, 2.2);
  cedarOn(L, 9, 6, 33, 9);
  cedarOn(L, 41, 6, 38, 8);
  cedarOn(L, 49, 8, 31, 9);
  cedarOn(L, 22, 4, 38, 7);

  // 90 days on: a relief tent and crates by the gate.
  L.tent(26, 41, 'x', 6);
  L.crates(36, 42, 3);
}
