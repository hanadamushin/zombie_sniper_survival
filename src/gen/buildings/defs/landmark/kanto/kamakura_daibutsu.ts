// L3b: 鎌倉大仏 (the Great Buddha of Kamakura, 1252), 高徳院 (Kōtoku-in), Hase. A seated bronze Amida
// in the open air (its hall was swept away in the 15th century): 11.3 m from the lap to the top of the
// head (13.35 m with the stone base), the knees 9.1 m apart, the hands joined in the lap, the head
// leaning a little forward, the long ears. Grey-green bronze. Round it the gravel court, the hall's
// old foundation stones, a bronze incense burner and two lotus vases in front, trees behind.
//
// The figure is a stack of round and oval prisms (the lap, the body, the shoulders, the head with its
// curls and the 肉髻), the arms and the hands as boxes. The front (local z = d) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { broadleaf } from './parts.ts';

const W = 40;
const D = 46;
const X = 20;
const Z = 19;
const B = 2;

export const LANDMARK_KAMAKURA_DAIBUTSU = landmarkDef({
  variant: 'kamakura_daibutsu',
  size: { w: [W, W], d: [D, D] },
  eaves: 9,
  top: 16, // the trees behind (the figure: B + 11.31)
  kind: 'house',
  build,
});

/** An oval prism centred on (x, z), `w` across and `d` deep. */
function oval(L: Lm, x: number, z: number, w: number, d: number, y0: number, y1: number, taper = 1, solid = true): void {
  const p = L.shape('cyl', x - w / 2, y0, z - d / 2, x + w / 2, y1, z + d / 2, 'paint', { paint: 'daibutsu', solid });
  if (taper !== 1) p.taper = taper;
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The stone base, two courses.
  L.box(9, 0, 10, 31, 1, 30, 'paint', { paint: 'stone' });
  L.box(10.5, 1, 11.2, 29.5, B, 28.8, 'paint', { paint: 'stone' });

  // The lap (the crossed legs, knee to knee 9.1 m), the feet and hands over it, the body widening to the
  // chest, the sloping shoulders under the robe.
  oval(L, X, Z + 1.5, 9.4, 6.6, B, B + 1.7, 0.92);
  oval(L, X, Z + 1.4, 8, 5.6, B + 1.6, B + 2.5, 0.82);
  oval(L, X, Z + 0.2, 5.9, 4.3, B + 2.2, B + 5.4, 1.08);
  oval(L, X, Z + 0.2, 6.4, 4.6, B + 5.3, B + 6.8, 0.96);
  oval(L, X, Z + 0.1, 7.5, 4.7, B + 6.5, B + 7.8, 0.42);
  // The upper arms down the sides, the forearms forward into the lap, the joined hands.
  for (const s of [-1, 1]) {
    oval(L, X + s * 3.05, Z + 0.4, 1.8, 2.5, B + 2.4, B + 7.1, 0.78);
    L.box(Math.min(X + s * 1.1, X + s * 3.7), B + 2.3, Z + 0.9, Math.max(X + s * 1.1, X + s * 3.7), B + 3.2, Z + 4.1, 'paint', { paint: 'daibutsu' });
  }
  L.box(X - 1.4, B + 2.5, Z + 3.5, X + 1.4, B + 3.3, Z + 4.5, 'paint', { paint: 'daibutsu' });
  // The robe's folds across the chest and over the lap (slightly darker lines).
  L.box(X - 2.6, B + 4.6, Z + 2.62, X + 1.6, B + 5.0, Z + 2.72, 'paint', { paint: 'bronze', solid: false });
  for (const dx of [-3, -1, 1, 3]) L.box(X + dx - 0.12, B + 0.3, Z + 4.82, X + dx + 0.12, B + 1.6, Z + 4.9, 'paint', { paint: 'bronze', solid: false });

  // The neck with its three folds, the face (forward of the body), the hair of curls, the 肉髻, the
  // long ears; the lowered eyes, the nose, the mouth, the 白毫 between the brows.
  const hz = Z + 0.9;
  L.column(X, hz - 0.3, 1.05, B + 7.5, B + 8.2, 'paint', { paint: 'daibutsu' });
  L.column(X, hz - 0.2, 1.12, B + 7.75, B + 7.85, 'paint', { paint: 'bronze', solid: false });
  oval(L, X, hz, 2.6, 2.8, B + 8, B + 9.8, 1.06);
  oval(L, X, hz - 0.12, 2.95, 3.05, B + 9.55, B + 10.55, 0.74);
  L.shape('cyl', X - 1.5, B + 9.5, hz - 0.12 - 1.55, X + 1.5, B + 9.7, hz - 0.12 + 1.55, 'paint', { paint: 'bronze', solid: false });
  oval(L, X, hz - 0.25, 1.85, 1.95, B + 10.4, B + 11.31, 0.55);
  for (const s of [-1, 1]) L.box(X + s * 1.38 - 0.16, B + 7.9, hz - 0.45, X + s * 1.38 + 0.16, B + 9.8, hz + 0.2, 'paint', { paint: 'daibutsu' });
  const fz = hz + 1.4;
  for (const s of [-1, 1]) L.box(X + s * 0.5 - 0.36, B + 9.05, fz - 0.05, X + s * 0.5 + 0.36, B + 9.15, fz + 0.06, 'paint', { paint: 'black', solid: false });
  L.box(X - 0.2, B + 8.55, fz - 0.1, X + 0.2, B + 9.1, fz + 0.22, 'paint', { paint: 'daibutsu', solid: false });
  L.box(X - 0.35, B + 8.3, fz - 0.05, X + 0.35, B + 8.38, fz + 0.04, 'paint', { paint: 'black', solid: false });
  L.box(X - 0.08, B + 9.35, fz - 0.03, X + 0.08, B + 9.5, fz + 0.06, 'paint', { paint: 'offWhite', solid: false });

  // The old hall's foundation stones round the figure.
  for (let i = 0; i < 5; i++) for (const zz of [6, 34]) {
    const x = 6 + i * 7;
    L.box(x - 0.6, 0, zz - 0.6, x + 0.6, 0.45, zz + 0.6, 'paint', { paint: 'stone' });
  }
  for (const zz of [13, 20, 27]) for (const x of [5, 35]) L.box(x - 0.6, 0, zz - 0.6, x + 0.6, 0.45, zz + 0.6, 'paint', { paint: 'stone' });
  // Before it: the incense burner and two bronze lotus vases.
  L.column(X, 35.5, 0.9, 0, 0.9, 'paint', { paint: 'stone' });
  L.column(X, 35.5, 0.75, 0.9, 1.9, 'paint', { paint: 'bronze', taper: 0.7 });
  for (const s of [-1, 1]) {
    L.column(X + s * 4, 33, 0.45, 0, 1.2, 'paint', { paint: 'stone' });
    L.column(X + s * 4, 33, 0.12, 1.2, 3.4, 'paint', { paint: 'bronze' });
    L.column(X + s * 4, 33, 0.4, 3.4, 4.1, 'paint', { paint: 'bronze', taper: 1.5, solid: false });
  }
  // Trees behind and to the sides.
  for (const [x, z, h] of [[4, 3.4, 14], [13, 3.4, 16], [27, 3.4, 15], [36, 3.6, 13], [3.6, 22, 12], [36.4, 24, 13]] as const) broadleaf(L, x, z, h, 3.2);

  // 90 days on: a relief tent and crates in the court, a fallen sign by the gate.
  L.tent(8, 41, 'x', 6);
  L.crates(30, 40, 3);
  L.fallenSign(15, 43, 'x');
}
