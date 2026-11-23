// L4: 朱鷺メッセ (Toki Messe, Niigata Convention Center, 2003) on Bandai Island at the mouth of the
// Shinano River. Its landmark is the Bandaijima Building (31 floors, 140.5 m — the tallest building on
// the Sea of Japan side), a slim glass tower of oval plan banded by white floor lines, its crown
// cut on a slant, the free observation room at 125 m; at its foot the low convention and exhibition
// halls under long curved silver roofs, joined by a glass concourse, and the riverside promenade.
//
// Real size for the tower; the halls are shortened. The front (local z = d, the promenade) faces
// the river (west).

import { landmarkDef, type Lm } from '../common.ts';

const W = 96;
const D = 70;
/** The tower's middle and its half sizes (an oval). */
const TX = 26;
const TZ = 30;
const HX = 24;
const HZ = 13;
const BODY = 131;

export const LANDMARK_TOKI_MESSE = landmarkDef({
  variant: 'toki_messe',
  size: { w: [W, W], d: [D, D] },
  eaves: 16,
  top: 140.5,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The tower: an oval glass body, the white floor lines every two floors, white ribs up its ends.
  L.shape('cyl', TX - HX, 0, TZ - HZ, TX + HX, BODY, TZ + HZ, 'paint', { paint: 'mirror' });
  // Its collision: a 12-sided prism stops only at its inner box — hidden boxes fill the oval.
  for (let k = 0; k < 4; k++) {
    const a = ((k + 0.5) / 4) * (Math.PI / 2);
    const [hx, hz] = [HX * Math.cos(a) * 0.96, HZ * Math.sin(a) * 0.96];
    L.box(TX - hx, 0, TZ - hz, TX + hx, BODY, TZ + hz, 'paint', { paint: 'gray', hidden: true });
  }
  for (let y = 8; y < BODY - 4; y += 8.6) L.shape('cyl', TX - HX - 0.15, y, TZ - HZ - 0.15, TX + HX + 0.15, y + 0.9, TZ + HZ + 0.15, 'paint', { paint: 'white', solid: false });
  for (const s of [-1, 1]) L.box(TX + s * (HX - 0.4) - 0.8, 0, TZ - 1.2, TX + s * (HX - 0.4) + 0.8, BODY + 2, TZ + 1.2, 'paint', { paint: 'white' });
  // The observation room's darker glass band, then the crown cut on a slant (high on the river side).
  L.shape('cyl', TX - HX - 0.1, 121, TZ - HZ - 0.1, TX + HX + 0.1, 127, TZ + HZ + 0.1, 'paint', { paint: 'deckGlass', solid: false });
  L.shape('wedge', TX - HX * 0.82, BODY, TZ - HZ * 0.8, TX + HX * 0.82, 140.5, TZ + HZ * 0.8, 'paint', { paint: 'silver', slope: 'z+' });
  L.box(TX - 2, BODY, TZ + HZ * 0.6, TX + 2, 139.5, TZ + HZ * 0.6 + 0.6, 'paint', { paint: 'red', solid: false });

  // The halls: the convention hall and the exhibition hall under long curved silver roofs (each a low
  // shallow gable over a band of light), the glass concourse between them and the tower.
  for (const [x0, x1] of [[52, 72], [74, 94]] as const) {
    L.box(x0, 0, 6, x1, 13, 58, 'paint', { paint: 'offWhite' });
    L.box(x0 - 0.1, 9.5, 6 - 0.1, x1 + 0.1, 11, 58 + 0.1, 'paint', { paint: 'windowDark', solid: false });
    L.shape('gable', x0 - 1, 13, 5, x1 + 1, 15, 59, 'paint', { paint: 'silver', axis: 'z' });
    L.shape('gable', x0 + 2, 14.8, 5, x1 - 2, 16, 59, 'paint', { paint: 'silver', axis: 'z', solid: false });
  }
  L.box(32, 0, 38, 52, 10, 52, 'glass');
  L.box(31.6, 10, 37.6, 52.4, 10.6, 52.4, 'paint', { paint: 'silver' });
  // The promenade's rail along the river.
  L.box(1, 0, D - 1.2, W - 1, 1.1, D - 1, 'steel');
  for (const x of [8, 30, 52, 74]) L.box(x - 0.15, 0, D - 4, x + 0.15, 4.5, D - 3.7, 'steel', { solid: false });

  // 90 days on: the halls were the city's evacuation centre — tents and crates on the promenade,
  // sandbags at the concourse's doors, abandoned and burnt-out cars, the tower's glass broken low down.
  L.tent(56, 63, 'x', 7);
  L.tent(66, 63, 'x', 7);
  L.tent(78, 63, 'x', 7);
  L.crates(88, 63, 6);
  L.sandbags(33, 53.2, 51, 53.2);
  L.car(10, 60, 'x', { burnt: true });
  L.car(20, 64, 'x');
  L.car(40, 61, 'z');
  L.scorch(TX - 8, 0.3, TZ + HZ - 0.2, TX + 2, 9, TZ + HZ + 0.25);
}
