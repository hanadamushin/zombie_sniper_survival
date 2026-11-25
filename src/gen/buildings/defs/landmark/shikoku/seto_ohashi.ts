// L10: 瀬戸大橋 (Seto-Ōhashi, 1988), the six bridges of the Kojima–Sakaide route over the Bisan Seto,
// one building type each (one row each in the landmark tables): the expressway on the upper deck,
// the JR Seto-Ōhashi line on the lower one, inside a stiffening truss all the way.
//   下津井瀬戸大橋  Shimotsui-Seto      suspension, towers 2, spans 230 + 940 + 230 (Washūzan → Hitsuishijima)
//   櫃石島橋        Hitsuishijima       cable-stayed, towers 2, spans 185 + 420 + 185
//   岩黒島橋        Iwakurojima         cable-stayed, towers 2, spans 185 + 420 + 185
//   与島橋          Yoshima             continuous truss, spans 175 + 245 + 165
//   北備讃瀬戸大橋  Kita Bisan-Seto     suspension, towers 2, spans 274 + 990 + 274
//   南備讃瀬戸大橋  Minami Bisan-Seto   suspension, towers 2, spans 274 + 1,100 + 274 (→ Bannosu, Sakaide)
// Only the Shimotsui-Seto bridge has an area (cell 20597: Washūzan and the north tip of Hitsuishijima);
// the islands and the other five bridges lie in cell 20764, a sea cell of the strategic map with no
// area (PROGRESS.md L10). Their rows stand on the strategic map and in the landmark yard.
//
// Shrunk 1/10 in plan as L9 (the Shimotsui strait is 94 m of water in its area: the main span); the
// walking deck is the lower one (the railway's), the upper one (the expressway) is the outside only,
// as the Rainbow Bridge's. Towers about three times the deck's height over the sea (L9's rule).

import type { BridgeDesign } from '../bridge.ts';
import { bridgeDef } from '../bridge.ts';

/** What the six share: the double deck in its truss. */
const SETO: Pick<BridgeDesign, 'deck' | 'profile' | 'upper' | 'truss' | 'shell'> = {
  deck: { width: 22, thick: 1.2, top: 'gray', side: 'offWhite', parapet: 1.1, parapetPaint: 'offWhite', rails: [-3, 3], piece: 30 },
  profile: { clear: 9, slope: 0.075, crest: 0.6 },
  upper: { gap: 6.5, top: 'gray', parapet: 'silver' },
  truss: { y0: -1.2, y1: 7.2, panel: 13, paint: 'offWhite', posts: false, steps: 2 },
  shell: 8000,
};
const CABLE = { sag: 1.2, hangers: 11, paint: 'silver', thick: 1.2, anchorage: { length: 10, height: 10, paint: 'stone' } } as const;

export const LANDMARK_SHIMOTSUI_SETO_BRIDGE = bridgeDef({
  ...SETO,
  variant: 'shimotsui_seto_bridge',
  spans: [230, 940, 230],
  at: 5,
  main: 'suspension',
  tower: { shape: 'portal', top: 31, leg: [3, 2.2], struts: [0.62, 0.97], paint: 'offWhite', cap: 0.8 },
  cable: CABLE,
  piers: { every: 14, paint: 'offWhite', columns: 2, size: 2.2 },
  yard: { length: 150, depth: 48, water: [26, 124] },
});

export const LANDMARK_HITSUISHIJIMA_BRIDGE = bridgeDef({
  ...SETO,
  variant: 'hitsuishijima_bridge',
  spans: [185, 420, 185],
  main: 'stayed',
  tower: { shape: 'portal', top: 30, leg: [2.8, 2], struts: [0.55, 0.97], paint: 'offWhite', cap: 0.6 },
  stays: { n: 4, plane: 'two', paint: 'silver', from: 0.45, step: 2.6 },
  piers: { every: 14, paint: 'offWhite', columns: 2, size: 2.2 },
  yard: { length: 90, depth: 48, water: [10, 80] },
});

export const LANDMARK_IWAKUROJIMA_BRIDGE = bridgeDef({
  ...SETO,
  variant: 'iwakurojima_bridge',
  spans: [185, 420, 185],
  main: 'stayed',
  tower: { shape: 'portal', top: 30, leg: [2.8, 2], struts: [0.55, 0.97], paint: 'offWhite', cap: 0.6 },
  stays: { n: 4, plane: 'two', paint: 'silver', from: 0.45, step: 2.6 },
  piers: { every: 14, paint: 'offWhite', columns: 2, size: 2.2 },
  yard: { length: 90, depth: 48, water: [10, 80] },
});

export const LANDMARK_YOSHIMA_BRIDGE = bridgeDef({
  ...SETO,
  variant: 'yoshima_bridge',
  spans: [175, 245, 165],
  main: 'girder',
  truss: { y0: -1.2, y1: 9, panel: 6, paint: 'offWhite', steps: 3 },
  piers: { every: 0, paint: 'offWhite', columns: 2, size: 2.6 },
  yard: { length: 70, depth: 40, water: [8, 62] },
});

export const LANDMARK_KITA_BISAN_SETO_BRIDGE = bridgeDef({
  ...SETO,
  variant: 'kita_bisan_seto_bridge',
  // (No crest, longer truss panels: the longest two keep within 8,000 triangles.)
  profile: { clear: 9, slope: 0.075 },
  truss: { y0: -1.2, y1: 7.2, panel: 18, paint: 'offWhite', posts: false, steps: 2 },
  spans: [274, 990, 274],
  main: 'suspension',
  tower: { shape: 'portal', top: 33, leg: [3, 2.2], struts: [0.62, 0.97], paint: 'offWhite', cap: 0.8 },
  cable: CABLE,
  piers: { every: 14, paint: 'offWhite', columns: 2, size: 2.2 },
  yard: { length: 160, depth: 48, water: [24, 136] },
});

export const LANDMARK_MINAMI_BISAN_SETO_BRIDGE = bridgeDef({
  ...SETO,
  variant: 'minami_bisan_seto_bridge',
  // (No crest, longer truss panels: the longest two keep within 8,000 triangles.)
  profile: { clear: 9, slope: 0.075 },
  truss: { y0: -1.2, y1: 7.2, panel: 18, paint: 'offWhite', posts: false, steps: 2 },
  spans: [274, 1100, 274],
  main: 'suspension',
  tower: { shape: 'portal', top: 35, leg: [3, 2.2], struts: [0.62, 0.97], paint: 'offWhite', cap: 0.8 },
  cable: CABLE,
  piers: { every: 14, paint: 'offWhite', columns: 2, size: 2.2 },
  yard: { length: 166, depth: 46, water: [22, 144] },
});
