// 航空自衛隊の基地 (07d-2f). The runway runs along x at the back of the site (only part of it: it
// runs off both ends), the taxiway, the apron with the hangars (格納庫, a fighter inside each, the big
// door to the taxiway) and fighters parked between them, the control tower (管制塔, the cab a perch
// over the whole field), the radar (a radome on its building), fuel tanks, the HQ (its commander's
// safe holds the area's key; the HQ armory and the ammunition depots open with it), the gate.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import type { Fit } from '../office/common.ts';
import { hall, mesh } from '../public/common.ts';
import { controlTower, runway, taxiway, windsock } from '../transport/airport_parts.ts';
import { pave } from '../transport/common.ts';
import { drums, fighter, mtruck } from '../military/parts.ts';
import { depot, hq, mainGate, parade, sdfDef, type KeyRect } from './sdf_parts.ts';

/** A hangar on rect r: the big door to the taxiway (z-), a door at the back, a fighter inside, tools along the wall. */
function hangar(k: Kit, f: Fit, r: Rect, tint: number): void {
  const [x0, z0, x1, z1] = r;
  const m = (x0 + x1) / 2;
  const h = hall(k, {
    rect: r, levels: 2, mat: 'metalRoof', tint, use: 'garage', floorMat: 'concrete',
    doors: [
      { side: 'z-', at: m, width: x1 - x0 - 10, head: 2 * ARCH.storey.concrete - 0.8, state: k.rand() < 0.7 ? 'open' : 'shutter' },
      { side: 'z+', at: x0 + 3 },
    ],
    high: { sides: ['x-', 'x+'], n: 3, width: 9 }, roof: 'gable', roofMat: 'metalRoof', roofTint: tint, rise: 3, axis: 'z', broken: 0.3,
  });
  // The fighter stands right of the middle (clear of the line between the doors), nose to the door.
  fighter(k, m + 6, (z0 + z1) / 2, 'z-', 0.4);
  f.row(h.id, 'x-', 2.0, 0.7, 2.0, 'shelf', { kind: 'shelf', table: 'tools', max: 3, from: z0 + 3, tint: 0.5 });
  f.row(h.id, 'z+', 1.2, 1.0, 1.0, 'olive', { kind: 'crate', table: 'fuel', max: 2, from: m + 1, tint: 0.1 });
  f.ensure(h.id, 'crate', 'garage');
}

/** The radar: a two-storey block with the radome on its roof. */
function radar(k: Kit, f: Fit, r: Rect, tint: number): void {
  const [x0, z0, x1, z1] = r;
  const h = hall(k, {
    rect: r, levels: 2, mat: 'concrete', tint, use: 'machine', floorMat: 'vinyl',
    doors: [{ side: 'z+', at: (x0 + x1) / 2 }], low: { sides: ['x-'], n: 1, width: 1.2 }, roof: 'flat', parapet: 0.3,
  });
  f.row(h.id, 'z-', 1.6, 0.8, 1.9, 'appliance', { kind: 'cabinet', table: 'tower', max: 3, tint: 0.3 });
  f.ensure(h.id, 'desk', 'tower');
  const top = k.levelY(2);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const s = Math.min(x1 - x0, z1 - z0) / 2 - 0.6;
  k.box(-1, cx - s, top, cz - s, cx + s, top + s * 1.2, cz + s, 'appliance', { layer: 'shell', tint: 0.1 });
  k.part({ shape: 'hip', x0: cx - s, x1: cx + s, z0: cz - s, z1: cz + s, y0: top + s * 1.2, y1: top + s * 2.0, mat: 'appliance', tint: 0.1, axis: 'x' });
}

export const BASE_JASDF: BuildingDef = sdfDef('jasdf', { size: { w: [520, 600], d: [200, 240] }, roofRise: 27, limits: { shell: 6000, interior: 6000 } }, (k, f) => {
  const { w, d } = k;
  const tint = k.rand();
  // The field: the runway (off both ends of the site), the taxiway, the apron.
  runway(k, 0, w, 32, 45, false);
  taxiway(k, 0, w, 78, 20);
  pave(k, 20, 88, w - 20, 136);
  windsock(k, 30, 62);
  // Hangars, fighters parked between them.
  const hw = 44;
  const xs = [40, 40 + hw + 30, 40 + 2 * (hw + 30)];
  for (const x of xs) hangar(k, f, [x, 96, x + hw, 132], k.rand());
  for (const x of xs) if (k.rand() < 0.7) fighter(k, x + hw + 15, 108, 'z-', 0.4);
  // The tower beside the apron, the radar, fuel tanks.
  const tx = xs[2]! + hw + 60;
  controlTower(k, f, [tx, 140, tx + 10, 150], 7, tint);
  radar(k, f, [w - 70, d - 80, w - 56, d - 64], tint);
  for (const x of [w - 130, w - 108]) {
    k.box(-1, x, 0, 142, x + 16, 9, 158, 'appliance', { layer: 'shell', tint: 0.1 });
    k.box(-1, x + 7.6, 9, 146, x + 8.4, 9.8, 154, 'steel', { layer: 'shell', tint: 0.5, solid: false });
  }
  mtruck(k, w - 95, 168, 'x', { burnt: k.rand() < 0.3 });
  drums(k, w - 140, 162, 9);
  // The HQ and the depots by the gate.
  const gx = w / 2;
  const keys: KeyRect[] = hq(k, [gx - 110, d - 50, gx - 50, d - 35], 3, tint);
  keys.push(depot(k, [40, 150, 49, 162]), depot(k, [55, 150, 64, 162]));
  mesh(k, 34, 170, 72, 170, [[42, 47]], 2.2);
  parade(k, [gx - 40, d - 54, gx - 12, d - 30], [gx - 30, d - 42]);
  const gap = mainGate(k, f, gx, d - 30, tint);
  // The fence: the front and the sides from the apron forward (the runway runs on past the site).
  const e = 0.6;
  mesh(k, e, d - e, w - e, d - e, [gap], 2.2);
  mesh(k, e, 90, e, d - e, [], 2.2);
  mesh(k, w - e, 90, w - e, d - e, [], 2.2);
  return keys;
});
