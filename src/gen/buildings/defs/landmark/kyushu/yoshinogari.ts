// L8: 吉野ヶ里遺跡 (the Yoshinogari site), Kanzaki and Yoshinogari, Saga. The great moated settlement of the
// Yayoi period, its northern inner enclosure (北内郭) rebuilt on the excavated post holes: a ring of
// ditch and a palisade of pointed stakes, tall timber watchtowers (物見櫓) at its corners — four posts,
// a lookout platform, a thatched roof —, and in the middle the main ritual hall (主祭殿), a raised hall
// under a great thatched roof, with raised storehouses beside it.
//
// Real size: the watchtowers about 12 m, the hall 12.5 m square and 16.4 m high. The enclosure is drawn
// smaller (40 × 38 m inside the palisade). A firing position: the front-left watchtower's platform
// (9.3 m), up its ladder. The front (local z = d, the gate) faces south.

import { landmarkDef, type Lm } from '../common.ts';
import { slant } from '../kanto/parts.ts';

const W = 56;
const D = 56;
const [X0, Z0, X1, Z1] = [8, 8, 48, 46];
const GATE = 28;
const DECK = 9.3;

export const LANDMARK_YOSHINOGARI = landmarkDef({
  variant: 'yoshinogari',
  size: { w: [W, W], d: [D, D] },
  eaves: 9,
  top: 16.4,
  roof: 'hip',
  kind: 'house',
  build,
});

/**
 * A watchtower round (cx, cz): four posts, ties and braces, the platform and its rail (open over the
 * ladder on the front when `ladder`), the thatched roof on the posts.
 */
function tower(L: Lm, cx: number, cz: number, ladder: boolean): void {
  const p = 2.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(cx + sx * p - 0.25, 0, cz + sz * p - 0.25, cx + sx * p + 0.25, 11.8, cz + sz * p + 0.25, 'woodDark');
  for (const y of [3.2, 6.4]) {
    for (const s of [-1, 1]) {
      L.box(cx - p, y, cz + s * p - 0.12, cx + p, y + 0.25, cz + s * p + 0.12, 'woodDark', { solid: false });
      L.box(cx + s * p - 0.12, y, cz - p, cx + s * p + 0.12, y + 0.25, cz + p, 'woodDark', { solid: false });
    }
  }
  // Cross braces on the two side faces (they read as the tower's lattice from afar).
  for (const s of [-1, 1]) {
    slant(L, [cx + s * p, 0.4, cz - p], [cx + s * p, 6.2, cz + p], 5, 0.2, 'brown');
    slant(L, [cx + s * p, 0.4, cz + p], [cx + s * p, 6.2, cz - p], 5, 0.2, 'brown');
  }
  // The platform and its rail of boards.
  const e = 3;
  L.box(cx - e, DECK - 0.35, cz - e, cx + e, DECK, cz + e, 'wood');
  L.box(cx - e, DECK, cz - e, cx + e, DECK + 1, cz - e + 0.12, 'wood', { solid: false });
  L.box(cx - e, DECK, cz - e, cx - e + 0.12, DECK + 1, cz + e, 'wood', { solid: false });
  L.box(cx + e - 0.12, DECK, cz - e, cx + e, DECK + 1, cz + e, 'wood', { solid: false });
  if (ladder) {
    for (const s of [-1, 1]) L.box(s < 0 ? cx - e : cx + 0.6, DECK, cz + e - 0.12, s < 0 ? cx - 0.6 : cx + e, DECK + 1, cz + e, 'wood', { solid: false });
  } else {
    L.box(cx - e, DECK, cz + e - 0.12, cx + e, DECK + 1, cz + e, 'wood', { solid: false });
  }
  // The thatched roof (hip and its small gable ridge), from the posts' heads.
  L.shape('hip', cx - 3.8, 11.6, cz - 3.8, cx + 3.8, 13.4, cz + 3.8, 'paint', { paint: 'thatch', axis: 'x' });
  L.shape('gable', cx - 2, 12.9, cz - 1.2, cx + 2, 14.4, cz + 1.2, 'paint', { paint: 'thatch', axis: 'x', solid: false });
  L.box(cx - 2.2, 14.2, cz - 0.25, cx + 2.2, 14.55, cz + 0.25, 'paint', { paint: 'brown', solid: false });
  if (ladder) {
    L.ladder(cx, cz + e + 0.45, 0, -1, 0, DECK);
    L.vantage(cx, DECK, cz);
  }
}

/** A raised storehouse (高床倉庫): stilts, a plank box, a steep thatched gable. */
function store(L: Lm, cx: number, cz: number): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(cx + sx * 2 - 0.2, 0, cz + sz * 1.6 - 0.2, cx + sx * 2 + 0.2, 2.2, cz + sz * 1.6 + 0.2, 'woodDark');
  L.box(cx - 2.4, 2.2, cz - 2, cx + 2.4, 4.4, cz + 2, 'wood');
  L.shape('gable', cx - 3.2, 4.2, cz - 3, cx + 3.2, 7.6, cz + 3, 'paint', { paint: 'thatch', axis: 'x' });
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('gravel', [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]]);
  // The ring ditch (環壕) outside the palisade, a causeway at the gate.
  L.ground('water', [[3, 3], [W - 3, 3], [W - 3, 6], [3, 6]], 2.2, 1.4);
  L.ground('water', [[3, 6], [6, 6], [6, Z1 + 2], [3, Z1 + 2]], 2.2, 1.4);
  L.ground('water', [[W - 6, 6], [W - 3, 6], [W - 3, Z1 + 2], [W - 6, Z1 + 2]], 2.2, 1.4);
  L.ground('water', [[3, Z1 + 2], [GATE - 3, Z1 + 2], [GATE - 3, Z1 + 5], [3, Z1 + 5]], 2.2, 1.4);
  L.ground('water', [[GATE + 3, Z1 + 2], [W - 3, Z1 + 2], [W - 3, Z1 + 5], [GATE + 3, Z1 + 5]], 2.2, 1.4);

  // The palisade: a plank fence and pointed stakes over it every 2.4 m, the gate in the front.
  const fence = (ax: number, az: number, bx: number, bz: number): void => {
    const len = Math.hypot(bx - ax, bz - az);
    const [ux, uz] = [(bx - ax) / len, (bz - az) / len];
    L.box(Math.min(ax, bx) - (uz ? 0.15 : 0), 0, Math.min(az, bz) - (ux ? 0.15 : 0), Math.max(ax, bx) + (uz ? 0.15 : 0), 2.6, Math.max(az, bz) + (ux ? 0.15 : 0), 'woodDark');
    for (let t = 0.6; t < len; t += 2.4) {
      const [x, z] = [ax + ux * t, az + uz * t];
      L.column(x, z, 0.2, 2.6, 3.4, 'woodDark', { taper: 0.1, solid: false });
    }
  };
  fence(X0, Z0, X1, Z0);
  fence(X0, Z0, X0, Z1);
  fence(X1, Z0, X1, Z1);
  fence(X0, Z1, GATE - 2, Z1);
  fence(GATE + 2, Z1, X1, Z1);
  // The gate: two posts and a lintel with the bird ornaments (鳥形木製品) on it.
  for (const s of [-1, 1]) L.box(GATE + s * 2 - 0.25, 0, Z1 - 0.25, GATE + s * 2 + 0.25, 4.6, Z1 + 0.25, 'woodDark');
  L.box(GATE - 2.6, 4.2, Z1 - 0.2, GATE + 2.6, 4.6, Z1 + 0.2, 'woodDark', { solid: false });
  for (const x of [GATE - 1.4, GATE, GATE + 1.4]) L.box(x - 0.3, 4.6, Z1 - 0.08, x + 0.3, 5, Z1 + 0.08, 'woodDark', { solid: false });

  // The watchtowers at the front corners and the back right.
  tower(L, X0 + 4.5, Z1 - 5.5, true);
  tower(L, X1 - 4.5, Z1 - 5.5, false);
  tower(L, X1 - 4, Z0 + 4, false);

  // The main ritual hall: stilts, the raised floor, the plank walls of two storeys, the great thatch.
  const [HX, HZ] = [26, 22];
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) L.box(HX + sx * 5.6 - 0.3, 0, HZ + sz * 5.6 - 0.3, HX + sx * 5.6 + 0.3, 2.6, HZ + sz * 5.6 + 0.3, 'woodDark');
  L.box(HX - 6.2, 2.6, HZ - 6.2, HX + 6.2, 3.1, HZ + 6.2, 'wood');
  L.box(HX - 5.6, 3.1, HZ - 5.6, HX + 5.6, 9.2, HZ + 5.6, 'wood');
  L.box(HX - 5.7, 5.9, HZ - 5.7, HX + 5.7, 6.3, HZ + 5.7, 'paint', { paint: 'brown', solid: false });
  L.windows('x', HZ + 5.6, 1, HX - 3, HX + 3, 2, 3.6, 5.4, 1.4, { paint: 'black', broken: 0 });
  L.shape('hip', HX - 7.6, 8.6, HZ - 7.6, HX + 7.6, 13, HZ + 7.6, 'paint', { paint: 'thatch', axis: 'x' });
  L.shape('gable', HX - 5.4, 12, HZ - 3.6, HX + 5.4, 16.2, HZ + 3.6, 'paint', { paint: 'thatch', axis: 'x' });
  L.box(HX - 5.8, 16, HZ - 0.4, HX + 5.8, 16.4, HZ + 0.4, 'paint', { paint: 'brown', solid: false });
  for (const s of [-1, 1]) L.shape('gable', HX + s * 5.4 - 0.05, 12.2, HZ - 3, HX + s * 5.4 + 0.05, 15.8, HZ + 3, 'wood', { axis: 'z', solid: false });
  // A ladder of a log up to the hall's floor (a step-cut log), and the storehouses behind.
  L.box(HX - 0.4, 0, HZ + 6.2, HX + 0.4, 2.6, HZ + 8.4, 'paint', { paint: 'brown', solid: false });
  store(L, 14, 14);
  store(L, 15, 30);

  // 90 days on: sandbags across the gate, a relief tent and crates outside it, a fallen sign.
  L.sandbags(GATE - 1.6, Z1 + 1.2, GATE + 1.6, Z1 + 1.2);
  L.tent(12, D - 3, 'x', 6);
  L.crates(40, D - 3.5, 4);
  L.fallenSign(GATE + 6, D - 2.5, 'x');
}
