// 商業ビル (07d-2c): a ten-storey fashion and restaurant building. Windowless walls hung with big
// signs, a glass slot up the front and a glass storefront on the street. Round the central core,
// a corridor with the tenants' shops off it — almost all of their shutters down; the entrance
// passage through the middle of the front row on the ground floor. The ground floor, the first,
// the seventh (two open shops), and the restaurant floor at the top can be entered; the rest
// are locked at the stair. On the roof: the beer garden's tables round the stair house.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { canteen, corridorPlate, curtain, kitchen, towerFloors, twoPass, type Fit } from './common.ts';
import { shopUnit, towerRoof } from './tower.ts';

export const OFFICE_SHOGYO: BuildingDef = {
  id: 'office.shogyo',
  category: 'office',
  variant: 'shogyo',
  kind: 'shop',
  size: { w: [22, 28], d: [19, 24] },
  storeys: 10,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 3.4,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_SHOGYO, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.3;
  k.thick = t;
  const tint = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;
  const n = 3; // front units
  const step = (w - 2 * t) / n;
  k.outerWalls(0, {
    mat: 'concrete', tint, y1,
    front: [
      k.window(t + step / 2, step - 1.2, { sill: 0.2, head: 3.0, broken: k.rand() < 0.4 }),
      k.door(w / 2, 'open', ARCH.door.wide),
      k.window(w - t - step / 2, step - 1.2, { sill: 0.2, head: 3.0, broken: k.rand() < 0.4 }),
    ],
    back: [k.door(3.0, 'locked'), { ...k.door(w - 4.0, 'shutter', 3.0), head: 3.0 }],
  });
  // Blank walls above, with a narrow glass slot up the middle of the front.
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const front = side === 'front';
    curtain(k, { side, from: 1, to: k.storeys, y1: top, t, mat: 'concrete', tint, sill: 0.0, drop: 0.0, sheet: front ? 'glass' : 'concrete', piers: front ? [w / 4, w * 0.75] : [], pier: front ? w / 2 - 1.6 : 0 });
  }
  // The signs: a big board on each front half, a vertical one on the corner (drawn only).
  const s = [k.rand(), k.rand(), k.rand()];
  k.box(-1, 0.6, k.levelY(2), d, w / 2 - 2.2, k.levelY(5), d + 0.15, 'sign', { layer: 'shell', tint: s[0], solid: false });
  k.box(-1, w / 2 + 2.2, k.levelY(4), d, w - 0.6, k.levelY(8), d + 0.15, 'sign', { layer: 'shell', tint: s[1], solid: false });
  k.box(-1, w - 0.5, k.levelY(1), d - 0.1, w - 0.1, k.eaves, d + 0.55, 'sign', { layer: 'shell', tint: s[2], solid: false });

  const outer: Rect = [t, t, w - t, d - t];
  const last = k.storeys - 1;
  const c = towerFloors(k, f, {
    t, shafts: 2, wc: true, tint,
    floorMat: (l) => (l === 0 ? 'tileFloor' : 'vinyl'),
    open: (l) => l === 0 || l === 1 || l === 6 || l === last,
    doorW: () => 1.6,
    plate: (level, _c, hole) => {
      const opened = level === 6 ? 2 : level === last ? 99 : 1;
      let left = opened;
      corridorPlate(k, level, {
        outer, hole, cw: 2.0, front: n, back: 3, sides: true,
        fill: (u) => {
          const [x0, z0, x1, z1] = u.rect;
          if (level === 0 && u.side === 'front' && u.index === 1) {
            k.room(0, x0, z0, x1, z1, 'lobby');
            return { state: 'open', width: ARCH.door.wide, at: w / 2 };
          }
          if (level === last) {
            // Restaurants: a dining room, or the kitchen behind.
            const use = u.side === 'back' && u.index === 1 ? 'kitchen' : 'canteen';
            const r = k.room(level, x0, z0, x1, z1, use, { locked: k.rand() < 0.25 });
            if (k.roomById(r).locked) return { state: 'locked' as const };
            if (use === 'kitchen') kitchen(f, r);
            else canteen(f, r, { tint: f.rand() });
            return { state: 'open' as const };
          }
          const open = left > 0 && k.rand() < 0.5;
          if (open) left--;
          return shopUnit(k, f, u, open, (['sales', 'grocery', 'pharmacy'] as const).slice(0, 1 + (u.index % 3)));
        },
      });
    },
  });
  const roofs = towerRoof(k, f, c, { t, tint, parapetTop: top });
  // The beer garden: tables on the roof.
  for (const r of roofs) canteen(f, r, { tint: 0.8, counter: false });
}
