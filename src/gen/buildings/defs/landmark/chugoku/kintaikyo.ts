// L6: 錦帯橋 (the Kintai Bridge), Iwakuni, Yamaguchi. The wooden bridge of five arches over the Nishiki
// River (1673, rebuilt 1953 and repaired since): three high wooden arches in the middle, a lower span at
// each end, carried by four stone piers with pointed noses against the current; the deck climbs and
// falls in steps over each arch between plain wooden rails. Iwakuni Castle is on the hill behind.
//
// Real size: 193.3 m long (the spans 34.8 / 35.1 / 35.1 / 35.1 / 34.8 m and four 4.6 m piers), 5 m
// wide. The river is dug from the lot (the shrunk area's river is narrower). The bridge's arches are
// kept lower than the real ones (3.2 m) so that the deck's steps stay under the player's step height.
// L6 draws it roughly: L9 makes it replace the area's bridge from bank to bank. The bridge runs along
// local x; the front (local z = d) faces downstream.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { pine } from '../tohoku/parts.ts';
import { along } from './parts.ts';

const W = 200;
const D = 30;
const CZ = 14;
const HW = 2.5;
const X0 = 3.35;
const PIER = 4.6;
const SPANS = [34.8, 35.1, 35.1, 35.1, 34.8] as const;
/** Top of the piers and of the abutments; the arches' rise (middle three) and the end spans' hump. */
const PIER_TOP = 3.4;
const BANK = 1.2;
const RISE = 3.2;
const HUMP = 0.9;
const WOOD: PaintName = 'hinoki';

export const LANDMARK_KINTAIKYO = landmarkDef({
  variant: 'kintaikyo',
  size: { w: [W, W], d: [D, D] },
  eaves: 6,
  top: 9.2,
  kind: 'shed',
  build,
});

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('water', [[X0 + 2, 0], [W - X0 - 2, 0], [W - X0 - 2, D], [X0 + 2, D]], 2.6, 1.4);

  let x = X0;
  SPANS.forEach((len, i) => {
    const xa = x;
    const xb = x + len;
    const end = i === 0 || i === SPANS.length - 1;
    const ya = i === 0 ? BANK : PIER_TOP;
    const yb = i === SPANS.length - 1 ? BANK : PIER_TOP;
    const rise = end ? HUMP : RISE;
    const top = (px: number): number => {
      const t = (px - xa) / (xb - xa);
      return ya + (yb - ya) * t + rise * 4 * t * (1 - t) + 0.5;
    };
    // The deck in short level steps; the dark timber arch under it; the rails (three steps a piece).
    const steps = end ? 16 : 30;
    along(L, xa, xb, steps, top, 0.45, CZ - HW, CZ + HW, WOOD);
    if (!end) along(L, xa, xb, 10, (px) => top(px) - 0.45, 1.3, CZ - HW + 0.3, CZ + HW - 0.3, 'brown', false);
    for (let k = 0; k < steps; k += 3) {
      const r0 = xa + ((xb - xa) * k) / steps;
      const r1 = xa + ((xb - xa) * Math.min(steps, k + 3)) / steps;
      const hi = Math.max(top(r0), top(r1), top((r0 + r1) / 2));
      for (const s of [-1, 1]) L.box(r0, hi - 0.6, CZ + s * HW - 0.12, r1, hi + 1, CZ + s * HW + 0.12, 'paint', { paint: WOOD });
    }
    // The stone pier after the span (not after the last).
    if (i < SPANS.length - 1) {
      const p0 = xb;
      const p1 = xb + PIER;
      L.box(p0, -2.6, CZ - 6, p1, PIER_TOP, CZ + 6, 'paint', { paint: 'granite' });
      // The pointed nose upstream (-z) and the stepped tail downstream.
      L.box(p0 + 0.9, -2.6, CZ - 8.5, p1 - 0.9, PIER_TOP - 0.8, CZ - 6, 'paint', { paint: 'granite' });
      L.box(p0 + 0.5, -2.6, CZ + 6, p1 - 0.5, PIER_TOP - 1.4, CZ + 7.6, 'paint', { paint: 'granite' });
      // The deck's level piece over the pier.
      L.box(p0, PIER_TOP, CZ - HW, p1, PIER_TOP + 0.5, CZ + HW, 'paint', { paint: WOOD });
      for (const s of [-1, 1]) L.box(p0, PIER_TOP + 0.5, CZ + s * HW - 0.12, p1, PIER_TOP + 1.5, CZ + s * HW + 0.12, 'paint', { paint: WOOD });
    }
    x = xb + PIER;
  });
  // The abutments at both ends, with a ramp up onto the deck.
  for (const [a, b] of [[0, X0], [W - X0, W]] as const) L.box(a, -2.6, CZ - 6, b, 0, CZ + 6, 'paint', { paint: 'granite' });
  L.shape('wedge', 0, 0, CZ - HW, X0, BANK + 0.5, CZ + HW, 'paint', { paint: 'granite', slope: 'x+' });
  L.shape('wedge', W - X0, 0, CZ - HW, W, BANK + 0.5, CZ + HW, 'paint', { paint: 'granite', slope: 'x-' });

  // Pines on both banks.
  for (const [px, pz] of [[2, 3], [2, 26], [197, 4], [197, 27]] as const) pine(L, px, pz, 9);

  // 90 days on: a sandbag wall at the near end, crates, a fallen sign.
  L.sandbags(0.4, CZ + 8, 3, CZ + 8);
  L.crates(195, 22, 3);
  L.fallenSign(197, CZ - 5, 'z');
}
