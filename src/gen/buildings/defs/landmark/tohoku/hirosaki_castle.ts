// L2: 弘前城 天守 (Hirosaki Castle's keep, 1810), one of the twelve keeps standing since the Edo
// period. Three tiers (三層三階), 14.4 m on its stone base at the south-east corner of the main
// enclosure (本丸): white plaster walls, copper-green roof tiles (銅瓦). The two faces over the moats
// (south and east) carry gabled bay windows (切妻出窓) on the first and second tiers; the inner faces
// are plain — the castle is known for looking different from outside and in.
//
// The lot is the corner of the 本丸 with the inner moat (内濠) along its front (south) and right side
// (east), the stone walls on the moat's inner edge, the keep on its stone base (天守台) in the corner,
// the vermilion bridge 下乗橋 crossing the east moat north of the keep, and the cherries round the
// moat (the park is famous for them). The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { cherry, pine, stoneBase, tier, topRoof, type TierStyle } from './parts.ts';

const W = 76;
const D = 64;
/** The moat: along the front and the right side, MOAT wide, with a bank of BANK beyond (the 二の丸's edge). */
const MOAT = 14;
const BANK = 6;
const DEPTH = 2.4;
/** The stone base of the keep: its top above the enclosure's ground. */
const BASE = 3.2;

export const LANDMARK_HIROSAKI_CASTLE = landmarkDef({
  variant: 'hirosaki_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 8,
  top: BASE + 15.5,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  const ix = W - BANK - MOAT; // the enclosure's east edge (the moat's inner edge)
  const iz = D - BANK - MOAT; // its south edge
  const bz = 14; // the bridge's middle (z)
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('water', [[0, iz], [W - BANK, iz], [W - BANK, D - BANK], [0, D - BANK]], DEPTH, 0.9);
  L.ground('water', [[ix, 0], [W - BANK, 0], [W - BANK, iz], [ix, iz]], DEPTH, 0.9);
  // The stone walls on the inner edge, from the moat's bottom to a little over the ground.
  L.box(0, -DEPTH, iz - 1.4, ix, 1.0, iz, 'paint', { paint: 'stone' });
  L.box(ix - 1.4, -DEPTH, 0, ix, 1.0, bz - 2.6, 'paint', { paint: 'stone' });
  L.box(ix - 1.4, -DEPTH, bz + 2.6, ix, 1.0, iz, 'paint', { paint: 'stone' });
  // The outer banks' low walls.
  L.box(W - BANK, -DEPTH, 0, W - BANK + 1, 0.3, bz - 2.6, 'paint', { paint: 'stone' });
  L.box(W - BANK, -DEPTH, bz + 2.6, W - BANK + 1, 0.3, D - BANK + 1, 'paint', { paint: 'stone' });
  L.box(0, -DEPTH, D - BANK, W - BANK, 0.3, D - BANK + 1, 'paint', { paint: 'stone' });
  // The keep's stone base in the corner, leaning back, rising from the moat.
  const bx0 = ix - 15.5;
  const bz0 = iz - 13.5;
  stoneBase(L, bx0, bz0, ix, iz, -DEPTH, BASE, 0.12, 4);
  const cx = (bx0 + ix) / 2;
  const cz = (bz0 + iz) / 2;

  // The three tiers: white walls, copper roofs.
  const s: TierStyle = { wall: 'white', roof: 'copper', over: 1.3, rise: 1.6, wx: 4, wz: 3, broken: 0.2 };
  let y = tier(L, cx, cz, 5.9, 4.9, BASE, 4.6, s);
  const y1 = y;
  y = tier(L, cx, cz, 4.7, 3.8, y, 3.5, { ...s, wx: 3, wz: 2, rise: 1.4 });
  const y2 = y;
  y = tier(L, cx, cz, 3.7, 2.8, y, 3.1, { ...s, wx: 3, wz: 2, rise: 0 });
  topRoof(L, cx, cz, 3.7, 2.8, y, 1.2, 3.3, 'copper', 'charcoal');

  // The gabled bay windows over the moats: two on the south face and two on the east of the first
  // tier, one each on the second. A box out of the wall, a lattice window, its gable with the white board.
  const bay = (side: 'z+' | 'x+', u: number, yb: number, h: number, wall: number): void => {
    const half = 1.5;
    if (side === 'z+') {
      L.box(u - half, yb + 0.8, wall, u + half, yb + h - 0.3, wall + 1.1, 'paint', { paint: 'white' });
      L.box(u - 1, yb + 1.6, wall + 1.1, u + 1, yb + h - 1.1, wall + 1.18, 'paint', { paint: 'windowDark', solid: false });
      L.shape('gable', u - half - 0.3, yb + h - 0.3, wall - 0.6, u + half + 0.3, yb + h + 1.5, wall + 1.5, 'paint', { paint: 'copper', axis: 'z', solid: false });
      L.shape('gable', u - half + 0.1, yb + h - 0.2, wall + 1.42, u + half - 0.1, yb + h + 1.2, wall + 1.5, 'paint', { paint: 'white', axis: 'z', solid: false });
      L.box(u - 0.2, yb + h + 0.1, wall + 1.5, u + 0.2, yb + h + 0.7, wall + 1.58, 'paint', { paint: 'gold', solid: false }); // 懸魚
    } else {
      L.box(wall, yb + 0.8, u - half, wall + 1.1, yb + h - 0.3, u + half, 'paint', { paint: 'white' });
      L.box(wall + 1.1, yb + 1.6, u - 1, wall + 1.18, yb + h - 1.1, u + 1, 'paint', { paint: 'windowDark', solid: false });
      L.shape('gable', wall - 0.6, yb + h - 0.3, u - half - 0.3, wall + 1.5, yb + h + 1.5, u + half + 0.3, 'paint', { paint: 'copper', axis: 'x', solid: false });
      L.shape('gable', wall + 1.42, yb + h - 0.2, u - half + 0.1, wall + 1.5, yb + h + 1.2, u + half - 0.1, 'paint', { paint: 'white', axis: 'x', solid: false });
      L.box(wall + 1.5, yb + h + 0.1, u - 0.2, wall + 1.58, yb + h + 0.7, u + 0.2, 'paint', { paint: 'gold', solid: false });
    }
  };
  bay('z+', cx - 3, BASE, y1 - BASE, cz + 4.9);
  bay('z+', cx + 3, BASE, y1 - BASE, cz + 4.9);
  bay('x+', cz - 2.2, BASE, y1 - BASE, cx + 5.9);
  bay('x+', cz + 2.2, BASE, y1 - BASE, cx + 5.9);
  bay('z+', cx, y1, y2 - y1, cz + 3.8);
  bay('x+', cz, y1, y2 - y1, cx + 4.7);

  // 下乗橋: the vermilion bridge over the east moat, north of the keep, to the 二の丸 (the bank).
  const ex = W - BANK + 2;
  L.box(ix - 2, -0.35, bz - 2.4, ex, 0.25, bz + 2.4, 'paint', { paint: 'red' });
  for (const s2 of [-1, 1]) {
    L.box(ix - 2, 0.25, bz + s2 * 2.3 - 0.1, ex, 1.15, bz + s2 * 2.3 + 0.1, 'paint', { paint: 'red', solid: false });
    for (let x = ix; x < ex; x += 3.4) L.box(x - 0.15, -DEPTH, bz + s2 * 2.2 - 0.15, x + 0.15, 1.3, bz + s2 * 2.2 + 0.15, 'paint', { paint: 'red', solid: false });
  }
  // The path from the bridge into the enclosure.
  L.box(18, 0, bz - 2, ix - 2, 0.05, bz + 2, 'paint', { paint: 'stone', solid: false });

  // Cherries along the moat's banks (both sides) and in the enclosure, two pines by the keep.
  for (const [x, z] of [[6, iz - 6], [16, iz - 7], [26, iz - 6], [6, 6], [20, 4], [ix - 6, 4]] as const) cherry(L, x, z, 9, 4.5);
  // The outer banks: a row of cherries leaning over the water.
  for (const z of [4, 24, 34, 44, 54]) cherry(L, W - 3, z, 8, 3.2);
  for (const x of [8, 20, 32, 44]) cherry(L, x, D - 3, 8, 3.2);
  pine(L, bx0 - 4, iz - 3, 10);
  pine(L, ix - 4, bz0 - 5, 8);

  // 90 days on: the enclosure's lawn was a shelter — tents and crates, sandbags at the bridge's foot;
  // a scorch on the keep's inner (north) wall.
  L.tent(12, 22, 'x', 6);
  L.tent(12, 31, 'x', 6);
  L.crates(22, 26, 4);
  L.sandbags(ix - 4, bz - 3.5, ix - 4, bz + 3.5);
  L.scorch(cx - 4, BASE + 0.5, cz - 4.98, cx - 0.5, BASE + 3.4, cz - 4.92);
}
