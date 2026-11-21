// 中規模オフィス (07d-2c): a nine-storey office block of the 1980s round a central core (the stair, two
// dead lifts, the toilets). Ribbon windows between deep concrete bands, stone-clad corners. The
// ground floor is the lobby (reception, benches, a café at the back), the first and fifth floors
// are open-plan offices, the top floor the directors' (a meeting room in front). The other floors
// are locked at the stair hall — some of the doors barricaded from the stair side. On the roof:
// the stair house, a cooling tower and the plant, a mast.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { curtain, twoPass, type Fit } from './common.ts';
import { towerRoof, towerStoreys } from './tower.ts';

export const OFFICE_MID: BuildingDef = {
  id: 'office.mid',
  category: 'office',
  variant: 'mid',
  kind: 'office',
  size: { w: [24, 30], d: [20, 26] },
  storeys: 9,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 6.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_MID, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.3;
  k.thick = t;
  const tint = k.rand();
  const stone = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;
  // Ground floor: a recessed glass front behind the corner piers; solid sides with a few windows.
  k.outerWalls(0, {
    mat: 'concrete', tint, y1,
    front: [k.window(w * 0.25, w * 0.3, { sill: 0.2, head: 3.0, broken: k.rand() < 0.4 }), k.door(w / 2, 'open', ARCH.door.wide), k.window(w * 0.75, w * 0.3, { sill: 0.2, head: 3.0 })],
    back: [k.door(w - 3, 'locked'), k.window(w * 0.3, 3.0, { sill: 1.2 })],
    left: [k.window(d * 0.3, 2.4), k.window(d * 0.7, 2.4)],
    right: [k.window(d * 0.3, 2.4), k.window(d * 0.7, 2.4)],
  });
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const along = side === 'front' || side === 'back' ? w : d;
    const lo = side === 'front' || side === 'back' ? 0 : t;
    curtain(k, { side, from: 1, to: k.storeys, y1: top, t, mat: 'concrete', tint, sill: 1.0, drop: 0.8, piers: [lo + 0.6, lo + (along - 2 * lo) - 0.6], pier: 1.2, pierMat: 'brick', pierTint: stone, broken: k.rand() < 0.5 ? [[1 + Math.floor(k.rand() * (k.storeys - 1)), along * 0.3, along * 0.45]] : [] });
  }
  const c = towerStoreys(k, f, { t, shafts: 2, tint, accent: k.rand(), programs: { 0: 'lobby', 1: 'office', 4: 'office', [k.storeys - 1]: 'exec' } });
  towerRoof(k, f, c, { t, tint, parapetTop: top, mastTop: k.eaves + 5.8 });
  // The cooling tower beside the stair house (solid on its own feet).
  const e = k.eaves;
  const x0 = c.x1 + 1.5;
  if (x0 + 3 < w - t - 1) k.box(-1, x0, e + 0.6, c.z0, x0 + 3.0, e + 3.4, c.z0 + 2.5, 'steel', { layer: 'shell', tint: 0.8, solid: false });
}
