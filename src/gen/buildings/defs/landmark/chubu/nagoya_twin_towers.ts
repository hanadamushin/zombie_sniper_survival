// L4: 名古屋駅 JRセントラルタワーズ (the twin towers over Nagoya Station, 2000). A long podium of
// the station building (the department store and the concourse, about 60 m) and on it two round
// towers: the office tower (245 m, 51 floors) to the south and the hotel tower (226 m, 53 floors) to
// the north, pale grey stone and banded glass, each with its crown. The front has the glass wall of
// the concourse and the bus terminal's canopy before it.
//
// The podium (about 180 m along the station) is shortened to 120 m; the towers and their heights are
// real size. In the shrunk area the station's tracks are a band 100 m wide where the towers stand (and
// railways are never cut), so the lot stands west of the tracks: the front (local z = d) faces west,
// the Taikō-dōri side; local x runs from north (0) to south (w).

import { landmarkDef, type Lm } from '../common.ts';
import { round, roundSolid } from '../kanto/parts.ts';

const W = 120;
const D = 64;
const POD = 60; // the podium's roof
/** The towers: middle along x, middle in z, radius, height. */
const OFFICE = { x: 86, z: 30, r: 21, h: 245 };
const HOTEL = { x: 34, z: 30, r: 19, h: 226 };

export const LANDMARK_NAGOYA_TWIN_TOWERS = landmarkDef({
  variant: 'nagoya_twin_towers',
  size: { w: [W, W], d: [D, D] },
  eaves: POD,
  top: 250,
  kind: 'office',
  build,
});

/** A round tower from the podium's roof: banded glass between stone, the crown. */
function tower(L: Lm, t: { x: number; z: number; r: number; h: number }, crown: 'office' | 'hotel'): void {
  const body = t.h - (crown === 'office' ? 14 : 10);
  round(L, t.x, t.z, t.r, POD, body, 'granite');
  roundSolid(L, t.x, t.z, t.r * 0.97, POD, body, 3);
  // The glass bands (a slightly larger dark drum every few floors, so the tower reads as striped).
  for (let y = POD + 6; y < body - 6; y += 12) L.column(t.x, t.z, t.r + 0.2, y, y + 7, 'paint', { paint: 'deckGlass', solid: false, yaw: Math.PI / 24 });
  // The vertical stone fins on the front (towards +z).
  L.box(t.x - 1.2, POD, t.z + t.r - 0.6, t.x + 1.2, body, t.z + t.r + 0.5, 'paint', { paint: 'white' });
  if (crown === 'office') {
    // A drawn-in crown of three steps and the mast.
    round(L, t.x, t.z, t.r * 0.86, body, body + 6, 'granite');
    round(L, t.x, t.z, t.r * 0.66, body + 6, body + 11, 'gray');
    L.column(t.x, t.z, t.r * 0.4, body + 11, t.h, 'paint', { paint: 'silver' });
    L.column(t.x - 4, t.z, 0.4, t.h, t.h + 5, 'paint', { paint: 'red', solid: false });
  } else {
    // A ring of fins round a flat top (the hotel's crown), the helipad.
    round(L, t.x, t.z, t.r * 0.94, body, body + 4, 'granite');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const [x, z] = [t.x + Math.cos(a) * t.r * 0.8, t.z + Math.sin(a) * t.r * 0.8];
      L.box(x - 0.7, body + 4, z - 0.7, x + 0.7, t.h, z + 0.7, 'paint', { paint: 'silver', solid: false });
    }
    L.box(t.x - 7, body + 4, t.z - 7, t.x + 7, body + 4.6, t.z + 7, 'paint', { paint: 'charcoal' });
  }
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The podium: stone, the floors' window bands, a step back near the top.
  L.box(2, 0, 4, W - 2, POD - 8, D - 10, 'paint', { paint: 'granite' });
  L.box(4, POD - 8, 6, W - 4, POD, D - 12, 'paint', { paint: 'granite' });
  // The floors' window bands: one long dark strip a floor on each face (a pane each would cost
  // thousands of triangles), and a few black gaps where the glass is gone.
  for (let f = 0; f < 9; f++) {
    const y = 9 + f * 4.6;
    L.box(4, y, D - 10, W - 4, y + 2.6, D - 9.92, 'paint', { paint: 'windowDark', solid: false });
    L.box(4, y, 3.92, W - 4, y + 2.6, 4, 'paint', { paint: 'windowDark', solid: false });
    L.box(W - 2, y, 6, W - 1.92, y + 2.6, D - 14, 'paint', { paint: 'windowDark', solid: false });
    L.box(1.92, y, 6, 2, y + 2.6, D - 14, 'paint', { paint: 'windowDark', solid: false });
  }
  L.windows('x', D - 9.92, 1, 6, 44, 4, 13.6, 16.2, 4, { paint: 'black' });
  L.windows('x', D - 9.92, 1, 78, 116, 3, 27.4, 30, 5, { paint: 'black' });
  // The concourse's glass wall in the middle of the front, its canopy.
  L.box(46, 0, D - 10, 74, 22, D - 9.6, 'glass');
  L.box(42, 22, D - 10.4, 78, 24, D - 9.4, 'paint', { paint: 'silver' });
  L.box(36, 6, D - 9.6, 84, 6.8, D - 3, 'paint', { paint: 'silver', solid: false });
  for (const x of [38, 50, 62, 74, 82]) L.box(x - 0.3, 0, D - 3.6, x + 0.3, 6, D - 3, 'paint', { paint: 'silver' });

  tower(L, OFFICE, 'office');
  tower(L, HOTEL, 'hotel');

  // 90 days on: the plaza before the station — a line of burnt-out buses and cars, relief tents and
  // sandbags at the concourse's door, broken glass (the windows above), scorch up the podium.
  L.car(14, D - 4, 'x', { burnt: true });
  L.car(22, D - 5, 'x');
  L.car(100, D - 4, 'x', { burnt: true });
  L.box(88, 0.3, D - 7, 99, 3.4, D - 4.5, 'paint', { paint: 'charcoal' }); // a burnt-out bus
  L.tent(56, D - 6, 'x', 6);
  L.crates(66, D - 6, 5);
  L.sandbags(46, D - 8.8, 74, D - 8.8);
  L.scorch(8, 4, D - 9.94, 18, 24, D - 9.86);
}
