// L10: しまなみ海道 (the Shimanami Kaidō, Onomichi–Imabari): its three great bridges, one building
// type each (one row each in the landmark tables).
//   来島海峡大橋 (Kurushima-Kaikyō, 1999): three suspension bridges in a row, 4,105 m — the first
//     (960 m, main span 600) from Ōshima to Bushijima, the second (1,515 m, main span 1,020) to Umajima,
//     the third (1,570 m, main span 1,030) to Imabari; six towers. Three rows that meet over the water
//     (Bushijima is too small for the area) and on Umajima: ends at the same height.
//   多々羅大橋 (Tatara, 1999): cable-stayed, spans 270 + 890 + 320, towers 220 m (two legs leaning
//     together above the deck), Ikuchijima → Ōmishima.
//   因島大橋 (Innoshima, 1983): suspension, spans 250 + 770 + 250, a stiffening truss under the deck,
//     Mukaishima → Innoshima.
// All three have their areas (cells 21258, 20925, 20759). Shrunk 1/10 in plan (L9); the towers about
// three times the deck's height over the sea (Tatara's are lower than its 8.5 times: they would stand
// higher than the bridge is long in the area).

import type { BridgeDesign } from '../bridge.ts';
import { bridgeDef } from '../bridge.ts';

const KURUSHIMA: Pick<BridgeDesign, 'main' | 'deck' | 'profile' | 'cable' | 'piers' | 'shell'> = {
  main: 'suspension',
  deck: { width: 20, thick: 1.6, top: 'gray', side: 'silver', parapet: 1.1, parapetPaint: 'silver', piece: 20 },
  profile: { clear: 10, slope: 0.075, crest: 0.6 },
  cable: { sag: 1.2, hangers: 8, paint: 'silver', thick: 0.9, anchorage: { length: 9, height: 9, paint: 'stone' } },
  piers: { every: 0, paint: 'stone', columns: 2, size: 2 },
  shell: 8000,
};
const tower = (top: number): BridgeDesign['tower'] => ({ shape: 'portal', top, leg: [2.6, 1.9], struts: [0.6, 0.97], paint: 'silver', cap: 0.6 });

export const LANDMARK_KURUSHIMA_KAIKYO_BRIDGE_1 = bridgeDef({
  ...KURUSHIMA,
  variant: 'kurushima_kaikyo_bridge_1',
  spans: [180, 600, 180],
  at: 42.5,
  tower: tower(24),
  // (The yard starts the main structure at `at` as the area does: room for it all.)
  yard: { length: 150, depth: 44, water: [50, 136] },
});

export const LANDMARK_KURUSHIMA_KAIKYO_BRIDGE_2 = bridgeDef({
  ...KURUSHIMA,
  variant: 'kurushima_kaikyo_bridge_2',
  spans: [250, 1020, 245],
  // From the junction over the water to the Umajima anchorage: the whole line (151.5 m at 1/10).
  fit: 0,
  tower: tower(27),
  yard: { length: 155, depth: 44, water: [10, 145] },
});

export const LANDMARK_KURUSHIMA_KAIKYO_BRIDGE_3 = bridgeDef({
  ...KURUSHIMA,
  variant: 'kurushima_kaikyo_bridge_3',
  spans: [260, 1030, 280],
  at: 0,
  tower: tower(29),
  yard: { length: 160, depth: 44, water: [10, 150] },
});

export const LANDMARK_TATARA_BRIDGE = bridgeDef({
  variant: 'tatara_bridge',
  spans: [270, 890, 320],
  at: 10.5,
  main: 'stayed',
  deck: { width: 20, thick: 1.4, top: 'gray', side: 'offWhite', parapet: 1.1, parapetPaint: 'offWhite', piece: 20 },
  profile: { clear: 8, slope: 0.09, crest: 0.5 },
  tower: { shape: 'aFrame', top: 36, leg: [2.6, 1.6], struts: [0.3], paint: 'offWhite', cap: 0.8 },
  stays: { n: 5, plane: 'two', paint: 'silver', from: 0.4, step: 2.2 },
  piers: { every: 0, paint: 'stone', columns: 2, size: 2 },
  yard: { length: 172, depth: 44, water: [14, 160] },
  shell: 8000,
});

export const LANDMARK_INNOSHIMA_BRIDGE = bridgeDef({
  variant: 'innoshima_bridge',
  spans: [250, 770, 250],
  at: 19.5,
  main: 'suspension',
  deck: { width: 18, thick: 1.2, top: 'gray', side: 'offWhite', parapet: 1.1, parapetPaint: 'offWhite', piece: 20 },
  profile: { clear: 10, slope: 0.075, crest: 0.6 },
  truss: { y0: -3.6, y1: 0, panel: 8, paint: 'offWhite', posts: false, steps: 2 },
  tower: { shape: 'portal', top: 29, leg: [2.6, 1.9], struts: [0.55, 0.8, 0.97], paint: 'offWhite', cap: 0.6 },
  cable: { sag: 1.2, hangers: 7, paint: 'silver', thick: 0.9, anchorage: { length: 9, height: 9, paint: 'stone' } },
  piers: { every: 0, paint: 'stone', columns: 2, size: 2 },
  yard: { length: 172, depth: 44, water: [24, 142] },
  shell: 8000,
});
