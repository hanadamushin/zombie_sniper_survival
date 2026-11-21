// ガラス張りの低層オフィス (07d-2c): a three-storey glass box round a central core (stair, a dead lift,
// the toilets). Each floor is open round the core: the lobby with the reception desk and sofas and
// a café at the back on the ground floor, open-plan desks on the first, the meeting tables and
// desks on the top floor. Floor-to-ceiling glass on thin mullions all round, some panes gone. A
// roof garden of planters round the stair house.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { canteen, coreRoof, curtainAll, meeting, officeDesks, ringRooms, roofPlant, towerFloors, twoPass, waiting, type Fit } from './common.ts';

export const OFFICE_GLASS_LOW: BuildingDef = {
  id: 'office.glass_low',
  category: 'office',
  variant: 'glass_low',
  kind: 'office',
  size: { w: [20, 26], d: [15, 19] },
  storeys: 3,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 3.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_GLASS_LOW, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.25;
  const tint = k.rand();
  const y1 = k.levelY(1);
  // Ground floor: glass between the corners, the entrance in the middle of the front.
  const glass = (from: number, to: number, n: number) => k.evenly(from, to, n).map((x) => k.window(x, (to - from) / n - 0.3, { sill: 0.1, head: 3.1, broken: k.rand() < 0.2 }));
  k.thick = t;
  k.outerWalls(0, {
    mat: 'steel', tint: 0.9, y1,
    front: [...glass(0.4, w / 2 - 1.2, 2), k.door(w / 2, 'open', ARCH.door.wide), ...glass(w / 2 + 1.2, w - 0.4, 2)],
    back: [...glass(0.4, w - 4.0, 3), k.door(w - 2.2, 'locked')],
    left: glass(0.6, d - 0.6, 2),
    right: glass(0.6, d - 0.6, 2),
  });
  curtainAll(k, { from: 1, to: k.storeys, y1: k.eaves + ARCH.rail.parapet, t, mat: 'steel', tint: 0.9, sill: 0.25, drop: 0.45, step: 3.0, pier: 0.15, broken: 0.35 });

  const c = towerFloors(k, f, {
    t, shafts: 1, wc: true, tint,
    floorMat: (l) => (l === 0 ? 'tileFloor' : 'carpet'),
    open: () => true,
    doorW: (l) => (l === 0 ? 1.8 : 1.2),
    plate: (level, _c, hole) => {
      if (level === 0) {
        const ring = ringRooms(k, 0, [t, t, w - t, d - t], hole, { front: 'lobby', back: 'canteen', left: 'office', right: 'office' });
        const lobby = ring.front!;
        const R = f.roomRect(lobby);
        f.put(lobby, [w / 2 + 2.0, R[1] + 0.8, w / 2 + 4.6, R[1] + 1.5], 1.05, 'counter', { tint: 0.95, search: { kind: 'counter', face: 'z+', table: 'lobby' } });
        waiting(f, lobby, 'lobby');
        if (ring.back !== undefined) canteen(f, ring.back, { tint: 0.2 });
        for (const r of [ring.left, ring.right]) if (r !== undefined) officeDesks(f, r, { tint });
        for (const r of ring.all) f.ensure(r, 'desk', k.roomById(r).use);
        f.stain(lobby, 'debris', 1.6);
        return;
      }
      const ring = ringRooms(k, level, [t, t, w - t, d - t], hole, 'office');
      for (const r of ring.all) {
        if (level === k.storeys - 1 && r === ring.front) meeting(f, r);
        officeDesks(f, r, { tint });
        f.ensure(r, 'desk', 'office');
      }
      if (f.chance(0.6)) f.stain(ring.all[0]!);
    },
  });

  // Roof: the stair house, planters round it, the plant on the back.
  k.roofFlat({ mat: 'concrete', tint });
  coreRoof(k, c, { tint });
  const roof = ringRooms(k, k.storeys, [t, t, w - t, d - t], [c.x0 - 0.1, c.z0 - 0.1, c.x1 + 0.1, c.z1 + 0.1], 'roof');
  roofPlant(f, roof.back !== undefined ? [roof.back] : roof.all, { units: 4, tank: false });
  for (const r of roof.all) {
    f.grid(r, 2.4, 0.9, 1.6, 1.6, (q) => {
      if (!f.put(r, q, 0.45, 'concrete', { tint: 0.3, margin: 0.45 })) return false;
      f.deco(r, [q[0] + 0.1, q[1] + 0.1, q[2] - 0.1, q[3] - 0.1], 0.9, 'plant');
      return true;
    });
    f.ensure(r, 'crate', 'roof');
  }
}

