// 医療モール (07d-2c): a seven-storey medical building (not a hospital): clinics round a corridor round
// the core. White tiles with ribbon windows, the green-cross tower on the roof and a board listing
// the clinics up the front. The ground floor is the dispensing pharmacy and a convenience corner
// either side of the entrance passage; the first, second and fifth floors are clinics (internal
// medicine, eyes, dentist, skin, children — some locked), the top floor the health-check centre.
// The rest are locked at the stair.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { clinicRoom, corridorPlate, curtain, ringRooms, salesFloor, towerFloors, twoPass, waiting, type Fit } from './common.ts';
import { clinicUnit, towerRoof } from './tower.ts';

export const OFFICE_MEDICAL_MALL: BuildingDef = {
  id: 'office.medical_mall',
  category: 'office',
  variant: 'medical_mall',
  kind: 'office',
  size: { w: [19, 24], d: [17, 21] },
  storeys: 7,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 5.2,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_MEDICAL_MALL, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.25;
  k.thick = t;
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;
  const step = (w - 2 * t) / 3;
  k.outerWalls(0, {
    mat: 'plaster', tint: 0.05, y1,
    front: [k.window(t + step / 2, step - 1.4, { sill: 0.3, head: 2.6, broken: k.rand() < 0.3 }), k.door(w / 2, 'open', ARCH.door.wide), k.door(w - t - step / 2, 'open', 1.2)],
    back: [k.door(2.5, 'locked')],
    left: [k.window(d / 2, 3.0)],
  });
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    curtain(k, { side, from: 1, to: k.storeys, y1: top, t, mat: 'plaster', tint: 0.05, sill: 1.0, drop: 0.7, piers: [], broken: k.rand() < 0.5 ? [[1 + Math.floor(k.rand() * 5), 2, 5]] : [] });
  }
  // The clinics' board up the front corner (drawn only).
  for (let i = 1; i < k.storeys; i++) k.box(-1, 0.1, k.levelY(i) + 0.3, d, 0.7, k.levelY(i) + 2.6, d + 0.5, 'sign', { layer: 'shell', tint: (i * 0.29) % 1, solid: false });

  const outer: Rect = [t, t, w - t, d - t];
  const last = k.storeys - 1;
  const c = towerFloors(k, f, {
    t, shafts: 1, wc: true, tint: 0.05,
    floorMat: () => 'vinyl',
    open: (l) => l <= 2 || l === 5 || l === last,
    doorW: (l) => (l === 0 ? 1.8 : 1.2),
    plate: (level, _c, hole) => {
      if (level === last) {
        // Health checks: open floor with beds and machines, the waiting benches in front.
        const r = ringRooms(k, level, outer, hole, { front: 'clinic', back: 'lab', left: 'clinic', right: 'clinic' });
        waiting(f, r.front!, 'clinic');
        for (const id of [r.back!, r.left!, r.right!]) clinicRoom(f, id);
        return;
      }
      corridorPlate(k, level, {
        outer, hole, cw: 1.6, front: 3, back: 3, sides: false,
        fill: (u) => {
          if (level === 0 && u.side === 'front') {
            const [x0, z0, x1, z1] = u.rect;
            if (u.index === 1) {
              k.room(0, x0, z0, x1, z1, 'lobby');
              return { state: 'open', width: ARCH.door.wide, at: w / 2 };
            }
            const r = k.room(0, x0, z0, x1, z1, 'sales');
            salesFloor(f, r, { tables: u.index === 0 ? ['pharmacy'] : ['grocery', 'pharmacy'], along: 'z' });
            return { state: 'open', width: 1.2 };
          }
          if (level === 0) return clinicUnit(k, f, u, true);
          return clinicUnit(k, f, u, k.rand() < 0.3 && !(u.side === 'front' && u.index === 0));
        },
      });
    },
  });
  towerRoof(k, f, c, { t, tint: 0.05, parapetTop: top, rail: false });
  // The green cross on its tower.
  const e = k.eaves;
  const cx = w - 2.5;
  k.box(-1, cx - 0.15, e, d - 0.3, cx + 0.15, e + 3.5, d - 0.05, 'steel', { layer: 'shell' });
  k.box(-1, cx - 1.2, e + 3.6, d - 0.15, cx + 1.2, e + 4.3, d, 'sign', { layer: 'shell', tint: 0.1, solid: false });
  k.box(-1, cx - 0.35, e + 2.9, d - 0.15, cx + 0.35, e + 5.0, d, 'sign', { layer: 'shell', tint: 0.1, solid: false });
}
