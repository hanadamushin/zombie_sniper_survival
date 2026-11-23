// L3b: 横浜マリンタワー (Yokohama Marine Tower, 1961), Yamashita Park. 106 m: a ten-sided steel lattice
// that narrows from a broad foot to a waist and opens again under the two-storey observation deck
// (its floor about 88 m, its roof 100 m), with the old lighthouse lamp and a mast on top. Painted
// silver since 2009 (red and white before). A lift shaft runs up the middle.
//
// The ten posts as leaning staircases (parts.ts slant), rings at each level, one diagonal per panel
// (the real lattice is a diamond net; one set reads as a net from afar and halves the count).
// Firing position: the deck's roof (100 m), by the maintenance ladder up the front of the lift shaft
// and through hatches in the deck's floor and roof. The front (local z = d) faces the park (south).

import type { PaintName } from '../../../../../data/render.ts';
import { subtractRects, type Rect } from '../../../kit.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { polyRing, round, slant } from './parts.ts';

const W = 36;
const D = 46;
const C = 18;
const FLOOR = 88;
const ROOF = 100;
const SHAFT = 3;
/** Radius of the posts at height y: 13 m at the foot, a 5 m waist at 56 m, 7.8 m under the deck. */
const radius = (y: number): number => (y < 56 ? 5 + 8 * (1 - y / 56) ** 1.5 : 5 + 2.8 * ((y - 56) / (FLOOR - 56)) ** 1.3);
const LEVELS = [0, 12, 24, 36, 48, 58, 68, 78, FLOOR] as const;

export const LANDMARK_YOKOHAMA_MARINE_TOWER = landmarkDef({
  variant: 'yokohama_marine_tower',
  size: { w: [W, W], d: [D, D] },
  eaves: ROOF,
  top: 106,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  const steel: PaintName = 'silver';
  const at = (k: number, y: number): [number, number, number] => {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 10;
    const r = radius(y);
    return [C + Math.cos(a) * r, y, C + Math.sin(a) * r];
  };
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const [y0, y1] = [LEVELS[i]!, LEVELS[i + 1]!];
    for (let k = 0; k < 10; k++) {
      // (The lower posts lean the most: two steps; one above.)
      slant(L, at(k, y0), at(k, y1), y0 < 36 ? 2 : 1, 0.8, steel, true);
      // One diagonal across each panel (all leaning the same way: a net from afar).
      if (i > 0) slant(L, at(k, y0), at(k + 1, y1), 2, 0.3, steel);
    }
    // The ring at the top of the level (a decagon, the posts' radius there).
    polyRing(L, C, C, radius(y1) * Math.cos(Math.PI / 10), y1 - 0.6, y1, 0.5, 10, steel, false);
  }
  // The lift shaft, the entrance hall round its foot.
  L.column(C, C, SHAFT, 0, FLOOR, 'paint', { paint: 'gray' });
  // (Its wall stops people round a doorway in front, where the ladder starts.)
  round(L, C, C, 8, 0, 9, 'offWhite', { solid: false });
  L.column(C, C, 8.3, 9, 9.8, 'paint', { paint: steel, solid: false });
  for (const [x0, z0, x1, z1] of [[C - 7.4, C - 7.4, C + 7.4, C + 2.5], [C - 7.4, C + 2.5, C - 1.4, C + 7.4], [C + 1.4, C + 2.5, C + 7.4, C + 7.4]] as const) {
    L.box(x0, 0, z0, x1, 9, z1, 'paint', { paint: 'offWhite', hidden: true });
  }
  L.box(C - 1.3, 0, C + 7.9, C + 1.3, 3.2, C + 8.1, 'paint', { paint: 'black', solid: false });
  L.windows('x', C + 7.9, 1, C - 6, C - 2, 2, 1.2, 7.5, 1.6, { paint: 'skyBlue', broken: 0.5 });
  L.windows('x', C + 7.9, 1, C + 2, C + 6, 2, 1.2, 7.5, 1.6, { paint: 'skyBlue', broken: 0.5 });

  // The deck: a white floor band, dark glass round two storeys, a white roof; solid slabs with hatches.
  const hatch: Rect = [C - 0.55, C + SHAFT - 0.05, C + 0.55, C + SHAFT + 0.95];
  const half = 6.6;
  for (const [y0, y1] of [[FLOOR, FLOOR + 1.4], [ROOF - 0.6, ROOF]] as const) {
    for (const r of subtractRects([C - half, C - half, C + half, C + half], [hatch])) L.box(r[0], y0, r[1], r[2], y1, r[3], 'paint', { paint: 'white', hidden: true });
  }
  round(L, C, C, 9.6, FLOOR, FLOOR + 1.4, 'white', { solid: false });
  round(L, C, C, 9.3, FLOOR + 1.4, ROOF - 0.6, 'deckGlass', { solid: false });
  round(L, C, C, 9.5, FLOOR + 6.2, FLOOR + 6.8, 'silver', { solid: false });
  round(L, C, C, 9.8, ROOF - 0.6, ROOF, 'white', { solid: false });
  const rail = ROOF + 1.1;
  const [e0, e1] = [C - half, C + half];
  L.box(e0, ROOF, e0, e1, rail, e0 + 0.08, 'steel');
  L.box(e0, ROOF, e1 - 0.08, e1, rail, e1, 'steel');
  L.box(e0, ROOF, e0, e0 + 0.08, rail, e1, 'steel');
  L.box(e1 - 0.08, ROOF, e0, e1, rail, e1, 'steel');
  // The lamp house and the mast.
  L.column(C, C, 2.4, ROOF, 102.6, 'paint', { paint: 'white' });
  L.column(C, C, 1.9, 102.6, 104, 'paint', { paint: 'lampGlass', solid: false });
  L.column(C, C, 0.35, 104, 106, 'steel', { taper: 0.3 });

  // The ladder up the front of the shaft, through the deck; the deck's roof is the firing position.
  L.ladder(C, C + SHAFT + 0.45, 0, -1, 0, ROOF);
  L.vantage(C, ROOF, e1 - 0.7);

  // 90 days on: a relief tent and crates on the forecourt, a burnt car, a fallen sign.
  L.tent(7, 40, 'x', 7);
  L.crates(14, 42, 3);
  L.car(29, 40, 'z', { burnt: true });
  L.fallenSign(20, 32, 'x');
}
