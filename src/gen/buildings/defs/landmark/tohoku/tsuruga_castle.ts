// L2: 会津若松城（鶴ヶ城） 天守 (Aizu-Wakamatsu Castle, Tsuruga-jō). The five-tier keep of 1639,
// battered in the Boshin War (1868) and pulled down, rebuilt in 1965 to the old shape: white walls,
// and since 2011 the red-brown glazed tiles (赤瓦) of the end of the Edo period — the only red-tiled
// keep in Japan. It stands on a high stone base (天守台, about 11 m); about 36 m to the top of the
// ridge fish. Joined to it: the long gate house 走長屋 on its own stone wall, with the iron gate
// (鉄門) under it, running south to the corner turret 干飯櫓 (rebuilt 2001).
//
// The lot (64 m square: the real place is pressed between two avenues and the edge of its area) is
// the north-west of the main enclosure (本丸): the keep and its stone base, the 走長屋 along the west
// edge, the lawn of the enclosure in front with its cherries (the castle park is one of the great
// cherry sites of the north). The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { cherry, chidori, pine, stoneBase, tier, topRoof, type TierStyle } from './parts.ts';

const W = 64;
const D = 64;
/** The keep's stone base: height and footprint. */
const BASE = 11;
const CX = 36;
const CZ = 20;

export const LANDMARK_TSURUGA_CASTLE = landmarkDef({
  variant: 'tsuruga_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 15,
  top: 36.4,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[CX - 12, CZ + 13], [W - 2, CZ + 13], [W - 2, CZ + 21], [CX - 12, CZ + 21]]);

  // The stone base, leaning back as it rises.
  stoneBase(L, CX - 12.5, CZ - 11, CX + 12.5, CZ + 11, 0, BASE, 0.12, 5);

  // Five tiers: white walls under red-brown tiles.
  const s: TierStyle = { wall: 'white', roof: 'brickRed', over: 1.6, rise: 1.9, wx: 6, wz: 5, broken: 0.25 };
  const hs: [number, number, number, number, number][] = [
    // half x, half z, height, windows along x, along z
    [10.4, 8.6, 4.6, 6, 5],
    [8.8, 7.2, 4.1, 5, 4],
    [7.3, 5.9, 3.9, 4, 3],
    [5.9, 4.6, 3.7, 3, 3],
    [4.6, 3.5, 3.6, 3, 2],
  ];
  let y = BASE;
  const eaves: number[] = [];
  hs.forEach(([hx, hz, h, wx, wz], i) => {
    y = tier(L, CX, CZ, hx, hz, y, h, { ...s, wx, wz, rise: i === hs.length - 1 ? 0 : s.rise });
    eaves.push(y);
  });
  const [t5x, t5z] = [hs[4]![0], hs[4]![1]];
  topRoof(L, CX, CZ, t5x, t5z, y, 1.5, 3.9, 'brickRed', 'gold');
  // The gables on the slopes (千鳥破風): the first roof's south and north faces, the third's east and west.
  const [h1x, h1z] = [hs[0]![0], hs[0]![1]];
  chidori(L, 'z+', CZ + h1z, CX, 4.2, eaves[0]! - 0.2, eaves[0]! + 3.1, s.over, 'brickRed');
  chidori(L, 'z-', CZ - h1z, CX, 4.2, eaves[0]! - 0.2, eaves[0]! + 3.1, s.over, 'brickRed');
  chidori(L, 'x+', CX + h1x, CZ, 3.4, eaves[0]! - 0.2, eaves[0]! + 2.8, s.over, 'brickRed');
  const [h3x] = [hs[2]![0]];
  chidori(L, 'x+', CX + h3x, CZ, 3, eaves[2]! - 0.2, eaves[2]! + 2.7, s.over, 'brickRed');
  chidori(L, 'x-', CX - h3x, CZ, 3, eaves[2]! - 0.2, eaves[2]! + 2.7, s.over, 'brickRed');
  chidori(L, 'z+', CZ + hs[1]![1], CX - 4, 2.6, eaves[1]! - 0.2, eaves[1]! + 2.4, s.over, 'brickRed');
  chidori(L, 'z+', CZ + hs[1]![1], CX + 4, 2.6, eaves[1]! - 0.2, eaves[1]! + 2.4, s.over, 'brickRed');
  chidori(L, 'z+', CZ + hs[3]![1], CX, 2.4, eaves[3]! - 0.2, eaves[3]! + 2.3, s.over, 'brickRed');

  // 走長屋: the long gate house on its stone wall, from the keep's west side down the lot's west edge.
  const RX = 8; // its middle (x)
  const RB = 5.5; // its stone wall's height
  stoneBase(L, RX - 4.5, CZ - 4, CX - 12, CZ + 4, 0, RB, 0.08, 3); // the arm to the keep
  stoneBase(L, RX - 4.5, CZ + 4, RX + 4.5, D - 14, 0, RB, 0.08, 3); // down the west edge
  const nagaya = (x0: number, z0: number, x1: number, z1: number, axis: 'x' | 'z'): void => {
    L.box(x0, RB, z0, x1, RB + 3.6, z1, 'paint', { paint: 'white' });
    if (axis === 'z') L.windows('z', x1, 1, z0 + 2, z1 - 2, Math.round((z1 - z0) / 5), RB + 1.4, RB + 2.6, 0.9, { broken: 0.3 });
    else L.windows('x', z1, 1, x0 + 2, x1 - 2, Math.round((x1 - x0) / 5), RB + 1.4, RB + 2.6, 0.9, { broken: 0.3 });
    L.shape('gable', x0 - 0.6, RB + 3.6, z0 - 0.6, x1 + 0.6, RB + 5.6, z1 + 0.6, 'paint', { paint: 'brickRed', axis });
  };
  nagaya(RX - 3.4, CZ - 3.2, CX - 12.6, CZ + 3.2, 'x');
  nagaya(RX - 3.4, CZ + 3.2, RX + 3.4, D - 15, 'z');
  // 鉄門: the iron gate through the arm's stone wall (black doors, shut), east face.
  L.box(RX + 5.6, 0, CZ + 4.05, RX + 9.4, 4.2, CZ + 4.2, 'paint', { paint: 'black' });
  L.box(RX + 5.4, 4.2, CZ + 4.05, RX + 9.6, 4.6, CZ + 4.3, 'paint', { paint: 'charcoal', solid: false });
  // 干飯櫓: the two-tier corner turret at the south end.
  const [kx, kz] = [RX + 1, D - 9];
  stoneBase(L, kx - 6, kz - 5.5, kx + 6, kz + 5.5, 0, RB + 0.5, 0.08, 3);
  const k1 = tier(L, kx, kz, 5, 4.5, RB + 0.5, 3.8, { ...s, over: 1.2, rise: 1.4, wx: 3, wz: 3 });
  const k2 = tier(L, kx, kz, 3.6, 3.2, k1, 3.2, { ...s, over: 1.1, rise: 0, wx: 2, wz: 2 });
  topRoof(L, kx, kz, 3.6, 3.2, k2, 1.1, 2.6, 'brickRed', 'charcoal');

  // Cherries round the lawn, pines by the stone base.
  for (const [x, z] of [[56, 6], [58, 20], [57, 32], [58, 52], [46, 59], [30, 59], [20, 41]] as const) cherry(L, x, z, 9, 4.6);
  pine(L, CX + 16, CZ + 6, 10);
  pine(L, CX - 6, CZ + 15, 9);

  // 90 days on: the lawn was a relief site — tents, crates and a supply truck burnt out by the gravel.
  L.tent(36, 42, 'x', 7);
  L.tent(36, 50, 'x', 7);
  L.crates(44, 46, 5);
  L.car(52, 46, 'x', { burnt: true });
  L.scorch(CX - 10.43, BASE + 0.6, CZ - 3, CX - 10.37, BASE + 3.8, CZ + 4);
}
