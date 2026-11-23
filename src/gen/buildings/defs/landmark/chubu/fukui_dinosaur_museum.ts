// L4: 福井県立恐竜博物館 (Fukui Prefectural Dinosaur Museum, Katsuyama, 2000, Kurokawa Kishō). On the
// wooded hill of Nagaō-yama park, a great silver dome shaped like an egg laid on its side holds the
// skeletons; the entrance is a glass hall under its south side, a long low wing runs behind it into the
// hill, and life-size dinosaur figures stand on the lawn before it.
//
// The dome is drawn about 72 × 54 m and 32 m high; the figures are a generic long-necked sauropod and a
// meat-eating theropod (no particular model). The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from '../kanto/parts.ts';
import { cedar } from '../tohoku/parts.ts';

const W = 100;
const D = 80;
/** The dome: middle, half sizes at its foot, height. */
const DX = 50;
const DZ = 34;
const RX = 36;
const RZ = 27;
const H = 32;

export const LANDMARK_FUKUI_DINOSAUR_MUSEUM = landmarkDef({
  variant: 'fukui_dinosaur_museum',
  size: { w: [W, W], d: [D, D] },
  eaves: 12,
  top: H,
  kind: 'office',
  build,
});

/**
 * The egg: oval slices up an ellipsoid, each a 12-sided prism tapered to the next (a second prism
 * turned by 15° would round it, but an oval turned is no longer the same oval); the top leans east.
 */
function dome(L: Lm): void {
  const n = 7;
  const r = (t: number): number => Math.sqrt(Math.max(0, 1 - t * t));
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const [y0, y1] = [H * t0, H * t1];
    const s0 = r(t0) * 0.98 + 0.02;
    const s1 = r(t1) * 0.98 + 0.02;
    const shift = 6 * t0; // the egg's top sits east of its middle
    const [hx, hz] = [RX * s0, RZ * s0];
    const paint = i % 2 === 0 ? 'dome' : 'silver';
    L.shape('cyl', DX + shift - hx, y0, DZ - hz, DX + shift + hx, y1, DZ + hz, 'paint', { paint, solid: i < 3 }).taper = s1 / s0;
  }
  // The collision of the lower dome: hidden boxes filling its oval up to a third of its height.
  for (let k = 0; k < 4; k++) {
    const a = ((k + 0.5) / 4) * (Math.PI / 2);
    L.box(DX - RX * Math.cos(a) * 0.9, 0, DZ - RZ * Math.sin(a) * 0.9, DX + RX * Math.cos(a) * 0.9, H * 0.4, DZ + RZ * Math.sin(a) * 0.9, 'paint', { paint: 'gray', hidden: true });
  }
}

/** A long-necked plant-eater (sauropod) facing -x: body, tail, four legs, the neck rising to the head. */
function sauropod(L: Lm, x: number, z: number): void {
  const c = { paint: 'green' as const };
  L.shape('cyl', x - 5, 2.6, z - 1.8, x + 5, 6.2, z + 1.8, 'paint', c);
  for (const [dx, dz] of [[-3.4, -1.1], [-3.4, 1.1], [3.2, -1.1], [3.2, 1.1]] as const) L.column(x + dx, z + dz, 0.55, 0, 3.4, 'paint', c);
  for (let i = 0; i < 4; i++) L.box(x + 4.6 + i * 2.2, 4.6 - i * 0.9, z - 0.8 + i * 0.15, x + 6.9 + i * 2.2, 5.6 - i * 0.95, z + 0.8 - i * 0.15, 'paint', { ...c, solid: false });
  for (let i = 0; i < 5; i++) L.box(x - 5.6 - i * 0.9, 5 + i * 1.6, z - 0.6, x - 4.4 - i * 0.9, 6.8 + i * 1.6, z + 0.6, 'paint', { ...c, solid: false });
  L.box(x - 11, 12.4, z - 0.7, x - 9, 13.6, z + 0.7, 'paint', { ...c, solid: false });
}

/** A meat-eater (theropod) facing +z: two legs, the body held level, the tail out behind, the big head. */
function theropod(L: Lm, x: number, z: number): void {
  const c = { paint: 'brown' as const };
  for (const dx of [-0.9, 0.9]) {
    L.box(x + dx - 0.5, 0, z - 0.6, x + dx + 0.5, 2.6, z + 0.4, 'paint', c);
    L.box(x + dx - 0.6, 2.4, z - 1.2, x + dx + 0.6, 4, z + 0.5, 'paint', c);
  }
  L.shape('cyl', x - 1.4, 3.6, z - 2.6, x + 1.4, 6, z + 2.4, 'paint', c);
  for (let i = 0; i < 3; i++) L.box(x - 0.9 + i * 0.25, 4.4 - i * 0.5, z - 5 - i * 2.4, x + 0.9 - i * 0.25, 5.6 - i * 0.6, z - 2.6 - i * 2.4, 'paint', { ...c, solid: false });
  L.box(x - 0.8, 5.4, z + 1.8, x + 0.8, 6.8, z + 3, 'paint', { ...c, solid: false });
  L.box(x - 0.9, 6, z + 2.6, x + 0.9, 7.6, z + 5.2, 'paint', { ...c, solid: false });
  L.box(x - 0.85, 5.6, z + 3, x + 0.85, 6.1, z + 5, 'paint', { paint: 'offWhite', solid: false }); // the jaw's teeth
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[30, 58], [70, 58], [70, D], [30, D]]);
  dome(L);
  // The glass entrance hall under the dome's south side, its canopy.
  L.box(36, 0, 54, 64, 9, 62, 'glass');
  L.box(35, 9, 53, 65, 9.8, 64, 'paint', { paint: 'silver' });
  for (const x of [37, 43.5, 50, 56.5, 63]) L.box(x - 0.25, 0, 61.6, x + 0.25, 9, 62.1, 'paint', { paint: 'silver' });
  L.box(46, 0, 62, 54, 3, 62.1, 'doorSteel');
  // The long low wing behind, half into the hill.
  L.box(8, 0, 2, 92, 10, 12, 'paint', { paint: 'offWhite' });
  L.box(7.6, 10, 1.6, 92.4, 10.8, 12.4, 'paint', { paint: 'charcoal' });
  L.box(8, 3, 11.98, 92, 7, 12.06, 'paint', { paint: 'windowDark', solid: false });

  sauropod(L, 82, 66);
  theropod(L, 18, 64);
  // The hill's woods round the lawn.
  for (const [x, z] of [[4, 22], [4, 44], [96, 24], [96, 46], [8, 76], [92, 77]] as const) cedar(L, x, z, 18, 2.6);
  for (const [x, z, h] of [[16, 46, 11], [86, 46, 12]] as const) broadleaf(L, x, z, h, 4);

  // 90 days on: tents and crates on the plaza (the museum was a shelter), a burnt-out car, a fallen
  // sign; the entrance hall's glass broken and scorched.
  L.tent(36, 70, 'x', 7);
  L.tent(46, 70, 'x', 7);
  L.crates(58, 70, 5);
  L.car(66, 75, 'x', { burnt: true });
  L.fallenSign(28, 70, 'z');
  L.scorch(38, 0.4, 62.02, 44, 7, 62.12);
}
