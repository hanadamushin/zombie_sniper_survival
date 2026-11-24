// L5: 大阪城天守閣 (the main keep of Osaka Castle). Rebuilt in 1931 in concrete after the Toyotomi keep
// shown on the Osaka summer campaign screens: five tiers (eight floors inside) of white plaster under
// green copper tiles, the gables crowded on every roof (千鳥破風・唐破風) with gold ornaments on their
// boards, and the top tier black with the gold tigers (伏虎) and cranes on its walls, under a hip-gable
// roof with the gold ridge fish. It stands on its stone base (天守台) in the main enclosure (本丸),
// whose west and south sides drop to the inner moat (内堀) behind the highest stone walls in Japan.
//
// Real size: 54.8 m from the enclosure's ground to the top of the fish (the stone base about 12 m),
// the first floor about 36 × 31 m. The enclosure's plaza (gravel), a strip of the inner moat along the
// lot's front with its stone wall, pines and cherries. The front (local z = d) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine, stoneBase, tier, type TierStyle } from '../tohoku/parts.ts';
import { ginkgo } from '../kanto/parts.ts';
import { karahafu, shachi } from '../chubu/parts.ts';
import { hafu } from './parts.ts';

const W = 96;
const D = 92;
/** The keep's middle, its stone base's top. */
const CX = 48;
const CZ = 34;
const BASE = 12;
/** The moat: from z = MOAT to the lot's front. */
const MOAT = 76;
const ROOF: PaintName = 'copper';

export const LANDMARK_OSAKA_CASTLE = landmarkDef({
  variant: 'osaka_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 40,
  top: 54.8,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, MOAT], [0, MOAT]]);
  L.ground('water', [[0, MOAT + 2], [W, MOAT + 2], [W, D], [0, D]], 3, 1.6);
  // The moat's stone wall: from the water up to the enclosure (its top a little above the plaza).
  L.box(0, -3, MOAT, W, 0.8, MOAT + 2, 'paint', { paint: 'gray' });

  // The stone base, then five tiers: white walls, green tiles; the fifth tier black with gold.
  stoneBase(L, CX - 22, CZ - 19, CX + 22, CZ + 19, 0, BASE, 0.12, 5, 'gray');
  const s: TierStyle = { wall: 'white', roof: ROOF, over: 2.3, rise: 3.3, wx: 9, wz: 8, broken: 0.25 };
  const hs: [number, number, number, number, number][] = [
    // half x, half z, height, windows along x, along z
    [18, 15.5, 8, 10, 9],
    [16.5, 14, 7.4, 9, 8],
    [13, 11, 6.8, 7, 6],
    [10, 8.4, 6.4, 5, 4],
  ];
  let y = BASE;
  const eaves: number[] = [];
  hs.forEach(([hx, hz, h, wx, wz], i) => {
    y = tier(L, CX, CZ, hx, hz, y, h, { ...s, wx, wz, over: i === 0 ? 2.6 : s.over });
    eaves.push(y);
  });
  // The fifth tier: black walls, a band of gold reliefs (the tigers and cranes), the gold-edged eaves.
  const [t5x, t5z, t5h] = [7.6, 6.2, 5.8];
  L.box(CX - t5x, y, CZ - t5z, CX + t5x, y + t5h, CZ + t5z, 'paint', { paint: 'black' });
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = CX - t5x + 1.4 + i * ((t5x * 2 - 2.8) / 3);
      L.box(x - 1, y + t5h * 0.55, CZ + sz * t5z - 0.06, x + 1, y + t5h * 0.85, CZ + sz * t5z + 0.06, 'paint', { paint: 'gold', solid: false });
    }
    L.windows('x', CZ + sz * t5z, sz as 1 | -1, CX - t5x + 1, CX + t5x - 1, 4, y + 1.2, y + t5h * 0.48, 1.1, { paint: 'charcoal', broken: 0.3 });
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = CZ - t5z + 1.4 + i * ((t5z * 2 - 2.8) / 2);
      L.box(CX + sx * t5x - 0.06, y + t5h * 0.55, z - 1, CX + sx * t5x + 0.06, y + t5h * 0.85, z + 1, 'paint', { paint: 'gold', solid: false });
    }
  }
  const ry = y + t5h;
  // The top roof (入母屋), gold-edged, the gold fish on its ridge.
  L.box(CX - t5x - 2.1, ry - 0.3, CZ - t5z - 2.1, CX + t5x + 2.1, ry, CZ + t5z + 2.1, 'paint', { paint: 'gold', solid: false });
  L.shape('hip', CX - t5x - 2.1, ry, CZ - t5z - 2.1, CX + t5x + 2.1, ry + 3.4, CZ + t5z + 2.1, 'paint', { paint: ROOF, axis: 'x' });
  L.shape('gable', CX - t5x * 0.85, ry + 2.4, CZ - t5z * 0.6, CX + t5x * 0.85, ry + 5.6, CZ + t5z * 0.6, 'paint', { paint: ROOF, axis: 'x' });
  for (const sx of [-1, 1]) L.shape('gable', CX + sx * t5x * 0.85 - 0.06, ry + 2.5, CZ - t5z * 0.5, CX + sx * t5x * 0.85 + 0.06, ry + 5.4, CZ + t5z * 0.5, 'paint', { paint: 'gold', axis: 'z', solid: false });
  L.box(CX - t5x * 0.85, ry + 5.3, CZ - 0.45, CX + t5x * 0.85, ry + 5.7, CZ + 0.45, 'paint', { paint: ROOF, solid: false });
  shachi(L, CX, CZ, ry + 5.5, 'x', t5x * 0.85 - 0.6, 2.6);

  // The gables, gold-boarded: two great ones on each long face of the first roof and one on each end;
  // a curved gable in the middle of the second roof's long faces, great gables on its ends; a great
  // gable on each face of the third roof; curved gables on the fourth roof's long faces.
  const [e1, e2, e3, e4] = [eaves[0]!, eaves[1]!, eaves[2]!, eaves[3]!];
  for (const sz of [-1, 1] as const) {
    const side = sz > 0 ? 'z+' : 'z-';
    const at = (k: number): number => CZ + sz * hs[k]![1];
    hafu(L, side, at(0), CX - 8, 5.2, e1 - 0.2, e1 + 4.1, 2.4, ROOF, 'gold');
    hafu(L, side, at(0), CX + 8, 5.2, e1 - 0.2, e1 + 4.1, 2.4, ROOF, 'gold');
    karahafu(L, side, at(1), CX, 4.8, e2 - 0.2, e2 + 3.3, s.over, ROOF, 'gold');
    hafu(L, side, at(2), CX, 4.6, e3 - 0.2, e3 + 3.8, s.over, ROOF, 'gold');
    karahafu(L, side, at(3), CX, 3.8, e4 - 0.2, e4 + 2.9, s.over, ROOF, 'gold');
  }
  for (const sx of [-1, 1] as const) {
    const side = sx > 0 ? 'x+' : 'x-';
    hafu(L, side, CX + sx * hs[0]![0], CZ, 5.6, e1 - 0.2, e1 + 4.2, 2.4, ROOF, 'gold');
    hafu(L, side, CX + sx * hs[1]![0], CZ, 5, e2 - 0.2, e2 + 4, s.over, ROOF, 'gold');
    hafu(L, side, CX + sx * hs[2]![0], CZ, 4.2, e3 - 0.2, e3 + 3.6, s.over, ROOF, 'gold');
  }

  // The steps up the stone base on the east side to the keep's door (shut), a stone lantern pair.
  L.box(CX + 22, 0, CZ + 8, CX + 30, 1.2, CZ + 14, 'paint', { paint: 'gray' });
  L.box(CX + 22, 1.2, CZ + 8, CX + 26, 2.4, CZ + 14, 'paint', { paint: 'gray' });

  // The enclosure's edge on the north (a low wall), pines on the stone wall's top, ginkgoes (yellow in
  // late November) on the plaza.
  L.box(0.4, 0, 0.4, W - 0.4, 1.8, 1.2, 'paint', { paint: 'white' });
  for (const [x, z, h] of [[6, 70, 9], [20, 72, 10], [76, 72, 9], [90, 70, 10], [6, 8, 11], [90, 10, 10]] as const) pine(L, x, z, h);
  for (const [x, z] of [[10, 40], [12, 56], [84, 44], [86, 58]] as const) ginkgo(L, x, z, 12);

  // 90 days on: the plaza was a relief site — tents, crates, sandbags across the walk; a burnt car,
  // a fallen sign; scorch on the first tier's wall.
  L.tent(22, 62, 'x', 8);
  L.tent(34, 64, 'x', 8);
  L.crates(64, 62, 5);
  L.sandbags(40, 70, 56, 70);
  L.car(74, 60, 'x', { burnt: true });
  L.fallenSign(52, 58, 'x');
  L.scorch(CX - 12, BASE + 0.6, CZ + 15.52, CX - 7, BASE + 4.5, CZ + 15.6);
}
