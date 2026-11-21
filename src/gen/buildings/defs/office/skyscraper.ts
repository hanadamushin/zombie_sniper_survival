// 超高層オフィス (07d-2c): a thirty-two-storey office skyscraper. Dark glass between continuous spandrel
// bands and heavy stone corners, a two-storey crown of louvres round the roof. The lobby, the
// first floor, the sixteenth (a sky lobby with its café and kitchen), the thirty-first (the
// restaurant) and the top floor (directors) can be entered; the rest are locked at the stair. The
// roof is the highest perch in the city: the stair house, a big helipad, a guard rail, the mast.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { curtain, twoPass, type Fit } from './common.ts';
import { towerRoof, towerStoreys } from './tower.ts';

export const OFFICE_SKYSCRAPER: BuildingDef = {
  id: 'office.skyscraper',
  category: 'office',
  variant: 'skyscraper',
  kind: 'office',
  size: { w: [34, 40], d: [27, 30] },
  storeys: 32,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 9.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_SKYSCRAPER, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.35;
  k.thick = t;
  const tint = k.rand();
  const stone = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + 1.2;
  const glass = (from: number, to: number, n: number) => k.evenly(from, to, n).map((x) => k.window(x, (to - from) / n - 0.6, { sill: 0.1, head: 3.3, broken: k.rand() < 0.25 }));
  k.outerWalls(0, {
    mat: 'brick', tint: stone, y1,
    front: [...glass(1.6, w / 2 - 1.5, 2), k.door(w / 2, 'open', ARCH.door.wide), ...glass(w / 2 + 1.5, w - 1.6, 2)],
    back: [...glass(1.6, w - 6, 2), k.door(w - 3.5, 'locked')],
    left: glass(1.6, d - 1.6, 2),
    right: glass(1.6, d - 1.6, 2),
  });
  // Upper storeys: bands and one dark sheet per side, the corners in stone (one box each, both faces).
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const long = side === 'front' || side === 'back';
    const along = long ? w : d;
    const broken: [number, number, number][] = k.rand() < 0.6 ? [[2 + Math.floor(k.rand() * (k.storeys - 4)), along * 0.4, along * 0.5]] : [];
    curtain(k, { side, from: 1, to: k.storeys, y1: top, t, mat: 'concrete', tint, sill: 0.8, drop: 0.5, piers: long ? [w / 2] : [], pier: 0.8, pierMat: 'brick', pierTint: stone, broken });
  }
  // Stone corners: a slab on each face of each corner, in the plane of the wall.
  const corners = (ya: number, yb: number): void => {
    for (const [x, z] of [[0, 0], [w - 1.2, 0], [0, d - 1.2], [w - 1.2, d - 1.2]] as const) {
      k.box(-1, x, ya, z < d / 2 ? 0 : d - t, x + 1.2, yb, z < d / 2 ? t : d, 'brick', { layer: 'shell', tint: stone });
      k.box(-1, x < w / 2 ? 0 : w - t, ya, z, x < w / 2 ? t : w, yb, z + 1.2, 'brick', { layer: 'shell', tint: stone });
    }
  };
  corners(y1 - 0.5, top);
  // The crown: louvres round the roof edge above the parapet (drawn only, the roof stays open to shoot from).
  const e = k.eaves;
  for (const [x0, z0, x1, z1] of [[1.2, d - 0.15, w - 1.2, d], [1.2, 0, w - 1.2, 0.15], [0, 1.2, 0.15, d - 1.2], [w - 0.15, 1.2, w, d - 1.2]] as const) k.box(-1, x0, e + 3.4, z0, x1, e + 5.2, z1, 'steel', { layer: 'shell', tint: 0.2, solid: false });
  corners(top, e + 5.2);
  const last = k.storeys - 1;
  const c = towerStoreys(k, f, { t, shafts: 4, tint, accent: k.rand(), programs: { 0: 'lobby', 1: 'office', 15: 'skylobby', [last - 1]: 'restaurant', [last]: 'exec' } });
  towerRoof(k, f, c, { t, tint, parapetTop: top, helipad: true, mastTop: e + 8.8 });
}
