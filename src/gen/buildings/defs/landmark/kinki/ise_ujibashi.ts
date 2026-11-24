// L5: 伊勢神宮 内宮 宇治橋 (the Uji Bridge of the Inner Shrine of Ise), Ise, Mie. The entrance to the
// Inner Shrine: a plain wooden bridge of Japanese cypress, 101.8 m long and 8.4 m wide, arching gently
// over the Isuzu River on rows of wooden piers, its rails topped by bronze knobs (擬宝珠); at each end
// a great torii of plain unpainted cypress (神明鳥居, 7.44 m), and upstream the rows of log guards
// (木除杭) standing in the river. The bridge and the torii are rebuilt every twenty years.
//
// The river is dug from the lot (the shrunk area's own river is narrower). Real size. The bridge runs
// along local x; the front (local z = d) faces south (downstream).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { torii } from '../chubu/parts.ts';
import { cedar } from '../tohoku/parts.ts';

const W = 124;
const D = 36;
const CZ = 20;
/** The bridge's ends, its half width; the river's banks. */
const B0 = 11;
const B1 = 113;
const HW = 4.2;
const R0 = 22;
const R1 = 102;
const WOOD: PaintName = 'hinoki';

export const LANDMARK_ISE_UJIBASHI = landmarkDef({
  variant: 'ise_ujibashi',
  size: { w: [W, W], d: [D, D] },
  eaves: 4.5,
  top: 22,
  kind: 'shed',
  build,
});

/** The deck's top at x: 1.2 m at the ends, 3.5 m over the middle of the river. */
const deck = (x: number): number => {
  const t = (x - (B0 + B1) / 2) / ((B1 - B0) / 2);
  return 1.2 + 2.3 * (1 - t * t);
};

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('water', [[R0, 0], [R1, 0], [R1, D], [R0, D]], 2.2, 1.4);
  // The banks' stone edges.
  for (const x of [R0 - 1, R1]) L.box(x, -1.4, 0, x + 1, 0.3, D, 'paint', { paint: 'stone' });

  // The ramps up onto the ends, the deck in short level boards following the arch.
  L.shape('wedge', B0 - 6, 0, CZ - HW, B0, deck(B0), CZ + HW, 'wood', { slope: 'x+' });
  L.shape('wedge', B1, 0, CZ - HW, B1 + 6, deck(B1), CZ + HW, 'wood', { slope: 'x-' });
  const n = 34;
  for (let i = 0; i < n; i++) {
    const xa = B0 + ((B1 - B0) * i) / n;
    const xb = B0 + ((B1 - B0) * (i + 1)) / n;
    const y = deck((xa + xb) / 2);
    L.box(xa, y - 0.5, CZ - HW, xb, y, CZ + HW, 'paint', { paint: WOOD });
    // The rails on both sides (low walls of boards that stop a fall), the posts' bronze knobs every other board.
    for (const s of [-1, 1]) {
      L.box(xa, y, CZ + s * HW - (s > 0 ? 0.25 : 0), xb, y + 0.95, CZ + s * HW + (s > 0 ? 0 : 0.25), 'paint', { paint: WOOD });
      if (i % 2 === 0) L.column(xa, CZ + s * (HW - 0.12), 0.2, y + 0.95, y + 1.45, 'paint', { paint: 'bronze', taper: 0.3, solid: false });
    }
  }
  // The piers: rows of three posts under the deck, braced, in the river.
  for (let x = R0 + 4; x < R1 - 2; x += 7.5) {
    const y = deck(x) - 0.5;
    for (const z of [CZ - HW + 0.6, CZ, CZ + HW - 0.6]) L.column(x, z, 0.28, -1.4, y, 'paint', { paint: WOOD });
    L.box(x - 0.2, y - 0.8, CZ - HW, x + 0.2, y - 0.4, CZ + HW, 'paint', { paint: WOOD, solid: false });
  }
  // The log guards upstream (north): rows of posts standing in the water.
  for (let x = R0 + 10; x < R1 - 6; x += 12) {
    for (const dz of [3, 6]) L.column(x, CZ - HW - dz, 0.25, -1.4, 1.6 + dz * 0.15, 'paint', { paint: WOOD });
  }

  // The great torii at both ends (plain cypress, the path running through them along x).
  torii(L, 4, CZ, 'x', 8.4, 7.44, WOOD, 'shinmei');
  torii(L, W - 4, CZ, 'x', 8.4, 7.44, WOOD, 'shinmei');

  // The cedars of the shrine forest on the far bank, a few on the near one.
  for (const [x, z] of [[108, 4], [112, 32], [118, 8], [120, 30], [14, 4], [8, 32]] as const) cedar(L, x, z, 22, 2.4);

  // 90 days on: a fallen sign by the near torii, sandbags on the near bank, relief crates.
  L.fallenSign(12, 30, 'x');
  L.sandbags(14, 26, 20, 26);
  L.crates(14, 8, 3);
}
