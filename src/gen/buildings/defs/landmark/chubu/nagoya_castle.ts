// L4: 名古屋城 天守と金鯱 (Nagoya Castle: the keep and its golden ridge fish). The great keep of 1612
// (burnt in the air raid of 1945, rebuilt in concrete in 1959 to the old shape): five tiers of white
// plaster under green copper tiles (銅瓦の緑青), the big gables on the slopes (千鳥破風・唐破風), and on
// its ridge the pair of golden fish (金鯱, 2.6 m). It stands on its stone base (天守台) in the
// north-west corner of the main enclosure (本丸); the small keep (小天守, two tiers) stands south of
// it, joined by the walled bridge (橋台). South-east of them the low palace (本丸御殿, rebuilt 2018) with
// its cypress-shingle roofs.
//
// Real size: the keep's first floor about 33 × 29 m, 36.1 m from the stone base to the fish, the base
// 13 m above the enclosure's ground (19.5 m above the dry moat's floor: the moat is not drawn, the
// enclosure is). The palace is a short piece of its south-west wing. The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { chidori, pine, stoneBase, tier, type TierStyle } from '../tohoku/parts.ts';
import { karahafu, shachi } from './parts.ts';

const W = 88;
const D = 80;
/** The keep's middle and its stone base. */
const CX = 50;
const CZ = 28;
const BASE = 13;
/** The small keep's middle, its base. */
const SX = 40;
const SZ = 61;
const SBASE = 9;

export const LANDMARK_NAGOYA_CASTLE = landmarkDef({
  variant: 'nagoya_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 28,
  top: BASE + 36.2,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[52, 48], [86, 48], [86, 50], [56, 50], [56, 78], [52, 78]]);

  // The keep's stone base (leaning back as it rises), then five tiers.
  stoneBase(L, CX - 19, CZ - 17, CX + 19, CZ + 17, 0, BASE, 0.1, 5, 'gray');
  const s: TierStyle = { wall: 'white', roof: 'copper', over: 2.3, rise: 3.1, wx: 9, wz: 8, broken: 0.25 };
  const hs: [number, number, number, number, number][] = [
    // half x, half z, height, windows along x, along z
    [16.5, 14.5, 6.4, 10, 9],
    [15.5, 13.5, 6.0, 9, 8],
    [12.5, 10.5, 5.6, 7, 6],
    [9.5, 7.5, 5.2, 5, 4],
    [6.8, 5.4, 4.8, 4, 3],
  ];
  let y = BASE;
  const eaves: number[] = [];
  hs.forEach(([hx, hz, h, wx, wz], i) => {
    y = tier(L, CX, CZ, hx, hz, y, h, { ...s, wx, wz, rise: i === hs.length - 1 ? 0 : s.rise, over: i === 0 ? 2.5 : s.over });
    eaves.push(y);
  });
  // The top roof (入母屋) and the golden fish on its ridge.
  const [t5x, t5z] = [hs[4]![0], hs[4]![1]];
  const ry = y;
  L.box(CX - t5x - 1.9, ry - 0.25, CZ - t5z - 1.9, CX + t5x + 1.9, ry, CZ + t5z + 1.9, 'paint', { paint: 'white', solid: false });
  L.shape('hip', CX - t5x - 1.9, ry, CZ - t5z - 1.9, CX + t5x + 1.9, ry + 3.2, CZ + t5z + 1.9, 'paint', { paint: 'copper', axis: 'x' });
  L.shape('gable', CX - t5x * 0.85, ry + 2.3, CZ - t5z * 0.6, CX + t5x * 0.85, ry + 5.6, CZ + t5z * 0.6, 'paint', { paint: 'copper', axis: 'x' });
  for (const sx of [-1, 1]) L.shape('gable', CX + sx * t5x * 0.85 - 0.06, ry + 2.4, CZ - t5z * 0.5, CX + sx * t5x * 0.85 + 0.06, ry + 5.4, CZ + t5z * 0.5, 'paint', { paint: 'white', axis: 'z', solid: false });
  L.box(CX - t5x * 0.85, ry + 5.3, CZ - 0.45, CX + t5x * 0.85, ry + 5.7, CZ + 0.45, 'paint', { paint: 'copper', solid: false });
  shachi(L, CX, CZ, ry + 5.5, 'x', t5x * 0.85 - 0.6, 2.6);

  // The gables on the slopes. First roof: two great gables on the long faces, one on each end.
  const [e1, e2, e3] = [eaves[0]!, eaves[1]!, eaves[2]!];
  for (const side of ['z+', 'z-'] as const) {
    const at = side === 'z+' ? CZ + hs[0]![1] : CZ - hs[0]![1];
    chidori(L, side, at, CX - 7, 5, e1 - 0.2, e1 + 3.9, 2.2, 'copper');
    chidori(L, side, at, CX + 7, 5, e1 - 0.2, e1 + 3.9, 2.2, 'copper');
  }
  chidori(L, 'x+', CX + hs[0]![0], CZ, 5.5, e1 - 0.2, e1 + 4, 2.2, 'copper');
  chidori(L, 'x-', CX - hs[0]![0], CZ, 5.5, e1 - 0.2, e1 + 4, 2.2, 'copper');
  // Second roof: a curved gable (唐破風) in the middle of the long faces, great gables on the ends.
  karahafu(L, 'z+', CZ + hs[1]![1], CX, 4.6, e2 - 0.2, e2 + 3.2, s.over, 'copper');
  karahafu(L, 'z-', CZ - hs[1]![1], CX, 4.6, e2 - 0.2, e2 + 3.2, s.over, 'copper');
  chidori(L, 'x+', CX + hs[1]![0], CZ, 5, e2 - 0.2, e2 + 4, s.over, 'copper');
  chidori(L, 'x-', CX - hs[1]![0], CZ, 5, e2 - 0.2, e2 + 4, s.over, 'copper');
  // Third roof: a great gable on the long faces.
  chidori(L, 'z+', CZ + hs[2]![1], CX, 4.4, e3 - 0.2, e3 + 3.6, s.over, 'copper');
  chidori(L, 'z-', CZ - hs[2]![1], CX, 4.4, e3 - 0.2, e3 + 3.6, s.over, 'copper');

  // The walled bridge (橋台) from the keep's base south to the small keep's: a stone causeway with a
  // roofed white wall on each side.
  const [bx0, bx1] = [SX - 4, SX + 4];
  L.box(bx0, 0, CZ + 16, bx1, SBASE, SZ - 11, 'paint', { paint: 'stone' });
  for (const x of [bx0, bx1 - 0.6]) {
    L.box(x, SBASE, CZ + 17, x + 0.6, SBASE + 2.2, SZ - 11, 'paint', { paint: 'white' });
    L.shape('gable', x - 0.4, SBASE + 2.2, CZ + 17, x + 1, SBASE + 2.9, SZ - 11, 'paint', { paint: 'copper', axis: 'z', solid: false });
  }

  // The small keep: its stone base and two tiers.
  stoneBase(L, SX - 13, SZ - 11, SX + 13, SZ + 11, 0, SBASE, 0.08, 4, 'gray');
  const ss: TierStyle = { ...s, over: 1.6, rise: 2 };
  const k1 = tier(L, SX, SZ, 11, 9, SBASE, 5.6, { ...ss, wx: 7, wz: 6 });
  chidori(L, 'z+', SZ + 9, SX, 4.2, k1 - 0.2, k1 + 3.2, ss.over, 'copper');
  chidori(L, 'x-', SX - 11, SZ, 4, k1 - 0.2, k1 + 3.2, ss.over, 'copper');
  const k2 = tier(L, SX, SZ, 8, 6.5, k1, 5, { ...ss, rise: 0, wx: 5, wz: 4 });
  L.box(SX - 9.6, k2 - 0.25, SZ - 8.1, SX + 9.6, k2, SZ + 8.1, 'paint', { paint: 'white', solid: false });
  L.shape('hip', SX - 9.6, k2, SZ - 8.1, SX + 9.6, k2 + 2.6, SZ + 8.1, 'paint', { paint: 'copper', axis: 'x' });
  L.shape('gable', SX - 6.5, k2 + 1.8, SZ - 4.5, SX + 6.5, k2 + 4.6, SZ + 4.5, 'paint', { paint: 'copper', axis: 'x' });
  shachi(L, SX, SZ, k2 + 4.5, 'x', 5.8, 1.6);

  // A wing of the palace (本丸御殿): low, unpainted cypress, shingle roofs (dark brown), the porch gable.
  const [px0, px1, pz0, pz1] = [58, 86, 54, 76];
  L.box(px0, 0, pz0, px1, 0.9, pz1, 'paint', { paint: 'stone' });
  L.box(px0 + 1, 0.9, pz0 + 1, px1 - 1, 5.4, pz1 - 1, 'paint', { paint: 'hinoki' });
  L.windows('x', pz1 - 1, 1, px0 + 2, px1 - 2, 7, 1.6, 4.4, 2.6, { paint: 'offWhite', broken: 0.3 });
  L.windows('z', px0 + 1, -1, pz0 + 2, pz1 - 2, 5, 1.6, 4.4, 2.6, { paint: 'offWhite', broken: 0.3 });
  L.shape('hip', px0 - 0.5, 5.4, pz0 - 0.5, px1 + 0.5, 10.5, pz1 + 0.5, 'paint', { paint: 'hiwada', axis: 'x' });
  L.shape('gable', px0 + 5, 7.8, pz0 + 5, px1 - 5, 12, pz1 - 5, 'paint', { paint: 'hiwada', axis: 'x' });
  // The porch (玄関) towards the gravel walk, with a gold-edged gable.
  L.box(px0 - 2.5, 0.9, 61, px0 + 1, 5, 69, 'paint', { paint: 'hinoki' });
  L.shape('gable', px0 - 3, 5, 60.5, px0 + 1, 8.4, 69.5, 'paint', { paint: 'hiwada', axis: 'x' });
  L.shape('gable', px0 - 3.06, 5.1, 61.5, px0 - 2.94, 8.1, 68.5, 'paint', { paint: 'gold', axis: 'z', solid: false });

  // The enclosure's edge: a low white wall on the west and north (the moat beyond), pines.
  L.box(0.4, 0, 0.4, 1.2, 2.2, D - 2, 'paint', { paint: 'white' });
  L.box(0.4, 0, 0.4, W - 2, 2.2, 1.2, 'paint', { paint: 'white' });
  for (const [x, z, h] of [[8, 10, 11], [9, 40, 12], [7, 66, 10], [22, 76, 9], [80, 8, 11], [80, 34, 12], [72, 44, 9]] as const) pine(L, x, z, h);

  // 90 days on: the enclosure's lawn was a relief site — tents, crates, a burnt-out car on the gravel;
  // scorch on the small keep's wall, a fallen sign by the walk.
  L.tent(18, 46, 'z', 7);
  L.tent(25, 46, 'z', 7);
  L.crates(21, 56, 5);
  L.car(54, 66, 'z', { burnt: true });
  L.fallenSign(60, 50.5, 'x');
  L.scorch(SX + 5, SBASE + 0.6, SZ + 9.02, SX + 7.5, SBASE + 2.8, SZ + 9.1);
}
