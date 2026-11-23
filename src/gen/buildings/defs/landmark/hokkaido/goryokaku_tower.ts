// L1 (R1's tower remade exterior-only): 五稜郭タワー (Goryōkaku Tower, Hakodate, 2006) beside the star
// fort. 107 m; a white concrete shaft carries the two-storey observation deck (floors at about 86 and
// 90 m) whose plan is a five-pointed star like the fort below it; a glass atrium at its foot and a
// short spire on top.
//
// Firing position: the deck's roof (94 m), by the maintenance ladder up the back of the shaft and
// through hatches in the deck. The front (local z = d) is the atrium's side.

import { subtractRects, type Rect } from '../../../kit.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 25;
const C = W / 2;
const LOW = 82; // underside of the deck
const MID = 88; // the upper floor
const ROOF = 94;

export const LANDMARK_GORYOKAKU_TOWER = landmarkDef({
  variant: 'goryokaku_tower',
  size: { w: [W, W], d: [W, W] },
  eaves: ROOF,
  top: 107,
  kind: 'tower',
  build,
});

function build(L: Lm): void {
  const white = { paint: 'white' as const };
  const shaft = 4.2;
  L.column(C, C, shaft, 0, LOW + 0.5, 'paint', white);
  // Two pale stripes up the shaft's front (the lift's windows).
  L.box(C - 0.8, 10, C + shaft - 0.25, C + 0.8, LOW - 2, C + shaft + 0.15, 'paint', { paint: 'skyBlue', solid: false });

  // The glass atrium at the foot.
  L.box(2.5, 0, 16, 22.5, 9.5, 24.5, 'paint', { paint: 'offWhite' });
  L.box(2.3, 9.5, 15.8, 22.7, 10.2, 24.7, 'paint', { paint: 'gray' });
  L.windows('x', 24.5, 1, 3, 22, 6, 1.2, 8.8, 2.8, { paint: 'skyBlue', broken: 0.4 });
  L.windows('z', 2.5, -1, 16.5, 24, 2, 1.2, 8.8, 3, { paint: 'skyBlue', broken: 0.5 });
  L.windows('z', 22.5, 1, 16.5, 24, 2, 1.2, 8.8, 3, { paint: 'skyBlue', broken: 0.5 });
  L.box(11, 0, 24.5, 14, 2.6, 24.62, 'doorSteel'); // the shut doors
  L.scorch(4, 0.4, 24.5, 9, 7, 24.6);

  // The deck: a square core (dark glass between white slabs) and the star's five points.
  const hatch: Rect = [C - 0.55, C - shaft - 0.95, C + 0.55, C - shaft + 0.05];
  const solid = (half: number, y0: number, y1: number, paint: 'white' | 'windowDark'): void => {
    for (const r of subtractRects([C - half, C - half, C + half, C + half], [hatch])) L.box(r[0], y0, r[1], r[2], y1, r[3], 'paint', { paint });
  };
  solid(8, LOW, LOW + 1.4, 'white');
  solid(7.9, LOW + 1.4, MID - 0.6, 'windowDark');
  solid(8, MID - 0.6, MID, 'white');
  solid(6.2, MID, ROOF - 0.6, 'windowDark');
  solid(6.2, ROOF - 0.6, ROOF, 'white');
  const points = (radius: number, half: number, y0: number, y1: number): void => {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = C + Math.cos(a) * radius;
      const z = C + Math.sin(a) * radius;
      // A square turned so that a corner points out from the middle (a diamond).
      const yaw = -a + Math.PI / 4;
      L.box(x - half, y0, z - half, x + half, y0 + 1.4, z + half, 'paint', { paint: 'white', yaw });
      L.box(x - half + 0.1, y0 + 1.4, z - half + 0.1, x + half - 0.1, y1 - 0.6, z + half - 0.1, 'paint', { paint: 'windowDark', yaw });
      L.box(x - half, y1 - 0.6, z - half, x + half, y1, z + half, 'paint', { paint: 'white', yaw });
    }
  };
  points(9.4, 2.1, LOW, MID);
  points(7.1, 1.7, MID, ROOF);
  // A rail round the roof, the spire.
  const e0 = C - 6.2;
  const e1 = C + 6.2;
  const rail = ROOF + 1.1;
  L.box(e0, ROOF, e0, e1, rail, e0 + 0.08, 'steel');
  L.box(e0, ROOF, e1 - 0.08, e1, rail, e1, 'steel');
  L.box(e0, ROOF, e0, e0 + 0.08, rail, e1, 'steel');
  L.box(e1 - 0.08, ROOF, e0, e1, rail, e1, 'steel');
  L.column(C, C, 1.2, ROOF, ROOF + 2.5, 'paint', white);
  L.column(C, C, 0.45, ROOF + 2.5, 107, 'steel', { taper: 0.25 });

  // The ladder up the back of the shaft and through the deck.
  L.ladder(C, C - shaft - 0.45, 0, 1, 0, ROOF);
  L.vantage(C, ROOF, e1 - 0.7);

  // 90 days on: an abandoned car and relief crates behind the tower.
  L.car(4.5, 3, 'x');
  L.crates(18.5, 3, 4);
}
