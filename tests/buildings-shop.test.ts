// Shops, restaurants and lodging (07d-2b). The catalog test in buildings.test.ts already checks every
// type (determinism, triangles, reachability, straight ways, walking every link turned four ways);
// this file checks what is particular to the 'shop' types: that the variants really differ, that the
// seed changes the details, the features each one promises (vaults, counters, the car park, the
// conveyor lanes, the repeated hotel floors, the baths, the fuel, the shutters that keep people out)
// and a walk in from the door to the highest open room of each.

import { describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame, type GameState } from '../src/core/types.ts';
import { ARCH } from '../src/data/architecture.ts';
import { BALANCE } from '../src/data/balance.ts';
import { ROOM_LOOT } from '../src/data/colony.ts';
import { addEnterable, createFlatBuilder } from '../src/gen/builder.ts';
import { BUILDING_DEFS, detailOf, generateBlueprint, triangleCount, type BuildingBlueprint, type BuildingDef, type Rot } from '../src/gen/buildings/index.ts';
import { finishMap, type TacticalMap } from '../src/gen/index.ts';
import { supportAt, type Vec3 } from '../src/sim/tactical/collision.ts';
import { indoorPath } from '../src/sim/tactical/indoor.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';

const SHUTTERED = ['shut_yaoya', 'shut_honya', 'shut_yakkyoku', 'shut_denki', 'shut_fuku', 'shut_drug', 'shut_sakaya'].map((v) => `shop.${v}`);
const OPEN = [
  'bank', 'bank_city', 'konbini_road', 'konbini_tenant', 'famires', 'ramen', 'kaitenzushi', 'izakaya', 'fastfood',
  'hotel_biz', 'hotel_resort', 'ryokan', 'minshuku', 'gas_station',
].map((v) => `shop.${v}`);
const MINE = [...OPEN, ...SHUTTERED];
const def = (id: string): BuildingDef => BUILDING_DEFS.find((d) => d.id === id)!;
const mid = (d: BuildingDef): [number, number] => [(d.size.w[0] + d.size.w[1]) / 2, (d.size.d[0] + d.size.d[1]) / 2];
const bp = (id: string, seed = 3): BuildingBlueprint => {
  const d = def(id);
  const [w, dd] = mid(d);
  return generateBlueprint(d, w, dd, seed);
};
const DT = BALANCE.time.fixedStep;
/** Rooms one walks through rather than searches (and the aisles between shelves). */
const PASSAGE = new Set(['hall', 'genkan', 'lobby', 'stairs', 'roof', 'toilet']);

function walkThrough(map: TacticalMap, state: GameState, pts: readonly Vec3[]): number {
  const p = state.player;
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty, tz] = pts[i]!;
    let ok = false;
    for (let s = 0; s < 30 / DT; s++) {
      const dx = tx - p.pos[0];
      const dz = tz - p.pos[2];
      if (Math.hypot(dx, dz) < 0.3 && Math.abs(ty - p.pos[1]) < 0.35) {
        ok = true;
        break;
      }
      p.yaw = Math.atan2(-dx, -dz);
      updatePlayer(p, map, { ...emptyInputFrame(), moveZ: Math.min(1, Math.hypot(dx, dz) / 0.6 + 0.2) }, DT);
    }
    if (!ok) return i;
  }
  return -1;
}

/** Rooms reachable from outside through open doors, joins and stairs. */
function reachable(b: BuildingBlueprint): Set<number> {
  const reach = new Set<number>([-1]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const l of b.links) {
      if (reach.has(l.a) !== reach.has(l.b)) {
        reach.add(l.a);
        reach.add(l.b);
        changed = true;
      }
    }
  }
  return reach;
}

describe('shops, restaurants and lodging (07d-2b)', () => {
  it('registers the twenty-one shop types (the sample konbini and twenty new ones)', () => {
    for (const id of MINE) expect(def(id), id).toBeDefined();
    expect(BUILDING_DEFS.filter((d) => d.category === 'shop').length).toBeGreaterThanOrEqual(21);
    expect(SHUTTERED.length).toBeGreaterThanOrEqual(6);
  });

  it('makes every variant look and lay out differently, and the seed change its details', () => {
    const signatures = new Set<string>();
    for (const id of MINE) {
      const d = def(id);
      const [w, dd] = mid(d);
      const b = generateBlueprint(d, w, dd, 7);
      const uses = [...new Set(b.rooms.map((r) => `${r.level}:${r.use}${r.locked ? 'L' : ''}`))].sort().join(',');
      signatures.add(`${d.storeys}|${d.roof}|${uses}`);
      const other = generateBlueprint(d, w, dd, 8);
      expect(JSON.stringify(other.parts), `${id}: seeds 7 and 8 give the same building`).not.toBe(JSON.stringify(b.parts));
    }
    expect(signatures.size).toBe(MINE.length);
  });

  it('has something to search in every kind of room with a purpose, from loot tables that exist', () => {
    for (const id of MINE) {
      for (const seed of [1, 2, 3]) {
        const d = def(id);
        const b = generateBlueprint(d, d.size.w[0], d.size.d[0], seed);
        const uses = new Set(b.rooms.filter((r) => !r.locked && !PASSAGE.has(r.use)).map((r) => r.use));
        for (const use of uses) {
          expect(b.search.some((s) => b.rooms[s.room]!.use === use && !b.rooms[s.room]!.locked), `${id} seed ${seed}: nothing to search in any ${use}`).toBe(true);
        }
        for (const s of b.search) expect(ROOM_LOOT[s.table], `${id}: loot table ${s.table}`).toBeDefined();
      }
    }
  });

  it('keeps the shuttered shops shut (but for the pharmacy\'s back door) and paints their shutters', () => {
    for (const id of SHUTTERED) {
      const b = bp(id);
      expect(b.openings.some((o) => o.state === 'shutter' && o.exterior), `${id}: a shutter on the street`).toBe(true);
      expect(b.parts.some((p) => p.mat === 'rust' && p.solid === false), `${id}: rust`).toBe(true);
      expect(b.parts.some((p) => (p.mat === 'sign' || p.mat === 'blood') && p.solid === false && p.z1 - p.z0 < 0.02), `${id}: graffiti`).toBe(true);
      const reach = reachable(b);
      const shop = b.rooms.filter((r) => r.use === 'sales');
      if (id === 'shop.shut_yakkyoku') {
        for (const r of shop) expect(reach.has(r.id), 'the pharmacy is reached through the back door').toBe(true);
        expect(b.search.some((s) => s.table === 'pharmacy' && reach.has(s.room)), 'medicine inside').toBe(true);
        expect(b.links.some((l) => l.a === -1 && b.rooms[l.b]!.use !== 'hall'), 'a way in that is not the front recess').toBe(true);
      } else {
        // Only the recess in front of the shutter can be reached.
        for (const r of b.rooms) if (r.use !== 'hall') expect(r.locked && !reach.has(r.id), `${id}: the ${r.use} on storey ${r.level} is shut`).toBe(true);
        // Offered for searching only when the recess has a vending machine.
        expect(d(id).lootable, id).toBe(b.search.some((q) => reach.has(q.room)));
      }
    }
    function d(id: string): BuildingDef {
      return def(id);
    }
  });

  it('has the features each type promises', () => {
    // Banks: the vault is locked behind a steel door, the teller counter is a low wall, the ATM corner has its own door.
    for (const id of ['shop.bank', 'shop.bank_city']) {
      const b = bp(id);
      expect(b.rooms.some((r) => r.use === 'storage' && r.locked), `${id}: vault`).toBe(true);
      expect(b.parts.some((p) => p.mat === 'doorSteel'), `${id}: steel door`).toBe(true);
      expect(b.parts.some((p) => p.mat === 'counter' && p.level === 0 && p.y1 - b.storeys[0]!.y < 1.2 && p.y1 - b.storeys[0]!.y > 0.9 && p.x1 - p.x0 > 2), `${id}: low counter`).toBe(true);
      expect(b.links.filter((l) => l.a === -1).length, `${id}: the ATM corner's own door`).toBeGreaterThanOrEqual(2);
    }
    const city = bp('shop.bank_city');
    expect(city.storeys.length).toBe(3);
    expect(city.stairs.some((s) => s.kind === 'shaft' && !s.usable)).toBe(true);
    expect(Math.max(...city.rooms.filter((r) => !r.locked).map((r) => r.level))).toBe(2);
    // Konbini: the roadside one has its car park, the tenant one is a ground floor with the building's lobby and locked core.
    const road = bp('shop.konbini_road');
    expect(road.parts.some((p) => p.mat === 'asphalt')).toBe(true);
    expect(road.rooms.some((r) => r.use === 'toilet') && road.rooms.some((r) => r.use === 'storage')).toBe(true);
    const tenant = bp('shop.konbini_tenant');
    expect(def('shop.konbini_tenant').storeys).toBe(1);
    expect(def('shop.konbini_tenant').storeyHeight).toBe(ARCH.storey.concrete);
    expect(tenant.rooms.some((r) => r.use === 'stairs' && r.locked)).toBe(true);
    expect(tenant.rooms.some((r) => r.use === 'lobby' && !r.locked)).toBe(true);
    // Restaurants.
    const fam = bp('shop.famires');
    expect(fam.rooms.filter((r) => r.level === 0).length).toBe(1); // only the stair box downstairs: the rest is the car park
    expect(fam.rooms.some((r) => r.level === 1 && r.use === 'kitchen')).toBe(true);
    const izakaya = bp('shop.izakaya');
    expect(izakaya.rooms.filter((r) => r.level === 1 && r.use === 'tatami').length).toBeGreaterThanOrEqual(2);
    expect(izakaya.rooms.some((r) => r.level === 0 && r.use === 'bar')).toBe(true);
    const sushi = bp('shop.kaitenzushi');
    expect(sushi.parts.filter((p) => p.mat === 'steel' && p.role === 'furniture' && p.z1 - p.z0 > 5 && p.x1 - p.x0 < 0.5).length).toBeGreaterThanOrEqual(2); // conveyor lanes
    const ff = bp('shop.fastfood');
    expect(ff.parts.some((p) => p.mat === 'asphalt')).toBe(true);
    expect(ff.openings.some((o) => o.kind === 'window' && o.exterior && o.axis === 'z' && o.x > ff.w / 2)).toBe(true); // the pick-up window on the lane side
    expect(bp('shop.ramen').rooms.map((r) => r.use)).toEqual(expect.arrayContaining(['kitchen', 'canteen', 'toilet', 'storage']));
    // Hotels: ten storeys of identical floors (the same rooms in the same places), the roof; the resort is long, low, with two stairs.
    const biz = bp('shop.hotel_biz');
    expect(biz.storeys.length).toBe(11);
    expect(biz.roofAccess).toBe(true);
    const plan = (level: number): string => biz.rooms.filter((r) => r.level === level).map((r) => `${r.x0.toFixed(2)},${r.z0.toFixed(2)},${r.x1.toFixed(2)},${r.z1.toFixed(2)}`).join(';');
    for (let level = 2; level < 10; level++) expect(plan(level)).toBe(plan(1));
    expect(triangleCount(biz).shell).toBeLessThanOrEqual(ARCH.limits.shop.shell);
    const guest = biz.rooms.filter((r) => r.use === 'bedroom');
    const lockedShare = guest.filter((r) => r.locked).length / guest.length;
    expect(lockedShare).toBeGreaterThan(0.25);
    expect(lockedShare).toBeLessThan(0.75);
    const resort = bp('shop.hotel_resort');
    expect(resort.storeys.length).toBe(3);
    expect(resort.w).toBeGreaterThanOrEqual(40);
    expect(resort.stairs.filter((s) => s.kind === 'stairs' && s.from === 0).length).toBe(2);
    // Lodging: the big baths and tatami rooms upstairs.
    const ryokan = bp('shop.ryokan');
    expect(ryokan.rooms.filter((r) => r.use === 'bath').length).toBe(2);
    expect(ryokan.rooms.filter((r) => r.level === 1 && r.use === 'tatami').length).toBeGreaterThanOrEqual(5);
    const minshuku = bp('shop.minshuku');
    expect(minshuku.rooms.filter((r) => r.level === 1 && r.use === 'tatami').length).toBe(4);
    expect(minshuku.rooms.some((r) => r.use === 'canteen')).toBe(true);
    // Gas station: fuel can be found, the bay is a garage with tools.
    const gas = bp('shop.gas_station');
    expect(gas.search.filter((s) => s.table === 'fuel').length).toBeGreaterThanOrEqual(2);
    expect(gas.search.some((s) => s.table === 'tools')).toBe(true);
    expect(gas.rooms.some((r) => r.use === 'garage')).toBe(true);
    expect(ROOM_LOOT.fuel!.fuel!).toBeGreaterThan(ROOM_LOOT.garage!.fuel!);
  });

  it('walks in from the front door to the highest open room of each, turned east', () => {
    for (const id of MINE) {
      const d = def(id);
      const b = createFlatBuilder(0);
      addEnterable(b, id, 100, 100, d.size.w[0], d.size.d[0], 1 as Rot);
      const map = finishMap(b);
      const det = detailOf(map.placements[0]!);
      const reach = reachable(det.bp);
      const open = det.rooms.filter((r) => !r.locked && reach.has(r.id));
      const topLevel = Math.max(...open.map((r) => r.level));
      const goal = open.filter((r) => r.level === topLevel).sort((a, b2) => (b2.x1 - b2.x0) * (b2.z1 - b2.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0]!;
      // The door in: of the outside doors into the goal's part of the building (the pharmacy's is its
      // back door), the one furthest towards the street (east).
      const part = new Set<number>([goal.id]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const l of det.bp.links) {
          if (l.a < 0) continue;
          if (part.has(l.a) !== part.has(l.b)) {
            part.add(l.a);
            part.add(l.b);
            changed = true;
          }
        }
      }
      const doors = det.links.filter((l) => l.a === -1 && part.has(l.b)).sort((p, q) => q.wpts[0]![0] - p.wpts[0]![0]);
      const door = doors[0]!;
      const start = door.wpts[0]!;
      const into = det.links.find((l) => l.b === goal.id || l.a === goal.id)!;
      const target: Vec3 = into.b === goal.id ? into.wpts[into.wpts.length - 1]! : into.wpts[0]!;
      const inside = door.wpts[door.wpts.length - 1]!;
      const route = indoorPath(map, inside, target, 0.35);
      expect(route, id).not.toBeNull();
      const path = [...door.wpts.slice(1), ...route!];
      const state = createInitialState(1, 1);
      placePlayer(state.player, map, start[0], start[2], 0);
      state.player.pos[1] = supportAt(map, start[0], start[2], 0.05);
      expect(walkThrough(map, state, path), `${id}: walking to the ${goal.use} on storey ${goal.level}`).toBe(-1);
      expect(state.player.pos[1]).toBeCloseTo(goal.wy, 1);
    }
  });
});
