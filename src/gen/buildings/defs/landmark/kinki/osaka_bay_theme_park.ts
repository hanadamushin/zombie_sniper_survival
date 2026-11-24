// L5: 湾岸のテーマパークの廃墟 (Osaka) — the ruin of a theme park on the reclaimed shore of Osaka Bay.
// Generic and nameless, as the Tokyo Bay one (L3b) and on purpose unlike it (the client's rule: no
// park's name, logo, characters or the shape of any particular ride): a broad steel arch over the
// entrance with its ticket booths, a street of city façades (four-storey fronts in brick and paint),
// a lagoon with a lighthouse and a wooden ship run aground, a drop tower with its ring of seats stuck
// half way, the green rails of a coaster with a vertical loop (one span fallen), 90 days after the fall.
// No castle and no big wheel (the Tokyo one has them).
//
// Its real ground is about a kilometre across; here the pieces stand close together on one lot. The
// front (local z = d, the arch) faces east (towards the station).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { slant, xyLine } from '../kanto/parts.ts';

const W = 136;
const D = 120;

export const LANDMARK_OSAKA_BAY_THEME_PARK = landmarkDef({
  variant: 'osaka_bay_theme_park',
  size: { w: [W, W], d: [D, D] },
  eaves: 18,
  top: 72,
  kind: 'office',
  build,
});

/** A street front: a four-storey façade block with a cornice, rows of windows, a shopfront. */
function facade(L: Lm, x0: number, x1: number, z0: number, z1: number, h: number, paint: PaintName, face: 1 | -1): void {
  L.box(x0, 0, z0, x1, h, z1, 'paint', { paint });
  L.box(x0 - 0.3, h - 0.8, z0 - 0.3, x1 + 0.3, h, z1 + 0.3, 'paint', { paint: 'offWhite', solid: false });
  const at = face > 0 ? x1 : x0;
  const n = Math.max(2, Math.floor((z1 - z0) / 3));
  for (let y = 5; y < h - 2; y += 3.4) L.windows('z', at, face, z0 + 1, z1 - 1, n, y, y + 1.9, 1.1, { broken: 0.45 });
  L.box(face > 0 ? at : at - 0.1, 0.2, z0 + 1, face > 0 ? at + 0.1 : at, 3.4, z1 - 1, 'paint', { paint: 'windowDark', solid: false });
  L.box(face > 0 ? at : at - 1.6, 3.4, z0 + 0.6, face > 0 ? at + 1.6 : at, 3.8, z1 - 0.6, 'paint', { paint: 'red', solid: false });
}

/** The coaster: a closed course (plan point and rail height) on white supports, a vertical loop, one span down. */
function coaster(L: Lm): void {
  const rail: PaintName = 'green';
  const course: [number, number, number][] = [
    [8, 8, 4], [8, 60, 30], [10, 74, 26], [22, 78, 8], [36, 78, 6], [60, 78, 6], [74, 76, 14], [80, 64, 20], [80, 44, 12], [70, 30, 6], [40, 30, 6], [24, 20, 10], [12, 10, 6],
  ];
  for (let i = 0; i < course.length; i++) {
    const a = course[i]!;
    const b = course[(i + 1) % course.length]!;
    L.box(a[0] - 0.4, 0, a[1] - 0.4, a[0] + 0.4, Math.max(0.5, a[2] - 0.4), a[1] + 0.4, 'paint', { paint: 'white' });
    if (i === 8) continue; // the fallen span
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 3));
    slant(L, [a[0], a[2], a[1]], [b[0], b[2], b[1]], n, 1.3, rail);
  }
  // The vertical loop on the straight from (36, 78) to (60, 78): a circle in the x–y plane.
  const [lx, ly, lr] = [48, 18.5, 12];
  const k = 20;
  for (let i = 0; i < k; i++) {
    const a = -Math.PI / 2 + (i / k) * Math.PI * 2;
    const b = -Math.PI / 2 + ((i + 1) / k) * Math.PI * 2;
    xyLine(L, lx + Math.cos(a) * lr, ly + Math.sin(a) * lr, lx + Math.cos(b) * lr, ly + Math.sin(b) * lr, 77.3, 78.7, 1.3, rail, { step: 1.6 });
  }
  for (const s of [-1, 1]) L.box(lx + s * lr - 0.4, 0, 77.6, lx + s * lr + 0.4, ly, 78.4, 'paint', { paint: 'white' });
  // The fallen span on the ground, a car of the train tipped beside it.
  L.bar(78, 42, 70, 32, 0, 0.6, 1.3, 'paint', { paint: rail });
  L.box(72, 0, 40, 75, 1.4, 42, 'paint', { paint: 'yellow', yaw: 0.8 });
}

/** The drop tower: a square lattice mast, the ring of seats stuck half way, the machine house on top. */
function dropTower(L: Lm, x: number, z: number): void {
  const h = 4;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) L.box(x + sx * h - 0.5, 0, z + sz * h - 0.5, x + sx * h + 0.5, 66, z + sz * h + 0.5, 'paint', { paint: 'red' });
  for (let y = 6; y < 66; y += 6) {
    for (const s of [-1, 1]) {
      L.box(x - h, y, z + s * h - 0.2, x + h, y + 0.4, z + s * h + 0.2, 'paint', { paint: 'white', solid: false });
      L.box(x + s * h - 0.2, y, z - h, x + s * h + 0.2, y + 0.4, z + h, 'paint', { paint: 'white', solid: false });
    }
  }
  L.box(x - 5, 66, z - 5, x + 5, 72, z + 5, 'paint', { paint: 'white' });
  L.column(x, z, 8, 30, 32.5, 'paint', { paint: 'yellow', solid: false });
  L.column(x, z, 8.4, 0, 1, 'paint', { paint: 'gray' });
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The lagoon (west half of the back), its lighthouse on a stone pier and a ship run aground.
  L.ground('water', [[86, 4], [132, 4], [132, 52], [100, 60], [86, 52]], 2, 0.8);
  L.box(122, 0, 8, 130, 1.2, 16, 'paint', { paint: 'stone' });
  L.column(126, 12, 2.6, 1.2, 22, 'paint', { paint: 'white', taper: 0.7 });
  for (const y of [6, 12]) L.column(126, 12, 2.45 - y * 0.035, y, y + 2.5, 'paint', { paint: 'red', solid: false });
  L.column(126, 12, 1.7, 22, 25, 'paint', { paint: 'lampGlass', solid: false });
  L.column(126, 12, 2.1, 25, 27, 'paint', { paint: 'red', taper: 0.2, solid: false });
  // The ship: a dark hull listing, three masts, rags of sail.
  L.box(96, -0.6, 22, 104, 4, 46, 'woodDark', { yaw: 0.12 });
  L.box(97, 4, 40, 103, 7, 46, 'woodDark', { yaw: 0.12 });
  for (const [z, h] of [[27, 22], [34, 26], [41, 20]] as const) {
    L.column(100, z, 0.35, 4, h, 'woodDark', { solid: false });
    L.box(96.5, h - 9, z - 0.15, 103.5, h - 3, z + 0.15, 'paint', { paint: 'offWhite', solid: false });
  }

  coaster(L);
  dropTower(L, 112, 82);

  // The street of façades: two rows facing each other along the walk from the arch (z 90..118).
  const cols: PaintName[] = ['brickRed', 'offWhite', 'green', 'navy', 'yellow', 'brickBrown'];
  let c = 0;
  for (const [z0, z1] of [[86, 96], [97, 106], [107, 116]] as const) {
    facade(L, 44, 56, z0, z1, 14 + (c % 2) * 3, cols[c % cols.length]!, 1);
    c++;
    facade(L, 76, 88, z0, z1, 15 + (c % 2) * 2, cols[c % cols.length]!, -1);
    c++;
  }

  // The entrance arch over the walk: a steel half circle on two feet, the ticket booths, the grille shut.
  const [ax, ay, ar] = [66, 0, 18];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI;
    const b = ((i + 1) / 14) * Math.PI;
    xyLine(L, ax + Math.cos(a) * ar, ay + Math.sin(a) * ar, ax + Math.cos(b) * ar, ay + Math.sin(b) * ar, 117, 119, 1.4, 'silver', { step: 1.4 });
  }
  for (const s of [-1, 1]) L.box(ax + s * ar - 1, 0, 116.5, ax + s * ar + 1, 2, 119.5, 'paint', { paint: 'gray' });
  L.box(56, 0, 117.9, 76, 3.2, 118.1, 'steel');
  for (let i = 0; i < 4; i++) {
    const x = 24 + i * 6;
    L.box(x, 0, 114, x + 4, 3, 118, 'paint', { paint: i % 2 ? 'yellow' : 'skyBlue' });
    L.box(x - 0.3, 3, 113.7, x + 4.3, 3.5, 118.3, 'paint', { paint: 'red', solid: false });
  }

  // 90 days on: burnt cars on the forecourt, relief tents in the street, sandbags across it, crates.
  L.car(10, 112, 'x', { burnt: true });
  L.car(16, 104, 'x', { burnt: true });
  L.car(122, 112, 'z');
  L.tent(66, 96, 'z', 8);
  L.crates(62, 108, 6);
  L.sandbags(57, 84, 75, 84);
  L.fallenSign(36, 104, 'x');
  L.scorch(56.02, 0.4, 98, 56.12, 8, 104);
}
