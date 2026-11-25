// L7: shapes shared by the shikoku landmarks: a castle's long single-storey turret (渡櫓・多聞櫓), a small
// corner turret (隅櫓) of two or three tiers, a railed balcony round a keep's top storey (廻縁高欄), a
// flight of stone steps, a bridge rail with its onion-capped posts (擬宝珠). Built from the common kit
// (../common.ts) and the shapes of the other regions; nothing here is a landmark of its own.

import type { PaintName } from '../../../../../data/render.ts';
import type { Lm } from '../common.ts';
import { blackTier, type BlackTierStyle } from '../chubu/parts.ts';
import { keepTop } from '../chugoku/parts.ts';

/**
 * A long single-storey turret (渡櫓) from (x0, z0) to (x1, z1) (an axis-aligned rectangle) standing
 * at y0, `h` high: black boards below and white plaster under the eaves (`white` its share, 1 for an
 * all-white wall), a few windows, a gabled grey tiled roof along its long side.
 */
export function watari(L: Lm, x0: number, z0: number, x1: number, z1: number, y0: number, h: number, white = 0.4, roof: PaintName = 'kawara'): void {
  const along = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  const yw = y0 + h * (1 - white);
  if (white < 1) L.box(x0, y0, z0, x1, yw, z1, 'paint', { paint: 'black' });
  L.box(x0, yw, z0, x1, y0 + h, z1, 'paint', { paint: 'white' });
  const n = Math.max(1, Math.round(Math.max(x1 - x0, z1 - z0) / 4));
  const [wy0, wy1] = [y0 + h * 0.35, y0 + h * 0.65];
  const o = { paint: 'charcoal' as PaintName, broken: 0.3 };
  if (along === 'x') {
    L.windows('x', z1, 1, x0 + 1, x1 - 1, n, wy0, wy1, 0.8, o);
    L.windows('x', z0, -1, x0 + 1, x1 - 1, n, wy0, wy1, 0.8, o);
  } else {
    L.windows('z', x1, 1, z0 + 1, z1 - 1, n, wy0, wy1, 0.8, o);
    L.windows('z', x0, -1, z0 + 1, z1 - 1, n, wy0, wy1, 0.8, o);
  }
  const over = 0.9;
  const rise = Math.min(x1 - x0, z1 - z0) * 0.42 + 0.6;
  L.box(x0 - over, y0 + h - 0.2, z0 - over, x1 + over, y0 + h, z1 + over, 'paint', { paint: 'white', solid: false });
  L.shape('gable', x0 - over, y0 + h, z0 - over, x1 + over, y0 + h + rise, z1 + over, 'paint', { paint: roof, axis: along });
}

/**
 * A corner turret (隅櫓) of `tiers` tiers round (cx, cz), its first storey half sizes hx / hz, from y0:
 * the black-boarded tiers (`white` 1: all white plaster), each smaller, the top roof (入母屋) with its
 * dark ridge ornaments. Returns the height of its ridge ornaments.
 */
export function turret(L: Lm, cx: number, cz: number, hx: number, hz: number, y0: number, tiers: number, h: number, white = 0.45, roof: PaintName = 'kawara'): number {
  const s: BlackTierStyle = { roof, over: 1.2, rise: 1.6, wx: 2, wz: 2, white, broken: 0.3 };
  let y = y0;
  let [ax, az] = [hx, hz];
  for (let i = 0; i < tiers; i++) {
    const last = i === tiers - 1;
    y = blackTier(L, cx, cz, ax, az, y, i === 0 ? h : h * 0.78, { ...s, rise: last ? 0 : s.rise, wx: ax > 3 ? 3 : 2, white: last ? Math.max(white, 0.6) : white });
    if (!last) [ax, az] = [ax * 0.78, az * 0.78];
  }
  return keepTop(L, cx, cz, ax, az, y, 1.2, Math.max(2.2, Math.min(ax, az) * 0.9), roof, 'white', 'charcoal');
}

/**
 * A railed balcony (廻縁・高欄) round a keep's top storey of half sizes hx / hz at the floor height y:
 * the dark floor reaching `out` past the wall and a low black rail round its edge. Drawn only.
 */
export function balcony(L: Lm, cx: number, cz: number, hx: number, hz: number, y: number, out: number, paint: PaintName = 'black'): void {
  const [ex, ez] = [hx + out, hz + out];
  L.box(cx - ex, y - 0.3, cz - ez, cx + ex, y, cz + ez, 'paint', { paint, solid: false });
  for (const s of [-1, 1]) {
    L.box(cx - ex, y, cz + s * ez - 0.07, cx + ex, y + 0.95, cz + s * ez + 0.07, 'paint', { paint, solid: false });
    L.box(cx + s * ex - 0.07, y, cz - ez, cx + s * ex + 0.07, y + 0.95, cz + ez, 'paint', { paint, solid: false });
  }
}

/**
 * A flight of stone steps climbing towards -z (the front of a terrace at the lot's front side): from
 * the foot at z = zFoot, height y0, `n` steps of `rise` each `run` deep, across x0..x1. Solid (people
 * climb it; keep `rise` under TACTICAL.player.stepUp). Returns the z of its top edge.
 */
export function stepsUp(L: Lm, x0: number, x1: number, zFoot: number, y0: number, n: number, rise: number, run: number, paint: PaintName = 'granite'): number {
  const zTop = zFoot - n * run;
  // Each step a slab from its front edge back to the top edge (the slabs below fill under it).
  for (let i = 0; i < n; i++) L.box(x0, y0 + i * rise, zTop, x1, y0 + (i + 1) * rise, zFoot - i * run, 'paint', { paint });
  return zTop;
}

/**
 * A bridge rail along x from xa to xb at z, following the deck's top `top(x)`: `n` rail pieces and
 * posts with onion caps (擬宝珠) at both ends and every `every` metres. Drawn only.
 */
export function bridgeRail(L: Lm, xa: number, xb: number, z: number, n: number, top: (x: number) => number, paint: PaintName, every = 0): void {
  for (let i = 0; i < n; i++) {
    const x0 = xa + ((xb - xa) * i) / n;
    const x1 = xa + ((xb - xa) * (i + 1)) / n;
    const y = top((x0 + x1) / 2);
    L.box(x0, y + 0.75, z - 0.09, x1, y + 0.95, z + 0.09, 'paint', { paint, solid: false });
    L.box(x0, y + 0.25, z - 0.06, x1, y + 0.35, z + 0.06, 'paint', { paint, solid: false });
  }
  const posts = [xa, xb];
  if (every > 0) for (let x = xa + every; x < xb - every * 0.5; x += every) posts.push(x);
  for (const x of posts) {
    const y = top(x);
    L.box(x - 0.14, y, z - 0.14, x + 0.14, y + 1.15, z + 0.14, 'paint', { paint, solid: false });
    L.column(x, z, 0.17, y + 1.15, y + 1.5, 'paint', { paint: 'bronze', taper: 0.15, solid: false });
  }
}
