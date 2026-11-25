// L8: shapes shared by the kyushu landmarks: palms of the south (ビロウ, the Canary palms of the seaside),
// plumes of hot-spring steam (湯けむり), a deck or bridge that follows a curve along z, a straight
// floor-by-floor band of dark openings on a concrete block, a Ryūkyū red-tiled roof. Built from the
// common kit (../common.ts) and the shapes of the other regions; nothing here is a landmark of its own.

import type { PaintName } from '../../../../../data/render.ts';
import type { Lm } from '../common.ts';
import { slant } from '../kanto/parts.ts';

/**
 * A palm (a fan palm of Aoshima, a Canary palm of the seaside): a slim trunk (it stops bullets) and
 * `n` drooping fronds from its top (drawn only), and a dark knot where they meet.
 */
export function palm(L: Lm, x: number, z: number, h: number, n = 7, frond = 3.4): void {
  L.column(x, z, 0.28, 0, h, 'paint', { paint: 'brown', taper: 0.8 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const [ex, ez] = [x + Math.cos(a) * frond, z + Math.sin(a) * frond];
    const [mx, mz] = [x + Math.cos(a) * frond * 0.55, z + Math.sin(a) * frond * 0.55];
    slant(L, [x, h, z], [mx, h + 0.5, mz], 1, 0.5, 'green');
    slant(L, [mx, h + 0.5, mz], [ex, h - 1.1, ez], 1, 0.45, 'green');
  }
  L.column(x, z, 0.55, h - 0.5, h + 0.6, 'paint', { paint: 'cedar', taper: 0.6, solid: false });
}

/**
 * A plume of steam rising from (x, y0, z) to y0 + h: a slender column `r` across at its foot that
 * swells as it rises, then breaks into `n` rounded puffs, bigger and further apart upwards, drifting
 * downwind (+x by `lean` of the height, a little +z). Drawn only; a solid shape cannot be thin, so the
 * gaps between the puffs are what make it read as steam and not as a white post.
 */
export function steam(L: Lm, x: number, z: number, y0: number, h: number, r: number, lean = 0.12, n = 4): void {
  const col = h * 0.3;
  L.column(x, z, r, y0, y0 + col, 'paint', { paint: 'steam', taper: 1.5, solid: false });
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    const pr = r * (1.3 + 1.5 * t);
    const yc = y0 + col + (h - col) * (t - 0.5 / n) + pr * 0.1;
    const dx = lean * h * t * t + (i % 2 ? 0.4 : -0.4) * r;
    const dz = lean * h * t * 0.25;
    L.column(x + dx, z + dz, pr * 0.8, yc - pr * 0.42, yc, 'paint', { paint: 'steam', taper: 1.25, solid: false });
    L.column(x + dx, z + dz, pr, yc, yc + pr * 0.5, 'paint', { paint: 'steam', taper: 0.45, solid: false });
  }
}

/**
 * A deck (a bridge, a hump) along z from za to zb whose top follows `top(z)`: `n` level boxes `depth`
 * deep (down from the top), across x0..x1. As chugoku's `along`, turned. Solid by default.
 */
export function alongZ(L: Lm, za: number, zb: number, n: number, top: (z: number) => number, depth: number, x0: number, x1: number, paint: PaintName, solid = true): void {
  for (let i = 0; i < n; i++) {
    const z0 = za + ((zb - za) * i) / n;
    const z1 = za + ((zb - za) * (i + 1)) / n;
    const y = top((z0 + z1) / 2);
    L.box(x0, y - depth, Math.min(z0, z1), x1, y, Math.max(z0, z1), 'paint', { paint, solid });
  }
}

/**
 * A concrete block of flats or offices from (x0, z0) to (x1, z1), `floors` storeys of `fh` from y0:
 * the block and, on its two long faces, a dark band per floor (the openings: balconies and windows
 * long since without glass). `skip` floors at the top of one end have fallen in (a ruin): the block
 * is drawn there `skip` floors lower over a share `gone` of its length.
 */
export function flats(L: Lm, x0: number, z0: number, x1: number, z1: number, y0: number, floors: number, fh: number, paint: PaintName, o: { skip?: number; gone?: number; band?: PaintName } = {}): void {
  const alongX = x1 - x0 >= z1 - z0;
  const skip = o.skip ?? 0;
  const gone = skip > 0 ? o.gone ?? 0.3 : 0;
  const top = y0 + floors * fh;
  const low = top - skip * fh;
  const band = o.band ?? 'windowDark';
  if (alongX) {
    const xs = x1 - (x1 - x0) * gone;
    L.box(x0, y0, z0, xs, top, z1, 'paint', { paint });
    if (gone > 0) L.box(xs, y0, z0, x1, low, z1, 'paint', { paint });
  } else {
    const zs = z1 - (z1 - z0) * gone;
    L.box(x0, y0, z0, x1, top, zs, 'paint', { paint });
    if (gone > 0) L.box(x0, y0, zs, x1, low, z1, 'paint', { paint });
  }
  for (let f = 0; f < floors; f++) {
    const ya = y0 + f * fh + fh * 0.3;
    const yb = y0 + f * fh + fh * 0.8;
    const ruinedHere = f >= floors - skip;
    for (const s of [-1, 1]) {
      if (alongX) {
        const z = s > 0 ? z1 : z0 - 0.08;
        const xe = ruinedHere ? x1 - (x1 - x0) * gone : x1;
        L.box(x0 + 0.6, ya, z, xe - 0.6, yb, z + 0.08, 'paint', { paint: band, solid: false });
      } else {
        const x = s > 0 ? x1 : x0 - 0.08;
        const ze = ruinedHere ? z1 - (z1 - z0) * gone : z1;
        L.box(x, ya, z0 + 0.6, x + 0.08, yb, ze - 0.6, 'paint', { paint: band, solid: false });
      }
    }
  }
}

/**
 * A Ryūkyū red-tiled hipped roof (赤瓦, the white mortar of the joints showing as a pale rim and ridge):
 * from the eaves at y over (x0, z0)–(x1, z1) to y + rise, ridge along the longer side.
 */
export function redRoof(L: Lm, x0: number, z0: number, x1: number, z1: number, y: number, rise: number, tile: PaintName = 'akagawara'): void {
  const axis = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  L.box(x0, y - 0.3, z0, x1, y, z1, 'paint', { paint: 'white', solid: false });
  L.shape('hip', x0, y, z0, x1, y + rise, z1, 'paint', { paint: tile, axis });
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const half = (axis === 'x' ? x1 - x0 - (z1 - z0) : z1 - z0 - (x1 - x0)) / 2;
  if (half > 0.5) {
    if (axis === 'x') L.box(cx - half, y + rise - 0.12, cz - 0.2, cx + half, y + rise + 0.18, cz + 0.2, 'paint', { paint: 'white', solid: false });
    else L.box(cx - 0.2, y + rise - 0.12, cz - half, cx + 0.2, y + rise + 0.18, cz + half, 'paint', { paint: 'white', solid: false });
  }
}
