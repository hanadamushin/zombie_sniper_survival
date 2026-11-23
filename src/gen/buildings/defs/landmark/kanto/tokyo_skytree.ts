// L3a: 東京スカイツリー (Tokyo Skytree, 2012), Oshiage, Sumida. 634 m: a steel lattice tower whose plan is
// an equilateral triangle at the foot (a side of about 68 m, a leg at each corner) that turns round as
// it rises — the curve of a Japanese sword's back (反り) on one side, a slight swell (起り) on another —
// round from about 300 m. Two observation decks: the 天望デッキ (Tembo Deck, 340–350 m), a broad
// three-storey glass drum, and the 天望回廊 (Tembo Galleria, 445–450 m), a narrower glass ring. Above
// it the gain tower (the antenna's lattice) to 634 m. Painted スカイツリーホワイト (a pale blue white).
//
// Seen from far away, so: the legs (a staircase of boxes each, as the TV towers), the triangular
// lattice of the lower 150 m (horizontal chords and braces drawn as leaning staircases), a solid round
// body above it with the legs still standing out as ribs until they merge, the decks as glass drums
// wider than the shaft. No firing position (a 350 m ladder is no game). The entrance building at the
// foot; the front (local z = d) is the corner that faces the lot's front.
//
// The lot (70×66 m) is the triangle and its plaza: Tokyo Skytree Town's mall is left out.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { beam, round, roundSolid, slant } from './parts.ts';

const W = 70;
const D = 66;
/** The triangle's centre (its corners at R(y) from here: one towards the front, two at the back). */
const CX = 35;
const CZ = 27;
const TOP = 634;
const WHITE: PaintName = 'skytree';

/** Distance from the centre to a leg's outer edge at height y (the triangle's corner). */
const R = (y: number): number => (y >= 300 ? 22 : 22 + 15.5 * (1 - y / 300) ** 1.5);
/** Radius of the round body at y (it fills the triangle from 150 m up). */
const BODY = (y: number): number => 13 + 8.5 * Math.min(1, Math.max(0, (y - 150) / 170));

export const LANDMARK_TOKYO_SKYTREE = landmarkDef({
  variant: 'tokyo_skytree',
  size: { w: [W, W], d: [D, D] },
  eaves: 350,
  top: TOP,
  kind: 'tower',
  shell: 8000,
  build,
});

/** The three corners' directions (towards the front, back-left, back-right). */
const CORNERS = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
const at = (k: number, r: number): [number, number] => [CX + Math.cos(CORNERS[k]!) * r, CZ + Math.sin(CORNERS[k]!) * r];

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);

  // The legs: a staircase of boxes from the corners at the foot to the round body (they merge at 320 m).
  const legTop = 320;
  const segs = 24;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < segs; i++) {
      const y0 = (legTop * i) / segs;
      const y1 = (legTop * (i + 1)) / segs;
      const ym = (y0 + y1) / 2;
      const half = 3.2 - 1.4 * (ym / legTop);
      const [x, z] = at(k, R(ym) - half);
      L.box(x - half, y0, z - half, x + half, y1 + 0.2, z + half, 'paint', { paint: WHITE });
    }
  }

  // The lattice of the lower 150 m: a chord between the legs at each level and a pair of braces across
  // each panel (the truss reads as a fine mesh from afar), round the lift core.
  const levels = [0, 14, 32, 52, 74, 98, 124, 150];
  for (let j = 1; j < levels.length; j++) {
    const ya = levels[j - 1]!;
    const yb = levels[j]!;
    for (let k = 0; k < 3; k++) {
      const [ax, az] = at(k, R(yb) - 2);
      const [bx, bz] = at((k + 1) % 3, R(yb) - 2);
      beam(L, ax, az, bx, bz, yb - 1.2, yb, 1.2, WHITE, false);
      const [cx, cz] = at(k, R(ya) - 2);
      const [dx, dz] = at((k + 1) % 3, R(ya) - 2);
      const steps = Math.max(4, Math.round((yb - ya) / 5));
      slant(L, [cx, ya, cz], [(bx + dx) / 2, yb, (bz + dz) / 2], steps, 0.9, WHITE);
      slant(L, [dx, ya, dz], [(ax + cx) / 2, yb, (az + cz) / 2], steps, 0.9, WHITE);
    }
  }
  // The core (lifts, stairs, the central concrete column), seen through the lattice.
  round(L, CX, CZ, 9, 0, 150, 'silver');

  // The round body above the lattice: the skin swells to meet the legs.
  for (let y = 150; y < 335; y += 18.5) {
    const y1 = Math.min(335, y + 18.5);
    round(L, CX, CZ, BODY(y1), y, y1, WHITE, { taper: BODY(y1) / BODY(y) });
    // A dark ring at each level: the lattice's chords against the sky.
    L.column(CX, CZ, BODY(y1) + 0.25, y1 - 0.8, y1, 'paint', { paint: 'gray', solid: false });
  }

  // 天望デッキ (Tembo Deck): a three-storey glass drum, 340–350 m, wider than the shaft.
  const DECK0 = 335;
  round(L, CX, CZ, 23.5, DECK0, DECK0 + 3, WHITE, { taper: 1.12 });
  round(L, CX, CZ, 26.4, DECK0 + 3, DECK0 + 14, 'deckGlass');
  for (const y of [DECK0 + 6.6, DECK0 + 10.2]) L.column(CX, CZ, 26.6, y, y + 0.5, 'paint', { paint: WHITE, solid: false });
  round(L, CX, CZ, 26.4, DECK0 + 14, DECK0 + 17, WHITE, { taper: 0.8 });

  // The shaft to the Galleria, then 天望回廊 (Tembo Galleria): a glass ring with a sloping (spiral) floor.
  round(L, CX, CZ, 19, DECK0 + 17, 440, WHITE, { taper: 0.86 });
  for (const y of [375, 405, 430]) L.column(CX, CZ, 19 * (1 - (0.14 * (y - DECK0 - 17)) / (440 - DECK0 - 17)) + 0.25, y, y + 0.8, 'paint', { paint: 'gray', solid: false });
  round(L, CX, CZ, 18.8, 440, 452, 'deckGlass');
  L.column(CX, CZ, 19.1, 446, 446.6, 'paint', { paint: WHITE, solid: false });
  round(L, CX, CZ, 18.8, 452, 456, WHITE, { taper: 0.75 });

  // Up to the gain tower: a narrowing lattice shaft, then the gain tower itself (the antennas' frame).
  round(L, CX, CZ, 13.4, 456, 497, WHITE, { taper: 0.6 });
  L.column(CX, CZ, 8.4, 497, 500, 'paint', { paint: 'gray' });
  for (const [y0, y1, r0, r1] of [[500, 540, 7.4, 6.6], [540, 580, 6.6, 5.6], [580, 612, 5.6, 4.2]] as const) {
    L.column(CX, CZ, r0, y0, y1, 'paint', { paint: WHITE, taper: r1 / r0 });
    L.column(CX, CZ, r1 + 0.3, y1 - 1, y1, 'paint', { paint: 'gray', solid: false });
  }
  L.column(CX, CZ, 2.2, 612, 630, 'paint', { paint: WHITE, taper: 0.5 });
  L.column(CX, CZ, 0.6, 630, TOP, 'paint', { paint: 'silver', taper: 0.4 });
  L.box(CX - 0.4, 628, CZ - 0.4, CX + 0.4, 629.2, CZ + 0.4, 'paint', { paint: 'red', solid: false });

  // The legs and the body stop people (the lattice's members do not: bullets and eyes pass between them).
  roundSolid(L, CX, CZ, 9, 0, 150, 3);

  // The entrance building inside the triangle (4 storeys, shut), its glass front to the lot's front.
  L.box(CX - 13, 0, CZ - 4, CX + 13, 15, CZ + 11, 'paint', { paint: 'offWhite' });
  L.windows('x', CZ + 11, 1, CX - 12, CX + 12, 8, 2, 13.5, 2.4, { paint: 'deckGlass', broken: 0.35 });
  L.box(CX - 13.4, 15, CZ - 4.4, CX + 13.4, 15.6, CZ + 11.4, 'paint', { paint: 'charcoal' });
  L.box(CX - 3, 0, CZ + 11, CX + 3, 3, CZ + 11.12, 'doorSteel');
  L.scorch(CX + 5, 1, CZ + 11.05, CX + 11, 7.5, CZ + 11.15);

  // 90 days on: the plaza was a gathering point — a tent, sandbags at the entrance, a burnt-out car.
  L.tent(12, 50, 'x', 7);
  L.crates(18.5, 55, 4);
  L.sandbags(CX - 8, CZ + 14, CX + 8, CZ + 14);
  L.car(55, 52, 'z', { burnt: true });
  L.fallenSign(50, 58, 'x');
}
