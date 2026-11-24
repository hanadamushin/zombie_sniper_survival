// L5: 東大寺 大仏殿 (the Great Buddha Hall of Tōdai-ji, rebuilt 1709), Nara. The largest wooden building
// of its kind: 57 m wide, 50 m deep, 49.1 m high. A two-storey look — the skirt roof (裳階) all round,
// curving up into the great curved gable (唐破風) over the doors in the middle of the front, the
// window for the Buddha's face (観相窓) above it — under one huge hipped roof of grey tiles with the gold
// horn-shaped ridge ends (鴟尾). White walls between dark timbers, on a stone platform. Before it the
// bronze octagonal lantern (八角燈籠); the corridor (回廊) and the middle gate (中門) close the courtyard
// in front. Deer of Nara Park wander in.
//
// The courtyard is shortened (the real one is about 100 m deep); the hall is real size. The front
// (local z = d, the middle gate) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { karahafu } from '../chubu/parts.ts';
import { deer } from './parts.ts';

const W = 80;
const D = 100;
const CX = 40;
/** The hall: half width, back and front faces (z). */
const HW = 28.5;
const Z0 = 6;
const Z1 = 56;
const TILE: PaintName = 'kawara';
const TIMBER: PaintName = 'brown';
const RED: PaintName = 'brickRed';

export const LANDMARK_TODAIJI_DAIBUTSUDEN = landmarkDef({
  variant: 'todaiji_daibutsuden',
  size: { w: [W, W], d: [D, D] },
  eaves: 26.5,
  top: 49.1,
  roof: 'hip',
  kind: 'house',
  build,
});

/** Dark timber posts and a beam on a white wall face, from u0 to u1 (x or z), y0..y1. */
function timbers(L: Lm, face: 'x' | 'z', at: number, out: 1 | -1, u0: number, u1: number, n: number, y0: number, y1: number): void {
  const c0 = out > 0 ? at : at - 0.2;
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    if (face === 'x') L.box(u - 0.45, y0, c0, u + 0.45, y1, c0 + 0.2, 'paint', { paint: TIMBER, solid: false });
    else L.box(c0, y0, u - 0.45, c0 + 0.2, y1, u + 0.45, 'paint', { paint: TIMBER, solid: false });
  }
  if (face === 'x') L.box(u0, y1 - 1.6, c0, u1, y1, c0 + 0.2, 'paint', { paint: TIMBER, solid: false });
  else L.box(c0, y1 - 1.6, u0, c0 + 0.2, y1, u1, 'paint', { paint: TIMBER, solid: false });
}

/** A run of the corridor (回廊): vermilion posts in front of a white wall, a tiled gable roof. */
function corridor(L: Lm, x0: number, z0: number, x1: number, z1: number): void {
  const along = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  L.box(x0, 0, z0, x1, 4.6, z1, 'paint', { paint: 'white' });
  if (along === 'x') timbers(L, 'x', z1, 1, x0 + 0.5, x1 - 0.5, Math.round((x1 - x0) / 4), 0, 4.6);
  else timbers(L, 'z', x1, 1, z0 + 0.5, z1 - 0.5, Math.round((z1 - z0) / 4), 0, 4.6);
  L.shape('gable', x0 - 0.6, 4.6, z0 - 0.6, x1 + 0.6, 7, z1 + 0.6, 'paint', { paint: TILE, axis: along });
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[CX - 3, Z1], [CX + 3, Z1], [CX + 3, D], [CX - 3, D]]);

  // The stone platform, the lower storey (white walls between dark timbers), the great doors.
  L.box(CX - HW - 3, 0, Z0 - 3, CX + HW + 3, 1.8, Z1 + 3, 'paint', { paint: 'stone' });
  L.box(CX - HW, 1.8, Z0, CX + HW, 11, Z1, 'paint', { paint: 'white' });
  timbers(L, 'x', Z1, 1, CX - HW, CX + HW, 11, 1.8, 11);
  timbers(L, 'x', Z0, -1, CX - HW, CX + HW, 11, 1.8, 11);
  timbers(L, 'z', CX - HW, -1, Z0, Z1, 10, 1.8, 11);
  timbers(L, 'z', CX + HW, 1, Z0, Z1, 10, 1.8, 11);
  L.box(CX - 4, 1.8, Z1 + 0.18, CX + 4, 9, Z1 + 0.3, 'paint', { paint: RED, solid: false });
  L.box(CX - 3.4, 2.2, Z1 + 0.3, CX + 3.4, 8.6, Z1 + 0.36, 'paint', { paint: 'charcoal', solid: false });
  // The skirt roof (裳階) and its curved gable over the doors.
  L.box(CX - HW - 3.6, 10.8, Z0 - 3.6, CX + HW + 3.6, 11.2, Z1 + 3.6, 'paint', { paint: TILE, solid: false });
  L.shape('hip', CX - HW - 3.6, 11.2, Z0 - 3.6, CX + HW + 3.6, 17, Z1 + 3.6, 'paint', { paint: TILE, axis: 'x' });
  karahafu(L, 'z+', Z1, CX, 7.5, 11, 18.4, 3.6, TILE, 'gold');

  // The upper storey: set back, white between timbers, the window for the Buddha's face.
  const [ux, uz0, uz1] = [HW - 4.5, Z0 + 4.5, Z1 - 4.5];
  const U = 26.5;
  L.box(CX - ux, 15, uz0, CX + ux, U, uz1, 'paint', { paint: 'white' });
  timbers(L, 'x', uz1, 1, CX - ux, CX + ux, 9, 15, U);
  timbers(L, 'x', uz0, -1, CX - ux, CX + ux, 9, 15, U);
  timbers(L, 'z', CX - ux, -1, uz0, uz1, 8, 15, U);
  timbers(L, 'z', CX + ux, 1, uz0, uz1, 8, 15, U);
  L.box(CX - 4.5, 18.4, uz1 + 0.2, CX + 4.5, 23.6, uz1 + 0.32, 'paint', { paint: RED, solid: false });
  L.box(CX - 3.8, 18.9, uz1 + 0.32, CX + 3.8, 23.1, uz1 + 0.38, 'paint', { paint: 'offWhite', solid: false });
  // The bracket band under the eaves, then the great hipped roof: a broad lower slope and a steeper top
  // with the long ridge, the gold ridge ends.
  L.box(CX - ux - 1, U - 1.6, uz0 - 1, CX + ux + 1, U + 0.4, uz1 + 1, 'paint', { paint: TIMBER, solid: false });
  L.box(CX - ux - 6, U, uz0 - 6, CX + ux + 6, U + 0.6, uz1 + 6, 'paint', { paint: TILE, solid: false });
  L.shape('hip', CX - ux - 6, U + 0.6, uz0 - 6, CX + ux + 6, 41, uz1 + 6, 'paint', { paint: TILE, axis: 'x' });
  const [rx, rz] = [ux - 2, 8.5];
  const mz = (Z0 + Z1) / 2;
  L.shape('hip', CX - rx, 38.5, mz - rz, CX + rx, 45.8, mz + rz, 'paint', { paint: TILE, axis: 'x' });
  const ridge = rx - rz;
  L.box(CX - ridge, 45.4, mz - 0.7, CX + ridge, 46.2, mz + 0.7, 'paint', { paint: 'charcoal', solid: false });
  for (const s of [-1, 1]) {
    const x = CX + s * ridge;
    L.box(x - 0.9, 45.8, mz - 0.6, x + 0.9, 47.8, mz + 0.6, 'paint', { paint: 'gold', solid: false });
    L.box(Math.min(x, x - s * 1.8), 47.8, mz - 0.45, Math.max(x, x - s * 1.8) + 0, 49.1, mz + 0.45, 'paint', { paint: 'gold', solid: false });
  }

  // The bronze octagonal lantern before the hall.
  L.box(CX - 1.4, 0, 70.6, CX + 1.4, 0.8, 73.4, 'paint', { paint: 'stone' });
  L.column(CX, 72, 0.4, 0.8, 2.2, 'paint', { paint: 'bronze' });
  L.column(CX, 72, 1, 2.2, 3.6, 'paint', { paint: 'bronze', solid: false });
  L.column(CX, 72, 1.5, 3.6, 4.3, 'paint', { paint: 'bronze', taper: 0.25, solid: false });
  L.column(CX, 72, 0.25, 4.3, 4.7, 'paint', { paint: 'bronze', solid: false });

  // The corridor on both sides and across the front, the middle gate (two storeys) in it.
  corridor(L, 0.5, 30, 4.5, 96);
  corridor(L, W - 4.5, 30, W - 0.5, 96);
  corridor(L, 4.5, 92, CX - 9, 96);
  corridor(L, CX + 9, 92, W - 4.5, 96);
  const [gz0, gz1] = [90, 98];
  for (const [a, b] of [[CX - 9, CX - 3], [CX + 3, CX + 9]] as const) L.box(a, 0, gz0, b, 7, gz1, 'paint', { paint: RED });
  L.box(CX - 9, 6, gz0, CX + 9, 7.5, gz1, 'paint', { paint: RED });
  L.shape('hip', CX - 11, 7.5, gz0 - 1.8, CX + 11, 9.5, gz1 + 1.8, 'paint', { paint: TILE, axis: 'x' });
  L.box(CX - 8, 9, gz0 + 0.8, CX + 8, 13, gz1 - 0.8, 'paint', { paint: 'white' });
  timbers(L, 'x', gz1 - 0.8, 1, CX - 8, CX + 8, 4, 9, 13);
  L.shape('hip', CX - 11, 13, gz0 - 1.8, CX + 11, 15.6, gz1 + 1.8, 'paint', { paint: TILE, axis: 'x' });
  L.shape('gable', CX - 6, 14.8, gz0 - 0.4, CX + 6, 17.6, gz1 + 0.4, 'paint', { paint: TILE, axis: 'x' });

  // Deer in the courtyard.
  deer(L, 20, 70, 'x', 1);
  deer(L, 24, 76, 'z', -1);
  deer(L, 58, 74, 'x', -1);

  // 90 days on: relief tents in the courtyard, crates, a fallen sign by the lantern.
  L.tent(16, 82, 'x', 8);
  L.tent(64, 82, 'x', 8);
  L.crates(56, 64, 4);
  L.fallenSign(CX + 5, 76, 'x');
}
