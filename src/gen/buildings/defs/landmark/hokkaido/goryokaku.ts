// L1: 五稜郭 (Goryōkaku, Hakodate, 1864): the five-pointed star fort, its moat and stone walls, and the
// reconstructed 箱館奉行所 (the Hakodate magistrate's office, 2010) in the middle. The real star is
// about 500 m across with its moat; an area is the real ground shrunk 1/10, which would leave a
// 50 m blot. The star is drawn 130 m across instead (about 1/4): large enough to read as a star from
// the deck of Goryōkaku Tower (placed next to it by the table), small enough for the shrunk town.
// The buildings in it keep their true size.
//
// Ground: the moat is dug into the lot (the ground's polygons, gen/real/landmarks.ts), the inside of
// the star is lawn; two bridges cross the moat (the front one, 一の橋, where the front (z = d) notch
// is; the back gate's bridge, 裏門橋). The stone walls stand on the inner edge of the moat.

import type { Lm } from '../common.ts';
import { landmarkDef } from '../common.ts';

const W = 136;
const C = W / 2;
/** Tip / notch radii of the moat's outer edge and of the walls (the moat's inner edge). */
const RO = 66;
const NO = 41;
const RI = 56;
const NI = 32;
const DEPTH = 2.4;

export const LANDMARK_GORYOKAKU = landmarkDef({
  variant: 'goryokaku',
  size: { w: [W, W], d: [W, W] },
  eaves: 4.5,
  top: 14.5,
  roof: 'hip',
  kind: 'house',
  build,
});

/** Star vertex k (0..9): a tip for even k (the first pointing to the back, -z), a notch for odd. */
function star(k: number, tip: number, notch: number): [number, number] {
  const a = -Math.PI / 2 + (k * Math.PI) / 5;
  const r = k % 2 === 0 ? tip : notch;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r];
}

function build(L: Lm): void {
  // The lawn over the whole lot, then the moat: one quadrilateral per edge of the star.
  L.ground('grass', [[0, 0], [W, 0], [W, W], [0, W]]);
  for (let k = 0; k < 10; k++) {
    const a = star(k, RO, NO);
    const b = star(k + 1, RO, NO);
    const c = star(k + 1, RI, NI);
    const d = star(k, RI, NI);
    L.ground('water', [a, b, c, d], DEPTH, 0.9);
  }
  // The stone walls on the inner edge (a gap where a bridge lands: the notches 5, front, and 1, back).
  const gap = 3.2;
  for (let k = 0; k < 10; k++) {
    let [ax, az] = star(k, RI, NI);
    let [bx, bz] = star(k + 1, RI, NI);
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    if (k + 1 === 5 || k + 1 === 1) [bx, bz] = [bx - ux * gap, bz - uz * gap];
    if (k === 5 || k === 1) [ax, az] = [ax + ux * gap, az + uz * gap];
    // The wall's outer face on the star line: move it 0.7 m in (towards the middle).
    const nx = -uz;
    const nz = ux;
    const inward = (C - ax) * nx + (C - az) * nz > 0 ? 1 : -1;
    const ox = nx * inward * 0.7;
    const oz = nz * inward * 0.7;
    L.bar(ax + ox, az + oz, bx + ox, bz + oz, -DEPTH, 1.1, 1.4, 'paint', { paint: 'stone' });
  }
  // Bridges: wooden decks over the moat at the front and back notches, with low rails.
  const bridge = (k: number): void => {
    const [ix, iz] = star(k, NI - 4, NI - 4);
    const [ox, oz] = star(k, NO + 4, NO + 4);
    L.bar(ix, iz, ox, oz, -0.3, 0.25, 4, 'wood');
    const len = Math.hypot(ox - ix, oz - iz);
    const px = (-(oz - iz) / len) * 2;
    const pz = ((ox - ix) / len) * 2;
    for (const s of [1, -1]) L.bar(ix + px * s, iz + pz * s, ox + px * s, oz + pz * s, 0.25, 1.1, 0.15, 'woodDark', { solid: false });
  };
  bridge(5);
  bridge(1);

  // 箱館奉行所 in the middle: white walls on a dark timber base, a tiled hip-and-gable roof, the drum tower.
  const hw = 18;
  const hd = 6.5;
  L.box(C - hw, 0, C - hd, C + hw, 1.4, C + hd, 'paint', { paint: 'brown' });
  L.box(C - hw, 1.4, C - hd, C + hw, 4.5, C + hd, 'paint', { paint: 'offWhite' });
  for (let i = 0; i <= 12; i++) {
    const x = C - hw + (i * 2 * hw) / 12;
    L.box(x - 0.15, 1.4, C + hd, x + 0.15, 4.5, C + hd + 0.1, 'paint', { paint: 'brown', solid: false });
  }
  L.shape('hip', C - hw - 1.4, 4.5, C - hd - 1.4, C + hw + 1.4, 8.2, C + hd + 1.4, 'paint', { paint: 'charcoal', axis: 'x' });
  L.shape('gable', C - hw + 4, 7.4, C - 3.2, C + hw - 4, 9.8, C + 3.2, 'paint', { paint: 'charcoal', axis: 'x' });
  // The entrance porch (front) and its gable.
  L.box(C - 3, 0, C + hd, C + 3, 3.8, C + hd + 3.5, 'paint', { paint: 'offWhite' });
  L.shape('gable', C - 3.6, 3.8, C + hd - 0.5, C + 3.6, 6.4, C + hd + 4.1, 'paint', { paint: 'charcoal', axis: 'z' });
  L.box(C - 1.2, 0, C + hd + 3.5, C + 1.2, 2.6, C + hd + 3.6, 'paint', { paint: 'brown' });
  // The drum tower (太鼓櫓) on the ridge.
  L.box(C - 1.9, 9.2, C - 1.9, C + 1.9, 12.3, C + 1.9, 'paint', { paint: 'white' });
  L.box(C - 1.6, 10.4, C + 1.9, C + 1.6, 11.6, C + 2, 'paint', { paint: 'black', solid: false });
  L.shape('hip', C - 2.5, 12.3, C - 2.5, C + 2.5, 14.5, C + 2.5, 'paint', { paint: 'charcoal' });

  // Trees inside the star (the cherries and pines of the park), between the bastions.
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) * Math.PI) / 5;
    const r = k % 2 === 0 ? 30 : 26;
    const x = C + Math.cos(a) * r;
    const z = C + Math.sin(a) * r;
    if (Math.abs(x - C) < hw + 4 && Math.abs(z - C) < hd + 6) continue;
    L.column(x, z, 0.35, 0, 3, 'paint', { paint: 'brown' });
    L.column(x, z, 3.4, 3, 8.5, 'paint', { paint: 'green', taper: 0.45, solid: false });
  }

  // 90 days on: the park was a shelter — tents and crates before the office, a burnt car by the front bridge.
  L.tent(C - 10, C + 18, 'x', 6);
  L.tent(C + 10, C + 18, 'x', 6);
  L.crates(C - 1.5, C + 21, 4);
  L.car(C + 9, W - 8, 'x', { burnt: true });
}
