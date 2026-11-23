// L3a: 皇居 二重橋と伏見櫓 (the Imperial Palace: Nijūbashi and the Fushimi turret), seen as from the
// outer garden: across the moat the stone bridge of the main gate (正門石橋, 1887) on its two arches —
// the "spectacles bridge" with its lamp posts — and behind it the main gate in a white wall; the iron
// bridge (正門鉄橋, the real 二重橋) higher up beyond; on the right the high curved stone wall with
// pines, and on it the 伏見櫓 (Fushimi turret), a two-tier white turret with its long wall houses
// (多聞) on either side. Only these, from the edge of the palace grounds: nobody goes in.
//
// The moat is dug from the lot (its water 2.2 m down). The front (local z = d, the plaza's gravel)
// faces south-east in reality; the table turns it to the square.

import { landmarkDef, type Lm } from '../common.ts';
import { pine, tier, topRoof } from '../tohoku/parts.ts';
import { slant } from './parts.ts';

const W = 100;
const D = 80;
/** The moat (z), the stone bridge (x), the wall's top. */
const M0 = 44;
const M1 = 68;
const BX0 = 22;
const BX1 = 32;
const WALL = 12;

export const LANDMARK_KOKYO_NIJUBASHI = landmarkDef({
  variant: 'kokyo_nijubashi',
  size: { w: [W, W], d: [D, D] },
  eaves: WALL,
  top: 27,
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, M1], [W, M1], [W, D], [0, D]]);
  L.ground('water', [[0, M0], [W, M0], [W, M1], [0, M1]], 3, 2.2);
  L.ground('grass', [[0, 0], [W, 0], [W, M0], [0, M0]]);

  // 正門石橋: piers in the water, two arches, the deck with its granite parapets and the lamp posts, a
  // ramp up from the plaza; the far end meets the gate.
  const deck = 3;
  const mid = (M0 + M1) / 2;
  for (const z of [M0 + 1.5, mid, M1 - 1.5]) L.box(BX0 + 0.3, -3, z - 1.6, BX1 - 0.3, deck - 0.6, z + 1.6, 'paint', { paint: 'granite' });
  // Each arch: the stone over the opening in slices (the opening's top a half ellipse from the water up).
  for (const [za, zb] of [[M0 + 3.1, mid - 1.6], [mid + 1.6, M1 - 3.1]] as const) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const open = -2.2 + 3.9 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
      L.box(BX0 + 0.3, open, za + ((zb - za) * i) / n, BX1 - 0.3, deck - 0.6, za + ((zb - za) * (i + 1)) / n, 'paint', { paint: 'granite' });
    }
  }
  L.box(BX0, deck - 0.6, M0 - 2, BX1, deck, M1 + 2, 'paint', { paint: 'granite' });
  L.shape('wedge', BX0, 0, M1 + 2, BX1, deck, M1 + 9, 'paint', { paint: 'granite', slope: 'z-' });
  for (const x of [BX0, BX1 - 0.6]) L.box(x, deck, M0 - 2, x + 0.6, deck + 1, M1 + 2, 'paint', { paint: 'granite' });
  for (const z of [M0 - 1.4, M1 + 1.4]) for (const x of [BX0 + 0.3, BX1 - 0.3]) {
    L.column(x, z, 0.25, deck + 1, deck + 4.4, 'paint', { paint: 'bronze', solid: false });
    L.box(x - 0.45, deck + 4.4, z - 0.45, x + 0.45, deck + 5.4, z + 0.45, 'paint', { paint: 'lampGlass', solid: false });
    L.box(x - 0.55, deck + 5.4, z - 0.55, x + 0.55, deck + 5.7, z + 0.55, 'paint', { paint: 'bronze', solid: false });
  }

  // 正門: the gate in the white wall at the bridge's far end (shut), the wall along the moat to the left.
  L.box(0, 0, M0 - 5, BX0 - 3, 4.2, M0 - 3.6, 'paint', { paint: 'offWhite' });
  L.box(0, 4.2, M0 - 5.4, BX0 - 3, 4.8, M0 - 3.2, 'paint', { paint: 'charcoal' });
  L.box(BX0 - 3, 0, M0 - 7, BX1 + 3, 6, M0 - 2, 'paint', { paint: 'offWhite' });
  L.box(BX0 + 1, 0, M0 - 2.05, BX1 - 1, 5, M0 - 1.9, 'paint', { paint: 'black' });
  L.shape('hip', BX0 - 4, 6, M0 - 8, BX1 + 4, 8.6, M0 - 1, 'paint', { paint: 'charcoal', axis: 'x' });

  // 正門鉄橋 (二重橋): higher up behind the gate, a dark steel deck on stone piers, its rails and lamps.
  const ib = 9;
  for (const z of [10, 26]) L.box(BX0 + 1, 0, z - 1.5, BX1 - 1, ib - 0.8, z + 1.5, 'paint', { paint: 'stone' });
  L.box(BX0 - 0.5, ib - 0.8, 4, BX1 + 0.5, ib, M0 - 9, 'paint', { paint: 'charcoal' });
  for (const x of [BX0 - 0.5, BX1 + 0.3]) L.box(x, ib, 4, x + 0.2, ib + 1.1, M0 - 9, 'paint', { paint: 'charcoal', solid: false });
  for (const x of [BX0 - 0.4, BX1 + 0.4]) slant(L, [x, ib - 0.8, 10], [x, ib - 3.4, 18], 4, 0.4, 'charcoal');
  for (const x of [BX0 - 0.4, BX1 + 0.4]) slant(L, [x, ib - 3.4, 18], [x, ib - 0.8, 26], 4, 0.4, 'charcoal');

  // The high stone wall on the right (its foot in the moat), leaning back as it rises; pines on it.
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) ** 1.6 * WALL * 0.18;
    L.box(42, (WALL * i) / steps, 2, W, (WALL * (i + 1)) / steps, M0 - t, 'paint', { paint: 'gray' });
  }
  // The bank on top of the wall: grass under the turret and the pines.
  L.box(42.2, WALL - 0.05, 2.2, W - 0.2, WALL + 0.15, M0 - WALL * 0.18 - 0.2, 'paint', { paint: 'green', solid: false });
  // 伏見櫓: two tiers of white walls, dark roofs, the wall houses (多聞) on either side along the wall's edge.
  const [fx, fz] = [70, 30];
  const s1 = tier(L, fx, fz, 7.5, 5.5, WALL, 4.4, { wall: 'white', roof: 'charcoal', over: 1.4, rise: 1.8, wx: 5, wz: 4, broken: 0.2 });
  const s2 = tier(L, fx, fz, 5.4, 4, s1, 3.6, { wall: 'white', roof: 'charcoal', over: 1.2, rise: 0, wx: 4, wz: 3, broken: 0.2 });
  topRoof(L, fx, fz, 5.4, 4, s2, 1.3, 3.4, 'charcoal', 'charcoal');
  for (const [x0, x1] of [[46, fx - 7.5], [fx + 7.5, W - 2]] as const) {
    L.box(x0, WALL, fz - 3, x1, WALL + 3.4, fz + 3, 'paint', { paint: 'white' });
    L.windows('x', fz + 3, 1, x0 + 1.5, x1 - 1.5, Math.round((x1 - x0) / 5), WALL + 1.2, WALL + 2.4, 0.9, { broken: 0.2 });
    L.shape('gable', x0 - 0.5, WALL + 3.4, fz - 3.8, x1 + 0.5, WALL + 5.4, fz + 3.8, 'paint', { paint: 'charcoal', axis: 'x' });
  }
  for (const [x, z, h] of [[48, 40, 9], [56, 38, 10], [86, 39, 9], [94, 37, 8], [60, 14, 11], [84, 12, 10]] as const) {
    pineOn(L, x, z, WALL, h);
  }
  for (const [x, z, h] of [[6, 30, 10], [12, 14, 9], [36, 24, 8]] as const) pine(L, x, z, h);

  // 90 days on: the plaza (the outer garden) — a relief tent and crates, a fallen board. Nothing on the bridges.
  L.tent(70, 74, 'x', 7);
  L.crates(82, 73, 4);
  L.fallenSign(48, 72, 'x');
}

/** A pine standing on the wall's top (y0). */
function pineOn(L: Lm, x: number, z: number, y0: number, h: number): void {
  L.column(x, z, 0.3, y0, y0 + h * 0.75, 'paint', { paint: 'brown' });
  L.column(x, z, h * 0.28, y0 + h * 0.55, y0 + h * 0.75, 'paint', { paint: 'cedar', taper: 0.6, solid: false });
  L.column(x, z, h * 0.2, y0 + h * 0.78, y0 + h, 'paint', { paint: 'cedar', taper: 0.5, solid: false });
}
