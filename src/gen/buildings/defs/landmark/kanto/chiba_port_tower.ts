// L3b: 千葉ポートタワー (Chiba Port Tower, 1986), Chiba Port Park. 125.2 m (137 m to the lightning rod):
// a slim prism on a rhombus 15.12 m a side, sheathed all over in half-mirror glass that shows the sky
// and the bay, but for the clear glass of the observation floors near the top (105 m and 113 m). A low
// entrance hall at its foot, the park's lawn round it.
//
// The rhombus (diagonals 26.2 m and 15.1 m) is four glass walls turned by 30° (parts.ts beam) round a
// hidden solid core; its roof two turned slabs. The front (local z = d) faces the park (south).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';
import { beam } from './parts.ts';

const W = 40;
const D = 44;
const C = 20;
const CZ = 18;
/** Half diagonals of the rhombus (along x and z). */
const HX = 13.1;
const HZ = 7.56;
const TOP = 125.2;

export const LANDMARK_CHIBA_PORT_TOWER = landmarkDef({
  variant: 'chiba_port_tower',
  size: { w: [W, W], d: [D, D] },
  eaves: TOP,
  top: 137,
  kind: 'tower',
  build,
});

/** The rhombus' four walls from y0 to y1, pushed out by `out` m (bands proud of the skin). */
function rhombus(L: Lm, y0: number, y1: number, paint: PaintName, out = 0, thick = 0.5): void {
  const k = 1 + out / HZ;
  const pts: [number, number][] = [[C + HX * k, CZ], [C, CZ + HZ * k], [C - HX * k, CZ], [C, CZ - HZ * k]];
  for (let i = 0; i < 4; i++) {
    const [a, b] = [pts[i]!, pts[(i + 1) % 4]!];
    beam(L, a[0], a[1], b[0], b[1], y0, y1, thick, paint, false);
  }
}

function build(L: Lm): void {
  L.ground('grass', [[0, 0], [W, 0], [W, D], [0, D]]);
  L.ground('paved', [[C - 3, CZ], [C + 3, CZ], [C + 3, D], [C - 3, D]]);
  // The solid core (hidden): what stops people and bullets inside the glass.
  L.box(C - HX * 0.5, 0, CZ - HZ * 0.5, C + HX * 0.5, TOP, CZ + HZ * 0.5, 'paint', { paint: 'gray', hidden: true });
  L.box(C - HX * 0.22, 0, CZ - HZ * 0.78, C + HX * 0.22, TOP, CZ + HZ * 0.78, 'paint', { paint: 'gray', hidden: true });
  // The mirror glass to the observation floors, then the floors' clear glass, the mirror again, the roof.
  rhombus(L, 0, 103, 'mirror');
  rhombus(L, 103, 117, 'deckGlass');
  for (const y of [103, 110, 117]) rhombus(L, y - 0.5, y + 0.5, 'silver', 0.15, 0.3);
  rhombus(L, 117, TOP, 'mirror');
  rhombus(L, TOP - 0.6, TOP, 'silver', 0.15, 0.4);
  // The roof: two slabs turned to the sides (they cover the rhombus but for its tips).
  for (const s of [-1, 1]) beam(L, C - HX * 0.75, CZ - s * HZ * 0.25, C + HX * 0.75, CZ + s * HZ * 0.25, TOP - 0.4, TOP, HZ * 1.1, 'silver', false);
  // The white mullions on the four corners, full height.
  for (const [x, z] of [[C + HX, CZ], [C - HX, CZ], [C, CZ + HZ], [C, CZ - HZ]] as const) L.box(x - 0.35, 0, z - 0.35, x + 0.35, TOP, z + 0.35, 'paint', { paint: 'white', solid: false });
  // The mast and the lightning rod.
  L.column(C, CZ, 1, TOP, TOP + 3, 'paint', { paint: 'silver' });
  L.column(C, CZ, 0.25, TOP + 3, 137, 'steel', { taper: 0.3 });

  // The entrance hall at the foot (front), shut.
  L.box(C - 9, 0, CZ + 6, C + 9, 6, CZ + 14, 'paint', { paint: 'offWhite' });
  L.box(C - 9.3, 6, CZ + 5.7, C + 9.3, 6.6, CZ + 14.3, 'paint', { paint: 'silver' });
  L.windows('x', CZ + 14, 1, C - 8, C + 8, 4, 1, 5, 3.2, { paint: 'skyBlue', broken: 0.5 });
  L.box(C - 1.6, 0, CZ + 14, C + 1.6, 3, CZ + 14.15, 'doorSteel');

  // 90 days on: a relief tent and crates on the lawn, a burnt car, a fallen sign, scorched glass.
  L.tent(6, 38, 'x', 7);
  L.crates(34, 38, 3);
  L.car(33, 4, 'x', { burnt: true });
  L.fallenSign(C + 6, D - 2, 'x');
  L.scorch(C - 6, 0.4, CZ + 14.05, C - 2, 5, CZ + 14.2);
}
