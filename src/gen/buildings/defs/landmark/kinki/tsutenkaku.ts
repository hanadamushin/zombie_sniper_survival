// L5: 通天閣 (Tsūtenkaku, 1956, Naitō Tachū), Shinsekai, Naniwa. 103 m (108 m with the lightning rod):
// a square steel tower standing on four splayed legs over the plaza (the arch people walk under), the
// body narrowing a little up to the octagonal observation floors (87.5 m), with great illuminated
// boards on its faces (here plain: no maker's name) and on top the round light whose colour forecast
// the weather, then the mast.
//
// Drawn as the TV towers: the legs and posts as steps of boxes, rings round each level, X braces in
// the lower panels (they do not stop people or bullets; the legs and posts do). Firing position: the
// observation floors' roof (95 m), by the maintenance ladder up the lift shaft in the middle and
// through hatches in the floors' slabs. The front (local z = d) faces south (Shinsekai's main street).

import { subtractRects, type Rect } from '../../../kit.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { slant } from '../kanto/parts.ts';

const W = 32;
const C = W / 2;
/** Top of the legs (the body's foot), the observation floors, their roof. */
const LEG = 18;
const DECK0 = 84;
const ROOF = 95;
const TOP = 108;
/** Half width of the body at y (above the legs). */
const half = (y: number): number => 8.6 - (3 * (y - LEG)) / (DECK0 - LEG);
const SHAFT = 1.8;

export const LANDMARK_TSUTENKAKU = landmarkDef({
  variant: 'tsutenkaku',
  size: { w: [W, W], d: [W, W] },
  eaves: ROOF,
  top: TOP,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, W], [0, W]]);
  const steel = 'silver' as const;

  // The legs: from the lot's corners up to the body's corners, splayed (an arch on each face).
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    slant(L, [C + sx * 14.5, 0, C + sz * 14.5], [C + sx * (half(LEG) - 0.6), LEG, C + sz * (half(LEG) - 0.6)], 6, 1.6, steel, true);
  }
  // The arch beams under the body's foot on each face, the floor of the first level (2F).
  const h0 = half(LEG);
  for (const s of [-1, 1]) {
    L.box(C - h0, LEG - 2.4, C + s * h0 - 0.5, C + h0, LEG, C + s * h0 + 0.5, 'paint', { paint: steel });
    L.box(C + s * h0 - 0.5, LEG - 2.4, C - h0, C + s * h0 + 0.5, LEG, C + h0, 'paint', { paint: steel });
  }
  L.box(C - h0 + 0.5, LEG - 0.6, C - h0 + 0.5, C + h0 - 0.5, LEG, C + h0 - 0.5, 'paint', { paint: 'gray', solid: false });
  // The first level's hall (2F) on the legs: a glazed box.
  // (Its slab and walls leave a hatch round the ladder, which starts on the plaza.)
  const hall: Rect = [C - 0.65, C + SHAFT - 0.1, C + 0.65, C + SHAFT + 1.1];
  for (const r of subtractRects([C - h0 + 0.6, C - h0 + 0.6, C + h0 - 0.6, C + h0 - 0.6], [hall])) L.box(r[0], LEG, r[1], r[2], LEG + 5, r[3], 'paint', { paint: 'offWhite' });
  for (const s of [-1, 1] as const) {
    L.windows('x', C + s * (h0 - 0.6), s, C - h0 + 1.5, C + h0 - 1.5, 6, LEG + 1.2, LEG + 4.2, 1.8, { broken: 0.4 });
    L.windows('z', C + s * (h0 - 0.6), s, C - h0 + 1.5, C + h0 - 1.5, 6, LEG + 1.2, LEG + 4.2, 1.8, { broken: 0.4 });
  }

  // The body: four corner posts in steps, a ring every 11 m, X braces on the four faces below the boards.
  const levels = [LEG + 5, 34, 45, 56, 67, 78, DECK0];
  for (let i = 0; i < levels.length - 1; i++) {
    const [ya, yb] = [levels[i]!, levels[i + 1]!];
    const ha = half(ya);
    const hb = half(yb);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const p = 1.1;
      const h = (ha + hb) / 2 - p / 2;
      L.box(C + sx * h - p / 2, ya, C + sz * h - p / 2, C + sx * h + p / 2, yb + 0.1, C + sz * h + p / 2, 'paint', { paint: steel });
    }
    for (const s of [-1, 1]) {
      L.box(C - hb, yb - 0.7, C + s * hb - 0.3, C + hb, yb, C + s * hb + 0.3, 'paint', { paint: steel, solid: false });
      L.box(C + s * hb - 0.3, yb - 0.7, C - hb, C + s * hb + 0.3, yb, C + hb, 'paint', { paint: steel, solid: false });
      if (i < 2) {
        slant(L, [C - ha, ya, C + s * ha], [C + hb, yb, C + s * hb], 4, 0.35, steel);
        slant(L, [C + ha, ya, C + s * ha], [C - hb, yb, C + s * hb], 4, 0.35, steel);
        slant(L, [C + s * ha, ya, C - ha], [C + s * hb, yb, C + hb], 4, 0.35, steel);
        slant(L, [C + s * ha, ya, C + ha], [C + s * hb, yb, C - hb], 4, 0.35, steel);
      }
    }
  }
  // The illuminated boards on the four faces (45–80 m): dark panels in a white frame, the lamps off.
  for (const s of [-1, 1]) {
    const [y0, y1] = [45, 80];
    const hb = half(y1) + 0.15;
    L.box(C - hb + 0.6, y0, C + s * hb - 0.12, C + hb - 0.6, y1, C + s * hb + 0.12, 'paint', { paint: 'white', solid: false });
    L.box(C - hb + 1.1, y0 + 0.5, C + s * (hb + 0.1) - 0.08, C + hb - 1.1, y1 - 0.5, C + s * (hb + 0.1) + 0.08, 'paint', { paint: 'charcoal', solid: false });
    L.box(C + s * hb - 0.12, y0, C - hb + 0.6, C + s * hb + 0.12, y1, C + hb - 0.6, 'paint', { paint: 'white', solid: false });
    L.box(C + s * (hb + 0.1) - 0.08, y0 + 0.5, C - hb + 1.1, C + s * (hb + 0.1) + 0.08, y1 - 0.5, C + hb - 1.1, 'paint', { paint: 'navy', solid: false });
  }

  // The lift shaft up the middle (its front wall carries the ladder).
  L.box(C - SHAFT, LEG, C - SHAFT, C + SHAFT, DECK0, C + SHAFT, 'paint', { paint: 'gray' });

  // The observation floors: an octagon (a square and the same turned 45°), dark glass, white bands.
  const hatch: Rect = [C - 0.55, C + SHAFT, C + 0.55, C + SHAFT + 1];
  const dh = 8;
  for (const [y0, y1] of [[DECK0, DECK0 + 1.2], [ROOF - 0.8, ROOF]] as const) {
    for (const r of subtractRects([C - dh, C - dh, C + dh, C + dh], [hatch])) L.box(r[0], y0, r[1], r[2], y1, r[3], 'paint', { paint: 'white', hidden: true });
  }
  const octa = (y0: number, y1: number, r: number, paint: 'white' | 'deckGlass' | 'gold', solid = false): void => {
    L.box(C - r, y0, C - r, C + r, y1, C + r, 'paint', { paint, solid });
    L.box(C - r * 0.83, y0, C - r * 0.83, C + r * 0.83, y1, C + r * 0.83, 'paint', { paint, solid: false, yaw: Math.PI / 4 });
  };
  octa(DECK0, DECK0 + 1.2, dh + 0.4, 'white');
  octa(DECK0 + 1.2, ROOF - 0.8, dh, 'deckGlass');
  octa(DECK0 + 5.4, DECK0 + 6.2, dh + 0.3, 'white');
  octa(ROOF - 0.8, ROOF, dh + 0.5, 'white');
  // The ladder's shaft walls through the floors, a rail round the roof.
  L.box(hatch[0] - 0.1, DECK0, hatch[1], hatch[0], ROOF - 0.8, hatch[3], 'steel');
  L.box(hatch[2], DECK0, hatch[1], hatch[2] + 0.1, ROOF - 0.8, hatch[3], 'steel');
  const rail = ROOF + 1.1;
  const e = 6.8;
  L.box(C - e, ROOF, C - e, C + e, rail, C - e + 0.08, 'steel');
  L.box(C - e, ROOF, C + e - 0.08, C + e, rail, C + e, 'steel');
  L.box(C - e, ROOF, C - e, C - e + 0.08, rail, C + e, 'steel');
  L.box(C + e - 0.08, ROOF, C - e, C + e, rail, C + e, 'steel');

  // The crown: four posts carrying the round weather light (the roof's view passes between them),
  // the mast and its rod.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    L.box(C + sx * 2.8 - 0.35, ROOF, C + sz * 2.8 - 0.35, C + sx * 2.8 + 0.35, ROOF + 3, C + sz * 2.8 + 0.35, 'paint', { paint: steel });
  }
  L.box(C - 3.4, ROOF + 3, C - 3.4, C + 3.4, ROOF + 3.6, C + 3.4, 'paint', { paint: steel, solid: false });
  L.column(C, C, 3, ROOF + 3.6, ROOF + 6.6, 'paint', { paint: 'lampGlass', taper: 0.85, solid: false });
  L.column(C, C, 1.2, ROOF + 6.6, 103, 'paint', { paint: steel, taper: 0.5 });
  L.column(C, C, 0.15, 103, TOP, 'steel', { solid: false });

  // The ladder up the shaft's front from the plaza, through the hatches; the roof is the firing position.
  L.ladder(C, C + SHAFT + 0.45, 0, -1, 0, ROOF);
  L.vantage(C, ROOF, C + e - 0.7);

  // 90 days on: a burnt car under the arch, relief crates, a fallen board, sandbags at the shaft's door.
  L.car(4, 26, 'z', { burnt: true });
  L.crates(26, 4, 4);
  L.fallenSign(24, 26, 'x');
  L.sandbags(8, 3, 16, 3);
}
