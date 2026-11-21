// What the office towers share (07d-2c): the storeys round a central core (towerFloors) with a
// program for each storey that can be entered, and the roof — the stair house, the helipad, the
// guard rail on the parapet, the mast and the plant. The facades are each type's own.
//
//   programs: lobby · office · exec (meeting room in front) · restaurant · skylobby · bar · hotel

import type { Kit, Rect } from '../../kit.ts';
import type { LootTableId, RoomUse } from '../../types.ts';
import { unit } from '../apartment/unit.ts';
import { guestRoom } from '../shop/common.ts';
import {
  barRoom, canteen, clinicRoom, corridorPlate, salesFloor, coreRoof, guardRail, helipad, kitchen, mast, meeting, officeDesks, ringRooms, roofPlant, stampDesks, storeRoom, toppled, towerFloors, waiting,
  type Core, type Fit, type UnitSlot,
} from './common.ts';

export type Program = 'lobby' | 'office' | 'exec' | 'restaurant' | 'skylobby' | 'bar' | 'hotel';

export interface TowerOpts {
  t: number;
  shafts: number;
  tint: number;
  /** Program of each storey that can be entered; the others are locked. */
  programs: Record<number, Program>;
  /** Desk / furniture colour. */
  accent?: number;
}

/** The storeys of an office tower. */
export function towerStoreys(k: Kit, f: Fit, o: TowerOpts): Core {
  const { w, d } = k;
  const t = o.t;
  const outer: Rect = [t, t, w - t, d - t];
  const accent = o.accent ?? 0.5;
  return towerFloors(k, f, {
    t, shafts: o.shafts, wc: true, tint: o.tint,
    floorMat: (l) => (l === 0 || o.programs[l] === 'skylobby' ? 'tileFloor' : o.programs[l] === 'hotel' ? 'carpet' : 'vinyl'),
    open: (l) => o.programs[l] !== undefined,
    doorW: (l) => (l === 0 ? 1.8 : 1.2),
    stamp: (l, ring) => stampDesks(k, l, ring, accent),
    plate: (level, _c, hole) => {
      const p = o.programs[level]!;
      if (p === 'hotel') {
        corridorPlate(k, level, {
          outer, hole, cw: 1.6, front: Math.max(2, Math.floor((w - 2 * t) / 4.2)), back: Math.max(2, Math.floor((w - 2 * t) / 4.2)), sides: false,
          fill: (u) => {
            const locked = k.rand() < 0.5 && !(u.side === 'front' && u.index === 0);
            guestRoom(k, level, u.rect, u.entry, u.door, { locked, twin: k.rand() < 0.35, tint: accent });
            return { state: locked ? 'locked' : 'open' };
          },
        });
        return;
      }
      const uses: Record<Program, { front: RoomUse; back: RoomUse; left: RoomUse; right: RoomUse }> = {
        lobby: { front: 'lobby', back: 'canteen', left: 'office', right: 'lobby' },
        office: { front: 'office', back: 'office', left: 'office', right: 'office' },
        exec: { front: 'office', back: 'office', left: 'office', right: 'office' },
        restaurant: { front: 'canteen', back: 'canteen', left: 'kitchen', right: 'storage' },
        skylobby: { front: 'lobby', back: 'canteen', left: 'kitchen', right: 'office' },
        bar: { front: 'bar', back: 'canteen', left: 'kitchen', right: 'bar' },
        hotel: { front: 'bedroom', back: 'bedroom', left: 'bedroom', right: 'bedroom' },
      };
      const ring = ringRooms(k, level, outer, hole, uses[p]);
      for (const r of ring.all) {
        const use = k.roomById(r).use;
        if (use === 'lobby') {
          if (r === ring.front) {
            const R = f.roomRect(r);
            f.put(r, [w / 2 + 2.2, R[1] + 0.8, w / 2 + 5.4, R[1] + 1.5], 1.05, 'counter', { tint: accent, search: { kind: 'counter', face: 'z+', table: 'lobby' } });
          }
          waiting(f, r, 'lobby');
        } else if (use === 'canteen') canteen(f, r, { tint: accent });
        else if (use === 'kitchen') kitchen(f, r);
        else if (use === 'storage') storeRoom(f, r, 'grocery');
        else if (use === 'bar') barRoom(f, r, accent);
        else {
          if (p === 'exec' && r === ring.front) meeting(f, r);
          officeDesks(f, r, { tint: accent });
        }
        f.ensure(r, 'desk', use);
        if (f.chance(0.2)) toppled(f, r);
      }
      if (f.chance(0.6)) f.stain(ring.all[Math.floor(f.rand() * ring.all.length)]!);
    },
  });
}

/**
 * The roof of a tower: slab, stair house, roof rooms; the helipad on the biggest strip, a guard
 * rail on the parapet (at `parapetTop`), a mast at the back, the plant elsewhere. The mast reaches
 * `mastTop` (keep it within roofRise).
 */
export function towerRoof(k: Kit, f: Fit, c: Core, o: { t: number; tint: number; parapetTop: number; helipad?: boolean; mastTop?: number; rail?: boolean; edge?: number }): number[] {
  const { w, d } = k;
  const t = o.t;
  k.roofFlat({ mat: 'concrete', tint: o.tint });
  // A roof that reaches past the walls (over balconies) to an upstand `edge` thick.
  const e = o.edge ?? t;
  if (e < t) for (const r of [[e, d - t, w - e, d - e], [e, e, w - e, t], [e, t, t, d - t], [w - t, t, w - e, d - t]] as Rect[]) k.floor(k.storeys, 'concrete', r);
  coreRoof(k, c, { tint: o.tint });
  const ring = ringRooms(k, k.storeys, [e, e, w - e, d - e], [c.x0 - 0.1, c.z0 - 0.1, c.x1 + 0.1, c.z1 + 0.1], 'roof');
  const strips = ring.all.map((r) => ({ r, rect: f.roomRect(r) }));
  const big = [...strips].sort((a, b) => Math.min(b.rect[2] - b.rect[0], b.rect[3] - b.rect[1]) - Math.min(a.rect[2] - a.rect[0], a.rect[3] - a.rect[1]))[0];
  if (o.helipad && big) {
    const size = Math.min(big.rect[2] - big.rect[0], big.rect[3] - big.rect[1]) - 1.0;
    if (size >= 6) helipad(k, (big.rect[0] + big.rect[2]) / 2, (big.rect[1] + big.rect[3]) / 2, Math.min(size, 15));
  }
  if (o.rail ?? true) guardRail(k, t, o.parapetTop);
  if (o.mastTop !== undefined) {
    const mx = (c.x0 + c.x1) / 2;
    mast(k, mx, t + 0.9, o.mastTop);
    if (ring.back !== undefined) f.reserve(ring.back, [mx - 0.5, t, mx + 0.5, t + 1.4]);
  }
  const others = strips.filter((s) => !o.helipad || s !== big).map((s) => s.r);
  roofPlant(f, others.length ? others : ring.all, { units: 4 });
  for (const r of ring.all) f.ensure(r, 'crate', 'roof');
  return ring.all;
}

/** A flat (apartment/unit.ts) in a corridor plate's unit slot; locked ones are an empty locked room. */
export function flatUnit(k: Kit, u: UnitSlot, locked: boolean): { state: 'open' | 'locked'; at: number } {
  const [x0, z0, x1, z1] = u.rect;
  const spec = u.entry === 'z-' ? { origin: [x0, z0] as [number, number], eu: 'x+' as const, ev: 'z+' as const, U: x1 - x0, V: z1 - z0 }
    : u.entry === 'z+' ? { origin: [x0, z1] as [number, number], eu: 'x+' as const, ev: 'z-' as const, U: x1 - x0, V: z1 - z0 }
      : u.entry === 'x+' ? { origin: [x1, z0] as [number, number], eu: 'z+' as const, ev: 'x-' as const, U: z1 - z0, V: x1 - x0 }
        : { origin: [x0, z0] as [number, number], eu: 'z+' as const, ev: 'x+' as const, U: z1 - z0, V: x1 - x0 };
  const plan = unit(k, { level: u.level, ...spec, locked, tatami: k.rand() < 0.3 });
  return { state: locked ? 'locked' : 'open', at: u.entry === 'z-' || u.entry === 'z+' ? plan.door[0] : plan.door[1] };
}

/** A shop unit: shuttered (locked) or open with its shelves and counter. */
export function shopUnit(k: Kit, f: Fit, u: UnitSlot, open: boolean, tables: LootTableId[] = ['sales']): { state: 'open' | 'shutter'; width?: number; at?: number } {
  const [x0, z0, x1, z1] = u.rect;
  if (!open) {
    k.room(u.level, x0, z0, x1, z1, 'sales', { locked: true });
    return { state: 'shutter' };
  }
  const r = k.room(u.level, x0, z0, x1, z1, 'sales');
  salesFloor(f, r, { tables, along: u.entry[0] === 'z' ? 'z' : 'x' });
  if (f.chance(0.4)) f.stain(r);
  return { state: 'open', width: 1.6, at: u.entry[0] === 'z' ? (x0 + x1) / 2 : (z0 + z1) / 2 };
}

/** A small clinic in a unit: its benches, the counter, a bed and the medicine cabinet. */
export function clinicUnit(k: Kit, f: Fit, u: UnitSlot, locked: boolean): { state: 'open' | 'locked' } {
  const [x0, z0, x1, z1] = u.rect;
  const r = k.room(u.level, x0, z0, x1, z1, 'clinic', { locked });
  if (!locked) {
    clinicRoom(f, r);
    waiting(f, r, 'clinic');
  }
  return { state: locked ? 'locked' : 'open' };
}
