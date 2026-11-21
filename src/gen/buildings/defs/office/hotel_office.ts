// ホテル兼オフィス (07d-2c): a twenty-two-storey tower with offices below and a hotel above. Storeys 1–10
// are offices behind a glass curtain wall; from the eleventh up, the hotel's punched windows in a
// light stone grid. The ground floor is the shared lobby; the first floor offices; the eleventh is
// the hotel's sky lobby (front desk, restaurant and its kitchen); the fifteenth and the twentieth
// are guest floors (a corridor round the core, rooms front and back, half of them locked); the top
// floor the bar lounge. The rest are locked at the stair. Helipad and guard rail on the roof.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { curtain, spaced, twoPass, type Fit } from './common.ts';
import { towerRoof, towerStoreys } from './tower.ts';

export const OFFICE_HOTEL_OFFICE: BuildingDef = {
  id: 'office.hotel_office',
  category: 'office',
  variant: 'hotel_office',
  kind: 'office',
  size: { w: [26, 32], d: [21, 25] },
  storeys: 22,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 6.5,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_HOTEL_OFFICE, rng, params, build);
  },
};

const SPLIT = 11; // first hotel storey

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.3;
  k.thick = t;
  const tint = k.rand();
  const stone = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;
  const glass = (from: number, to: number, n: number) => k.evenly(from, to, n).map((x) => k.window(x, (to - from) / n - 0.4, { sill: 0.1, head: 3.2, broken: k.rand() < 0.25 }));
  k.outerWalls(0, {
    mat: 'plaster', tint: stone, y1,
    front: [...glass(0.8, w / 2 - 4.4, 2), k.door(w / 2 - 3.2, 'open', ARCH.door.wide), ...glass(w / 2 - 2.0, w / 2 + 2.0, 1), k.door(w / 2 + 3.2, 'open', ARCH.door.wide), ...glass(w / 2 + 4.4, w - 0.8, 2)],
    back: [k.door(3, 'locked'), ...glass(5, w - 1, 3)],
    left: glass(1.0, d - 1.0, 2),
    right: glass(1.0, d - 1.0, 2),
  });
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const long = side === 'front' || side === 'back';
    const along = long ? w : d - 2 * t;
    const lo = long ? 0 : t;
    // Offices: glass with mullions; the hotel: a stone grid of punched windows.
    curtain(k, { side, from: 1, to: SPLIT, y1: k.levelY(SPLIT) + 0.9, t, mat: 'steel', tint: 0.25, sill: 0.6, drop: 0.5, piers: spaced(lo + 0.2, lo + along - 0.2, 6.5), pier: 0.25, broken: long && k.rand() < 0.5 ? [[2 + Math.floor(k.rand() * 8), lo + along * 0.3, lo + along * 0.4]] : [] });
    curtain(k, { side, from: SPLIT + 1, to: k.storeys, y1: top, t, mat: 'plaster', tint: stone, sill: 0.9, drop: 0.8, piers: spaced(lo + 0.5, lo + along - 0.5, 3.8), pier: 1.4 });
  }
  // A cornice between the two parts (drawn only past the wall).
  k.box(-1, -0.3, k.levelY(SPLIT) - 0.2, -0.3, w + 0.3, k.levelY(SPLIT) + 0.3, d + 0.3, 'plaster', { layer: 'shell', tint: stone, solid: false });
  const last = k.storeys - 1;
  const c = towerStoreys(k, f, { t, shafts: 3, tint, accent: k.rand(), programs: { 0: 'lobby', 1: 'office', [SPLIT]: 'skylobby', 15: 'hotel', 20: 'hotel', [last]: 'bar' } });
  towerRoof(k, f, c, { t, tint, parapetTop: top, helipad: true, mastTop: k.eaves + 6.3 });
}

