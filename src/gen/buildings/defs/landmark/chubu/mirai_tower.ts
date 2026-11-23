// L4: 中部電力 MIRAI TOWER (the old Nagoya TV Tower, 1954, Naitō Tachū — Japan's first central TV
// tower) in Hisaya-ōdōri Park. 180 m; the glass Sky Deck at 90 m and the open Sky Balcony at 100 m on
// top of it. A silver-grey steel lattice: four legs splayed wide at the foot and drawn in under the
// deck, horizontal rings, the deck as a glass box; above it the narrower lattice and the antenna. A
// four-storey building stands between the legs (the entrance, and since 2022 a hotel's lobby).
//
// Firing position: the Sky Balcony (100 m), reached by the maintenance ladder up the building's back wall and the
// lattice, through hatches in the deck's floor, roof and the balcony's floor. The front (local
// z = d) faces south down the park.

import { subtractRects, type Rect } from '../../../kit.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 30;
const DECK = 90; // the Sky Deck's floor
const DROOF = 96.6; // its roof
const BAL = 100; // the Sky Balcony's floor
const SHAFT = 9.5; // inset of the legs at the deck (m from the lot edge)
const BLD = 14; // the building between the legs

export const LANDMARK_MIRAI_TOWER = landmarkDef({
  variant: 'mirai_tower',
  size: { w: [W, W], d: [W, W] },
  eaves: BAL,
  top: 180,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  const steel = { paint: 'silver' as const };
  L.ground('paved', [[0, 0], [W, 0], [W, W], [0, W]]);
  const legA = 1.3;
  // The leg's outer face inset at height y: steep at the foot, then nearly straight up to the deck.
  const inset = (y: number): number => 0.3 + (SHAFT - 0.3) * (1 - (1 - Math.min(1, y / (DECK - 2))) ** 2);
  const segs = 14;
  const top = DECK - 1.6;
  for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    for (let i = 0; i < segs; i++) {
      const y0 = (top * i) / segs;
      const y1 = (top * (i + 1)) / segs;
      const e = inset((y0 + y1) / 2);
      const x = sx === 0 ? e : W - e - legA;
      const z = sz === 0 ? e : W - e - legA;
      L.box(x, y0, z, x + legA, y1 + 0.3, z + legA, 'paint', steel);
    }
  }
  // Horizontal rings (the lattice's chords) and the upright posts up the middle of each face (the
  // diagonals from afar).
  const rings = [BLD, 28, 42, 56, 68, 79];
  for (const y of rings) {
    const e = inset(y) + 0.2;
    const f = W - e;
    L.box(e, y - 0.4, e, f, y, e + 0.4, 'paint', steel);
    L.box(e, y - 0.4, f - 0.4, f, y, f, 'paint', steel);
    L.box(e, y - 0.4, e, e + 0.4, y, f, 'paint', steel);
    L.box(f - 0.4, y - 0.4, e, f, y, f, 'paint', steel);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const [y0, y1] = [rings[i]!, rings[i + 1]!];
    const e = inset(y0) + 0.25;
    for (const u of [W / 3, (2 * W) / 3]) {
      if (y0 > 50 && u !== W / 3) continue; // one post per face where the lattice is narrow
      const uu = y0 > 50 ? W / 2 : u;
      L.box(uu - 0.2, y0, e, uu + 0.2, y1, e + 0.3, 'paint', steel);
      L.box(uu - 0.2, y0, W - e - 0.3, uu + 0.2, y1, W - e, 'paint', steel);
      L.box(e, y0, uu - 0.2, e + 0.3, y1, uu + 0.2, 'paint', steel);
      L.box(W - e - 0.3, y0, uu - 0.2, W - e, y1, uu + 0.2, 'paint', steel);
    }
  }

  // The building between the legs: four storeys, glass bands, the shut entrance on the front.
  L.box(5, 0, 12, 25, BLD - 0.4, 25, 'paint', { paint: 'offWhite' });
  L.box(4.8, BLD - 0.4, 11.8, 25.2, BLD, 25.2, 'paint', { paint: 'charcoal' });
  for (const f of [0, 1, 2, 3]) {
    const y0 = 1 + f * 3.2;
    L.windows('x', 25, 1, 6, 24, 6, y0, y0 + 2, 2.4, { broken: 0.4 });
    L.windows('x', 12, -1, 6, 24, 6, y0, y0 + 2, 2.4, { broken: 0.3 });
    L.windows('z', 25, 1, 13, 24, 4, y0, y0 + 2, 2.4, { broken: 0.3 });
    L.windows('z', 5, -1, 13, 24, 4, y0, y0 + 2, 2.4, { broken: 0.3 });
  }
  L.box(12, 0, 25, 18, 2.8, 25.12, 'doorSteel');
  L.scorch(19, 0.4, 25.05, 24, 6.5, 25.14);

  // The Sky Deck: a glass box 15 m square on the legs; hatches for the ladder in its floor and roof.
  const hatch: Rect = [W / 2 - 0.55, 11, W / 2 + 0.55, 12];
  const [d0, d1] = [7.5, W - 7.5];
  for (const r of subtractRects([d0, d0, d1, d1], [hatch])) {
    L.box(r[0], DECK - 1.6, r[1], r[2], DECK, r[3], 'paint', { paint: 'gray' });
    L.box(r[0], DROOF - 0.5, r[1], r[2], DROOF, r[3], 'paint', { paint: 'gray' });
  }
  L.box(d0, DECK, d0, d1, DROOF - 0.5, d0 + 0.1, 'glass');
  L.box(d0, DECK, d1 - 0.1, d1, DROOF - 0.5, d1, 'glass');
  L.box(d0, DECK, d0 + 0.1, d0 + 0.1, DROOF - 0.5, d1 - 0.1, 'glass');
  L.box(d1 - 0.1, DECK, d0 + 0.1, d1, DROOF - 0.5, d1 - 0.1, 'glass');
  L.box(d0 - 0.1, DECK + 3.2, d0 - 0.1, d1 + 0.1, DECK + 3.5, d1 + 0.1, 'paint', { paint: 'silver', solid: false }); // the band between its two floors
  for (const [x, z] of [[d0, d0], [d1 - 0.5, d0], [d0, d1 - 0.5], [d1 - 0.5, d1 - 0.5]] as const) L.box(x, DECK, z, x + 0.5, DROOF, z + 0.5, 'paint', steel);
  L.box(hatch[0] - 0.1, DECK, hatch[1] - 0.1, hatch[0], DROOF - 0.5, hatch[3], 'steel');
  L.box(hatch[2], DECK, hatch[1] - 0.1, hatch[2] + 0.1, DROOF - 0.5, hatch[3], 'steel');

  // The lattice through the deck up to the balcony (four posts), the balcony's floor, its rail.
  const [b0, b1] = [9.6, W - 9.6];
  for (const [x, z] of [[b0, b0], [b1 - 0.8, b0], [b0, b1 - 0.8], [b1 - 0.8, b1 - 0.8]] as const) L.box(x, DROOF, z, x + 0.8, BAL, z + 0.8, 'paint', steel);
  const hatch2 = hatch;
  for (const r of subtractRects([b0 - 1.2, b0 - 1.2, b1 + 1.2, b1 + 1.2], [hatch2])) L.box(r[0], BAL - 0.5, r[1], r[2], BAL, r[3], 'paint', { paint: 'gray' });
  L.box(hatch2[0] - 0.1, DROOF, hatch2[1] - 0.1, hatch2[0], BAL - 0.5, hatch2[3], 'steel');
  L.box(hatch2[2], DROOF, hatch2[1] - 0.1, hatch2[2] + 0.1, BAL - 0.5, hatch2[3], 'steel');
  const rail = BAL + 1.1;
  const [r0, r1] = [b0 - 1.2, b1 + 1.2];
  L.box(r0, BAL, r0, r1, rail, r0 + 0.08, 'steel');
  L.box(r0, BAL, r1 - 0.08, r1, rail, r1, 'steel');
  L.box(r0, BAL, r0, r0 + 0.08, rail, r1, 'steel');
  L.box(r1 - 0.08, BAL, r0, r1, rail, r1, 'steel');

  // Above the balcony: a narrower lattice to 140 m, then the antenna mast with its beacon.
  let y = BAL;
  for (const [e0, h] of [[10.6, 14], [11.4, 14], [12.3, 12]] as const) {
    const f = W - e0;
    for (const [x, z] of [[e0, e0], [f - 0.8, e0], [e0, f - 0.8], [f - 0.8, f - 0.8]] as const) L.box(x, y, z, x + 0.8, y + h + 0.2, z + 0.8, 'paint', steel);
    for (const yy of [y + h / 2, y + h]) {
      L.box(e0, yy - 0.35, e0, f, yy, e0 + 0.35, 'paint', steel);
      L.box(e0, yy - 0.35, f - 0.35, f, yy, f, 'paint', steel);
      L.box(e0, yy - 0.35, e0, e0 + 0.35, yy, f, 'paint', steel);
      L.box(f - 0.35, yy - 0.35, e0, f, yy, f, 'paint', steel);
    }
    y += h;
  }
  for (const [half, h, c] of [[1.4, 16, 'silver'], [0.9, 12, 'silver'], [0.55, 9.6, 'white'], [0.3, 2.4, 'red']] as const) {
    L.box(W / 2 - half, y, W / 2 - half, W / 2 + half, y + h, W / 2 + half, 'paint', { paint: c });
    y += h;
  }

  // The maintenance ladder: up the building's back wall and the lattice's middle, through the hatches.
  L.ladder(W / 2, 11.5, 0, 1, 0, BAL);
  L.vantage(W / 2, BAL, r1 - 0.7);

  // 90 days on: a burnt-out car and sandbags by the foot, a fallen sign in the park.
  L.car(3, 28, 'x', { burnt: true });
  L.sandbags(19, 27.6, 27, 27.6);
  L.fallenSign(26.5, 2.5, 'z');
}
