// 5 階建ての雑居ビル (07d sample). Concrete block with a switchback stair in a core along the left
// wall, a corridor in front of it, and two tenants per floor off the corridor. The stair goes on
// up to a stair house on the flat roof, whose door opens onto the roof.
//
//   plan (every floor)                    tenants by floor (seeded): shop / bar / office / clinic / storage;
//   +------+----------------+             some tenant doors are locked (those rooms are marked locked)
//   | stair|  back tenant   |
//   | core |                |
//   +-  -  +--D-------------+
//   |corri-D  front tenant  |
//   | dor  |                |
//   +--D---+----------------+   front (z = d), the entrance to the corridor on the left

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef, Room, RoomUse } from '../../types.ts';

const P = ARCH.wall.partition / 2;
const LANE = ARCH.stair.wideWidth;

/** Fill a tenant room (door on its x0 side at z = doorZ). */
function furnish(k: Kit, level: number, r: Room, use: RoomUse, doorZ: number): void {
  const keep = 1.4; // clear strip inside the door
  const x0 = r.x0 + keep;
  switch (use) {
    case 'office': {
      // Rows of desks across the room, lockers on the far wall.
      const rows = Math.max(1, Math.floor((r.x1 - x0 - 1.0) / 2.2));
      for (let i = 0; i < rows; i++) {
        const dx = x0 + 0.3 + i * 2.2;
        for (let z = r.z0 + 0.9; z + 1.4 < r.z1 - 0.6; z += 2.2) {
          if (Math.abs(z + 0.7 - doorZ) < 1.2 && i === 0) continue;
          k.furniture(level, dx, z, dx + 0.75, z + 1.4, 0.72, 'wood', { tint: 0.55, search: i === 0 && z < r.z0 + 1 ? { kind: 'desk', face: 'x+', table: 'office' } : undefined });
        }
      }
      k.furniture(level, r.x1 - 0.5, r.z0 + 0.4, r.x1, Math.min(r.z1 - 0.4, r.z0 + 2.6), 1.8, 'steel', { search: { kind: 'locker', face: 'x-', table: 'office' } });
      return;
    }
    case 'clinic': {
      k.furniture(level, r.x1 - 0.9, r.z0 + 0.5, r.x1, r.z0 + 2.4, 0.65, 'fabric', { tint: 0.9 }); // bed
      k.furniture(level, r.x1 - 0.45, r.z1 - 2.2, r.x1, r.z1 - 0.4, 1.8, 'steel', { tint: 0.9, search: { kind: 'cabinet', face: 'x-', table: 'pharmacy' } });
      k.furniture(level, x0, r.z1 - 0.6, x0 + 1.6, r.z1, 0.9, 'counter', { search: { kind: 'counter', face: 'z-', table: 'clinic' } });
      return;
    }
    case 'bar': {
      k.furniture(level, x0 + 0.4, r.z0 + 0.6, x0 + 1.0, r.z1 - 0.8, 1.05, 'counter', { tint: 0.2, search: { kind: 'counter', face: 'x+', table: 'bar' } });
      k.furniture(level, r.x1 - 0.4, r.z0 + 0.5, r.x1, r.z1 - 0.5, 1.9, 'shelf', { tint: 0.2 });
      for (let z = r.z0 + 1.0; z < r.z1 - 1.2; z += 1.0) k.furniture(level, x0 - 0.35, z, x0 - 0.05, z + 0.3, 0.75, 'steel', { solid: false });
      return;
    }
    case 'sales': {
      for (let x = x0 + 0.2; x + 0.8 < r.x1 - 0.8; x += 2.0) k.furniture(level, x, r.z0 + 1.0, x + 0.8, r.z1 - 1.0, 1.4, 'shelf', { search: x === x0 + 0.2 ? { kind: 'shelf', face: 'x-', table: 'grocery' } : undefined });
      return;
    }
    default: {
      // Storage: shelving along the far walls, boxes.
      k.furniture(level, r.x1 - 0.6, r.z0 + 0.3, r.x1, r.z1 - 0.3, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'storage' } });
      k.furniture(level, x0 + 0.3, r.z0 + 0.3, x0 + 1.3, r.z0 + 1.3, 0.9, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'z+', table: 'storage' } });
    }
  }
}

export const OFFICE_ZAKKYO5: BuildingDef = {
  id: 'office.zakkyo5',
  category: 'office',
  variant: 'zakkyo5',
  kind: 'office',
  size: { w: [9.5, 12.5], d: [14, 18] },
  storeys: 5,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 3.0,
  lootable: true,
  generate(rng, params) {
    const k = createKit(OFFICE_ZAKKYO5, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const cw = LANE * 2 + 0.15; // stair core / corridor width
    const laneA = t + LANE / 2;
    const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
    const sz1 = t + n * ARCH.stair.going + ARCH.stair.landing; // front of the stairwell
    const xp = t + cw + P; // corridor | tenants (centre line)
    const zm = Math.max(sz1 + 1.8, d * 0.5); // back tenant | front tenant
    const zDoorBack = (sz1 + zm) / 2;
    const zDoorFront = (zm + d - t) / 2;
    const concrete = k.rand();
    const glassy = k.rand() < 0.5;
    const top = k.storeys - 1;

    for (let level = 0; level < k.storeys; level++) {
      const ground = level === 0;
      const uses: RoomUse[] = ground ? [k.pick(['sales', 'bar', 'clinic'] as const), k.pick(['storage', 'office'] as const)] : [k.pick(['office', 'office', 'clinic', 'bar'] as const), k.pick(['office', 'storage', 'clinic'] as const)];
      const lockFront = !ground && k.rand() < 0.3;
      const lockBack = k.rand() < 0.3;
      // Outer walls with this floor's windows.
      const tenantW = w - t - (xp + P);
      const frontWin = k.evenly(xp + P + 0.3, w - t - 0.3, glassy ? 2 : 3).map((x) => k.window(x, glassy ? tenantW / 2 - 0.5 : 1.2, { sill: ground ? 0.1 : 0.8, head: ground ? 2.7 : 2.4, broken: k.rand() < 0.2 }));
      const front = ground
        ? [k.door(t + cw / 2, 'open', 1.2), ...(uses[0] === 'sales' && k.rand() < 0.5 ? [k.door((xp + P + w - t) / 2, 'shutter', Math.min(3.2, tenantW - 0.8))] : frontWin)]
        : [k.window(t + cw / 2, 1.2), ...frontWin];
      k.outerWalls(level, {
        mat: 'concrete', tint: concrete, parapet: level === top ? ARCH.rail.parapet : 0,
        front,
        back: [k.window(t + cw / 2, 0.9, { sill: 1.6, head: 2.5 }), k.window((xp + P + w - t) / 2, 1.6)],
        left: [k.window((sz1 + d) / 2, 0.8, { sill: 1.2 })],
        right: [(t + zm) / 2, (zm + d - t) / 2].map((z) => k.window(z, 2.0, { broken: k.rand() < 0.15 })),
      });
      k.floor(level, ground ? 'tileFloor' : 'vinyl');
      // Corridor and stair core.
      k.room(level, t, sz1, xp - P, d - t, ground ? 'lobby' : 'hall');
      k.stairs({ level, start: [laneA, sz1], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'concrete', tint: concrete });
      // Tenants.
      k.partition(level, xp, t, xp, d - t, [k.door(zDoorBack - t, lockBack ? 'locked' : 'open'), k.door(zDoorFront - t, lockFront ? 'locked' : 'open')], { mat: 'plaster' });
      k.partition(level, xp + P, zm, w - t, zm, [], { mat: 'plaster' });
      const back = k.room(level, xp + P, t, w - t, zm - P, uses[1]!, { locked: lockBack });
      const fr = k.room(level, xp + P, zm + P, w - t, d - t, uses[0]!, { locked: lockFront });
      furnish(k, level, k.roomById(back), uses[1]!, zDoorBack);
      furnish(k, level, k.roomById(fr), uses[0]!, zDoorFront);
      if (k.rand() < 0.35) k.stain(level, t + 0.4, sz1 + 1.0, t + 1.6, sz1 + 2.2);
      if (ground) k.furniture(level, t, d - t - 2.5, t + 0.3, d - t - 1.2, 1.4, 'steel', { tint: 0.3 }); // mailboxes
    }

    // Roof: the slab, the parapet (on the top floor's walls), the stair house and its door.
    k.roofFlat({ mat: 'concrete', tint: concrete });
    const ph = 2.7;
    const pz = sz1 + 2.0;
    const e = k.eaves;
    const wallOpts = { mat: 'concrete' as const, tint: concrete, y0: e, y1: e + ph, layer: 'shell' as const };
    k.wall(k.storeys, 0, pz - t, cw + 2 * t, pz, [k.door(t + LANE + 0.075)], wallOpts);
    k.wall(k.storeys, cw + t, t, cw + 2 * t, pz - t, [], wallOpts);
    k.box(-1, 0, e + ph, 0, cw + 2 * t, e + ph + 0.2, pz, 'concrete', { layer: 'shell', tint: concrete });
    // The stair house's back and left walls rise from the parapet of the building's outer walls.
    const pp = e + ARCH.rail.parapet;
    k.box(-1, 0, pp, 0, cw + 2 * t, e + ph, t, 'concrete', { layer: 'shell', tint: concrete });
    k.box(-1, 0, pp, t, t, e + ph, pz - t, 'concrete', { layer: 'shell', tint: concrete });
    k.room(k.storeys, t, sz1, cw + t, pz - t, 'stairs');
    const roofFront = k.room(k.storeys, t, pz, w - t, d - t, 'roof');
    const roofSide = k.room(k.storeys, cw + 2 * t, t, w - t, pz, 'roof');
    k.join(roofSide, roofFront);
    k.furniture(k.storeys, w - t - 2.2, d - t - 1.8, w - t - 0.4, d - t - 0.6, 1.2, 'steel', { tint: 0.6 }); // air-conditioning units
    k.furniture(k.storeys, cw + 2 * t + 1.0, t + 0.6, cw + 2 * t + 2.6, t + 2.0, 1.6, 'rust'); // water tank
    return k.finish();
  },
};
