// L6: 嚴島神社 大鳥居 (the Great Torii of Itsukushima Shrine), Miyajima, Hiroshima, a World Heritage
// site. The vermilion gate standing in the sea 200 m out from the shrine (1875, of camphor wood, held
// up by its own weight): two great main pillars, and before and behind each a smaller pillar (稚児柱)
// tied to it by beams under a little roof (the "両部鳥居" style), the tie beam (貫), the double top
// lintel (島木 and 笠木) with its dark roof and upturned ends, the plaque in the middle. At high tide
// the sea reaches far up its pillars.
//
// Real size: 16.6 m to the top, the top lintel 24.2 m, the main pillars 3.2 m thick and 10.9 m apart.
// The lot is sea (the table drains nothing: the blueprint digs it); the shrine itself, 200 m off
// (20 m in the shrunk area), is not drawn. The gate faces the open sea (local z = d).

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 48;
const D = 44;
const CX = 24;
const CZ = 22;
const RED: PaintName = 'intlOrange';
const SPAN = 10.9;
const H = 16.6;

export const LANDMARK_ITSUKUSHIMA_OTORII = landmarkDef({
  variant: 'itsukushima_otorii',
  size: { w: [W, W], d: [D, D] },
  eaves: 14,
  top: H,
  kind: 'shed',
  build,
});

/** A beam across the gate (along x) from u0 to u1 (relative to the middle), y0..y1, half depth t. */
function across(L: Lm, u0: number, u1: number, y0: number, y1: number, t: number, paint: PaintName = RED): void {
  L.box(CX + u0, y0, CZ - t, CX + u1, y1, CZ + t, 'paint', { paint });
}

function build(L: Lm): void {
  // The sea (the shrunk area's own water is filled under the lot and dug again here).
  L.ground('water', [[0, 0], [W, 0], [W, D], [0, D]], 3, 1.2);
  const foot = -3;

  const half = SPAN / 2;
  for (const s of [-1, 1]) {
    const px = CX + s * half;
    // The main pillar (round, a little thinner at the top) and the four small pillars round it, two on
    // each side along z, tied by two beams and roofed.
    L.column(px, CZ, 1.6, foot, H - 2.2, 'paint', { paint: RED, taper: 0.9 });
    for (const sz of [-1, 1]) {
      const pz = CZ + sz * 4.4;
      L.column(px, pz, 0.7, foot, 8.6, 'paint', { paint: RED, taper: 0.92 });
      const [z0, z1] = sz > 0 ? [CZ, pz + 0.7] : [pz - 0.7, CZ];
      for (const [y0, y1] of [[4.6, 5.3], [7.6, 8.3]] as const) L.box(px - 0.45, y0, z0, px + 0.45, y1, z1, 'paint', { paint: RED });
      // The small roof over the beams (dark, cypress bark).
      L.box(px - 1.2, 8.6, Math.min(z0, z1) - 0.5, px + 1.2, 9.1, Math.max(z0, z1) + 0.5, 'paint', { paint: 'charcoal', solid: false });
    }
    // The pillar's foot in the sea (a darker band where the tide runs), the stones round it.
    L.column(px, CZ, 1.72, foot, -0.2, 'paint', { paint: 'brown', solid: false });
  }

  // The tie beam (貫) passing out beyond the pillars, the plaque post (額束) and the plaque.
  across(L, -half - 3.4, half + 3.4, 10.4, 11.5, 0.6);
  across(L, -0.6, 0.6, 11.5, 14, 0.4);
  L.box(CX - 1.3, 11.9, CZ + 0.4, CX + 1.3, 13.7, CZ + 0.55, 'paint', { paint: 'charcoal', solid: false });
  L.box(CX - 1.3, 11.9, CZ - 0.55, CX + 1.3, 13.7, CZ - 0.4, 'paint', { paint: 'charcoal', solid: false });
  // The double top lintel: 島木 (vermilion), 笠木 (vermilion with its dark roof), the ends turning up.
  across(L, -11, 11, 14, 14.9, 0.75);
  across(L, -12.1, 12.1, 14.9, 15.8, 0.9);
  across(L, -12.3, 12.3, 15.8, 16.1, 1.05, 'charcoal');
  for (const s of [-1, 1]) {
    const u = s * 12.1;
    across(L, Math.min(u, u - s * 2.4), Math.max(u, u - s * 2.4), 16.1, H, 0.8, 'charcoal');
  }

  // 90 days on: a small boat drifted against the gate, upside down.
  L.box(CX + 8, -1.3, CZ + 9, CX + 13, -0.5, CZ + 11, 'paint', { paint: 'offWhite', solid: false });
  L.box(CX + 8.6, -0.5, CZ + 9.4, CX + 12.4, -0.25, CZ + 10.6, 'paint', { paint: 'navy', solid: false });
}
