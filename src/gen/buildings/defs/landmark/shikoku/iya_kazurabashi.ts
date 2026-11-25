// L7: 祖谷のかずら橋 (the vine bridge of Iya), Nishiiyayama, Miyoshi, Tokushima: a suspension bridge woven
// of shirakuchi vines (シラクチカズラ, rebuilt every three years) across the gorge of the Iya River, an
// important tangible folk cultural property. The deck of split timbers laid loosely across the vine
// cables, sagging over the river; the vine handrails, the vertical vines between them and the deck
// (a net), the cables tied to timber frames and trees on both banks.
//
// A rough shape (the bridge landmarks are rebuilt end to end by L9). Real size: 45 m long, 2 m wide,
// 14 m over the water. The gorge is drawn in the lot: two rock cliffs 9 m high over the river, the wooded slopes falling
// away from them to the lot's edges.
// The bridge runs along local x; the front (local z = d) is the downstream side.

import { landmarkDef, type Lm } from '../common.ts';
import { along } from '../chugoku/parts.ts';

const W = 60;
const D = 24;
const CZ = 12;
/** The banks (their tops), the bridge's ends and its sag. */
const BANK = 9;
const [BX0, BX1] = [13, 47];
const SAG = 1.7;
/** The width of the rock cliffs' tops on either side of the river. */
const CLIFF = 5;

export const LANDMARK_IYA_KAZURABASHI = landmarkDef({
  variant: 'iya_kazurabashi',
  size: { w: [W, W], d: [D, D] },
  eaves: BANK,
  top: BANK + 14,
  roof: 'flat',
  kind: 'house',
  build,
});

const deck = (x: number): number => BANK + 0.1 - SAG * Math.sin((Math.PI * Math.min(Math.max(x - BX0, 0), BX1 - BX0)) / (BX1 - BX0));

/** A tree on a bank's top (a broad green crown on its trunk). */
function treeAt(L: Lm, x: number, z: number, y: number, h: number, r: number, dark: boolean): void {
  L.column(x, z, 0.35, y, y + h * 0.5, 'paint', { paint: 'brown' });
  L.column(x, z, r, y + h * 0.35, y + h, 'paint', { paint: dark ? 'cedar' : 'green', taper: dark ? 0.15 : 0.5, solid: false });
}

function build(L: Lm): void {
  // The river, round the big rock in its middle under the bridge (the lot's middle stays dry ground).
  const [rx0, rx1, rz0, rz1, r0, r1] = [W / 2 - 3, W / 2 + 3, CZ - 3, CZ + 3, BX0 + 2, BX1 - 2];
  for (const poly of [
    [[r0, 0], [r1, 0], [r1, rz0], [r0, rz0]],
    [[r0, rz1], [r1, rz1], [r1, D], [r0, D]],
    [[r0, rz0], [rx0, rz0], [rx0, rz1], [r0, rz1]],
    [[rx1, rz0], [r1, rz0], [r1, rz1], [rx1, rz1]],
  ] as [number, number][][]) L.ground('water', poly, 1.4, 1);
  L.column(W / 2, CZ, 3.4, -1.4, 1.4, 'paint', { paint: 'gray', taper: 0.55 });
  L.ground('gravel', [[BX0, 0], [BX0 + 2, 0], [BX0 + 2, D], [BX0, D]]);
  L.ground('gravel', [[BX1 - 2, 0], [BX1, 0], [BX1, D], [BX1 - 2, D]]);
  // The rocky banks, their wooded tops, the boulders in the river.
  // Each bank: a rock cliff over the river, the wooded slope falling away from it to the lot's edge.
  for (const [a, b, s] of [[0, BX0, 1], [BX1, W, -1]] as const) {
    const [c0, c1] = s > 0 ? [b - CLIFF, b] : [a, a + CLIFF];
    L.box(c0, 0, 0, c1, BANK - 0.5, D, 'paint', { paint: 'gray' });
    L.box(c0, BANK - 0.5, 0, c1, BANK, D, 'paint', { paint: 'poplar' });
    L.shape('wedge', s > 0 ? a : c1, 0, 0, s > 0 ? c0 : b, BANK, D, 'paint', { paint: 'poplar', slope: s > 0 ? 'x+' : 'x-' });
  }
  for (const [x, z, r] of [[20, 4, 1.6], [27, 18, 2.2], [36, 7, 1.8], [41, 20, 1.4]] as const) L.column(x, z, r, -1, 0.9, 'paint', { paint: 'granite', taper: 0.6 });

  // The deck: split timbers on the cables, sagging over the river (walkable: small steps).
  along(L, BX0 - 1, BX1 + 1, 26, deck, 0.25, CZ - 1, CZ + 1, 'hinoki');
  // The cables under the deck and the handrails (more sag), the vertical vines between them.
  for (const s of [-1, 1]) {
    const z = CZ + s * 1.1;
    along(L, BX0 - 1, BX1 + 1, 18, (x) => deck(x) - 0.2, 0.22, z - 0.12, z + 0.12, 'thatch', false);
    along(L, BX0 - 1, BX1 + 1, 18, (x) => deck(x) + 1.2, 0.2, z - 0.1, z + 0.1, 'thatch', false);
    for (let x = BX0 + 1; x < BX1; x += 2) L.box(x - 0.05, deck(x), z - 0.05, x + 0.05, deck(x) + 1.15, z + 0.05, 'paint', { paint: 'thatch', solid: false });
  }
  // The timber frames on the banks the cables are tied to.
  for (const x of [BX0 - 2.5, BX1 + 2.5]) {
    for (const s of [-1, 1]) L.box(x - 0.2, BANK, CZ + s * 1.6 - 0.2, x + 0.2, BANK + 3.4, CZ + s * 1.6 + 0.2, 'woodDark');
    L.box(x - 0.2, BANK + 3, CZ - 1.9, x + 0.2, BANK + 3.4, CZ + 1.9, 'woodDark');
  }
  // Trees on both banks (the gorge's forest).
  const slopeY = (x: number): number => (x < W / 2 ? BANK * Math.min(1, x / (BX0 - CLIFF)) : BANK * Math.min(1, (W - x) / (W - BX1 - CLIFF)));
  for (const [x, z, dark] of [[10, 3, true], [6, 20, false], [4, 11, true], [10.5, 17, false], [50, 4, false], [54, 18, true], [56, 9, false], [49.5, 21, true]] as const) treeAt(L, x, z, slopeY(x) - 0.3, dark ? 14 : 9, dark ? 2.6 : 3.2, dark);

  // 90 days on: relief crates left at one end, a fallen sign by the other.
  L.box(BX0 - 4.6, BANK, 5, BX0 - 2.6, BANK + 0.9, 6.2, 'olive', { tint: 0.2 });
  L.box(BX0 - 4.4, BANK + 0.9, 5.1, BX0 - 2.8, BANK + 1.7, 6.1, 'olive', { tint: 0.5 });
  L.box(BX1 + 1.4, BANK, 16, BX1 + 4.2, BANK + 0.12, 17.8, 'paint', { paint: 'navy', solid: false });
}
