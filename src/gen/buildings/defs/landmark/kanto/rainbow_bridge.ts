// L3a, L9: レインボーブリッジ (Rainbow Bridge, 1993), the suspension bridge over the inner harbour from
// Shibaura to Daiba: 798 m between its anchorages (spans 114 + 570 + 114 m), two white towers 126 m
// above the sea, the deck a double-decked truss (the Shuto expressway above; the waterfront road, the
// Yurikamome and the walkways below), 52 m of clearance. From the Daiba anchorage the approach
// viaduct curves on over the water to Daiba.
//
// L9: laid along the area's own road from the Shibaura shore to Daiba (the table's `bridge` line):
// both towers, both anchorages, the main cables from end to end, the approach on its piers. Shrunk
// 1/10 in plan (80 m between the anchorages); the lower deck no higher than its ramps reach from the
// shores, the towers 28 m over the water: twice the truss's top, as the real ones (docs/realmap_guide.md
// §7, L9).

import { bridgeDef } from '../bridge.ts';

export const LANDMARK_RAINBOW_BRIDGE = bridgeDef({
  variant: 'rainbow_bridge',
  spans: [114, 570, 114],
  at: 12,
  main: 'suspension',
  deck: { width: 26, thick: 1.4, top: 'gray', side: 'white', parapet: 1.1, parapetPaint: 'white', rails: [0] },
  profile: { clear: 6, slope: 0.075, crest: 0.6 },
  upper: { gap: 6.5, top: 'gray', parapet: 'silver' },
  truss: { y0: -1.4, y1: 7.2, panel: 8, paint: 'white' },
  tower: { shape: 'portal', top: 28, leg: [3.2, 2.2], struts: [0.66, 0.92], paint: 'white', cap: 1.6 },
  cable: { sag: 1.2, hangers: 5, paint: 'silver', thick: 0.9, anchorage: { length: 8, height: 10, paint: 'offWhite' } },
  piers: { every: 14, paint: 'offWhite', columns: 2, size: 2.2 },
  yard: { length: 190, depth: 48, water: [14, 176] },
  shell: 8000,
});
