// L8: 沖縄美ら海水族館 (the Okinawa Churaumi Aquarium, 2002), Ocean Expo Park, Motobu, Okinawa. On the slope
// over the East China Sea (Iejima on the horizon): a long low building of pale stone-coloured concrete
// in broad layers under deep flat eaves, glazed towards the sea; before its entrance the gate 海人門
// (Umanchu-mon), a great pyramid roof of red Ryūkyū tiles on slim posts, and in the plaza the
// whale shark monument (the aquarium's emblem: its great tank keeps whale sharks).
//
// Real size: the building about 180 × 80 m on four floors; the lot is drawn small (88 × 56 m), its
// height real. The front (local z = d, the gate) faces west, to the sea.

import { landmarkDef, type Lm } from '../common.ts';
import { palm, redRoof } from './parts.ts';

const W = 88;
const D = 56;
const [X0, X1, Z0, Z1] = [5, 83, 6, 38];

export const LANDMARK_CHURAUMI_AQUARIUM = landmarkDef({
  variant: 'churaumi_aquarium',
  size: { w: [W, W], d: [D, D] },
  eaves: 14,
  top: 20.4,
  kind: 'office',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('grass', [[0, 46], [30, 46], [30, D], [0, D]]);
  // The lower body: pale concrete, a band of dark glass along the sea front, the first deep eave.
  L.box(X0, 0, Z0, X1, 14, Z1, 'paint', { paint: 'offWhite' });
  L.box(X0 + 1, 1.2, Z1, X1 - 1, 5.6, Z1 + 0.1, 'paint', { paint: 'deckGlass', solid: false });
  L.windows('x', Z1 + 0.1, 1, X0 + 3, X1 - 3, 10, 1.6, 5.2, 5, { paint: 'skyBlue', broken: 0.5 });
  L.box(X0 + 1, 8, Z1, X1 - 1, 9.4, Z1 + 0.1, 'paint', { paint: 'deckGlass', solid: false });
  for (const [y, out] of [[6.2, 3.2], [14, 2.6]] as const) L.box(X0 - out * 0.5, y - 0.6, Z0 - out * 0.4, X1 + out * 0.5, y, Z1 + out, 'paint', { paint: 'white' });
  // The upper layer, set back, its own eave; the glazed café at the north end of the sea front.
  L.box(X0 + 12, 14, Z0 + 2, X1 - 18, 19.4, Z1 - 6, 'paint', { paint: 'stone' });
  L.box(X0 + 10.5, 19.4, Z0 + 1, X1 - 16.5, 20.2, Z1 - 4, 'paint', { paint: 'white' });
  L.box(X0 + 13, 15, Z1 - 6, X1 - 19, 18, Z1 - 5.9, 'paint', { paint: 'deckGlass', solid: false });
  L.box(X0, 0.5, Z1 - 12, X0 + 0.1, 12.8, Z1 - 1, 'paint', { paint: 'deckGlass', solid: false });
  // The vertical fins of the long walls (their stone-like panels).
  for (let x = X0 + 6; x < X1 - 3; x += 8) L.box(x - 0.3, 6.2, Z1, x + 0.3, 13.4, Z1 + 0.5, 'paint', { paint: 'stone', solid: false });

  // 海人門: the great pyramid roof of red tiles on its slim posts, before the entrance.
  const [gx, gz] = [52, 45];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.column(gx + sx * 5.4, gz + sz * 4.6, 0.35, 0, 8.4, 'paint', { paint: 'white' });
  L.box(gx - 6, 8.2, gz - 5.2, gx + 6, 8.8, gz + 5.2, 'paint', { paint: 'white', solid: false });
  redRoof(L, gx - 8.4, gz - 7.6, gx + 8.4, gz + 7.6, 8.8, 7.4);
  L.box(gx - 2.4, 0, Z1 + 0.1, gx + 2.4, 4, Z1 + 0.25, 'doorSteel');

  // The whale shark: a long flat body, its broad head and the tail fin, the dorsal fin, pale spots.
  const [wx, wz] = [18, 50];
  L.box(wx - 1.2, 0, wz - 0.6, wx + 1.2, 0.9, wz + 0.6, 'paint', { paint: 'granite' });
  const body = L.shape('cyl', wx - 6, 0.9, wz - 1.4, wx + 4.5, 2.8, wz + 1.4, 'paint', { paint: 'slateBlue' });
  body.taper = 0.8;
  L.box(wx - 9, 1, wz - 0.12, wx - 5.6, 4.2, wz + 0.12, 'paint', { paint: 'slateBlue' });
  L.shape('wedge', wx - 2, 2.6, wz - 0.12, wx + 0.6, 4, wz + 0.12, 'paint', { paint: 'slateBlue', slope: 'x-', solid: false });
  for (const [dx, dz] of [[-3, 1], [0, 1.2], [2.5, 0.9], [-1.5, -1.2], [1.5, -1.1], [-4, -0.9]] as const) L.box(wx + dx - 0.2, 2.5, wz + dz - 0.2, wx + dx + 0.2, 2.86, wz + dz + 0.2, 'paint', { paint: 'white', solid: false });

  // Palms along the plaza.
  for (const [x, z] of [[4, 42], [32, 52], [70, 52], [84, 42], [84, 4], [4, 3]] as const) palm(L, x, z, 8, 6, 3);

  // 90 days on: relief tents and crates in the plaza, a burnt car, a fallen sign, scorched glass.
  L.tent(74, 46, 'z', 7);
  L.crates(62, 52, 4);
  L.car(40, 53, 'x', { burnt: true });
  L.fallenSign(30, 44, 'x');
  L.scorch(X0 + 20, 1.2, Z1 + 0.12, X0 + 28, 5.4, Z1 + 0.2);
}
