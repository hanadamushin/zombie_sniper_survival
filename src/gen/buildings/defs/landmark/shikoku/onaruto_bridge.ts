// L9: 大鳴門橋 (the Ōnaruto Bridge, 1985), the suspension bridge over the Naruto Strait and its
// whirlpools between Shikoku (Ōge Island, Naruto) and Awaji Island: 1,629 m (spans 330 + 876 + 330 m
// between the anchorages), two white towers 144 m above the sea, the deck 41 m over the strait on a
// deep stiffening truss (its lower level, built for a railway that never came, holds the walkway
// 渦の道 over the whirlpools).
//
// Laid along the area's motorway from Ōge Island to Awaji (the table's `bridge` line, cell 21106).
// Shrunk 1/10 in plan (163 m between the anchorages over the 152 m of the shrunk strait); the towers
// 3.4 times the deck's height over the water, as the real ones (docs/realmap_guide.md §7, L9).

import { bridgeDef } from '../bridge.ts';

export const LANDMARK_ONARUTO_BRIDGE = bridgeDef({
  variant: 'onaruto_bridge',
  spans: [330, 876, 330],
  at: 26,
  main: 'suspension',
  deck: { width: 22, thick: 1.2, top: 'gray', side: 'white', parapet: 1.1, parapetPaint: 'white' },
  profile: { clear: 9, slope: 0.075, crest: 1 },
  truss: { y0: -4.5, y1: 0, panel: 10, paint: 'offWhite', posts: false, steps: 2 },
  tower: { shape: 'portal', top: 31, leg: [3, 2], struts: [0.5, 0.75, 0.97], paint: 'white', cap: 0.8 },
  cable: { sag: 1.2, hangers: 8, paint: 'silver', thick: 0.9, anchorage: { length: 10, height: 8, paint: 'stone' } },
  piers: { every: 14, paint: 'stone', columns: 2, size: 2 },
  yard: { length: 230, depth: 46, water: [36, 200] },
  shell: 8000,
});
