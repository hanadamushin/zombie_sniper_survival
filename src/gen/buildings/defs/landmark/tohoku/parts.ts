// L2: shapes shared by the tohoku landmarks: the tiers of a castle keep (天守), its gables, trees,
// stone walls that lean back (石垣). Built from the common kit (../common.ts); nothing here is a
// landmark of its own.

import type { PaintName } from '../../../../../data/render.ts';
import type { Lm } from '../common.ts';

export interface TierStyle {
  wall: PaintName;
  roof: PaintName;
  /** How far the roof reaches past the wall, and how high it rises (m). */
  over: number;
  rise: number;
  /** Windows per face along x and along z (dark lattice), and the share of broken ones. */
  wx: number;
  wz: number;
  broken?: number;
}

/**
 * One tier (重) of a keep: its white walls from y0 to y0 + h round (cx, cz), half sizes hx / hz, a row
 * of lattice windows on each face, and the hipped roof skirt over it. The next tier stands from the
 * eaves (the returned height) inside the skirt, so the roof shows round it.
 */
export function tier(L: Lm, cx: number, cz: number, hx: number, hz: number, y0: number, h: number, s: TierStyle): number {
  const y1 = y0 + h;
  L.box(cx - hx, y0, cz - hz, cx + hx, y1, cz + hz, 'paint', { paint: s.wall });
  const wy0 = y0 + h * 0.38;
  const wy1 = y0 + h * 0.72;
  const o = { broken: s.broken ?? 0.2 };
  if (s.wx > 0) {
    L.windows('x', cz + hz, 1, cx - hx + 0.8, cx + hx - 0.8, s.wx, wy0, wy1, 0.9, o);
    L.windows('x', cz - hz, -1, cx - hx + 0.8, cx + hx - 0.8, s.wx, wy0, wy1, 0.9, o);
  }
  if (s.wz > 0) {
    L.windows('z', cx + hx, 1, cz - hz + 0.8, cz + hz - 0.8, s.wz, wy0, wy1, 0.9, o);
    L.windows('z', cx - hx, -1, cz - hz + 0.8, cz + hz - 0.8, s.wz, wy0, wy1, 0.9, o);
  }
  // The eaves' edge (a thin dark line under the tiles), then the skirt (none under the top roof: rise 0).
  if (s.rise <= 0) return y1;
  L.box(cx - hx - s.over, y1 - 0.25, cz - hz - s.over, cx + hx + s.over, y1, cz + hz + s.over, 'paint', { paint: s.roof, solid: false });
  L.shape('hip', cx - hx - s.over, y1, cz - hz - s.over, cx + hx + s.over, y1 + s.rise, cz + hz + s.over, 'paint', { paint: s.roof, axis: hx >= hz ? 'x' : 'z' });
  return y1;
}

/** The top roof of a keep (入母屋): a hip with a gable ridge on it, and the two ridge-end fish (鯱). */
export function topRoof(L: Lm, cx: number, cz: number, hx: number, hz: number, y: number, over: number, rise: number, roof: PaintName, fish: PaintName): number {
  const axis = hx >= hz ? 'x' : 'z';
  L.box(cx - hx - over, y - 0.25, cz - hz - over, cx + hx + over, y, cz + hz + over, 'paint', { paint: roof, solid: false });
  L.shape('hip', cx - hx - over, y, cz - hz - over, cx + hx + over, y + rise * 0.55, cz + hz + over, 'paint', { paint: roof, axis });
  const [gx, gz] = axis === 'x' ? [hx * 0.85, hz * 0.55] : [hx * 0.55, hz * 0.85];
  L.shape('gable', cx - gx, y + rise * 0.4, cz - gz, cx + gx, y + rise, cz + gz, 'paint', { paint: roof, axis });
  // The gable ends' white boards.
  const top = y + rise;
  for (const s of [-1, 1]) {
    if (axis === 'x') L.shape('gable', cx + s * gx - 0.05, y + rise * 0.42, cz - gz * 0.8, cx + s * gx + 0.05, top - 0.2, cz + gz * 0.8, 'paint', { paint: 'white', axis: 'z', solid: false });
    else L.shape('gable', cx - gx * 0.8, y + rise * 0.42, cz + s * gz - 0.05, cx + gx * 0.8, top - 0.2, cz + s * gz + 0.05, 'paint', { paint: 'white', axis: 'x', solid: false });
    const [fx, fz] = axis === 'x' ? [cx + s * (gx - 0.4), cz] : [cx, cz + s * (gz - 0.4)];
    L.box(fx - 0.25, top - 0.1, fz - 0.25, fx + 0.25, top + 0.9, fz + 0.25, 'paint', { paint: fish, solid: false });
  }
  return top + 0.9;
}

/**
 * A gable on a roof slope (千鳥破風), facing out of the face `side` (+z, -z, +x, -x) of a tier whose
 * wall is at `at`: the triangle stands over the eaves, `half` wide, from y0 to y1.
 */
export function chidori(L: Lm, side: 'z+' | 'z-' | 'x+' | 'x-', at: number, u: number, half: number, y0: number, y1: number, over: number, roof: PaintName): void {
  const out = side.endsWith('+') ? 1 : -1;
  const a = at - out * 1.2;
  const b = at + out * (over - 0.1);
  if (side[0] === 'z') {
    L.shape('gable', u - half, y0, Math.min(a, b), u + half, y1, Math.max(a, b), 'paint', { paint: roof, axis: 'z', solid: false });
    L.shape('gable', u - half + 0.35, y0 + 0.1, b - out * 0.08 - 0.04, u + half - 0.35, y1 - 0.3, b - out * 0.08 + 0.04, 'paint', { paint: 'white', axis: 'z', solid: false });
  } else {
    L.shape('gable', Math.min(a, b), y0, u - half, Math.max(a, b), y1, u + half, 'paint', { paint: roof, axis: 'x', solid: false });
    L.shape('gable', b - out * 0.08 - 0.04, y0 + 0.1, u - half + 0.35, b - out * 0.08 + 0.04, y1 - 0.3, u + half - 0.35, 'paint', { paint: 'white', axis: 'x', solid: false });
  }
}

/**
 * A stone base that leans back as it rises (the curve of a castle's 石垣): `steps` boxes from y0 to
 * y1, each drawn in by `lean` of its height on every side, from the footprint [x0, x1] × [z0, z1].
 */
export function stoneBase(L: Lm, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, lean: number, steps = 4, paint: PaintName = 'stone'): void {
  const h = (y1 - y0) / steps;
  for (let i = 0; i < steps; i++) {
    // The curve: the lower courses lean little, the upper ones more (扇の勾配).
    const t = (i / steps) ** 1.6 * (y1 - y0) * lean;
    L.box(x0 + t, y0 + i * h, z0 + t, x1 - t, y0 + (i + 1) * h, z1 - t, 'paint', { paint });
  }
}

/** A cherry tree (桜) in bloom: trunk and a pink rounded crown; the crown does not stop bullets. */
export function cherry(L: Lm, x: number, z: number, h: number, r: number): void {
  L.column(x, z, 0.3, 0, h * 0.45, 'paint', { paint: 'brown' });
  L.column(x, z, r * 0.75, h * 0.35, h * 0.62, 'paint', { paint: 'sakura', taper: 1.35, solid: false });
  L.column(x, z, r, h * 0.62, h, 'paint', { paint: 'sakura', taper: 0.5, solid: false });
}

/**
 * A weeping cherry (枝垂れ桜): a tall trunk, a broad rounded top, and the curtain of blossom hanging
 * from its rim almost to the ground (an umbrella, not a cone).
 */
export function weepingCherry(L: Lm, x: number, z: number, h: number, r: number): void {
  L.column(x, z, 0.45, 0, h * 0.75, 'paint', { paint: 'brown' });
  L.column(x, z, r, h * 0.68, h, 'paint', { paint: 'sakura', taper: 0.45, solid: false });
  L.column(x, z, r * 0.45, h * 0.3, h * 0.72, 'paint', { paint: 'sakura', taper: 1.6, solid: false });
  // The hanging strands round the rim, with gaps between them.
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * 0.82;
    const half = rr * Math.sin(Math.PI / n) * 0.75;
    const [cx, cz] = [x + Math.cos(a) * rr, z + Math.sin(a) * rr];
    const y0 = h * (0.14 + 0.08 * (i % 3));
    L.bar(cx + Math.sin(a) * half, cz - Math.cos(a) * half, cx - Math.sin(a) * half, cz + Math.cos(a) * half, y0, h * 0.74, 0.5, 'paint', { paint: 'sakura', solid: false });
  }
}

/** A Japanese cedar (杉): a straight trunk and a tall dark narrow crown. */
export function cedar(L: Lm, x: number, z: number, h: number, r = 2.6): void {
  L.column(x, z, 0.5, 0, h * 0.4, 'paint', { paint: 'brown' });
  L.column(x, z, r, h * 0.3, h, 'paint', { paint: 'cedar', taper: 0.12, solid: false });
}

/** A black pine (松): trunk and two flat dark crowns. */
export function pine(L: Lm, x: number, z: number, h: number): void {
  L.column(x, z, 0.3, 0, h * 0.75, 'paint', { paint: 'brown' });
  L.column(x, z, h * 0.28, h * 0.55, h * 0.75, 'paint', { paint: 'cedar', taper: 0.6, solid: false });
  L.column(x, z, h * 0.2, h * 0.78, h, 'paint', { paint: 'cedar', taper: 0.5, solid: false });
}
