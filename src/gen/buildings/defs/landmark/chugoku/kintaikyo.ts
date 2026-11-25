// L6, L9: 錦帯橋 (the Kintai Bridge), Iwakuni, Yamaguchi. The wooden bridge of five spans over the
// Nishiki River (1673, rebuilt 1953 and repaired since): three high wooden arches in the middle, a
// lower span at each end on wooden trestles, carried by four stone piers; the deck climbs and falls
// over each arch between plain wooden rails. Real size: 193.3 m long (the spans 34.8 / 35.1 / 35.1 /
// 35.1 / 34.8 m), 5 m wide.
//
// L9: laid across the area's own river (the table's `bridge` line, west bank to east bank), its five
// spans fitted to the shrunk river (1/10: about 4–5 m each); 5 m wide as the real one. The arches
// rise 1.5 m over the piers (steps the walkers take). (L6 dug its own 190 m river in a lot.)

import { bridgeDef } from '../bridge.ts';
import { pine } from '../tohoku/parts.ts';

export const LANDMARK_KINTAIKYO = bridgeDef({
  variant: 'kintaikyo',
  spans: [34.8, 35.1, 35.1, 35.1, 34.8],
  fit: 3,
  main: 'arch',
  carry: 'boxes',
  deck: { width: 5, thick: 0.45, top: 'hinoki', side: 'hinoki', parapet: 0.9, parapetPaint: 'hinoki' },
  profile: { clear: 1.6, slope: 0.35, rise: 1.5 },
  arches: { which: [1, 2, 3], paint: 'brown', pier: 'granite', pierSize: 1.6 },
  piers: { every: 0, paint: 'granite', columns: 1, size: 1 },
  yard: { length: 40, depth: 22, water: [3, 37] },
  top: 9.5,
  extra(L, B) {
    // Pines on both banks (in the yard, where the bridge's ends are known to be dry).
    if (B.area) return;
    for (const [x, z] of [[3, 3], [3, L.d - 3], [L.w - 3, 4], [L.w - 3, L.d - 3]] as const) pine(L, x, z, 9);
  },
});
