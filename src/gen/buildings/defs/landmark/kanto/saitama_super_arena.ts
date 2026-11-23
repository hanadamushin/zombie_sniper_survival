// L3b: さいたまスーパーアリーナ (Saitama Super Arena, 2000), Saitama Shintoshin. A great silver-grey hall
// of metal panels about 40 m high, with the tall block that houses the moving stand (ムービングブロック,
// the stand that rolls 70 m to turn the arena into a stadium) rising to about 66 m at its north end,
// a long glass front to the east, and the raised deck of けやきひろば (Keyaki Hiroba, a grove of
// zelkovas on a deck between the arena and the station).
//
// Heights from the building databases (roof about 66 m, the moving block about 41 m; not confirmed by
// an official source). Its real 200 m are shortened to 100 m (the shrunk Shintoshin); the heights are
// kept. The front (local z = d, the glass and the deck) faces east (the station).

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from './parts.ts';

const W = 100;
const D = 90;
const Z1 = 62;

export const LANDMARK_SAITAMA_SUPER_ARENA = landmarkDef({
  variant: 'saitama_super_arena',
  size: { w: [W, W], d: [D, D] },
  eaves: 41,
  top: 66,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The hall: a plinth, the silver walls with dark bands, the low roof.
  L.box(4, 0, 6, W - 4, 4, Z1, 'paint', { paint: 'gray' });
  L.box(6, 4, 8, W - 6, 40, Z1 - 2, 'paint', { paint: 'silver' });
  for (const y of [12, 24, 34]) {
    L.box(5.8, y, 7.8, W - 5.8, y + 1.4, Z1 - 1.8, 'paint', { paint: 'slateBlue', solid: false });
  }
  L.box(5.4, 40, 7.4, W - 5.4, 41, Z1 - 1.4, 'paint', { paint: 'white' });
  // The tall block of the moving stand at the north end (local x = 0 side), its sloping roof.
  L.box(8, 41, 10, 44, 60, Z1 - 4, 'paint', { paint: 'silver' });
  L.shape('wedge', 8, 60, 10, 44, 66, Z1 - 4, 'paint', { paint: 'white', slope: 'x-' });
  L.shape('wedge', 44, 41, 10, 60, 60, Z1 - 4, 'paint', { paint: 'silver', slope: 'x-' });
  L.box(10, 46, Z1 - 4, 42, 56, Z1 - 3.9, 'paint', { paint: 'slateBlue', solid: false });
  // The glass front (east): tall dark glass with silver mullions, the entrances shut.
  L.box(14, 4, Z1 - 2.05, W - 14, 36, Z1 - 1.9, 'paint', { paint: 'deckGlass', solid: false });
  for (let x = 14; x <= W - 14; x += 8) L.box(x - 0.3, 4, Z1 - 2.2, x + 0.3, 36, Z1 - 1.75, 'paint', { paint: 'silver', solid: false });
  for (const x of [26, 50, 74]) L.box(x - 4, 0, Z1, x + 4, 4, Z1 + 0.12, 'shutter');

  // けやきひろば: a deck on pillars between the arena and the station, its grove of zelkovas.
  L.box(10, 6.4, Z1 + 6, W - 10, 7.2, D - 2, 'paint', { paint: 'granite' });
  for (let x = 14; x <= W - 14; x += 14) for (const z of [Z1 + 9, D - 6]) L.box(x - 0.6, 0, z - 0.6, x + 0.6, 6.4, z + 0.6, 'paint', { paint: 'gray' });
  // The deck's stairs down to the front of the arena.
  for (let k = 0; k < 8; k++) L.box(54, k * 0.8, Z1 + 6 - (k + 1) * 0.75, 62, (k + 1) * 0.8, Z1 + 6 - k * 0.75, 'paint', { paint: 'granite' });
  for (let x = 18; x <= W - 18; x += 12) for (const z of [Z1 + 12, Z1 + 22]) {
    L.box(x - 0.3, 7.2, z - 0.3, x + 0.3, 9, z + 0.3, 'paint', { paint: 'brown' });
    L.column(x, z, 3.4, 8.6, 17, 'paint', { paint: 'green', taper: 0.55, solid: false });
  }

  // 90 days on: the arena was a great shelter — tents in rows on the ground in front, crates, sandbags at
  // the doors, burnt cars.
  for (const x of [72, 82, 92]) L.tent(x, Z1 + 3.2, 'x', 7);
  L.crates(20, Z1 + 2, 6);
  L.sandbags(24, Z1 + 1, 36, Z1 + 1);
  L.car(W - 8, D - 9, 'z', { burnt: true });
  L.car(5, D - 9, 'z', { burnt: true });
  L.fallenSign(64, D - 1, 'x');
  broadleaf(L, 4, D - 3.5, 10, 2.6);
}
