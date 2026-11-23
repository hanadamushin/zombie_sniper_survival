// L2: 瑞鳳殿 (Zuihōden, Sendai), the mausoleum of Date Masamune on the wooded hill 経ヶ峯: built
// 1637 in the brilliant Momoyama style, burnt in 1945 and rebuilt in 1979. Black lacquer and gold,
// the bracket sets under the eaves painted in red, green and blue, a pyramid roof (宝形造) with a gold
// jewel; in front of it the Chinese gate (唐門) in its stone fence, the worship hall (拝殿), and at the
// head of the stone stairs the gate 涅槃門. Tall cedars stand all round.
//
// The front (local z = d) is the 涅槃門 at the head of the stairs; the mausoleum is at the back.
// Ninety days on, the place is left alone: a fallen guide board and crates by the gate only.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from './parts.ts';

const W = 40;
const D = 60;
const CX = 20;

export const LANDMARK_ZUIHODEN = landmarkDef({
  variant: 'zuihoden',
  size: { w: [W, W], d: [D, D] },
  eaves: 6.6,
  top: 34,
  roof: 'hip',
  kind: 'house',
  build,
});

/** The painted bracket band under the eaves: green, then red, then gold, round a hall. */
function brackets(L: Lm, x0: number, z0: number, x1: number, z1: number, y: number): void {
  const bands: [PaintName, number][] = [['green', 0.35], ['red', 0.3], ['gold', 0.15]];
  let yy = y;
  let g = 0.1;
  for (const [paint, h] of bands) {
    L.box(x0 - g, yy, z0 - g, x1 + g, yy + h, z1 + g, 'paint', { paint, solid: false });
    yy += h;
    g += 0.15;
  }
}

/** A gate: black posts and doors (shut), the bracket band, a roof whose gable faces the front. */
function gate(L: Lm, cx: number, cz: number, hw: number, hd: number, h: number, karahafu: boolean): void {
  for (const s of [-1, 1]) for (const t of [-1, 1]) L.box(cx + s * hw - 0.3, 0, cz + t * hd - 0.3, cx + s * hw + 0.3, h, cz + t * hd + 0.3, 'paint', { paint: 'black' });
  L.box(cx - hw + 0.3, 0, cz - 0.08, cx + hw - 0.3, h - 0.6, cz + 0.08, 'paint', { paint: 'black' });
  L.box(cx - 0.05, 0.4, cz + 0.08, cx + 0.05, h - 1, cz + 0.14, 'paint', { paint: 'gold', solid: false });
  L.box(cx - hw + 0.6, h - 1.4, cz + 0.08, cx + hw - 0.6, h - 0.7, cz + 0.16, 'paint', { paint: 'skyBlue', solid: false }); // carved panel
  brackets(L, cx - hw - 0.3, cz - hd - 0.3, cx + hw + 0.3, cz + hd + 0.3, h);
  const y = h + 0.8;
  L.shape('gable', cx - hw - 1.1, y, cz - hd - 1.3, cx + hw + 1.1, y + 1.9, cz + hd + 1.3, 'paint', { paint: 'charcoal', axis: 'z' });
  if (karahafu) {
    // The Chinese gable's bow over the front: a gold-edged hump on the eaves.
    L.shape('hip', cx - hw * 0.7, y - 0.1, cz + hd + 0.4, cx + hw * 0.7, y + 1.0, cz + hd + 1.5, 'paint', { paint: 'charcoal', axis: 'x', solid: false });
    L.box(cx - hw * 0.7, y - 0.2, cz + hd + 1.42, cx + hw * 0.7, y, cz + hd + 1.5, 'paint', { paint: 'gold', solid: false });
  }
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[CX - 2.5, 20], [CX + 2.5, 20], [CX + 2.5, D], [CX - 2.5, D]]);

  // The mausoleum: its stone platform in the stone fence, black lacquer walls with gold fittings,
  // the bracket band, the pyramid roof and the jewel.
  const [mz, mh] = [11, 2.9]; // middle (z) and half size
  L.box(CX - 6.5, 0, mz - 6.5, CX + 6.5, 1.2, mz + 6.5, 'paint', { paint: 'gray' });
  for (const [x0, z0, x1, z1] of [[CX - 7.5, mz - 7.5, CX + 7.5, mz - 7.1], [CX - 7.5, mz - 7.5, CX - 7.1, mz + 7.5], [CX + 7.1, mz - 7.5, CX + 7.5, mz + 7.5], [CX - 7.5, mz + 7.1, CX - 1.8, mz + 7.5], [CX + 1.8, mz + 7.1, CX + 7.5, mz + 7.5]] as const) {
    L.box(x0, 0, z0, x1, 1.6, z1, 'paint', { paint: 'stone' });
  }
  const y0 = 1.2;
  const e = 6.6;
  L.box(CX - mh, y0, mz - mh, CX + mh, e - 1, mz + mh, 'paint', { paint: 'black' });
  // Gold on the corners, the door (shut) with its gold fittings, the painted panels over the walls.
  for (const s of [-1, 1]) for (const t of [-1, 1]) L.box(CX + s * mh - 0.15, y0, mz + t * mh - 0.15, CX + s * mh + 0.15, e - 1, mz + t * mh + 0.15, 'paint', { paint: 'gold', solid: false });
  L.box(CX - 1.1, y0, mz + mh, CX + 1.1, y0 + 3, mz + mh + 0.08, 'paint', { paint: 'black', solid: false });
  L.box(CX - 1.2, y0 + 1.4, mz + mh + 0.08, CX + 1.2, y0 + 1.6, mz + mh + 0.14, 'paint', { paint: 'gold', solid: false });
  for (const [px, pz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    if (pz) L.box(CX - mh + 0.3, e - 1.9, mz + pz * mh - 0.04, CX + mh - 0.3, e - 1.1, mz + pz * mh + 0.04 + pz * 0.04, 'paint', { paint: 'skyBlue', solid: false });
    else L.box(CX + px * mh - 0.04, e - 1.9, mz - mh + 0.3, CX + px * mh + 0.04 + px * 0.04, e - 1.1, mz + mh - 0.3, 'paint', { paint: 'skyBlue', solid: false });
  }
  brackets(L, CX - mh, mz - mh, CX + mh, mz + mh, e - 1);
  L.box(CX - mh - 1.9, e - 0.2, mz - mh - 1.9, CX + mh + 1.9, e, mz + mh + 1.9, 'paint', { paint: 'gold', solid: false });
  L.shape('hip', CX - mh - 1.9, e, mz - mh - 1.9, CX + mh + 1.9, e + 3.6, mz + mh + 1.9, 'paint', { paint: 'charcoal', axis: 'x' });
  L.column(CX, mz, 0.5, e + 3.3, e + 3.9, 'paint', { paint: 'gold' });
  L.column(CX, mz, 0.4, e + 3.9, e + 4.7, 'paint', { paint: 'gold', taper: 0.15 });

  // The Chinese gate in the fence, the worship hall, the 涅槃門 at the head of the stairs.
  gate(L, CX, mz + 7.3, 1.5, 0.9, 3.2, true);
  const [hz0, hz1] = [25, 31];
  L.box(CX - 6.5, 0, hz0, CX + 6.5, 0.6, hz1, 'paint', { paint: 'gray' });
  L.box(CX - 6, 0.6, hz0 + 0.4, CX + 6, 4.4, hz1 - 0.4, 'paint', { paint: 'black' });
  for (let x = CX - 6; x <= CX + 6.01; x += 2) L.box(x - 0.12, 0.6, hz1 - 0.42, x + 0.12, 4.4, hz1 - 0.3, 'paint', { paint: 'gold', solid: false });
  brackets(L, CX - 6, hz0 + 0.4, CX + 6, hz1 - 0.4, 4.4);
  L.shape('hip', CX - 7.6, 5.2, hz0 - 1.2, CX + 7.6, 7.4, hz1 + 1.2, 'paint', { paint: 'charcoal', axis: 'x' });
  L.shape('gable', CX - 5.5, 6.6, hz0 + 0.6, CX + 5.5, 8.6, hz1 - 0.6, 'paint', { paint: 'charcoal', axis: 'x' });
  gate(L, CX, D - 6, 2.6, 1.4, 4.0, false);
  // The stone stairs falling away beyond the gate (their top steps), stone lanterns along the path.
  for (let i = 0; i < 3; i++) L.box(CX - 3, 0, D - 3.2 + i * 1, CX + 3, 0.45 - i * 0.15, D - 2.2 + i * 1, 'paint', { paint: 'gray' });
  for (const z of [36, 44]) {
    for (const s of [-1, 1]) {
      L.box(CX + s * 4 - 0.4, 0, z - 0.4, CX + s * 4 + 0.4, 1.2, z + 0.4, 'paint', { paint: 'stone' });
      L.box(CX + s * 4 - 0.6, 1.2, z - 0.6, CX + s * 4 + 0.6, 1.9, z + 0.6, 'paint', { paint: 'stone' });
      L.shape('hip', CX + s * 4 - 0.8, 1.9, z - 0.8, CX + s * 4 + 0.8, 2.4, z + 0.8, 'paint', { paint: 'stone', axis: 'x' });
    }
  }

  // The cedars of 経ヶ峯 all round.
  for (const [x, z, h] of [[4, 4, 32], [36, 5, 30], [3, 18, 33], [37, 20, 31], [5, 34, 30], [35, 36, 32], [4, 48, 31], [36, 50, 29], [12, 40, 28], [28, 42, 30], [14, 2, 30], [27, 2, 33]] as const) cedar(L, x, z, h);

  // 90 days on: a fallen guide board and relief crates by the gate.
  L.fallenSign(CX + 6, D - 9, 'x');
  L.crates(CX - 9, D - 10, 3);
}
