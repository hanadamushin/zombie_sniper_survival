// L3b: 湾岸のテーマパークの廃墟 — the ruin of a theme park on the reclaimed shore of Tokyo Bay. Deliberately
// generic and nameless (the client's rule: no park's name, logo, characters or the shape of any
// particular ride): an entrance gate with ticket booths and its grille shut, a European-style castle
// of pale stone with red cone roofs, a big wheel, the rails of a roller coaster on their supports (one
// span fallen), a merry-go-round, 90 days after the fall.
//
// Its real ground is a few hundred metres across; here the pieces stand close together on one lot.
// The front (local z = d, the gate) faces south (towards the station).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { slant, wheel } from './parts.ts';

const W = 140;
const D = 124;

export const LANDMARK_BAY_THEME_PARK = landmarkDef({
  variant: 'bay_theme_park',
  size: { w: [W, W], d: [D, D] },
  eaves: 16,
  top: 57,
  kind: 'office',
  build,
});

/** A round tower with a red cone roof. */
function turret(L: Lm, x: number, z: number, r: number, h: number, cone: number): void {
  L.column(x, z, r, 0, h, 'paint', { paint: 'stone' });
  L.column(x, z, r + 0.3, h - 1, h, 'paint', { paint: 'offWhite', solid: false });
  L.column(x, z, r + 0.9, h, h + cone, 'paint', { paint: 'roofRed', taper: 0, solid: false });
}

function castle(L: Lm): void {
  const [x0, x1, z0, z1] = [56, 84, 30, 52];
  L.box(x0, 0, z0, x1, 16, z1, 'paint', { paint: 'stone' });
  L.box(x0 - 0.3, 15, z0 - 0.3, x1 + 0.3, 16.2, z1 + 0.3, 'paint', { paint: 'offWhite', solid: false });
  for (let x = x0 + 1; x < x1 - 1; x += 3) L.box(x, 16.2, z1 - 0.8, x + 1.5, 17.6, z1 + 0.3, 'paint', { paint: 'stone', solid: false });
  L.shape('hip', x0 + 1, 16, z0 + 1, x1 - 1, 21, z1 - 3, 'paint', { paint: 'roofRed', axis: 'x' });
  // The gateway (dark) and rows of tall windows.
  L.box(66.5, 0, z1, 73.5, 8, z1 + 0.12, 'paint', { paint: 'black', solid: false });
  L.windows('x', z1, 1, x0 + 2, x1 - 2, 7, 10, 13.5, 1.3, { paint: 'windowDark', broken: 0.4 });
  L.windows('x', z1, 1, x0 + 2, 64, 2, 3, 6.5, 1.3, { paint: 'windowDark', broken: 0.4 });
  L.windows('x', z1, 1, 76, x1 - 2, 2, 3, 6.5, 1.3, { paint: 'windowDark', broken: 0.4 });
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) turret(L, x, z, 3.6, 22, 8);
  // The keep and its spire, a slim turret beside it.
  L.box(64, 16, 36, 76, 31, 46, 'paint', { paint: 'offWhite' });
  L.windows('x', 46, 1, 65, 75, 3, 22, 27, 1.4, { paint: 'windowDark', broken: 0.5 });
  L.box(63.6, 30.4, 35.6, 76.4, 31.4, 46.4, 'paint', { paint: 'stone', solid: false });
  L.column(70, 41, 6.2, 31.4, 45, 'paint', { paint: 'roofRed', taper: 0, solid: false });
  L.column(78, 37, 2, 16, 34, 'paint', { paint: 'stone' });
  L.column(78, 37, 2.6, 34, 41, 'paint', { paint: 'roofRed', taper: 0, solid: false });
  L.column(70, 41, 0.15, 45, 48, 'steel', { solid: false });
}

/** The coaster: rails on supports along a closed course (plan point and rail height). One span is down. */
function coaster(L: Lm): void {
  const course: [number, number, number][] = [
    [102, 104, 5], [130, 104, 6], [134, 92, 8], [134, 70, 18], [134, 48, 28], [133, 26, 34], [126, 14, 30], [112, 12, 12],
    [102, 18, 5], [98, 34, 14], [100, 50, 20], [104, 64, 9], [116, 72, 16], [122, 84, 10], [112, 94, 7],
  ];
  const rail: PaintName = 'intlOrange';
  for (let i = 0; i < course.length; i++) {
    const a = course[i]!;
    const b = course[(i + 1) % course.length]!;
    // A support under every bend (steel, solid).
    L.box(a[0] - 0.4, 0, a[1] - 0.4, a[0] + 0.4, a[2] - 0.4, a[1] + 0.4, 'rust');
    if (a[2] > 15) L.box(a[0] - 2.2, a[2] * 0.45, a[1] - 0.25, a[0] + 2.2, a[2] * 0.45 + 0.4, a[1] + 0.25, 'rust', { solid: false });
    if (i === 10) continue; // the fallen span
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 3));
    slant(L, [a[0], a[2], a[1]], [b[0], b[2], b[1]], n, 1.4, rail);
  }
  // The fallen span on the ground, a car tipped beside it.
  L.bar(100, 50, 103, 63, 0, 0.6, 1.4, 'paint', { paint: rail });
  L.box(97, 0, 57, 100, 1.4, 59, 'paint', { paint: 'yellow', yaw: 0.6 });
}

/** A merry-go-round: its platform, posts, the striped cone roof. */
function carousel(L: Lm, x: number, z: number): void {
  L.column(x, z, 7, 0, 0.8, 'paint', { paint: 'offWhite' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    L.box(x + Math.cos(a) * 6.2 - 0.12, 0.8, z + Math.sin(a) * 6.2 - 0.12, x + Math.cos(a) * 6.2 + 0.12, 4.4, z + Math.sin(a) * 6.2 + 0.12, 'paint', { paint: 'gold', solid: false });
  }
  L.column(x, z, 1.2, 0.8, 4.4, 'paint', { paint: 'offWhite' });
  L.column(x, z, 7.6, 4.4, 5.4, 'paint', { paint: 'red', taper: 0.85, solid: false });
  L.column(x, z, 6.5, 5.4, 8.4, 'paint', { paint: 'white', taper: 0.25, solid: false });
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  castle(L);
  coaster(L);
  carousel(L, 44, 84);

  // The big wheel on its A-frames over a small station.
  const [cx, cy, cz, r] = [26, 32, 40, 23.8];
  L.box(cx - 8, 0, cz - 5, cx + 8, 3.5, cz + 5, 'paint', { paint: 'offWhite' });
  for (const s of [-1, 1]) for (const sx of [-1, 1]) slant(L, [cx + sx * 12, 0, cz + s * 7], [cx + sx * 0.8, cy, cz + s * 2], 10, 1, 'white', true);
  wheel(L, cx, cy, cz, r, 2.4, { rim: 'white', spoke: 'silver', cars: ['red', 'yellow', 'skyBlue', 'green'], spokes: 8, cars_n: 24, sides: 32, hub: 2.4, hubPaint: 'gold' });

  // The entrance gate: two towers, the arch between, ticket booths, the grille shut.
  for (const x0 of [38, 94]) {
    L.box(x0, 0, 108, x0 + 8, 14, 118, 'paint', { paint: 'offWhite' });
    L.column(x0 + 4, 113, 5, 14, 19, 'paint', { paint: 'skyBlue', taper: 0, solid: false });
  }
  L.box(46, 9, 110, 94, 12.5, 116, 'paint', { paint: 'offWhite' });
  L.box(46, 12.5, 110.5, 94, 13, 115.5, 'paint', { paint: 'gold', solid: false });
  L.box(46, 0, 112.9, 94, 5, 113.1, 'steel');
  for (let i = 0; i < 5; i++) {
    const x = 50 + i * 9;
    L.box(x, 0, 116, x + 4, 3, 119, 'paint', { paint: i % 2 ? 'sakura' : 'skyBlue' });
    L.shape('gable', x - 0.3, 3, 115.7, x + 4.3, 4.2, 119.3, 'paint', { paint: 'white', axis: 'x', solid: false });
  }

  // 90 days on: burnt cars and a bus on the forecourt, relief tents inside the gate, sandbags, crates.
  L.car(14, 116, 'x', { burnt: true });
  L.car(22, 120, 'x');
  L.box(110, 0.3, 116, 121, 3.2, 118.6, 'paint', { paint: 'charcoal' });
  L.tent(60, 96, 'x', 8);
  L.tent(80, 96, 'x', 8);
  L.crates(70, 100, 6);
  L.sandbags(46, 106, 94, 106);
  L.fallenSign(30, 104, 'x');
  L.scorch(58, 0.4, 52.05, 64, 9, 52.2);
}
