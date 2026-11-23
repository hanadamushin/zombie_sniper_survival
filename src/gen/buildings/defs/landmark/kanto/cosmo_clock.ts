// L3b: みなとみらいの大観覧車 コスモクロック21 (Cosmo Clock 21, 1989 / 1999), Minato Mirai 21. A big wheel
// 100 m across, 112.5 m to the top of its rim, with 60 gondolas and a great clock at its hub (the
// wheel is the clock's face: the hub shows the time, the spokes are its dial). It stands on two white
// A-frames over the low station building of the amusement park by the harbour.
//
// The wheel faces the front (local z = d, the bay side). The upright circle is drawn as a staircase
// of boxes (parts.ts xyLine / wheel); only the legs, the station and the hub's axle stop bullets.

import { landmarkDef, type Lm } from '../common.ts';
import { slant, wheel, xyLine } from './parts.ts';

const W = 112;
const D = 34;
const CX = W / 2;
const CZ = 17;
const R = 49.35;
const CY = 62.5;

export const LANDMARK_COSMO_CLOCK = landmarkDef({
  variant: 'cosmo_clock',
  size: { w: [W, W], d: [D, D] },
  eaves: 10,
  top: 112.5,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The station: a low building under the wheel with a platform to the gondolas.
  L.box(CX - 18, 0, CZ - 7, CX + 18, 6, CZ + 7, 'paint', { paint: 'offWhite' });
  L.box(CX - 18.3, 6, CZ - 7.3, CX + 18.3, 6.6, CZ + 7.3, 'paint', { paint: 'gray' });
  L.windows('x', CZ + 7, 1, CX - 16, CX + 16, 6, 1.5, 4.8, 3.6, { paint: 'skyBlue', broken: 0.4 });
  // Two A-frames carry the axle (front and back of the wheel).
  for (const s of [-1, 1]) {
    for (const sx of [-1, 1]) slant(L, [CX + sx * 24, 0, CZ + s * 13], [CX + sx * 1.2, CY, CZ + s * 3.2], 16, 1.8, 'white', true);
    // A cross tie between the legs.
    L.box(CX - 13, 30, CZ + s * 8.4 - 0.5, CX + 13, 31.2, CZ + s * 8.4 + 0.5, 'paint', { paint: 'white', solid: false });
  }
  L.box(CX - 1.5, CY - 1.5, CZ - 3.6, CX + 1.5, CY + 1.5, CZ + 3.6, 'paint', { paint: 'silver' });

  wheel(L, CX, CY, CZ, R, 3.2, {
    rim: 'white', spoke: 'silver', cars: ['skyBlue', 'white', 'sakura', 'yellow', 'silver', 'green'], spokes: 12, cars_n: 60, sides: 48, hub: 9, hubPaint: 'white',
  });
  // The clock at the hub: a dark face with its two hands (stopped), a light ring of dial marks.
  for (let i = 0; i < 4; i++) {
    const t0 = -1 + (2 * i) / 4;
    const t1 = -1 + (2 * (i + 1)) / 4;
    const half = 7 * Math.sqrt(1 - ((t0 + t1) / 2) ** 2);
    L.box(CX - half, CY + t0 * 7, CZ + 2.1, CX + half, CY + t1 * 7, CZ + 2.3, 'paint', { paint: 'black', solid: false });
  }
  xyLine(L, CX, CY, CX + 3.4, CY + 4.6, CZ + 2.3, CZ + 2.45, 0.5, 'white', { step: 0.6 });
  xyLine(L, CX, CY, CX - 5.8, CY - 1.4, CZ + 2.3, CZ + 2.45, 0.4, 'white', { step: 0.6 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [x, y] = [CX + Math.cos(a) * 6.2, CY + Math.sin(a) * 6.2];
    L.box(x - 0.3, y - 0.3, CZ + 2.3, x + 0.3, y + 0.3, CZ + 2.4, 'paint', { paint: 'yellow', solid: false });
  }

  // 90 days on: a gondola fallen at the foot, crates and a tent by the station, a fallen sign.
  L.box(CX + 26, 0, CZ + 6, CX + 28.6, 2.2, CZ + 8.4, 'paint', { paint: 'skyBlue', yaw: 0.5 });
  L.tent(12, 9, 'x', 7);
  L.crates(22, 6, 4);
  L.fallenSign(CX - 22, D - 3, 'x');
  L.car(W - 10, D - 4, 'x', { burnt: true });
}
