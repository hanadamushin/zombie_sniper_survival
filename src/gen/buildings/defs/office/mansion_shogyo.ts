// マンション兼商業 (07d-2c): an eighteen-storey block of flats on a three-storey commercial podium.
// The podium is glass with the supermarket's big sign: the supermarket all round the core on the
// ground floor (the residents come in through it to the stair), a row of shops and a clinic off a
// corridor on the first floor, the gym on the second. From the third floor up, flats round a
// corridor (three in front, three behind) behind a tiled grid of windows with an air-conditioner
// unit on each balcony rail. The third, ninth and top floors of flats can be entered; the rest are
// locked at the stair. Roof: stair house, guard rail, plant.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { corridorPlate, curtain, ringRooms, salesFloor, spaced, storeRoom, towerFloors, twoPass, type Fit } from './common.ts';
import { clinicUnit, flatUnit, shopUnit, towerRoof } from './tower.ts';

const PODIUM = 3;

export const OFFICE_MANSION_SHOGYO: BuildingDef = {
  id: 'office.mansion_shogyo',
  category: 'office',
  variant: 'mansion_shogyo',
  kind: 'apartment',
  size: { w: [24, 30], d: [21, 25] },
  storeys: 18,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 3.4,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_MANSION_SHOGYO, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.3;
  k.thick = t;
  const tint = k.rand();
  const brand = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;
  const glass = (from: number, to: number, n: number) => k.evenly(from, to, n).map((x) => k.window(x, (to - from) / n - 0.5, { sill: 0.2, head: 2.9, broken: k.rand() < 0.3 }));
  k.outerWalls(0, {
    mat: 'concrete', tint, y1,
    front: [...glass(0.8, w / 2 - 1.3, 2), k.door(w / 2, 'open', ARCH.door.wide), ...glass(w / 2 + 1.3, w - 0.8, 2)],
    back: [k.door(3.0, 'locked'), { ...k.door(w - 4.0, 'shutter', 3.0), head: 3.0 }],
    left: glass(1.0, d - 1.0, 2),
    right: [k.door(d - 3.0, 'open', 1.2)],
  });
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const long = side === 'front' || side === 'back';
    const along = long ? w : d - 2 * t;
    const lo = long ? 0 : t;
    // The podium: glass between a few piers; the flats: a tiled grid of windows.
    curtain(k, { side, from: 1, to: PODIUM, y1: k.levelY(PODIUM) + 0.4, t, mat: 'concrete', tint, sill: 0.5, drop: 0.6, piers: spaced(lo + 0.4, lo + along - 0.4, 6.0), pier: 0.8 });
    curtain(k, { side, from: PODIUM + 1, to: k.storeys, y1: top, t, mat: 'tile', tint: brand * 0.3, sill: 0.9, drop: 0.6, piers: spaced(lo + 0.5, lo + along - 0.5, 3.2), pier: 1.0, pierMat: 'plaster', pierTint: tint });
  }
  // The supermarket's sign round the top of the podium (drawn only past the wall).
  k.box(-1, 1.0, k.levelY(PODIUM) - 1.6, d, w - 1.0, k.levelY(PODIUM) - 0.3, d + 0.25, 'sign', { layer: 'shell', tint: brand, solid: false });

  const outer: Rect = [t, t, w - t, d - t];
  const last = k.storeys - 1;
  const flats = new Set([PODIUM, 9, last]);
  const c = towerFloors(k, f, {
    t, shafts: 2, wc: true, tint,
    floorMat: (l) => (l < PODIUM ? 'tileFloor' : 'flooring'),
    open: (l) => l < PODIUM || flats.has(l),
    doorW: (l) => (l === 0 ? 1.8 : 1.2),
    plate: (level, _c, hole) => {
      if (level === 0) {
        const r = ringRooms(k, 0, outer, hole, { front: 'sales', back: 'storage', left: 'sales', right: 'sales' });
        salesFloor(f, r.front!, { tables: ['grocery', 'sales'], tint: brand });
        salesFloor(f, r.left!, { tables: ['grocery'], tint: brand, along: 'z', counter: false });
        salesFloor(f, r.right!, { tables: ['pharmacy', 'grocery'], tint: brand, along: 'z', counter: false });
        storeRoom(f, r.back!, 'grocery');
        f.stain(r.front!);
        return;
      }
      if (level === 1) {
        corridorPlate(k, 1, {
          outer, hole, cw: 1.6, front: 3, back: 2, sides: false,
          fill: (u) => (u.side === 'back' && u.index === 0 ? clinicUnit(k, f, u, false) : shopUnit(k, f, u, k.rand() < 0.35, ['sales', 'grocery'])),
        });
        return;
      }
      if (level === 2) {
        // The gym: machines in rows round the core, the locker room at the back.
        const r = ringRooms(k, 2, outer, hole, { front: 'hall', back: 'storage', left: 'hall', right: 'hall' });
        for (const id of [r.front!, r.left!, r.right!]) f.grid(id, 0.9, 1.9, 1.0, 1.2, (q) => f.put(id, q, 1.4, 'steel', { tint: 0.2 }), undefined, 10);
        f.row(r.back!, 'z-', 0.45, 0.5, 1.8, 'steel', { kind: 'locker', table: 'storage', every: 3, gap: 0.02, max: 12 });
        f.ensure(r.back!, 'locker', 'storage');
        return;
      }
      corridorPlate(k, level, {
        outer, hole, cw: 1.5, front: 3, back: 3, sides: false,
        fill: (u) => flatUnit(k, u, k.rand() < 0.5 && !(u.side === 'front' && u.index === 1)),
      });
    },
  });
  towerRoof(k, f, c, { t, tint, parapetTop: top, helipad: true });
  // Air-conditioner units on the balcony rails of the flats (drawn only).
  for (let i = PODIUM + 1; i < k.storeys; i += 1) {
    if (k.rand() < 0.4) continue;
    const x = 1.5 + k.rand() * (w - 3);
    k.box(-1, x, k.levelY(i) + 0.1, d, x + 0.8, k.levelY(i) + 0.7, d + 0.35, 'appliance', { layer: 'shell', solid: false, tint: 0.5 });
  }
}

