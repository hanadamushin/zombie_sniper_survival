// 超高層手前のオフィス (07d-2c): a twenty-storey glass office tower. A curtain wall of vertical aluminium
// mullions and thin spandrels all round, a recessed glass lobby behind a canopy. Inside, the core
// (stair, three dead lifts, toilets) and open floors round it — only the lobby, the first, tenth
// and nineteenth floors and the top (directors') floor can be entered; the rest are locked at the
// stair. On the roof: the stair house, the helipad, the guard rail on the parapet, a mast, the
// plant — a sniper's perch over the city.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { curtainAll, twoPass, type Fit } from './common.ts';
import { towerRoof, towerStoreys } from './tower.ts';

export const OFFICE_TOWER20: BuildingDef = {
  id: 'office.tower20',
  category: 'office',
  variant: 'tower20',
  kind: 'office',
  size: { w: [28, 34], d: [24, 29] },
  storeys: 20,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 6.5,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_TOWER20, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.3;
  k.thick = t;
  const tint = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + 0.9;
  const glass = (from: number, to: number, n: number) => k.evenly(from, to, n).map((x) => k.window(x, (to - from) / n - 0.4, { sill: 0.1, head: 3.2, broken: k.rand() < 0.25 }));
  k.outerWalls(0, {
    mat: 'steel', tint: 0.2, y1,
    front: [...glass(1.0, w / 2 - 1.3, 3), k.door(w / 2, 'open', ARCH.door.wide), ...glass(w / 2 + 1.3, w - 1.0, 3)],
    back: [...glass(1.0, w - 5, 3), k.door(w - 3, 'locked')],
    left: glass(1.0, d - 1.0, 3),
    right: glass(1.0, d - 1.0, 3),
  });
  // The canopy over the entrance (drawn only past the wall).
  k.box(-1, w / 2 - 4, k.levelY(0) + 3.3, d - 0.3, w / 2 + 4, k.levelY(0) + 3.5, d + 0.6, 'steel', { layer: 'shell', solid: false, tint: 0.2 });
  curtainAll(k, { from: 1, to: k.storeys, y1: top, t, mat: 'steel', tint: 0.2, sill: 0.6, drop: 0.5, step: 4.2, pier: 0.2, broken: 0.06 });
  const last = k.storeys - 1;
  const c = towerStoreys(k, f, { t, shafts: 3, tint, accent: k.rand(), programs: { 0: 'lobby', 1: 'office', 9: 'office', [last - 1]: 'office', [last]: 'exec' } });
  towerRoof(k, f, c, { t, tint, parapetTop: top, helipad: true, mastTop: k.eaves + 6.3 });
}

