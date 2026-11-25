// L7: 金刀比羅宮 (Kotohira-gū, "Konpira-san"), on the hillside of Zōzu-san above Kotohira, Kagawa: the
// shrine of seafarers reached by the long stone stairway (785 steps to the main shrine). Drawn as the
// hillside in two terraces with the stairway up their middle: at the foot a stone torii; the first
// flight to the great gate (大門, a two-storey gate under grey tiles) at the edge of the middle terrace,
// where the Asahi shrine (旭社, its two-tiered copper roof) stands beside the steps; the second flight
// to the top terrace and the main shrine (御本宮: the worship hall and the main hall behind it, plain
// wood under cypress bark 檜皮葺), with the lookout at the terrace's edge over the Sanuki plain. Stone
// lanterns line the steps; cedars and camphor trees on the hillside.
//
// The real climb is about 190 m over 1.3 km; the shrunk hill is levelled, so the climb is drawn as
// two terraces 11 m apart (22 m in all), 50 walkable steps (0.44 m each). The lookout at the top
// terrace's edge is a firing position (reached by the steps). The front (local z = d, the foot of the
// stairway) faces east, towards the town.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { torii } from '../chubu/parts.ts';
import { broadleaf } from '../kanto/parts.ts';
import { stepsUp } from './parts.ts';

const W = 52;
const D = 96;
/** The two terraces' heights, the stairway's x range, the steps. */
const MID = 11;
const TOP = 22;
const [SX0, SX1] = [22, 30];
const RISE = 0.44;
const RUN = 0.9;
const N = 25;
/** The flights' feet and tops (z). */
const F1 = 89;
const F1T = F1 - N * RUN;
const F2 = 52.5;
const F2T = F2 - N * RUN;
const ROOF: PaintName = 'hiwada';

export const LANDMARK_KOTOHIRAGU = landmarkDef({
  variant: 'kotohiragu',
  size: { w: [W, W], d: [D, D] },
  eaves: TOP + 6,
  top: TOP + 18,
  roof: 'gable',
  kind: 'house',
  build,
});

/** A stone lantern standing at height y (on a terrace or a slope). */
function lanternAt(L: Lm, x: number, y: number, z: number): void {
  L.box(x - 0.35, y - 1, z - 0.35, x + 0.35, y + 1.4, z + 0.35, 'paint', { paint: 'granite' });
  L.box(x - 0.45, y + 1.4, z - 0.45, x + 0.45, y + 2, z + 0.45, 'paint', { paint: 'offWhite', solid: false });
  L.shape('hip', x - 0.65, y + 2, z - 0.65, x + 0.65, y + 2.5, z + 0.65, 'paint', { paint: 'granite', axis: 'x', solid: false });
}

function build(L: Lm): void {
  L.ground('gravel', [[0, F1], [W, F1], [W, D], [0, D]]);

  // The hillside: the middle terrace (from the top terrace's foot to the gate), the top terrace, the
  // slopes beside the two flights, the stone faces of the terraces' edges.
  L.box(0, 0, 0, W, MID, F1T, 'paint', { paint: 'poplar' });
  L.box(0, MID, 0, W, TOP, F2T, 'paint', { paint: 'poplar' });
  for (const [a, b] of [[0, SX0], [SX1, W]] as const) {
    L.shape('wedge', a, 0, F1T, b, MID, F1, 'paint', { paint: 'poplar', slope: 'z-' });
    L.shape('wedge', a, MID, F2T, b, TOP, F2, 'paint', { paint: 'poplar', slope: 'z-' });
  }
  for (const [a, b] of [[0, SX0], [SX1, W]] as const) {
    L.box(a, MID - 1.6, F1T - 0.1, b, MID + 0.02, F1T + 0.3, 'paint', { paint: 'granite', solid: false });
    L.box(a, TOP - 2.2, F2T - 0.1, b, TOP + 0.02, F2T + 0.3, 'paint', { paint: 'gray', solid: false });
  }

  // The stairway: two flights, a lantern every few steps on both sides.
  stepsUp(L, SX0, SX1, F1, 0, N, RISE, RUN);
  stepsUp(L, SX0, SX1, F2, MID, N, RISE, RUN);
  for (const [f, y0] of [[F1, 0], [F2, MID]] as const) {
    for (let i = 2; i < N; i += 5) {
      const z = f - i * RUN - RUN / 2;
      for (const x of [SX0 - 0.7, SX1 + 0.7]) lanternAt(L, x, y0 + (i + 0.5) * RISE, z);
    }
  }
  // The stone torii at the foot.
  torii(L, (SX0 + SX1) / 2, F1 + 3, 'z', 9, 7.2, 'granite');

  // The great gate (大門) at the top of the first flight: two storeys, grey tiles.
  const gx = (SX0 + SX1) / 2;
  const gz = F1T - 3;
  for (const sx of [-4.6, -2.2, 2.2, 4.6]) for (const dz of [-1.8, 1.8]) L.box(gx + sx - 0.3, MID, gz + dz - 0.3, gx + sx + 0.3, MID + 4.6, gz + dz + 0.3, 'woodDark');
  L.box(gx - 6.6, MID + 4.4, gz - 2.8, gx + 6.6, MID + 4.8, gz + 2.8, 'paint', { paint: 'kawara', solid: false });
  L.box(gx - 5, MID + 4.8, gz - 2.2, gx + 5, MID + 7.4, gz + 2.2, 'woodDark');
  L.windows('x', gz + 2.2, 1, gx - 4, gx + 4, 3, MID + 5.4, MID + 6.8, 1.6, { paint: 'offWhite', broken: 0.3 });
  L.box(gx - 6.4, MID + 7.3, gz - 3.4, gx + 6.4, MID + 7.6, gz + 3.4, 'paint', { paint: 'charcoal', solid: false });
  L.shape('hip', gx - 6.4, MID + 7.6, gz - 3.4, gx + 6.4, MID + 9.4, gz + 3.4, 'paint', { paint: 'kawara', axis: 'x' });
  L.shape('gable', gx - 4.2, MID + 8.8, gz - 2, gx + 4.2, MID + 10.6, gz + 2, 'paint', { paint: 'kawara', axis: 'x' });

  // The Asahi shrine beside the second flight: plain wood, the two-tiered copper roof.
  const [ax0, az0, ax1, az1] = [3, F2 + 1.5, 17, F1T - 1];
  L.box(ax0, MID, az0, ax1, MID + 5, az1, 'woodDark');
  L.windows('x', az1, 1, ax0 + 1, ax1 - 1, 4, MID + 1, MID + 4, 2.2, { paint: 'hinoki', broken: 0.2 });
  L.shape('hip', ax0 - 1.6, MID + 5, az0 - 1.6, ax1 + 1.6, MID + 7, az1 + 1.6, 'paint', { paint: 'copper', axis: 'x' });
  L.box(ax0 + 2.2, MID + 6.6, az0 + 1.6, ax1 - 2.2, MID + 8.4, az1 - 1.6, 'woodDark');
  L.shape('hip', ax0 + 0.6, MID + 8.4, az0 + 0.4, ax1 - 0.6, MID + 10.4, az1 - 0.4, 'paint', { paint: 'copper', axis: 'x' });
  L.shape('gable', ax0 + 3.4, MID + 9.6, az0 + 2.2, ax1 - 3.4, MID + 11.6, az1 - 2.2, 'paint', { paint: 'copper', axis: 'x' });

  // The main shrine on the top terrace: the worship hall in front, the main hall behind, cypress bark.
  const hx = (SX0 + SX1) / 2;
  L.box(hx - 10, TOP, 15, hx + 10, TOP + 5.4, 24, 'paint', { paint: 'hinoki' });
  L.windows('x', 24, 1, hx - 9, hx + 9, 5, TOP + 0.8, TOP + 4.6, 2.6, { paint: 'brown', broken: 0.25 });
  L.box(hx - 11.8, TOP + 5.2, 13.2, hx + 11.8, TOP + 5.6, 25.8, 'paint', { paint: ROOF, solid: false });
  L.shape('hip', hx - 11.8, TOP + 5.6, 13.2, hx + 11.8, TOP + 8.6, 25.8, 'paint', { paint: ROOF, axis: 'x' });
  L.shape('gable', hx - 7.5, TOP + 7.6, 15.6, hx + 7.5, TOP + 10.6, 23.4, 'paint', { paint: ROOF, axis: 'x' });
  L.box(hx - 6.5, TOP, 4, hx + 6.5, TOP + 7, 15, 'paint', { paint: 'hinoki' });
  L.shape('gable', hx - 8, TOP + 7, 2.8, hx + 8, TOP + 13.4, 16.2, 'paint', { paint: ROOF, axis: 'z' });
  L.box(hx - 0.4, TOP + 13.2, 2.8, hx + 0.4, TOP + 13.8, 16.2, 'paint', { paint: 'charcoal', solid: false });
  for (const z of [5, 9.5, 14]) L.box(hx - 1.6, TOP + 13.4, z - 0.35, hx + 1.6, TOP + 14, z + 0.35, 'paint', { paint: 'gold', solid: false });
  // The lookout at the terrace's edge (north of the steps' top): its rail, the firing position.
  L.box(SX1 + 1, TOP, F2T + 0.2, W - 2, TOP + 1, F2T + 0.4, 'woodDark');
  L.box(2, TOP, F2T + 0.2, SX0 - 1, TOP + 1, F2T + 0.4, 'woodDark');
  L.vantage(SX1 + 9, TOP, F2T - 1);

  // Cedars and camphor trees on the hillside.
  for (const [x, z, y] of [[4, 8, TOP], [48, 6, TOP], [46, 22, TOP], [6, 24, TOP], [42, 44, MID], [48, 60, MID]] as const) {
    if (y === TOP) cedarAt(L, x, z, y, 18);
    else cedarAt(L, x, z, y, 14);
  }
  // On the slopes beside the flights (their height at that point of the slope).
  for (const [x, f, y0, t] of [[5, F1, 0, 0.35], [15, F1, 0, 0.7], [44, F1, 0, 0.5], [36, F1, 0, 0.8], [7, F2, MID, 0.5], [46, F2, MID, 0.3], [38, F2, MID, 0.75]] as const) {
    cedarAt(L, x, f - t * N * RUN, y0 + t * (MID - 0) - 0.4, 13);
  }
  broadleaf(L, 4, D - 4, 9, 4.5);
  broadleaf(L, W - 4, D - 4, 9, 4.5);

  // 90 days on: relief crates and sandbags at the gate, a tent by the Asahi shrine's side, a fallen sign
  // and a car left at the foot.
  L.sandbags(SX0 - 6, D - 2, SX0 - 1, D - 2);
  L.crates(SX1 + 6, D - 5, 4);
  L.fallenSign(SX0 - 7, D - 6, 'x');
  L.car(44, D - 9, 'z');
}

/** A cedar standing on a terrace at height y (cedar() stands on the lot's ground). */
function cedarAt(L: Lm, x: number, z: number, y: number, h: number): void {
  L.column(x, z, 0.5, y, y + h * 0.4, 'paint', { paint: 'brown' });
  L.column(x, z, 2.6, y + h * 0.3, y + h, 'paint', { paint: 'cedar', taper: 0.12, solid: false });
}
