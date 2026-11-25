// L9: 関門橋 (the Kanmon Bridge, 1973), the suspension bridge of the Kanmon Expressway over the Kanmon
// Strait between Shimonoseki (Honshu) and Moji (Kyushu): 1,068 m between its anchorages (spans
// 178 + 712 + 178 m), two steel towers 141 m above the sea standing on both shores, the deck (six
// lanes on a stiffening truss) 61 m over the strait.
//
// Laid along the area's motorway from the Moji shore across to the Dannoura side (the table's
// `bridge` line, all in cell 21574). Shrunk 1/10 in plan (107 m between the anchorages over the 68 m
// of the shrunk strait: the towers stand on the shores as the real ones); the towers 2.3 times the
// deck's height over the water, as the real ones (docs/realmap_guide.md §7, L9).

import { bridgeDef } from '../bridge.ts';

export const LANDMARK_KANMON_BRIDGE = bridgeDef({
  variant: 'kanmon_bridge',
  spans: [178, 712, 178],
  at: 40.6,
  main: 'suspension',
  deck: { width: 24, thick: 1.2, top: 'gray', side: 'silver', parapet: 1.1, parapetPaint: 'silver' },
  profile: { clear: 12, slope: 0.075, crest: 0.8 },
  truss: { y0: -3.4, y1: 0, panel: 9, paint: 'silver', posts: false, steps: 2 },
  tower: { shape: 'portal', top: 30, leg: [2.6, 1.8], struts: [0.6, 0.97], paint: 'silver', cap: 0.8 },
  cable: { sag: 1.1, hangers: 6, paint: 'silver', thick: 0.8, anchorage: { length: 9, height: 7, paint: 'stone' } },
  piers: { every: 14, paint: 'stone', columns: 2, size: 2 },
  yard: { length: 178, depth: 46, water: [40, 140] },
  shell: 8000,
});
