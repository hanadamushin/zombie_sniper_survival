// L1: Hokkaido University (北海道大学), two landmarks of its campus.
//
//   hokudai_clark   クラーク像: the bronze bust of William S. Clark (1926, recast 1948) on its stone
//                   pedestal in a lawn among the great elms (ハルニレ) by the old Agricultural College.
//                   A bust is small: the elms and the lawn ring with its path are what read from afar.
//   hokudai_poplar  ポプラ並木: the avenue of tall Lombardy poplars (planted 1912), two rows of
//                   slender 25–28 m columns along a gravel path, fenced off; a trunk felled by a
//                   storm lies beside it (the 2004 typhoon took many).

import { landmarkDef, type Lm } from '../common.ts';

export const LANDMARK_HOKUDAI_CLARK = landmarkDef({
  variant: 'hokudai_clark',
  size: { w: [32, 32], d: [32, 32] },
  eaves: 3,
  top: 21,
  kind: 'shed',
  build: clark,
});

export const LANDMARK_HOKUDAI_POPLAR = landmarkDef({
  variant: 'hokudai_poplar',
  size: { w: [96, 96], d: [18, 18] },
  eaves: 3,
  top: 28,
  kind: 'shed',
  build: poplar,
});

/** A broad elm: trunk, a crown spreading like an umbrella (wider up, then rounded off); the crown does not stop bullets. */
function elm(L: Lm, x: number, z: number, h: number): void {
  const r = Math.min(Math.min(x, z, L.w - x, L.d - z) + 0.5, h * 0.42);
  L.column(x, z, 0.55, 0, h * 0.4, 'paint', { paint: 'brown' });
  L.column(x, z, r * 0.5, h * 0.32, h * 0.66, 'paint', { paint: 'green', taper: 2, solid: false });
  L.column(x, z, r, h * 0.66, h, 'paint', { paint: 'green', taper: 0.45, solid: false });
}

function clark(L: Lm): void {
  const c = 16;
  L.ground('grass', [[0, 0], [32, 0], [32, 32], [0, 32]]);
  // The ring path round the bust and the path in from the front.
  L.ring(c, c, 5.2, 0, 0.06, 1.6, 12, 'paint', { paint: 'stone', solid: false });
  L.box(c - 0.8, 0, c + 6, c + 0.8, 0.06, 32, 'paint', { paint: 'stone', solid: false });
  // The pedestal (dark granite, a plinth and a shaft) and the bust (bronze, facing the front).
  L.box(c - 1.1, 0, c - 1.1, c + 1.1, 0.45, c + 1.1, 'paint', { paint: 'gray' });
  L.box(c - 0.65, 0.45, c - 0.65, c + 0.65, 2.0, c + 0.65, 'paint', { paint: 'charcoal' });
  L.box(c - 0.75, 2.0, c - 0.75, c + 0.75, 2.15, c + 0.75, 'paint', { paint: 'charcoal' });
  L.box(c - 0.45, 2.15, c - 0.25, c + 0.45, 2.7, c + 0.25, 'paint', { paint: 'brown' }); // shoulders
  L.column(c, c + 0.02, 0.16, 2.7, 3.0, 'paint', { paint: 'brown' }); // head
  L.box(c - 0.1, 2.58, c + 0.1, c + 0.1, 2.85, c + 0.24, 'paint', { paint: 'brown', solid: false }); // beard
  L.box(c + 1.4, 0, c + 1.6, c + 2.4, 0.9, c + 1.7, 'paint', { paint: 'charcoal' }); // the plaque (BOYS, BE AMBITIOUS)
  // The elms round the lawn.
  elm(L, 6.5, 7, 20);
  elm(L, 25.5, 7.5, 18);
  elm(L, 7, 24.5, 17);
  elm(L, 25.5, 24, 21);
  // 90 days on: a fallen campus sign and relief crates by the path.
  L.fallenSign(22, 29, 'x');
  L.crates(8, 15, 3);
}

function poplar(L: Lm): void {
  const [w, d] = [96, 18];
  L.ground('grass', [[0, 0], [w, 0], [w, d], [0, d]]);
  L.ground('gravel', [[0, 7.2], [w, 7.2], [w, 10.8], [0, 10.8]]);
  // Two rows of Lombardy poplars every 7.5 m (a gap where one fell).
  let i = 0;
  for (let x = 4; x < w - 2; x += 7.5, i++) {
    for (const [z, s] of [[4.6, 0], [13.4, 1]] as const) {
      if ((i === 6 && s === 0) || (i === 9 && s === 1)) continue;
      const h = 24 + ((i * 7 + s * 3) % 5);
      L.column(x, z, 0.4, 0, 3, 'paint', { paint: 'brown' });
      L.column(x, z, 2.2, 2.6, h * 0.7, 'paint', { paint: 'poplar', taper: 0.8, solid: false });
      L.column(x, z, 1.76, h * 0.7, h, 'paint', { paint: 'poplar', taper: 0.12, solid: false });
    }
  }
  // The fallen trunk beside the path, its broken stump.
  L.column(4 + 7.5 * 6, 4.6, 0.45, 0, 1.6, 'paint', { paint: 'brown' });
  L.bar(4 + 7.5 * 6 + 1, 2.4, 4 + 7.5 * 6 + 21, 1.0, 0, 0.8, 0.8, 'paint', { paint: 'brown' });
  // The low rope fence along both sides of the path (the avenue is closed to walkers).
  for (const z of [6.4, 11.6]) {
    L.box(0, 0.6, z - 0.03, w, 0.66, z + 0.03, 'woodDark', { solid: false });
    for (let x = 2; x < w; x += 6) L.box(x - 0.06, 0, z - 0.06, x + 0.06, 0.8, z + 0.06, 'woodDark');
  }
  // 90 days on: a fallen information board at the entrance, a tent pitched at the far end.
  L.fallenSign(3, 9, 'z');
  L.tent(w - 8, 9, 'x', 5);
}
