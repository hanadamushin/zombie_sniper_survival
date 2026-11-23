// L3a: the University of Tokyo, Hongō campus — two landmarks.
//
// 安田講堂 (Yasuda Auditorium, 1925, Uchida Yoshikazu): dark tapestry brick, a square central tower
// (about 40 m) pierced by a tall arch three storeys high, with a clock; low symmetric wings; behind
// them the auditorium's round hall under a copper roof. It closes the east end of the ginkgo avenue
// from the main gate — in late November a tunnel of yellow. The front (local z = d) faces west, down
// the avenue (the lot holds a stretch of it).
//
// 赤門 (Akamon, 1827): the vermilion gate of the Kaga Maeda mansion (a 薬医門 with its two guard houses
// under karahafu roofs), now a gate of the campus on Hongō-dōri. Shut. The front faces west (the street).

import { landmarkDef, type Lm } from '../common.ts';
import { ginkgo, round } from './parts.ts';

const W = 76;
const D = 82;
/** Yasuda: the building's front (the wings), the tower's front and middle. */
const FRONT = 44;
const TX = W / 2;

export const LANDMARK_YASUDA_AUDITORIUM = landmarkDef({
  variant: 'yasuda_auditorium',
  size: { w: [W, W], d: [D, D] },
  eaves: 19,
  top: 41,
  kind: 'office',
  build: yasuda,
});

function yasuda(L: Lm): void {
  L.ground('paved', [[TX - 8, FRONT], [TX + 8, FRONT], [TX + 8, D], [TX - 8, D]]);
  L.ground('grass', [[0, FRONT + 2], [TX - 9, FRONT + 2], [TX - 9, D], [0, D]]);
  L.ground('grass', [[TX + 9, FRONT + 2], [W, FRONT + 2], [W, D], [TX + 9, D]]);

  // The round hall behind, under its low copper dome.
  round(L, TX, 22, 21, 0, 24, 'brickBrown');
  round(L, TX, 22, 21.4, 24, 29, 'copper', { taper: 0.6 });
  // The wings: two storeys over a base, arched windows, a parapet; set back from the tower.
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [3, TX - 8] : [TX + 8, W - 3];
    L.box(x0, 0, 22, x1, 19, FRONT - 2, 'paint', { paint: 'brickBrown' });
    L.box(x0 - 0.1, 0, 21.9, x1 + 0.1, 3.2, FRONT - 1.9, 'paint', { paint: 'stone' });
    L.box(x0 - 0.15, 18.2, 21.85, x1 + 0.15, 19.6, FRONT - 1.85, 'paint', { paint: 'stone', solid: false });
    L.windows('x', FRONT - 2, 1, x0 + 1.5, x1 - 1.5, 6, 5, 9.5, 1.6, { broken: 0.3 });
    L.windows('x', FRONT - 2, 1, x0 + 1.5, x1 - 1.5, 6, 11.5, 16.5, 1.6, { broken: 0.3 });
    L.windows('z', s < 0 ? x0 : x1, s < 0 ? -1 : 1, 24, FRONT - 4, 4, 11.5, 16.5, 1.6, { broken: 0.3 });
    // The stair towers at the wing's inner end (a step up to the central tower).
    const [a0, a1] = s < 0 ? [TX - 13, TX - 8] : [TX + 8, TX + 13];
    L.box(a0, 0, 24, a1, 24, FRONT, 'paint', { paint: 'brickBrown' });
    L.box(a0 - 0.1, 23.2, 23.9, a1 + 0.1, 24.6, FRONT + 0.1, 'paint', { paint: 'stone', solid: false });
  }
  // The central tower with its great arch (the entrance inside it shut) and the clock.
  L.box(TX - 8, 0, 24, TX + 8, 38, FRONT + 2, 'paint', { paint: 'brickBrown' });
  L.box(TX - 4.6, 0, FRONT + 1.6, TX + 4.6, 15, FRONT + 2.1, 'paint', { paint: 'charcoal' });
  L.shape('gable', TX - 4.6, 15, FRONT + 1.6, TX + 4.6, 17.6, FRONT + 2.1, 'paint', { paint: 'charcoal', axis: 'z', solid: false });
  L.box(TX - 3.2, 0, FRONT + 1.4, TX + 3.2, 8, FRONT + 1.6, 'doorSteel');
  L.windows('x', FRONT + 2, 1, TX - 4, TX + 4, 3, 21, 30, 1.2, { broken: 0.25 });
  L.box(TX - 2.2, 31.5, FRONT + 2, TX + 2.2, 35.7, FRONT + 2.2, 'paint', { paint: 'offWhite', solid: false });
  L.box(TX - 0.15, 33.4, FRONT + 2.2, TX + 0.15, 35.3, FRONT + 2.3, 'paint', { paint: 'black', solid: false });
  L.box(TX - 0.15, 33.4, FRONT + 2.2, TX + 1.6, 33.7, FRONT + 2.3, 'paint', { paint: 'black', solid: false });
  // The tower's top: a stone band and corner piers rising past the parapet.
  L.box(TX - 8.3, 37, 23.7, TX + 8.3, 38.4, FRONT + 2.3, 'paint', { paint: 'stone' });
  for (const [x, z] of [[TX - 8, 24], [TX + 6.4, 24], [TX - 8, FRONT + 0.4], [TX + 6.4, FRONT + 0.4]] as const) L.box(x, 38, z, x + 1.6, 41, z + 1.6, 'paint', { paint: 'brickBrown' });

  // The ginkgo avenue: two rows, yellow.
  for (const z of [52, 60, 68, 76]) {
    ginkgo(L, TX - 14, z, 17);
    ginkgo(L, TX + 14, z, 17);
  }
  // 90 days on: a barricade of sandbags across the arch, a fallen board, a relief tent on the lawn.
  L.sandbags(TX - 6, FRONT + 5, TX + 6, FRONT + 5);
  L.tent(10, 60, 'z', 7);
  L.crates(16, 70, 3);
  L.fallenSign(TX + 22, FRONT + 8, 'x');
  L.scorch(TX + 9, 3, FRONT + 0.05, TX + 13, 14, FRONT + 0.15);
}

const AW = 30;
const AD = 14;
export const LANDMARK_AKAMON = landmarkDef({
  variant: 'akamon',
  size: { w: [AW, AW], d: [AD, AD] },
  eaves: 6.6,
  top: 11.4,
  kind: 'house',
  build: akamon,
});

function akamon(L: Lm): void {
  const cx = AW / 2;
  const [z0, z1] = [4.2, 10];
  const zm = (z0 + z1) / 2;
  L.ground('paved', [[cx - 6, z1], [cx + 6, z1], [cx + 6, AD], [cx - 6, AD]]);
  // The gate: the two main posts at the front, the back posts, the leaves (shut) set back between
  // them, the tie beams and the frieze over them, all vermilion; a broad tiled gable roof.
  for (const x of [cx - 3.5, cx + 2.6]) {
    L.box(x, 0, z1 - 0.9, x + 0.9, 6.6, z1, 'paint', { paint: 'red' });
    L.box(x + 0.15, 0, z0, x + 0.75, 6.6, z0 + 0.6, 'paint', { paint: 'red' });
    L.box(x + 0.1, 0, z0 + 0.6, x + 0.8, 0.5, z1 - 0.9, 'paint', { paint: 'stone', solid: false });
  }
  L.box(cx - 2.6, 0, zm - 0.12, cx + 2.6, 5, zm + 0.12, 'paint', { paint: 'red' }); // the leaves, shut
  L.box(cx - 0.05, 0.2, zm + 0.12, cx + 0.05, 4.8, zm + 0.18, 'paint', { paint: 'black', solid: false });
  for (const y of [1.6, 3.4]) L.box(cx - 2.5, y, zm + 0.12, cx + 2.5, y + 0.18, zm + 0.2, 'paint', { paint: 'black', solid: false });
  L.box(cx - 2.6, 5, zm - 0.12, cx + 2.6, 6.6, zm + 0.12, 'paint', { paint: 'red' });
  L.box(cx - 4, 5.6, z1 - 0.95, cx + 4, 6.6, z1 + 0.05, 'paint', { paint: 'red' });
  L.box(cx - 4, 5.6, z0 - 0.05, cx + 4, 6.6, z0 + 0.65, 'paint', { paint: 'red' });
  L.box(cx - 4.2, 6.6, z0 - 0.3, cx + 4.2, 7.1, z1 + 0.3, 'paint', { paint: 'black', solid: false });
  L.shape('gable', cx - 6.2, 7, z0 - 2.4, cx + 6.2, 10.6, z1 + 2.4, 'paint', { paint: 'charcoal', axis: 'x' });
  L.box(cx - 6.4, 10.2, zm - 0.45, cx + 6.4, 10.9, zm + 0.45, 'paint', { paint: 'charcoal', solid: false });
  for (const sx of [-1, 1]) L.box(cx + sx * 6.1 - 0.4, 10.2, zm - 0.4, cx + sx * 6.1 + 0.4, 11.4, zm + 0.4, 'paint', { paint: 'charcoal', solid: false });
  // The two guard houses (番所): vermilion, a latticed window to the street, a gable (karahafu) towards it.
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 1.4 : AW - 8.4;
    L.box(x0, 0, z0, x0 + 7, 3.8, z1 - 1, 'paint', { paint: 'red' });
    L.box(x0 + 2.2, 1.4, z1 - 1, x0 + 4.8, 2.8, z1 - 0.9, 'paint', { paint: 'black', solid: false });
    for (let k = 0; k < 4; k++) L.box(x0 + 2.4 + k * 0.7, 1.4, z1 - 0.9, x0 + 2.5 + k * 0.7, 2.8, z1 - 0.85, 'paint', { paint: 'red', solid: false });
    L.shape('hip', x0 - 0.5, 3.8, z0 - 0.6, x0 + 7.5, 5.4, z1 - 0.4, 'paint', { paint: 'charcoal', axis: 'x' });
    L.shape('gable', x0 + 1.6, 3.6, z1 - 1.6, x0 + 5.4, 5.6, z1 + 0.4, 'paint', { paint: 'charcoal', axis: 'z' });
    // The campus wall going off on either side (white plaster on a stone base, tiled coping).
    const [w0, w1] = s < 0 ? [0, x0] : [x0 + 7, AW];
    L.box(w0, 0, z0 + 0.5, w1, 0.8, z0 + 1.3, 'paint', { paint: 'stone' });
    L.box(w0, 0.8, z0 + 0.6, w1, 2.8, z0 + 1.2, 'paint', { paint: 'offWhite' });
    L.box(w0, 2.8, z0 + 0.3, w1, 3.2, z0 + 1.5, 'paint', { paint: 'charcoal', solid: false });
  }
  // 90 days on: a fallen board and a car left at the kerb.
  L.fallenSign(cx + 8.5, 12.4, 'x');
  L.car(4.5, 12.2, 'x');
}
