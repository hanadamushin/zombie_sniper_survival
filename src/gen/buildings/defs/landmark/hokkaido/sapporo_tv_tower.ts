// L1 (R1's tower remade exterior-only): さっぽろテレビ塔 (Sapporo TV Tower, 1957, Naitō Tachū) at the
// east end of Ōdōri Park. 147.2 m with the antenna, the observation deck's floor at 90.38 m. A steel
// lattice: four legs splayed wide at the foot (an Eiffel-like curve) meeting under the glass deck,
// braced by horizontal rings; the big digital clock on the face towards the park; a narrower lattice
// and the antenna mast above the deck. A low building stands between the legs at the back.
//
// Firing position: the deck's roof (94 m), reached by the maintenance ladder inside the lattice (it
// goes up through hatches in the deck's floor and roof). The front (local z = d) faces the park.

import { subtractRects, type Rect } from '../../../kit.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 20;
const DECK = 90; // floor of the deck
const ROOF = 94; // its roof
const SHAFT = 6; // inset of the legs at the deck (m from the lot edge)

export const LANDMARK_SAPPORO_TV_TOWER = landmarkDef({
  variant: 'sapporo_tv_tower',
  size: { w: [W, W], d: [W, W] },
  eaves: ROOF,
  top: 147.2,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  const steel = { paint: 'intlOrange' as const };
  const legA = 1.0;
  // Inset of a leg's outer face at height y (0 at the foot, SHAFT at the deck): steep at first, then straight up.
  const inset = (y: number): number => 0.3 + (SHAFT - 0.3) * (1 - (1 - Math.min(1, y / (DECK - 2))) ** 2.2);
  const segs = 12;
  const top = DECK - 1.5;
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
  // Horizontal rings between the legs (the lattice's chords).
  for (const y of [10, 24, 40, 56, 70, 82]) {
    const e = inset(y) + 0.2;
    const f = W - e;
    L.box(e, y - 0.35, e, f, y, e + 0.35, 'paint', steel);
    L.box(e, y - 0.35, f - 0.35, f, y, f, 'paint', steel);
    L.box(e, y - 0.35, e, e + 0.35, y, f, 'paint', steel);
    L.box(f - 0.35, y - 0.35, e, f, y, f, 'paint', steel);
  }
  // Diagonals across the two broad lower panels of each side (in plan they cannot lean: posts up the middle).
  for (const y of [10, 24, 40]) {
    const e = inset(y) + 0.2;
    L.box(W / 2 - 0.25, y, e, W / 2 + 0.25, y + (y === 40 ? 16 : 14), e + 0.3, 'paint', steel);
    L.box(W / 2 - 0.25, y, W - e - 0.3, W / 2 + 0.25, y + (y === 40 ? 16 : 14), W - e, 'paint', steel);
    L.box(e, y, W / 2 - 0.25, e + 0.3, y + (y === 40 ? 16 : 14), W / 2 + 0.25, 'paint', steel);
    L.box(W - e - 0.3, y, W / 2 - 0.25, W - e, y + (y === 40 ? 16 : 14), W / 2 + 0.25, 'paint', steel);
  }

  // The building between the legs (shops at the foot), at the back.
  L.box(3, 0, 2.5, 17, 8.5, 11, 'paint', { paint: 'offWhite' });
  L.box(2.8, 8.5, 2.3, 17.2, 9.1, 11.2, 'paint', { paint: 'charcoal' });
  L.windows('x', 11, 1, 3.5, 16.5, 5, 4.6, 7.6, 2.2, { broken: 0.5 });
  L.windows('z', 3, -1, 3, 10.5, 3, 4.6, 7.6, 2, { broken: 0.4 });
  L.windows('z', 17, 1, 3, 10.5, 3, 4.6, 7.6, 2, { broken: 0.4 });
  L.box(4.5, 0, 11, 7.5, 2.6, 11.12, 'doorSteel'); // the shut entrance
  L.scorch(13, 0.5, 11, 16.5, 6, 11.1);

  // The digital clock on the front, under the deck.
  const yc = 72;
  const ec = inset(yc + 3);
  L.box(W / 2 - 4.5, yc, W - ec - 0.2, W / 2 + 4.5, yc + 5, W - ec + 0.2, 'paint', { paint: 'black' });
  L.box(W / 2 - 3.6, yc + 1.2, W - ec + 0.2, W / 2 + 3.6, yc + 3.8, W - ec + 0.35, 'paint', { paint: 'lampGlass', solid: false });

  // The deck: a glass box 12 m square on the legs, hatches for the ladder in its floor and roof.
  const hatch: Rect = [W / 2 - 0.55, 11, W / 2 + 0.55, 12];
  const d0 = 4;
  const d1 = W - 4;
  for (const r of subtractRects([d0, d0, d1, d1], [hatch])) {
    L.box(r[0], DECK - 1.6, r[1], r[2], DECK, r[3], 'paint', { paint: 'gray' });
    L.box(r[0], ROOF - 0.4, r[1], r[2], ROOF, r[3], 'paint', { paint: 'gray' });
  }
  L.box(d0, DECK, d0, d1, ROOF - 0.4, d0 + 0.1, 'glass');
  L.box(d0, DECK, d1 - 0.1, d1, ROOF - 0.4, d1, 'glass');
  L.box(d0, DECK, d0 + 0.1, d0 + 0.1, ROOF - 0.4, d1 - 0.1, 'glass');
  L.box(d1 - 0.1, DECK, d0 + 0.1, d1, ROOF - 0.4, d1 - 0.1, 'glass');
  for (const [x, z] of [[d0, d0], [d1 - 0.4, d0], [d0, d1 - 0.4], [d1 - 0.4, d1 - 0.4]] as const) L.box(x, DECK, z, x + 0.4, ROOF, z + 0.4, 'paint', steel);
  // The ladder's shaft through the deck, and a rail round the roof.
  L.box(hatch[0] - 0.1, DECK, hatch[1] - 0.1, hatch[0], ROOF - 0.4, hatch[3], 'steel');
  L.box(hatch[2], DECK, hatch[1] - 0.1, hatch[2] + 0.1, ROOF - 0.4, hatch[3], 'steel');
  const rail = ROOF + 1.1;
  L.box(d0, ROOF, d0, d1, rail, d0 + 0.08, 'steel');
  L.box(d0, ROOF, d1 - 0.08, d1, rail, d1, 'steel');
  L.box(d0, ROOF, d0, d0 + 0.08, rail, d1, 'steel');
  L.box(d1 - 0.08, ROOF, d0, d1, rail, d1, 'steel');

  // Above the deck: a narrower lattice to 120 m, then the antenna.
  let y = ROOF;
  for (const [e0, h] of [[7.5, 10], [8.1, 9], [8.7, 7]] as const) {
    const f = W - e0;
    for (const [x, z] of [[e0, e0], [f - 0.7, e0], [e0, f - 0.7], [f - 0.7, f - 0.7]] as const) L.box(x, y, z, x + 0.7, y + h + 0.2, z + 0.7, 'paint', steel);
    L.box(e0, y + h - 0.3, e0, f, y + h, e0 + 0.3, 'paint', steel);
    L.box(e0, y + h - 0.3, f - 0.3, f, y + h, f, 'paint', steel);
    L.box(e0, y + h - 0.3, e0, e0 + 0.3, y + h, f, 'paint', steel);
    L.box(f - 0.3, y + h - 0.3, e0, f, y + h, f, 'paint', steel);
    y += h;
  }
  for (const [half, h, c] of [[1.1, 12, 'white'], [0.7, 8, 'red'], [0.45, 5, 'white'], [0.25, 2.2, 'red']] as const) {
    L.box(W / 2 - half, y, W / 2 - half, W / 2 + half, y + h, W / 2 + half, 'paint', { paint: c });
    y += h;
  }

  // The maintenance ladder: up the lattice on the back building's front wall, through the hatches.
  L.ladder(W / 2, 11.45, 0, -1, 0, ROOF);
  L.vantage(W / 2, ROOF, d1 - 0.7);

  // 90 days on: a burnt-out car and a line of sandbags by the foot.
  L.car(5.2, 16.5, 'x', { burnt: true });
  L.sandbags(12.5, 18.6, 17, 18.6);
}
