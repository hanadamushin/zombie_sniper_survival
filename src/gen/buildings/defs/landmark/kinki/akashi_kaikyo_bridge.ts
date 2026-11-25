// L5, L9: 明石海峡大橋 (the Akashi Kaikyō Bridge, 1998), the strait between Kōbe (Maiko) and Awaji
// Island: 3,911 m between its anchorages, the longest suspension span of its time (960 + 1,991 + 960 m),
// two towers 298.3 m above the sea painted green-grey (two legs tied by X braces and struts), the
// stiffening truss of the deck about 65 m over the water hanging from the two main cables.
//
// L9: laid along the area's motorway from the Maiko shore to Awaji (the table's `bridge` line). The
// strait runs across two areas (Maiko 20274 and the north tip of Awaji 20441): each builds its own
// stretch of the same line. Shrunk 1/10 in plan (391 m between the anchorages, the area's strait is
// 381 m wide); the towers 55 m over the sea (four times the deck's height, as the real ones) and the deck no higher than its ramps reach
// (docs/realmap_guide.md §7, L9).

import { bridgeDef } from '../bridge.ts';

export const LANDMARK_AKASHI_KAIKYO_BRIDGE = bridgeDef({
  variant: 'akashi_kaikyo_bridge',
  spans: [960, 1991, 960],
  at: 42,
  main: 'suspension',
  deck: { width: 22, thick: 1.2, top: 'gray', side: 'grayGreen', parapet: 1.1, parapetPaint: 'grayGreen', piece: 30 },
  profile: { clear: 12, slope: 0.075, crest: 1.5 },
  truss: { y0: -4.2, y1: 0, panel: 20, paint: 'grayGreen', posts: false, steps: 2 },
  tower: { shape: 'portal', top: 55, leg: [4, 2.8], struts: [0.42, 0.62, 0.8, 0.97], paint: 'grayGreen', cap: 1.2 },
  cable: { sag: 1.5, hangers: 15, paint: 'silver', thick: 1.3, anchorage: { length: 12, height: 9, paint: 'stone' } },
  piers: { every: 0, paint: 'stone', columns: 2, size: 2.4 },
  yard: { length: 470, depth: 52, water: [40, 430] },
  shell: 8000,
});
