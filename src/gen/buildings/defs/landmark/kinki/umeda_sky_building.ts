// L5: 梅田スカイビル (Umeda Sky Building, 1993, Hara Hiroshi), Shin-Umeda City, Kita. 173 m: two
// 40-storey towers of silver glass joined at the top by the Floating Garden Observatory (空中庭園),
// a bridge of the full width whose middle, over the gap, is pierced by a great round opening; glass
// tubes of escalators cross the gap up to it. At the foot, the garden of the Shin-Umeda City.
//
// Real size: 173 m; each tower drawn 36 × 36 m, the gap 36 m. The front (local z = d) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf, slant, xyLine } from '../kanto/parts.ts';

const W = 116;
const D = 44;
/** The towers' x ranges, their z range, the bridge's foot, the roof. */
const TOWERS: readonly [number, number][] = [[4, 40], [76, 112]];
const Z0 = 4;
const Z1 = 40;
const BRIDGE = 150;
const ROOF = 173;
const GLASS: PaintName = 'mirror';
const FRAME: PaintName = 'silver';

export const LANDMARK_UMEDA_SKY_BUILDING = landmarkDef({
  variant: 'umeda_sky_building',
  size: { w: [W, W], d: [D, D] },
  eaves: BRIDGE,
  top: ROOF + 1.2,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The towers: glass, a silver frame line every three floors and fins up the faces.
  for (const [x0, x1] of TOWERS) {
    L.box(x0, 0, Z0, x1, BRIDGE, Z1, 'paint', { paint: GLASS });
    for (let y = 12; y < BRIDGE; y += 12) {
      L.box(x0 - 0.15, y, Z0 - 0.15, x1 + 0.15, y + 0.8, Z1 + 0.15, 'paint', { paint: FRAME, solid: false });
    }
    for (const z of [Z0, Z1]) {
      const out = z === Z1 ? 1 : -1;
      for (let i = 0; i <= 5; i++) {
        const x = x0 + ((x1 - x0) * i) / 5;
        L.box(x - 0.3, 0, z + (out > 0 ? 0 : -0.3), x + 0.3, BRIDGE, z + (out > 0 ? 0.3 : 0), 'paint', { paint: FRAME, solid: false });
      }
    }
    for (const x of [x0, x1]) {
      const out = x === x1 ? 1 : -1;
      for (let i = 1; i < 6; i++) {
        const z = Z0 + ((Z1 - Z0) * i) / 6;
        L.box(x + (out > 0 ? 0 : -0.3), 0, z - 0.3, x + (out > 0 ? 0.3 : 0), BRIDGE, z + 0.3, 'paint', { paint: FRAME, solid: false });
      }
    }
    // The entrance lobby's dark glass at the foot.
    L.box(x0 + 3, 0, Z1, x1 - 3, 9, Z1 + 0.15, 'paint', { paint: 'deckGlass', solid: false });
  }

  // The Floating Garden: the bridge over the whole width (solid on the towers), its middle over the
  // gap pierced by the round opening (slabs that stop at the circle).
  const [g0, g1] = [TOWERS[0]![1], TOWERS[1]![0]];
  const gc = (g0 + g1) / 2;
  const [oy, or] = [161.2, 10.6];
  for (const [x0, x1] of TOWERS) L.box(x0 - 0.5, BRIDGE, Z0 - 0.5, x1 + 0.5, ROOF - 1.5, Z1 + 0.5, 'paint', { paint: FRAME });
  const n = 10;
  for (let i = 0; i < n; i++) {
    const y0 = BRIDGE + ((ROOF - 1.5 - BRIDGE) * i) / n;
    const y1 = BRIDGE + ((ROOF - 1.5 - BRIDGE) * (i + 1)) / n;
    const ym = (y0 + y1) / 2;
    const dy = Math.abs(ym - oy);
    if (dy >= or) {
      L.box(g0, y0, Z0, g1, y1, Z1, 'paint', { paint: FRAME });
    } else {
      const half = Math.sqrt(or * or - dy * dy);
      L.box(g0, y0, Z0, gc - half, y1, Z1, 'paint', { paint: FRAME });
      L.box(gc + half, y0, Z0, g1, y1, Z1, 'paint', { paint: FRAME });
    }
  }
  // The opening's white rim on both faces.
  for (const [za, zb] of [[Z0 - 0.3, Z0 + 0.2], [Z1 - 0.2, Z1 + 0.3]] as const) {
    const k = 20;
    for (let i = 0; i < k; i++) {
      const t0 = (i / k) * Math.PI * 2;
      const t1 = ((i + 1) / k) * Math.PI * 2;
      xyLine(L, gc + Math.cos(t0) * or, oy + Math.sin(t0) * or, gc + Math.cos(t1) * or, oy + Math.sin(t1) * or, za, zb, 0.9, 'white', { step: 2.5 });
    }
  }
  // The garden's glass band round the observatory floor, the roof deck's rail (the Sky Walk), the roof.
  for (const [x0, x1] of TOWERS) L.box(x0 - 0.7, 164, Z0 - 0.7, x1 + 0.7, 169.5, Z1 + 0.7, 'paint', { paint: 'deckGlass', solid: false });
  L.box(TOWERS[0]![0] - 0.8, ROOF - 1.5, Z0 - 0.8, TOWERS[1]![1] + 0.8, ROOF, Z1 + 0.8, 'paint', { paint: 'white' });
  L.box(TOWERS[0]![0], ROOF, Z1 - 0.1, TOWERS[1]![1], ROOF + 1.1, Z1, 'steel', { solid: false });
  L.box(TOWERS[0]![0], ROOF, Z0, TOWERS[1]![1], ROOF + 1.1, Z0 + 0.1, 'steel', { solid: false });

  // The escalator tubes across the gap (glass), up into the garden.
  slant(L, [g0, 128, Z1 - 8], [g1, BRIDGE, Z1 - 8], 12, 3, 'skyBlue');
  slant(L, [g1, 116, Z0 + 8], [g0, 138, Z0 + 8], 12, 3, 'skyBlue');
  // A bridge between the towers low down, and the garden at the foot.
  L.box(g0, 22, Z0 + 14, g1, 26, Z1 - 14, 'paint', { paint: FRAME });
  for (const [x, z] of [[48, 10], [68, 10], [46, 30], [70, 32], [58, 20]] as const) broadleaf(L, x, z, 9, 3.6);

  // 90 days on: burnt cars in the plaza between the towers, relief tents and crates, sandbags at a door.
  L.car(50, 38, 'x', { burnt: true });
  L.car(64, 41, 'x');
  L.tent(47, 21, 'z', 7);
  L.crates(68, 22, 4);
  L.sandbags(TOWERS[1]![0] + 4, Z1 + 1.5, TOWERS[1]![1] - 4, Z1 + 1.5);
  L.scorch(8, 0.5, Z1 + 0.32, 16, 10, Z1 + 0.4);
}
