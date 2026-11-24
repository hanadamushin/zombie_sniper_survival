// L6: shapes shared by the chugoku landmarks: the great straw ropes of Izumo (しめ縄), a timber member
// that follows an arch (Kintai Bridge), a black keep's top roof with plain ridge ornaments. Built
// from the common kit (../common.ts) and the shapes of the other regions; nothing here is a landmark
// of its own.

import type { PaintName } from '../../../../../data/render.ts';
import type { Lm } from '../common.ts';

/**
 * A sacred straw rope (しめ縄) hanging along x under an eave, its middle at (cx, cy, cz): fattest in the
 * middle (`thick` across), thinning to its two ends `half` away, sagging a little; `tassels` straw
 * bundles (〆の子) hang from it. Drawn only (it hangs over the heads of the people below).
 */
export function shimenawa(L: Lm, cx: number, cy: number, cz: number, half: number, thick: number, tassels: number): void {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const u0 = -half + (2 * half * i) / n;
    const u1 = -half + (2 * half * (i + 1)) / n;
    const um = (u0 + u1) / 2;
    const t = um / half;
    // Thickest in the middle, a third of it at the ends (the twisted rope tapers); a slight sag.
    const r = (thick / 2) * (0.35 + 0.65 * (1 - t * t));
    const sag = thick * 0.15 * (1 - t * t);
    L.box(cx + u0, cy - r - sag, cz - r, cx + u1, cy + r - sag, cz + r, 'paint', { paint: 'straw', solid: false });
  }
  // The twist: a darker band along the top of the middle part.
  L.box(cx - half * 0.55, cy + thick * 0.28, cz - thick * 0.2, cx + half * 0.55, cy + thick * 0.42, cz + thick * 0.2, 'paint', { paint: 'thatch', solid: false });
  for (let k = 0; k < tassels; k++) {
    const u = -half * 0.6 + (half * 1.2 * (k + 0.5)) / tassels;
    const t = u / half;
    const r = (thick / 2) * (0.35 + 0.65 * (1 - t * t));
    const len = thick * 0.9;
    const w = thick * 0.16;
    L.box(cx + u - w, cy - r - len, cz - w, cx + u + w, cy - r + 0.1, cz + w, 'paint', { paint: 'straw', solid: false });
  }
}

/**
 * A timber or a deck that follows a curve along x (an arch, a hump): `n` level boxes from xa to xb whose
 * tops follow `top(x)`, each `depth` deep (down from its top), across z0..z1. Returns nothing; solid by
 * default (people walk on a deck).
 */
export function along(L: Lm, xa: number, xb: number, n: number, top: (x: number) => number, depth: number, z0: number, z1: number, paint: PaintName, solid = true): void {
  for (let i = 0; i < n; i++) {
    const x0 = xa + ((xb - xa) * i) / n;
    const x1 = xa + ((xb - xa) * (i + 1)) / n;
    const y = top((x0 + x1) / 2);
    L.box(x0, y - depth, z0, x1, y, z1, 'paint', { paint, solid });
  }
}

/**
 * The top roof of a keep with plain (not gold) ridge ornaments: hip, the gable ridge on it with its
 * boards, two small dark ridge-end ornaments. As matsumoto_castle's, with the colours chosen.
 */
export function keepTop(L: Lm, cx: number, cz: number, hx: number, hz: number, y: number, over: number, rise: number, roof: PaintName, board: PaintName, fish: PaintName): number {
  const axis = hx >= hz ? 'x' : 'z';
  L.box(cx - hx - over, y - 0.25, cz - hz - over, cx + hx + over, y, cz + hz + over, 'paint', { paint: 'white', solid: false });
  L.shape('hip', cx - hx - over, y, cz - hz - over, cx + hx + over, y + rise * 0.55, cz + hz + over, 'paint', { paint: roof, axis });
  const [gx, gz] = axis === 'x' ? [hx * 0.85, hz * 0.55] : [hx * 0.55, hz * 0.85];
  L.shape('gable', cx - gx, y + rise * 0.4, cz - gz, cx + gx, y + rise, cz + gz, 'paint', { paint: roof, axis });
  for (const s of [-1, 1]) {
    if (axis === 'x') L.shape('gable', cx + s * gx - 0.05, y + rise * 0.42, cz - gz * 0.8, cx + s * gx + 0.05, y + rise - 0.2, cz + gz * 0.8, 'paint', { paint: board, axis: 'z', solid: false });
    else L.shape('gable', cx - gx * 0.8, y + rise * 0.42, cz + s * gz - 0.05, cx + gx * 0.8, y + rise - 0.2, cz + s * gz + 0.05, 'paint', { paint: board, axis: 'x', solid: false });
    const [fx, fz] = axis === 'x' ? [cx + s * (gx - 0.3), cz] : [cx, cz + s * (gz - 0.3)];
    L.box(fx - 0.24, y + rise - 0.1, fz - 0.24, fx + 0.24, y + rise + 0.8, fz + 0.24, 'paint', { paint: fish, solid: false });
  }
  return y + rise + 0.8;
}
