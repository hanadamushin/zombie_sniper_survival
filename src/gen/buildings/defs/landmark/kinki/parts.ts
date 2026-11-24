// L5: shapes shared by the kinki landmarks: gables with a coloured board (the gold of Osaka, the white
// of Himeji), wooden pagodas (五重塔・三重塔), a plain torii of boxes (the thousand torii of Fushimi
// Inari), discs in the upright plane (the Tower of the Sun's faces), small deer of Nara. Built from
// the common kit (../common.ts) and the tohoku / kanto / chubu shapes; nothing here is a landmark of
// its own.

import type { PaintName } from '../../../../../data/render.ts';
import type { Lm } from '../common.ts';

/**
 * A gable on a roof slope (千鳥破風) as tohoku's `chidori`, with the board's colour chosen (gold for
 * Osaka's ornate gables, white for Himeji). Faces out of `side` of a wall at `at`, `half` wide.
 */
export function hafu(L: Lm, side: 'z+' | 'z-' | 'x+' | 'x-', at: number, u: number, half: number, y0: number, y1: number, over: number, roof: PaintName, board: PaintName): void {
  const out = side.endsWith('+') ? 1 : -1;
  const a = at - out * 1.2;
  const b = at + out * (over - 0.1);
  if (side[0] === 'z') {
    L.shape('gable', u - half, y0, Math.min(a, b), u + half, y1, Math.max(a, b), 'paint', { paint: roof, axis: 'z', solid: false });
    L.shape('gable', u - half + 0.35, y0 + 0.1, b - out * 0.08 - 0.04, u + half - 0.35, y1 - 0.3, b - out * 0.08 + 0.04, 'paint', { paint: board, axis: 'z', solid: false });
  } else {
    L.shape('gable', Math.min(a, b), y0, u - half, Math.max(a, b), y1, u + half, 'paint', { paint: roof, axis: 'x', solid: false });
    L.shape('gable', b - out * 0.08 - 0.04, y0 + 0.1, u - half + 0.35, b - out * 0.08 + 0.04, y1 - 0.3, u + half - 0.35, 'paint', { paint: board, axis: 'x', solid: false });
  }
}

export interface PagodaStyle {
  /** Half width and wall height of each storey, from the bottom. */
  tiers: readonly (readonly [number, number])[];
  /** The posts and beams, the wall panels between them, the roof tiles, the finial. */
  frame: PaintName;
  panel: PaintName;
  roof: PaintName;
  finial: PaintName;
  /** How far each roof reaches past its storey's wall (bottom first; the last is reused), its rise. */
  over: readonly number[];
  rise: number;
  /** Stone platform: half width and height. */
  plinth: readonly [number, number];
  /** The top of the finial (相輪), m above the lot. */
  top: number;
  /** Height of the ground it stands on (a terrace of a hillside temple), default 0. */
  base?: number;
}

/**
 * A wooden pagoda (塔): a stone platform, square storeys narrowing upwards, each with its corner posts
 * and the panels between them, the bracket band (組物) under a broad roof that reaches far out, and the
 * finial on the top roof (the pole, nine rings, the water flame). Returns the height of the top roof's peak.
 */
export function pagoda(L: Lm, cx: number, cz: number, s: PagodaStyle): number {
  const [ph, phh] = s.plinth;
  const b = s.base ?? 0;
  L.box(cx - ph, b, cz - ph, cx + ph, b + phh, cz + ph, 'paint', { paint: 'stone' });
  let y = b + phh;
  const n = s.tiers.length;
  let peak = y;
  s.tiers.forEach(([hw, h], i) => {
    // The wall (panels), the corner posts and the middle doors' frame, the bracket band under the eaves.
    L.box(cx - hw, y, cz - hw, cx + hw, y + h, cz + hw, 'paint', { paint: s.panel });
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      L.box(cx + px * hw - 0.35, y, cz + pz * hw - 0.35, cx + px * hw + 0.35, y + h, cz + pz * hw + 0.35, 'paint', { paint: s.frame, solid: false });
    }
    if (i === 0) {
      for (const sz of [-1, 1]) L.box(cx - hw * 0.4, y + 0.2, cz + sz * hw - 0.06, cx + hw * 0.4, y + h - 0.9, cz + sz * hw + 0.06, 'paint', { paint: s.frame, solid: false });
      for (const sx of [-1, 1]) L.box(cx + sx * hw - 0.06, y + 0.2, cz - hw * 0.4, cx + sx * hw + 0.06, y + h - 0.9, cz + hw * 0.4, 'paint', { paint: s.frame, solid: false });
    }
    // The bracket band (組物): deep and dark, reaching out under the eaves.
    L.box(cx - hw - 0.4, y + h - 1.4, cz - hw - 0.4, cx + hw + 0.4, y + h - 0.5, cz + hw + 0.4, 'paint', { paint: s.frame, solid: false });
    L.box(cx - hw - 1.2, y + h - 0.5, cz - hw - 1.2, cx + hw + 1.2, y + h, cz + hw + 1.2, 'paint', { paint: s.frame, solid: false });
    const over = s.over[Math.min(i, s.over.length - 1)]!;
    const top = i === n - 1;
    const rise = top ? s.rise * 1.35 : s.rise;
    // The roof: a thin edge (the tiles' end), the hipped roof (a pyramid on the top storey).
    L.box(cx - hw - over, y + h, cz - hw - over, cx + hw + over, y + h + 0.6, cz + hw + over, 'paint', { paint: s.roof, solid: false });
    L.shape('hip', cx - hw - over, y + h + 0.6, cz - hw - over, cx + hw + over, y + h + 0.6 + rise, cz + hw + over, 'paint', { paint: s.roof, axis: 'x' });
    peak = y + h + 0.6 + rise;
    // The next storey stands on the roof's slope (its foot hidden in the tiles).
    y += h + (top ? 0 : 0.6 + rise * 0.45);
  });
  // The finial: its base box, the pole, nine rings, the water flame (水煙) and the jewel.
  const f0 = peak - 0.6;
  const fh = s.top - f0;
  L.box(cx - 1.2, f0, cz - 1.2, cx + 1.2, f0 + fh * 0.07, cz + 1.2, 'paint', { paint: s.finial });
  L.column(cx, cz, 0.4, f0, s.top - fh * 0.05, 'paint', { paint: s.finial });
  for (let i = 0; i < 9; i++) {
    const ry = f0 + fh * (0.14 + i * 0.065);
    L.column(cx, cz, 1.05 - i * 0.04, ry, ry + fh * 0.025, 'paint', { paint: s.finial, solid: false });
  }
  L.column(cx, cz, 0.9, f0 + fh * 0.76, f0 + fh * 0.9, 'paint', { paint: s.finial, taper: 0.5, solid: false });
  L.column(cx, cz, 0.35, f0 + fh * 0.9, s.top, 'paint', { paint: s.finial, taper: 0.2, solid: false });
  return peak;
}

/**
 * A plain torii of boxes (four parts, 48 triangles: the thousand torii of Fushimi Inari, where the
 * count matters more than the round posts): two posts, the tie (貫), the top lintel (笠木) a little
 * wider. Across a path along `along`.
 */
export function boxTorii(L: Lm, x: number, z: number, along: 'x' | 'z', span: number, h: number, paint: PaintName, post = 0.32): void {
  const half = span / 2;
  const t = post / 2;
  for (const s of [-1, 1]) {
    if (along === 'z') L.box(x + s * half - t, 0, z - t, x + s * half + t, h, z + t, 'paint', { paint });
    else L.box(x - t, 0, z + s * half - t, x + t, h, z + s * half + t, 'paint', { paint });
  }
  const span2 = (y0: number, y1: number, ext: number, th: number, c: PaintName): void => {
    if (along === 'z') L.box(x - half - ext, y0, z - th, x + half + ext, y1, z + th, 'paint', { paint: c, solid: false });
    else L.box(x - th, y0, z - half - ext, x + th, y1, z + half + ext, 'paint', { paint: c, solid: false });
  };
  span2(h * 0.78, h * 0.78 + post * 0.7, post * 0.6, t * 0.8, paint);
  span2(h, h + post * 0.9, post * 1.8, t * 1.25, 'black');
}

/**
 * A disc in the upright plane facing ±z (a face, a clock dial, a sign): `n` level slabs whose widths
 * follow the circle (an ellipse with ry ≠ rx), from z0 to z1. Drawn only.
 */
export function disc(L: Lm, cx: number, cy: number, rx: number, ry: number, z0: number, z1: number, paint: PaintName, n = 6, solid = false): void {
  for (let i = 0; i < n; i++) {
    const t0 = -1 + (2 * i) / n;
    const t1 = -1 + (2 * (i + 1)) / n;
    const half = rx * Math.sqrt(1 - ((t0 + t1) / 2) ** 2);
    L.box(cx - half, cy + t0 * ry, z0, cx + half, cy + t1 * ry, z1, 'paint', { paint, solid });
  }
}

/** A sika deer of Nara (鹿), standing, its body along `along`: drawn only (people walk through it). */
export function deer(L: Lm, x: number, z: number, along: 'x' | 'z', dir: 1 | -1 = 1): void {
  const c: PaintName = 'brown';
  const o = { paint: c, solid: false } as const;
  const [lx, lz] = along === 'x' ? [0.55, 0.2] : [0.2, 0.55];
  L.box(x - lx, 0.75, z - lz, x + lx, 1.15, z + lz, 'paint', o);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const [px, pz] = along === 'x' ? [x + a * 0.42, z + b * 0.12] : [x + b * 0.12, z + a * 0.42];
    L.box(px - 0.05, 0, pz - 0.05, px + 0.05, 0.78, pz + 0.05, 'paint', o);
  }
  const [hx, hz] = along === 'x' ? [x + dir * 0.6, z] : [x, z + dir * 0.6];
  L.box(hx - 0.1, 1.1, hz - 0.1, hx + 0.1, 1.55, hz + 0.1, 'paint', o);
  const [fx, fz] = along === 'x' ? [hx + dir * 0.12, hz] : [hx, hz + dir * 0.12];
  L.box(fx - 0.13, 1.48, fz - 0.11, fx + 0.13, 1.7, fz + 0.11, 'paint', o);
}
