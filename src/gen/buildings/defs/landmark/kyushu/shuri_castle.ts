// L8: 首里城 (Shuri Castle), Naha, Okinawa: the palace of the Ryūkyū kings, burnt in 2019 and rebuilt (the
// main hall finished in 2026). From the west: the gate 守礼門 (Shureimon) — red-lacquered posts on white
// stone feet, two tiers of red tiles (赤瓦) and the plaque 守禮之邦 —, the curving walls of pale Ryūkyū
// limestone with the arched gate 歓会門 and its small red tower, the long red hall 奉神門 across the
// court, and the court 御庭 striped red and white before the main hall 正殿: two storeys of vermilion
// under red tiles, the great curved gable (唐玻豊) over its front, gold dragons on the ridge, and the
// two stone dragon pillars (大龍柱) at its steps; the north hall red, the south hall of plain wood.
//
// Real size: the main hall 29 × 17 m and 18 m high, Shureimon 13 m wide and 8 m high; the gate is some
// 250 m from the hall. The castle is drawn in one lot (52 × 72 m), the walls and gates closer than they
// are. The front (local z = d, Shureimon) faces west; local x runs south (the table's rot 3).

import { landmarkDef, type Lm } from '../common.ts';
import { karahafu } from '../chubu/parts.ts';
import { beam } from '../kanto/parts.ts';
import { palm, redRoof } from './parts.ts';

const W = 52;
const D = 72;
const C = 26;
/** Shureimon (z), the walls and Kankaimon (z), Hōshinmon (z), the court, the main hall. */
const SZ = 65;
const KZ = 50;
const HZ = 39;
const [MX0, MX1, MZ0, MZ1] = [C - 14.5, C + 14.5, 4, 21];

export const LANDMARK_SHURI_CASTLE = landmarkDef({
  variant: 'shuri_castle',
  size: { w: [W, W], d: [D, D] },
  eaves: 13,
  top: 18.4,
  roof: 'hip',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[C - 3, HZ], [C + 3, HZ], [C + 3, D], [C - 3, D]]);

  // ---- Shureimon: four red posts on white stone feet, the two tiers of red tiles, the plaque.
  for (const x of [C - 6.2, C - 2.2, C + 2.2, C + 6.2]) {
    L.box(x - 0.9, 0, SZ - 1.5, x + 0.9, 0.9, SZ + 1.5, 'paint', { paint: 'white' });
    L.box(x - 0.35, 0.9, SZ - 0.35, x + 0.35, 6.4, SZ + 0.35, 'paint', { paint: 'shuri' });
    for (const s of [-1, 1]) L.box(x - 0.2, 0.9, SZ + s * 1.1 - 0.2, x + 0.2, 3.6, SZ + s * 1.1 + 0.2, 'paint', { paint: 'shuri', solid: false });
  }
  L.box(C - 7, 4.8, SZ - 0.6, C + 7, 5.6, SZ + 0.6, 'paint', { paint: 'shuri', solid: false });
  redRoof(L, C - 8.4, SZ - 3.4, C + 8.4, SZ + 3.4, 5.9, 1.6);
  L.box(C - 5, 6.9, SZ - 1.6, C + 5, 7.6, SZ + 1.6, 'paint', { paint: 'shuri', solid: false });
  L.box(C - 1.8, 6.2, SZ + 3.3, C + 1.8, 7.3, SZ + 3.45, 'paint', { paint: 'black', solid: false });
  L.box(C - 1.5, 6.4, SZ + 3.45, C + 1.5, 7.1, SZ + 3.5, 'paint', { paint: 'gold', solid: false });
  redRoof(L, C - 5.8, SZ - 2.4, C + 5.8, SZ + 2.4, 7.6, 1.3);

  // ---- The curving limestone walls and Kankaimon: the arch's opening, its small red tower.
  const wall = (pts: [number, number][], h: number): void => {
    for (let i = 0; i + 1 < pts.length; i++) beam(L, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], 0, h, 2, 'ryukyuStone');
  };
  wall([[3, 57], [9, 53], [16, 51], [C - 3, KZ]], 6);
  wall([[C + 3, KZ], [W - 16, 51], [W - 9, 53], [W - 3, 57]], 6);
  for (const s of [-1, 1]) L.box(C + s * 3 - 1.2, 0, KZ - 1.4, C + s * 3 + 1.2, 6.4, KZ + 1.4, 'paint', { paint: 'ryukyuStone' });
  L.box(C - 4.2, 3.8, KZ - 1.4, C + 4.2, 6.4, KZ + 1.4, 'paint', { paint: 'ryukyuStone' });
  L.box(C - 1.8, 3.4, KZ + 1.2, C + 1.8, 3.8, KZ + 1.45, 'paint', { paint: 'ryukyuStone', solid: false });
  L.box(C - 3, 6.4, KZ - 1.6, C + 3, 8.8, KZ + 1.6, 'paint', { paint: 'shuri' });
  redRoof(L, C - 4, KZ - 2.4, C + 4, KZ + 2.4, 8.8, 1.6);
  // The walls round the court (lower), to the back of the lot.
  wall([[3.6, 57], [3.6, 2], [W - 3.6, 2], [W - 3.6, 57]], 4.6);

  // ---- Hōshinmon: the long red hall across the court, its middle passage, red tiles.
  L.box(9, 0, HZ - 2.4, C - 3, 4.4, HZ + 2.4, 'paint', { paint: 'shuri' });
  L.box(C + 3, 0, HZ - 2.4, W - 9, 4.4, HZ + 2.4, 'paint', { paint: 'shuri' });
  L.box(C - 3, 3.2, HZ - 2.4, C + 3, 4.4, HZ + 2.4, 'paint', { paint: 'shuri' });
  L.windows('x', HZ + 2.4, 1, 11, C - 5, 3, 0.6, 3, 2, { paint: 'gold', broken: 0.2 });
  L.windows('x', HZ + 2.4, 1, C + 5, W - 11, 3, 0.6, 3, 2, { paint: 'gold', broken: 0.2 });
  redRoof(L, 8, HZ - 3.6, W - 8, HZ + 3.6, 4.4, 2.6);

  // ---- The court (御庭): stripes of red and white tiles along the way to the hall.
  for (let i = 0; i < 9; i++) {
    const x0 = C - 15 + i * (30 / 9);
    L.box(x0, 0, MZ1 + 2, x0 + 30 / 9, 0.05, HZ - 2.6, 'paint', { paint: i % 2 ? 'offWhite' : 'akagawara', solid: false });
  }
  // The north hall (red) and the south hall (plain wood) either side of the court.
  L.box(5.4, 0, 24.5, 10.2, 4, 35, 'paint', { paint: 'shuri' });
  redRoof(L, 4.8, 24, 10.8, 35.6, 4, 2.2);
  L.box(W - 10.2, 0, 24.5, W - 5.4, 4, 35, 'woodDark');
  redRoof(L, W - 10.8, 24, W - 4.8, 35.6, 4, 2.2);

  // ---- The main hall: its stone platform, two storeys of vermilion under red tiles.
  L.box(MX0 - 1.2, 0, MZ0 - 1.2, MX1 + 1.2, 1, MZ1 + 1.5, 'paint', { paint: 'ryukyuStone' });
  L.box(MX0, 1, MZ0, MX1, 7.2, MZ1, 'paint', { paint: 'shuri' });
  L.box(MX0 - 0.05, 5.8, MZ0 - 0.05, MX1 + 0.05, 6.3, MZ1 + 0.05, 'paint', { paint: 'gold', solid: false });
  L.windows('x', MZ1, 1, MX0 + 1.5, MX1 - 1.5, 7, 1.6, 5.2, 2.4, { paint: 'charcoal', broken: 0.2 });
  for (const [x, out] of [[MX1, 1], [MX0, -1]] as const) L.windows('z', x, out, MZ0 + 1.5, MZ1 - 1.5, 4, 1.6, 5.2, 2.2, { paint: 'charcoal', broken: 0.2 });
  redRoof(L, MX0 - 1.8, MZ0 - 1.8, MX1 + 1.8, MZ1 + 1.8, 7.2, 2.2);
  L.box(MX0 + 2.5, 8.6, MZ0 + 2, MX1 - 2.5, 12.4, MZ1 - 2, 'paint', { paint: 'shuri' });
  L.windows('x', MZ1 - 2, 1, MX0 + 4, MX1 - 4, 6, 9.4, 11.6, 2, { paint: 'charcoal', broken: 0.2 });
  // The top roof (hip and gable), gold dragon heads at the ridge's ends, the ridge's white mortar.
  L.box(MX0 + 0.6, 12.1, MZ0 + 0.6, MX1 - 0.6, 12.4, MZ1 - 0.6, 'paint', { paint: 'white', solid: false });
  L.shape('hip', MX0 + 0.6, 12.4, MZ0 + 0.6, MX1 - 0.6, 15.4, MZ1 - 0.6, 'paint', { paint: 'akagawara', axis: 'x' });
  L.shape('gable', MX0 + 4.5, 14.4, MZ0 + 4, MX1 - 4.5, 17.4, MZ1 - 4, 'paint', { paint: 'akagawara', axis: 'x' });
  for (const s of [-1, 1]) {
    L.shape('gable', C + s * 10.5 - 0.06, 14.6, MZ0 + 4.6, C + s * 10.5 + 0.06, 17, MZ1 - 4.6, 'paint', { paint: 'shuri', axis: 'z', solid: false });
    L.box(C + s * 10.2 - 0.45, 17.2, (MZ0 + MZ1) / 2 - 0.45, C + s * 10.2 + 0.45, 18.4, (MZ0 + MZ1) / 2 + 0.45, 'paint', { paint: 'gold', solid: false });
  }
  L.box(C - 10.5, 17.2, (MZ0 + MZ1) / 2 - 0.2, C + 10.5, 17.55, (MZ0 + MZ1) / 2 + 0.2, 'paint', { paint: 'white', solid: false });
  // The great curved gable over the front (唐玻豊), its gold edge, the steps and the dragon pillars.
  karahafu(L, 'z+', MZ1 + 0.4, C, 6.5, 7, 13.2, 1.8, 'akagawara', 'gold');
  L.box(C - 6, 1, MZ1, C + 6, 7.2, MZ1 + 2.2, 'paint', { paint: 'shuri' });
  for (const s of [-1, 1]) {
    L.column(C + s * 4.2, MZ1 + 3, 0.5, 0, 4.4, 'paint', { paint: 'ryukyuStone' });
    L.box(C + s * 4.2 - 0.4, 4.4, MZ1 + 2.6, C + s * 4.2 + 0.4, 5, MZ1 + 3.6, 'paint', { paint: 'ryukyuStone', solid: false });
  }

  // Palms and fukugi trees outside the walls.
  for (const [x, z, h] of [[3.5, 62, 8], [W - 3.5, 61, 7], [3.5, 70, 7], [W - 3.5, 69, 8]] as const) palm(L, x, z, h, 6, 2.4);

  // 90 days on: a relief tent and crates in the court, a fallen sign and a burnt car before Shureimon.
  L.tent(16, 30, 'z', 6);
  L.crates(34, 31, 4);
  L.fallenSign(C + 9, SZ + 4, 'x');
  L.car(40, 70, 'x', { burnt: true });
}
