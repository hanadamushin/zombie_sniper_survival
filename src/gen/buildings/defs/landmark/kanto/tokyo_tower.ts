// L3a: 東京タワー (Tokyo Tower, 1958, Naitō Tachū), Shiba Park, Minato. 333 m: a steel lattice on four
// legs spread about 80 m at the foot, curving up steeply (an Eiffel-like profile) to the メインデッキ
// (Main Deck, 145/150 m), then a narrower square lattice to the トップデッキ (Top Deck, 250 m) and the
// antenna. Painted in seven equal bands of international orange and white (the aviation rule; orange
// at the foot and at the top). Under the legs, the five-storey building (フットタウン).
//
// Drawn as the TV towers: the legs a staircase of boxes, chords round each level, X braces in each
// panel as leaning staircases (they do not stop people or bullets; the legs do). Firing position: the
// Main Deck's roof (152 m), by the maintenance ladder up the front wall of the foot building and
// through hatches in the deck's floor and roof. The front (local z = d) faces south (Shiba Park).

import type { PaintName } from '../../../../../data/render.ts';
import { subtractRects, type Rect } from '../../../kit.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { slant } from './parts.ts';

const W = 84;
const C = W / 2;
const TOP = 333;
/** The Main Deck: floor, roof, half width. */
const DECK0 = 136;
const ROOF = 152;
const DH = 17;
/** Inset of a leg's outer face at y (from the lot edge): splayed at the foot, steep under the deck. */
const inset = (y: number): number => 1 + 26.5 * (1 - (1 - Math.min(1, y / DECK0)) ** 2.4);
/** The paint of the band at height y (seven equal bands, orange at the foot and the top). */
const band = (y: number): PaintName => (Math.floor(Math.max(0, Math.min(TOP - 0.01, y)) / (TOP / 7)) % 2 === 0 ? 'intlOrange' : 'white');

export const LANDMARK_TOKYO_TOWER = landmarkDef({
  variant: 'tokyo_tower',
  size: { w: [W, W], d: [W, W] },
  eaves: ROOF,
  top: TOP,
  kind: 'tower',
  shell: 8000,
  build,
});

/** A square lattice between two heights: corner posts (solid), chords, X braces (drawn only). */
function lattice(L: Lm, ys: readonly number[], half: (y: number) => number, post: (y: number) => number, segs: number, braces: boolean): void {
  const y0 = ys[0]!;
  const y1 = ys[ys.length - 1]!;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    for (let i = 0; i < segs; i++) {
      const ya = y0 + ((y1 - y0) * i) / segs;
      const yb = y0 + ((y1 - y0) * (i + 1)) / segs;
      const ym = (ya + yb) / 2;
      const h = half(ym);
      const p = post(ym);
      const x = C + sx * (h - p / 2);
      const z = C + sz * (h - p / 2);
      L.box(x - p / 2, ya, z - p / 2, x + p / 2, yb + 0.15, z + p / 2, 'paint', { paint: band(ym) });
    }
  }
  for (let j = 1; j < ys.length; j++) {
    const ya = ys[j - 1]!;
    const yb = ys[j]!;
    const hb = half(yb) - 0.4;
    const t = 0.55;
    // The chord round the level.
    for (const s of [-1, 1]) {
      L.box(C - hb, yb - t * 1.4, C + s * hb - t / 2, C + hb, yb, C + s * hb + t / 2, 'paint', { paint: band(yb), solid: false });
      L.box(C + s * hb - t / 2, yb - t * 1.4, C - hb, C + s * hb + t / 2, yb, C + hb, 'paint', { paint: band(yb), solid: false });
    }
    if (!braces) continue;
    const ha = half(ya) - 0.4;
    const n = Math.max(4, Math.round((yb - ya) / 7));
    for (const s of [-1, 1]) {
      // Front / back faces (along x), then the sides (along z): an X across the panel.
      slant(L, [C - ha, ya, C + s * ha], [C + hb, yb, C + s * hb], n, 0.45, band);
      slant(L, [C + ha, ya, C + s * ha], [C - hb, yb, C + s * hb], n, 0.45, band);
      slant(L, [C + s * ha, ya, C - ha], [C + s * hb, yb, C + hb], n, 0.45, band);
      slant(L, [C + s * ha, ya, C + ha], [C + s * hb, yb, C - hb], n, 0.45, band);
    }
  }
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, W], [0, W]]);

  // The legs and the lower lattice (the lowest panel is behind the foot building: no braces there).
  lattice(L, [0, 26], (y) => C - inset(y), (y) => 4.6 - 1.4 * (y / DECK0), 4, false);
  lattice(L, [26, 54, 82, 109, DECK0], (y) => C - inset(y), (y) => 4.6 - 1.4 * (y / DECK0), 12, true);

  // The foot building (フットタウン), five storeys, shut; its front wall carries the ladder.
  L.box(20, 0, 20, 64, 22, 50, 'paint', { paint: 'offWhite' });
  L.box(19.6, 22, 19.6, 64.4, 22.6, 50.4, 'paint', { paint: 'charcoal' });
  for (const y of [5, 11, 17]) {
    L.windows('x', 50, 1, 21, 40, 5, y, y + 3, 2.6, { broken: 0.45 });
    L.windows('x', 50, 1, 44, 63, 5, y, y + 3, 2.6, { broken: 0.45 });
    L.windows('z', 64, 1, 21, 49, 6, y, y + 3, 2.6, { broken: 0.3 });
    L.windows('z', 20, -1, 21, 49, 6, y, y + 3, 2.6, { broken: 0.3 });
  }
  L.box(30, 0, 50, 36, 3, 50.12, 'doorSteel');
  L.scorch(52, 0.5, 50.05, 60, 9, 50.15);

  // The Main Deck: two glazed floors on the legs, hatches for the ladder in its floor and roof.
  const hatch: Rect = [C - 0.55, 50, C + 0.55, 51];
  const [d0, d1] = [C - DH, C + DH];
  for (const r of subtractRects([d0, d0, d1, d1], [hatch])) {
    L.box(r[0], DECK0, r[1], r[2], DECK0 + 1.6, r[3], 'paint', { paint: 'white' });
    L.box(r[0], ROOF - 0.5, r[1], r[2], ROOF, r[3], 'paint', { paint: 'white' });
  }
  L.box(d0 + 0.5, DECK0 + 7.1, d0 + 0.5, d1 - 0.5, DECK0 + 8.1, d1 - 0.5, 'paint', { paint: 'white', solid: false });
  for (const s of [-1, 1]) {
    L.box(d0, DECK0 + 1.6, C + s * DH - 0.1, d1, ROOF - 0.5, C + s * DH + 0.1, 'paint', { paint: 'deckGlass' });
    L.box(C + s * DH - 0.1, DECK0 + 1.6, d0 + 0.1, C + s * DH + 0.1, ROOF - 0.5, d1 - 0.1, 'paint', { paint: 'deckGlass' });
    // The white band between the two floors, outside the glass.
    L.box(d0 - 0.2, DECK0 + 7.4, C + s * DH - 0.3, d1 + 0.2, DECK0 + 8.4, C + s * DH + 0.3, 'paint', { paint: 'white', solid: false });
    L.box(C + s * DH - 0.3, DECK0 + 7.4, d0, C + s * DH + 0.3, DECK0 + 8.4, d1, 'paint', { paint: 'white', solid: false });
  }
  // The ladder's shaft through the deck, and a rail round the roof.
  L.box(hatch[0] - 0.1, DECK0, hatch[1] - 0.1, hatch[0], ROOF - 0.5, hatch[3], 'steel');
  L.box(hatch[2], DECK0, hatch[1] - 0.1, hatch[2] + 0.1, ROOF - 0.5, hatch[3], 'steel');
  const rail = ROOF + 1.1;
  L.box(d0, ROOF, d0, d1, rail, d0 + 0.08, 'steel');
  L.box(d0, ROOF, d1 - 0.08, d1, rail, d1, 'steel');
  L.box(d0, ROOF, d0, d0 + 0.08, rail, d1, 'steel');
  L.box(d1 - 0.08, ROOF, d0, d1, rail, d1, 'steel');

  // The upper lattice to the Top Deck (its posts stand on the deck's roof, the braces let people pass).
  lattice(L, [ROOF, 176, 200, 224, 246], (y) => 12.5 - (7.5 * (y - ROOF)) / (246 - ROOF), (y) => 1.6 - (0.6 * (y - ROOF)) / (246 - ROOF), 8, true);
  // The Top Deck (250 m): a small glazed box, white.
  L.box(C - 6.2, 246, C - 6.2, C + 6.2, 248, C + 6.2, 'paint', { paint: 'white' });
  L.box(C - 6, 248, C - 6, C + 6, 253, C + 6, 'paint', { paint: 'deckGlass' });
  L.box(C - 6.2, 253, C - 6.2, C + 6.2, 255, C + 6.2, 'paint', { paint: 'white' });
  // The antenna: a slim lattice, then the mast in bands.
  lattice(L, [255, 275, 295], (y) => 4.2 - (2 * (y - 255)) / 40, () => 0.8, 4, false);
  let y = 295;
  for (const [r, h] of [[1.6, 13], [1.1, 13], [0.6, 12]] as const) {
    L.column(C, C, r, y, y + h, 'paint', { paint: band(y + h / 2), taper: 0.8 });
    y += h;
  }
  L.box(C - 0.3, TOP - 1, C - 0.3, C + 0.3, TOP, C + 0.3, 'paint', { paint: 'red', solid: false });

  // The maintenance ladder up the foot building's front wall, through the hatches; the deck's roof is the firing position.
  L.ladder(C, 50.45, 0, -1, 0, ROOF);
  L.vantage(C, ROOF, d1 - 0.7);

  // 90 days on: a relief point by the entrance — tents, crates; a burnt car under the leg.
  L.tent(16, 66, 'x', 7);
  L.tent(16, 74, 'x', 7);
  L.crates(26, 70, 5);
  L.car(64, 72, 'z', { burnt: true });
  L.fallenSign(42, 60, 'x');
}
