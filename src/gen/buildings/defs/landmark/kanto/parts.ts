// L3a: shapes shared by the Tokyo landmarks: lines that lean (lattice members, cables, legs), round
// bodies of 24 sides, the collision of a big round body, trees. Built from the common kit
// (../common.ts); nothing here is a landmark of its own. L3b (the rest of Kanto) may use them too.

import type { PaintName } from '../../../../../data/render.ts';
import type { Lm } from '../common.ts';

export type P3 = readonly [number, number, number];

/**
 * A straight member from a to b (x, y, z) that leans, drawn as `n` short boxes in a staircase: each
 * step a bar (turned to the line's direction in plan) `thick` wide. Parts cannot tilt, so this is the
 * only way to draw a slanted leg, a diagonal brace or a cable; from 50 m on it reads as a line.
 * `paint` may be a function of the step's middle height (the bands of a painted tower).
 */
export function slant(L: Lm, a: P3, b: P3, n: number, thick: number, paint: PaintName | ((y: number) => PaintName), solid = false): void {
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const ax = a[0] + (b[0] - a[0]) * t0;
    const az = a[2] + (b[2] - a[2]) * t0;
    const bx = a[0] + (b[0] - a[0]) * t1;
    const bz = a[2] + (b[2] - a[2]) * t1;
    const y0 = a[1] + (b[1] - a[1]) * t0;
    const y1 = a[1] + (b[1] - a[1]) * t1;
    const [lo, hi] = y0 < y1 ? [y0, y1] : [y1, y0];
    // A thin line keeps some height on a flat stretch, and the steps overlap a little (no gaps).
    const top = Math.max(hi + 0.02, lo + thick);
    const c = typeof paint === 'function' ? paint((lo + hi) / 2) : paint;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < thick) {
      const [mx, mz] = [(ax + bx) / 2, (az + bz) / 2];
      L.box(mx - thick / 2, lo, mz - thick / 2, mx + thick / 2, top, mz + thick / 2, 'paint', { paint: c, solid });
    } else {
      // Lengthen each step by the thickness so that the corners of a staircase meet.
      const ex = ((bx - ax) / len) * (thick / 2);
      const ez = ((bz - az) / len) * (thick / 2);
      beam(L, ax - ex, az - ez, bx + ex, bz + ez, lo, top, thick, c, solid);
    }
  }
}

/** An angle folded into (-π/2, π/2] (a box is the same turned by π). */
const fold = (a: number): number => {
  let r = a;
  while (r > Math.PI / 2) r -= Math.PI;
  while (r <= -Math.PI / 2) r += Math.PI;
  return r;
};

/**
 * A straight member in plan from (ax, az) to (bx, bz) (a chord, a wall segment): as `bar`, but turned
 * by 45° at most (long along local x or z, whichever needs the smaller turn) and split in halves until
 * each piece's unturned box stays on the lot (the catalog checks a part's box before its turn).
 */
export function beam(L: Lm, ax: number, az: number, bx: number, bz: number, y0: number, y1: number, thick: number, paint: PaintName, solid = true): void {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const tx = fold(Math.atan2(-dz, dx));
  const tz = fold(Math.atan2(dx, dz));
  const alongX = Math.abs(tx) <= Math.abs(tz);
  const [hx, hz] = alongX ? [len / 2, thick / 2] : [thick / 2, len / 2];
  const m = 0.55;
  if (len > 2 && (cx - hx < -m || cx + hx > L.w + m || cz - hz < -m || cz + hz > L.d + m)) {
    beam(L, ax, az, cx, cz, y0, y1, thick, paint, solid);
    beam(L, cx, cz, bx, bz, y0, y1, thick, paint, solid);
    return;
  }
  const yaw = alongX ? tx : tz;
  L.box(cx - hx, y0, cz - hz, cx + hx, y1, cz + hz, 'paint', { paint, solid, yaw: Math.abs(yaw) < 1e-9 ? undefined : yaw });
}

/** A regular polygon's wall (`n` sides, apothem r to the wall's middle, a flat side facing +x), by beams. */
export function polyRing(L: Lm, cx: number, cz: number, r: number, y0: number, y1: number, thick: number, n: number, paint: PaintName, solid = true): void {
  const half = (r + thick / 2) * Math.tan(Math.PI / n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, z] = [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
    beam(L, x + Math.sin(a) * half, z - Math.cos(a) * half, x - Math.sin(a) * half, z + Math.cos(a) * half, y0, y1, thick, paint, solid);
  }
}

/** A round body (24 sides: two 12-sided prisms, one turned by 15°), radius r, `taper` at its top. */
export function round(L: Lm, cx: number, cz: number, r: number, y0: number, y1: number, paint: PaintName, o: { taper?: number; solid?: boolean } = {}): void {
  L.column(cx, cz, r, y0, y1, 'paint', { paint, taper: o.taper, solid: o.solid });
  L.column(cx, cz, r, y0, y1, 'paint', { paint, taper: o.taper, solid: false, yaw: Math.PI / 12 });
}

/**
 * The collision of a big round body: a 12-sided prism only stops at its inscribed square, which
 * leaves 30 m of a 100 m drum open. Hidden boxes (drawn nowhere, solid) fill the circle in `n` steps.
 */
export function roundSolid(L: Lm, cx: number, cz: number, r: number, y0: number, y1: number, n = 4): void {
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * (Math.PI / 2);
    const hx = r * Math.cos(a) * 0.97;
    const hz = r * Math.sin(a) * 0.97;
    L.box(cx - hx, y0, cz - hz, cx + hx, y1, cz + hz, 'paint', { paint: 'gray', hidden: true, solid: true });
  }
}

/** A broadleaf evergreen (the shrine forest, a campus): trunk and a round dark crown that bullets pass. */
export function broadleaf(L: Lm, x: number, z: number, h: number, r: number, paint: PaintName = 'green'): void {
  L.column(x, z, Math.max(0.3, r * 0.08), 0, h * 0.4, 'paint', { paint: 'brown' });
  L.column(x, z, r * 0.8, h * 0.18, h * 0.55, 'paint', { paint, taper: 1.25, solid: false });
  L.column(x, z, r, h * 0.52, h, 'paint', { paint, taper: 0.4, solid: false });
}

/** A ginkgo in late November (yellow): a straight trunk and a tall egg-shaped crown. */
export function ginkgo(L: Lm, x: number, z: number, h: number): void {
  L.column(x, z, 0.4, 0, h * 0.5, 'paint', { paint: 'brown' });
  L.column(x, z, h * 0.27, h * 0.22, h * 0.62, 'paint', { paint: 'ginkgo', taper: 0.75, solid: false });
  L.column(x, z, h * 0.21, h * 0.6, h, 'paint', { paint: 'ginkgo', taper: 0.12, solid: false });
}
