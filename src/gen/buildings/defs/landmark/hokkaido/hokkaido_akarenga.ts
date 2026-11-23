// L1: 北海道庁旧本庁舎 — 赤れんが庁舎 (the former Hokkaido Government Office, 1888). A two-storey
// neo-baroque block of red brick (about 2.5 million bricks), 61 m across, on a granite base, with
// white stone bands and tall sash windows; a dark slate roof with dormers and chimneys; the three
// pavilions of the front (the middle one with the entrance and a pediment) and, over the middle of
// the roof, the octagonal tower with its viewing balcony (about 20 m) and dome (33 m to the top).
// The front (local z = d) faces east down the ginkgo avenue of 北三条通.

import { landmarkDef, type Lm } from '../common.ts';

const W = 62;
const D = 44;

export const LANDMARK_HOKKAIDO_AKARENGA = landmarkDef({
  variant: 'hokkaido_akarenga',
  size: { w: [W, W], d: [D, D] },
  eaves: 13,
  top: 33,
  roof: 'hip',
  kind: 'office',
  build,
});

function build(L: Lm): void {
  const brick = { paint: 'brickRed' as const };
  const stone = { paint: 'stone' as const };
  const slate = { paint: 'slateBlue' as const };
  const [x0, x1, z0, z1] = [1, 61, 4, 34];
  const E = 13;
  L.box(x0 - 0.3, 0, z0 - 0.3, x1 + 0.3, 1.3, z1 + 0.3, 'paint', { paint: 'gray' }); // granite base
  L.box(x0, 1.3, z0, x1, E, z1, 'paint', brick);
  // White stone bands: between the storeys and under the cornice.
  for (const [y, t] of [[6.6, 0.35], [E - 0.6, 0.6]] as const) L.box(x0 - 0.15, y, z0 - 0.15, x1 + 0.15, y + t, z1 + 0.15, 'paint', { ...stone, solid: false });
  // The front pavilions (the middle with the entrance), each with a pediment.
  const pav = (a: number, b: number, h: number, depth: number): void => {
    L.box(a, 0, z1, b, 1.3, z1 + depth + 0.3, 'paint', { paint: 'gray' });
    L.box(a, 1.3, z1, b, h, z1 + depth, 'paint', brick);
    L.box(a - 0.15, h - 0.6, z1, b + 0.15, h, z1 + depth + 0.15, 'paint', stone);
    L.shape('gable', a - 0.2, h, z1 - 2, b + 0.2, h + 3.2, z1 + depth + 0.2, 'paint', { ...slate, axis: 'z' });
    L.shape('gable', a + 0.3, h, z1 + depth, b - 0.3, h + 2.8, z1 + depth + 0.25, 'paint', { ...stone, axis: 'z', solid: false });
  };
  pav(25, 37, 15, 3);
  pav(x0, 9, 14, 2);
  pav(53, x1, 14, 2);
  // Windows: two storeys of tall sashes all round (dark panes, a white sill band per row).
  const rows: [number, number][] = [[2.6, 5.6], [7.9, 11.4]];
  for (const [y0, y1] of rows) {
    L.windows('x', z1, 1, 10, 24, 5, y0, y1, 1.3, { broken: 0.35 });
    L.windows('x', z1, 1, 38, 52, 5, y0, y1, 1.3, { broken: 0.35 });
    L.windows('x', z1 + 3, 1, 26.5, 35.5, 3, y0, y1, 1.3, { broken: 0.3 });
    L.windows('x', z1 + 2, 1, 2.5, 7.5, 2, y0, y1, 1.3, { broken: 0.3 });
    L.windows('x', z1 + 2, 1, 54.5, 59.5, 2, y0, y1, 1.3, { broken: 0.3 });
    L.windows('x', z0, -1, x0 + 2, x1 - 2, 15, y0, y1, 1.3, { broken: 0.4 });
    L.windows('z', x0, -1, z0 + 2, z1 - 2, 7, y0, y1, 1.3, { broken: 0.4 });
    L.windows('z', x1, 1, z0 + 2, z1 - 2, 7, y0, y1, 1.3, { broken: 0.4 });
  }
  // The shut entrance and its steps.
  L.box(29.5, 1.3, z1 + 3, 32.5, 5.2, z1 + 3.12, 'paint', { paint: 'brown' });
  L.box(27, 0, z1 + 3.3, 35, 0.9, z1 + 5, 'paint', { paint: 'gray' });

  // The slate roof (a low hip), its dormers and chimneys.
  L.shape('hip', x0 - 0.5, E, z0 - 0.5, x1 + 0.5, 19, z1 + 0.5, 'paint', { ...slate, axis: 'x' });
  for (const x of [14, 22, 40, 48]) {
    for (const [za, zb] of [[z1 - 1.5, z1 + 0.6], [z0 - 0.6, z0 + 1.5]] as const) {
      L.box(x - 1.1, E, za, x + 1.1, E + 2.6, zb, 'paint', { paint: 'offWhite' });
      L.shape('gable', x - 1.4, E + 2.6, za - 0.2, x + 1.4, E + 3.8, zb + 0.2, 'paint', { ...slate, axis: 'z' });
    }
  }
  for (const [x, z] of [[8, 12], [8, 26], [54, 12], [54, 26], [20, 19], [42, 19]] as const) L.box(x - 0.6, E + 2, z - 0.6, x + 0.6, 20.5, z + 0.6, 'paint', brick);

  // The octagonal tower: a square brick base out of the roof, the balcony, the drum, the dome, the lantern.
  const cx = W / 2;
  const cz = (z0 + z1) / 2;
  L.box(cx - 3.4, E, cz - 3.4, cx + 3.4, 20, cz + 3.4, 'paint', brick);
  L.box(cx - 4.4, 20, cz - 4.4, cx + 4.4, 20.4, cz + 4.4, 'paint', stone);
  L.ring(cx, cz, 4.2, 20.4, 21.4, 0.12, 8, 'paint', { paint: 'white', solid: false }); // the balcony's rail
  L.column(cx, cz, 3.2, 20.4, 25.6, 'paint', slate);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = cx + Math.cos(a) * 3.22;
    const z = cz + Math.sin(a) * 3.22;
    L.bar(x - Math.sin(a) * 0.55, z + Math.cos(a) * 0.55, x + Math.sin(a) * 0.55, z - Math.cos(a) * 0.55, 21.6, 24.4, 0.1, 'paint', { paint: 'white', solid: false });
  }
  L.column(cx, cz, 3.4, 25.6, 26, 'paint', { paint: 'white' });
  L.column(cx, cz, 3.3, 26, 28.6, 'paint', { ...slate, taper: 0.45 });
  L.column(cx, cz, 1.1, 28.6, 30.6, 'paint', { paint: 'white' });
  L.column(cx, cz, 1.2, 30.6, 31.4, 'paint', { ...slate, taper: 0.3 });
  L.column(cx, cz, 0.08, 31.4, 33, 'steel');

  // 90 days on: an evacuation tent, sandbags and relief crates on the front lawn.
  L.tent(12, 40, 'x', 7);
  L.sandbags(24, 41.5, 30, 41.5);
  L.crates(46, 40, 4);
  L.scorch(x1 - 6, 1.5, z1, x1 - 1, 9, z1 + 0.06);
}
