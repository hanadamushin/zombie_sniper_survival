// L2, L9: 青森ベイブリッジ (Aomori Bay Bridge, 1992), the cable-stayed bridge over the inner port by
// Aomori Station: 1,219 m long, its cable-stayed part 498 m (spans 129 + 240 + 129 m) on two white
// concrete towers shaped as an inverted Y — the "A" of Aomori — whose single mast carries one plane of
// fanned stays down to the middle of the 25 m deck (一面吊り, Japan's first such four-lane PC bridge);
// the approach viaducts carry it on over the railway yard and the quays at both ends. The towers'
// height is not in the sources at hand: about 80 m, read from photographs (the deck about a third up).
//
// L9: laid along its real line from 柳川 to 安方 (the table's `bridge` line; the area data has no road
// on it: its ends are tied to the nearest streets). Shrunk 1/10 in plan (the stayed part 50 m, the
// whole 168 m); the towers 2.4 times the deck's height over the water, as the real ones
// (docs/realmap_guide.md §7, L9).

import { bridgeDef } from '../bridge.ts';

export const LANDMARK_AOMORI_BAY_BRIDGE = bridgeDef({
  variant: 'aomori_bay_bridge',
  spans: [129, 240, 129],
  at: 87,
  main: 'stayed',
  deck: { width: 22, thick: 1.4, top: 'gray', side: 'white', parapet: 1.1, parapetPaint: 'white', lines: [0] },
  profile: { clear: 6.5, slope: 0.075 },
  tower: { shape: 'pole', top: 19, leg: [2.2, 1.2], paint: 'white', cap: 1 },
  stays: { n: 7, plane: 'one', paint: 'white', from: 0.45 },
  piers: { every: 11, paint: 'offWhite', columns: 2, size: 1.8 },
  yard: { length: 182, depth: 40, water: [84, 142] },
  shell: 8000,
});
