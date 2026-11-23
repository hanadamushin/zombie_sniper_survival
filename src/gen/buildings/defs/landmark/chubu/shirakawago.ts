// L4: 白川郷 荻町の合掌造り集落 (the gasshō-zukuri village of Ogimachi, Shirakawa-gō; a World
// Heritage site). Farmhouses under steep thatched roofs (about 60°, like hands joined in prayer: 合掌)
// of three to five floors — the attics were for silkworms — with their gable ends to north and south,
// boarded and lit by rows of small paper windows, standing among rice paddies (harvested in late
// November), water channels and a pond for fire-fighting water, cedars on the hill behind.
//
// The village has over a hundred houses; the lot holds six (the largest like the Wada house, 13 × 24 m
// and about 15 m to the ridge) with their paddies, in a strip along the valley floor (44 × 96 m: the
// shrunk valley between the river and the mountainside is narrow and steep). The front (local z = d)
// faces south, down the valley.

import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from '../tohoku/parts.ts';
import { gassho, maple } from './parts.ts';

const W = 44;
const D = 96;

export const LANDMARK_SHIRAKAWAGO = landmarkDef({
  variant: 'shirakawago',
  size: { w: [W, W], d: [D, D] },
  eaves: 3,
  top: 24,
  roof: 'gable',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  // Paddies (the stubble of the harvest), the village lane (gravel), a fire pond, a water channel.
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[20, 0], [24, 0], [24, D], [20, D]]);
  L.ground('water', [[36, 36], [42, 36], [42, 43], [36, 43]], 1.6, 0.6);
  L.ground('water', [[1, 38], [19, 38], [19, 39.4], [1, 39.4]], 0.8, 0.5);
  // The paddies' low banks.
  for (const [x0, z0, x1, z1] of [[1, 64, 19, 64.6], [25, 64, 43, 64.6], [1, 90, 19, 90.6], [25, 34, 35, 34.6]] as const) L.box(x0, 0, z0, x1, 0.35, z1, 'paint', { paint: 'green', solid: false });

  // The houses (walls' footprint, wall height, ridge).
  gassho(L, 5, 8, 18, 32, 2.6, 15, 1.4, 0.25);
  gassho(L, 27, 12, 37, 30, 2.4, 12, 1.2, 0.3);
  gassho(L, 5, 44, 15, 60, 2.4, 12.5, 1.2, 0.3);
  gassho(L, 27, 46, 36, 60, 2.2, 10.5, 1.1, 0.35);
  gassho(L, 6, 72, 14, 84, 2, 9, 1, 0.4);
  gassho(L, 27, 70, 36, 86, 2.2, 11, 1.1, 0.3);
  // A storehouse on stilts by the pond (板倉), small thatch.
  L.box(37, 0, 88, 42, 1, 93, 'woodDark');
  L.box(37.3, 1, 88.3, 41.7, 3.6, 92.7, 'woodDark');
  L.shape('gable', 36.4, 3.6, 87.4, 42.6, 6.2, 93.6, 'paint', { paint: 'thatch', axis: 'z' });

  // Cedars on the slope behind (north) and along the east edge, maples in their autumn red.
  for (const x of [3.5, 14, 30, 40.5]) cedar(L, x, 3, 22, 2.6);
  for (const z of [52, 66]) cedar(L, 41, z, 20, 2.4);
  for (const [x, z] of [[18.5, 36], [38, 32], [17, 88]] as const) maple(L, x, z, 7, 2.8);

  // 90 days on: the village was a relief point on the valley road — a burnt-out car and an abandoned
  // one on the lane, tents and crates on the stubble, sandbags across the lane; a shed's thatch
  // fallen in (a thatch heap by its posts); scorch on a house's wall.
  L.car(22, 66, 'z', { burnt: true });
  L.car(22, 40, 'z');
  L.tent(9, 66.5, 'x', 7);
  L.crates(31, 66, 4);
  L.sandbags(20, 94, 24, 94);
  L.shape('gable', 4, 0, 88, 12, 1.6, 94, 'paint', { paint: 'thatch', axis: 'z', solid: false });
  for (const [x, z] of [[4.5, 88.5], [11.2, 88.5], [4.5, 93.3]] as const) L.box(x, 0, z, x + 0.3, 2.4, z + 0.3, 'woodDark');
  L.scorch(37, 0.4, 16, 37.08, 2.2, 22);
}
