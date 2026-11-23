// L2: 伊達政宗騎馬像 (the equestrian statue of Date Masamune, 1935, recast 1964) on the site of the
// main enclosure of Sendai Castle (仙台城跡 本丸, Aobayama). The lord in armour on a standing horse,
// in bronze, on a tall granite pedestal at the edge of the enclosure, looking out over the city —
// the long crescent on his helmet (三日月の前立) is what tells him from afar. About 4.5 m of statue
// on 4.5 m of stone.
//
// The lot is the end of the enclosure: the gravel plaza, the pedestal, the stone parapet and rail
// on the edge (the drop to the city in front), a few pines and the rest house of the castle site.
// The front (local z = d) is the side the statue looks to.

import { landmarkDef, type Lm } from '../common.ts';
import { pine } from './parts.ts';

const W = 40;
const D = 40;
const CX = 20;
const CZ = 22;
/** Top of the pedestal. */
const PED = 4.5;

export const LANDMARK_DATE_MASAMUNE_STATUE = landmarkDef({
  variant: 'date_masamune_statue',
  size: { w: [W, W], d: [D, D] },
  eaves: PED,
  top: 13,
  kind: 'shed',
  build,
});

function build(L: Lm): void {
  const bronze = { paint: 'bronze' as const, solid: false };
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The pedestal: two granite steps and the block, its plaque on the front.
  L.box(CX - 3.6, 0, CZ - 5, CX + 3.6, 0.5, CZ + 5, 'paint', { paint: 'gray' });
  L.box(CX - 3, 0.5, CZ - 4.4, CX + 3, 1.0, CZ + 4.4, 'paint', { paint: 'gray' });
  L.box(CX - 2.3, 1.0, CZ - 3.6, CX + 2.3, PED - 0.3, CZ + 3.6, 'paint', { paint: 'stone' });
  L.box(CX - 2.6, PED - 0.3, CZ - 3.9, CX + 2.6, PED, CZ + 3.9, 'paint', { paint: 'stone' });
  L.box(CX - 1.2, 1.8, CZ + 3.6, CX + 1.2, 3.4, CZ + 3.68, 'paint', { paint: 'bronze', solid: false });

  // The horse, standing, facing the front (+z): body, four legs, neck and head, tail.
  const y = PED;
  L.box(CX - 0.75, y + 1.55, CZ - 1.9, CX + 0.75, y + 2.75, CZ + 1.7, 'paint', { paint: 'bronze' });
  for (const [x, z] of [[-0.45, -1.5], [0.45, -1.3], [-0.45, 1.25], [0.45, 1.4]] as const) L.box(CX + x - 0.18, y, CZ + z - 0.2, CX + x + 0.18, y + 1.65, CZ + z + 0.2, 'paint', bronze);
  L.box(CX - 0.4, y + 2.3, CZ + 1.4, CX + 0.4, y + 3.3, CZ + 2.3, 'paint', bronze); // neck, rising
  L.box(CX - 0.35, y + 3.0, CZ + 2.0, CX + 0.35, y + 3.8, CZ + 2.6, 'paint', bronze);
  L.box(CX - 0.3, y + 2.9, CZ + 2.5, CX + 0.3, y + 3.5, CZ + 3.4, 'paint', bronze); // head, nose down
  L.box(CX - 0.18, y + 3.75, CZ + 2.2, CX - 0.06, y + 4.05, CZ + 2.35, 'paint', bronze); // ears
  L.box(CX + 0.06, y + 3.75, CZ + 2.2, CX + 0.18, y + 4.05, CZ + 2.35, 'paint', bronze);
  L.box(CX - 0.15, y + 1.2, CZ - 2.2, CX + 0.15, y + 2.6, CZ - 1.85, 'paint', bronze); // tail

  // The rider: legs astride, the armoured body, the arms (the reins), the head with its helmet and crescent.
  for (const s of [-1, 1]) L.box(CX + s * 0.8 - 0.18, y + 1.6, CZ - 0.2, CX + s * 0.8 + 0.18, y + 2.75, CZ + 0.5, 'paint', bronze);
  L.box(CX - 0.55, y + 2.75, CZ - 0.6, CX + 0.55, y + 4.0, CZ + 0.2, 'paint', bronze); // body
  L.box(CX - 0.85, y + 3.6, CZ - 0.55, CX + 0.85, y + 4.05, CZ + 0.15, 'paint', bronze); // shoulder guards
  for (const s of [-1, 1]) L.box(CX + s * 0.5 - 0.14, y + 3.1, CZ + 0.1, CX + s * 0.5 + 0.14, y + 3.4, CZ + 0.9, 'paint', bronze); // forearms
  L.box(CX - 0.25, y + 4.05, CZ - 0.45, CX + 0.25, y + 4.45, CZ + 0.0, 'paint', bronze); // face
  L.box(CX - 0.42, y + 4.35, CZ - 0.6, CX + 0.42, y + 4.65, CZ + 0.12, 'paint', bronze); // helmet
  L.box(CX - 0.6, y + 4.15, CZ - 0.65, CX + 0.6, y + 4.3, CZ - 0.05, 'paint', bronze); // its neck guard
  // The crescent (三日月の前立): long and thin, its horns rising out to both sides from the brow.
  const cz = CZ + 0.15;
  L.box(CX - 0.35, y + 4.5, cz, CX + 0.35, y + 4.62, cz + 0.06, 'paint', bronze);
  const steps: [number, number, number][] = [[0.35, 0.95, 4.58], [0.95, 1.45, 4.7], [1.45, 1.85, 4.88], [1.85, 2.15, 5.12]];
  for (const [a, b, h] of steps) {
    // The right horn a little longer than the left (the real one is lopsided).
    L.box(CX + a, y + h, cz, CX + b * 1.05, y + h + 0.14, cz + 0.06, 'paint', bronze);
    L.box(CX - b * 0.92, y + h, cz, CX - a, y + h + 0.14, cz + 0.06, 'paint', bronze);
  }

  // The edge of the enclosure: a low stone parapet and a rail, the drop to the city beyond the lot.
  L.box(0, 0, D - 1.6, W, 0.7, D - 0.4, 'paint', { paint: 'stone' });
  for (let x = 1; x < W; x += 3) L.box(x - 0.06, 0.7, D - 1.06, x + 0.06, 1.3, D - 0.94, 'paint', { paint: 'charcoal', solid: false });
  L.box(0, 1.2, D - 1.08, W, 1.3, D - 0.92, 'paint', { paint: 'charcoal', solid: false });
  // The stone walls of the enclosure along the sides (a low top course).
  L.box(0, 0, 0, 1.4, 1, D - 1.6, 'paint', { paint: 'stone' });
  // The rest house at the back: a long low building, its glass front.
  L.box(26, 0, 2, 38, 4.2, 9, 'paint', { paint: 'offWhite' });
  L.windows('x', 9, 1, 27, 37, 5, 0.8, 3.4, 1.7, { broken: 0.6 });
  L.shape('gable', 25.5, 4.2, 1.5, 38.5, 6, 9.5, 'paint', { paint: 'charcoal', axis: 'x' });
  pine(L, 6, 6, 9);
  pine(L, 5, 26, 8);
  pine(L, 36, 18, 10);

  // 90 days on: sandbags at the pedestal's foot, relief crates, a burnt car by the rest house.
  L.sandbags(CX - 4.6, CZ + 6.2, CX + 4.6, CZ + 6.2);
  L.crates(9, 13, 4);
  L.tent(30, 14, 'x', 6);
  L.car(14, 4, 'x', { burnt: true });
}
