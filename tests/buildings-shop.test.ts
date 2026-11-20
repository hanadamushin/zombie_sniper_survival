// Shops, restaurants, hotels, inns, the petrol station and the shuttered shops (07d-2b). The catalog
// test in buildings.test.ts already checks every type (determinism, triangles, reachability,
// straight ways, walking every link turned four ways); this file checks what is particular to the
// shop category: that the variants really differ, that the seed changes the details, the features
// each one promises, and a walk in from the street to the top floor of each.

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
import { yardEntries, yardMap } from '../src/sim/tactical/yard.ts';

const SHUTTERED = ['yaoya', 'honya', 'yakkyoku', 'denki', 'fuku', 'drug', 'sakaya'].map((v) => `shop.shut_${v}`);
const OPEN = [
  'bank_chihou', 'bank_toshi', 'konbini_road', 'konbini_tenant', 'famiresu', 'ramen', 'kaitenzushi', 'izakaya', 'fastfood',
  'hotel_biz', 'hotel_resort', 'ryokan_onsen', 'minshuku', 'gas',
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

/** Rooms that are only ways through (no search needed). */
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

describe('shops, restaurants, hotels and inns (07d-2b)', () => {
  it('registers every promised type in the shop category', () => {
    for (const id of MINE) expect(def(id), id).toBeDefined();
    const shop = BUILDING_DEFS.filter((d) => d.category === 'shop');
    expect(shop.filter((d) => d.id.startsWith('shop.bank')).length).toBe(2);
    expect(shop.filter((d) => d.id.startsWith('shop.konbini')).length).toBe(3); // the sample and two more
    expect(shop.filter((d) => d.id.startsWith('shop.hotel')).length).toBe(2);
    expect(shop.filter((d) => d.id.startsWith('shop.shut_')).length).toBeGreaterThanOrEqual(6);
  });

  it('makes every variant look and lay out differently, and the seed change its details', () => {
    const signatures = new Set<string>();
    for (const id of MINE) {
      const d = def(id);
      const b = bp(id, 7);
      const uses = b.rooms.map((r) => `${r.level}:${r.use}${r.locked ? '!' : ''}`).sort().join(',');
      const doors = b.openings.filter((o) => o.kind === 'door' && o.exterior).map((o) => o.state).sort().join(',');
      signatures.add(`${d.storeys}|${d.roof}|${uses}|${doors}`);
      const other = bp(id, 8);
      expect(JSON.stringify(other.parts), `${id}: seeds 7 and 8 give the same building`).not.toBe(JSON.stringify(b.parts));
    }
    expect(signatures.size).toBe(MINE.length);
  });

  it('gives every room with a purpose something to search, from a loot table that exists', () => {
    for (const id of MINE) {
      const d = def(id);
      for (const seed of [1, 2, 3]) {
        const b = generateBlueprint(d, d.size.w[0], d.size.d[0], seed);
        // Strips of one floor joined into one (the aisles of a convenience store) count as one room.
        const group = b.rooms.map((r) => r.id);
        const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i]!)));
        for (const l of b.links) if (l.kind === 'join' && b.rooms[l.a]!.use === b.rooms[l.b]!.use) group[find(l.a)] = find(l.b);
        const searched = new Set(b.search.map((q) => find(q.room)));
        for (const r of b.rooms) {
          if (r.locked || PASSAGE.has(r.use)) continue;
          expect(searched.has(find(r.id)), `${id} seed ${seed}: the ${r.use} on storey ${r.level} has nothing to search`).toBe(true);
        }
        for (const s of b.search) expect(ROOM_LOOT[s.table], `${id}: loot table ${s.table}`).toBeDefined();
      }
    }
  });

  it('keeps the closed shops shut: shutters in front, the shop floor locked (the pharmacy is open from the back)', () => {
    for (const id of SHUTTERED) {
      const b = bp(id);
      const front = b.openings.filter((o) => o.exterior && o.kind === 'door' && o.level === 0 && o.z > b.d - 0.5);
      expect(front.length, id).toBeGreaterThan(0);
      expect(front.every((o) => o.state === 'shutter' || o.state === 'locked'), `${id}: something open in the front`).toBe(true);
      const sales = b.rooms.find((r) => r.use === 'sales')!;
      if (id === 'shop.shut_yakkyoku') {
        expect(sales.locked).toBeFalsy();
        expect(b.search.filter((s) => s.room === sales.id && s.table === 'pharmacy').length).toBeGreaterThanOrEqual(2);
        // In by the back door: from outside to the shop floor.
        const back = b.links.find((l) => l.a === -1)!;
        expect(back.pts[0]![2]).toBeLessThan(1);
      } else {
        expect(sales.locked, id).toBe(true);
        expect(b.search.every((s) => s.table !== 'pharmacy')).toBe(true);
      }
    }
  });

  it('builds what each type promises', () => {
    // Banks: the vault is locked behind a steel door; the ATM corner opens on the street; the city branch has three floors.
    for (const id of ['shop.bank_chihou', 'shop.bank_toshi']) {
      const b = bp(id);
      expect(b.rooms.some((r) => r.use === 'storage' && r.locked), `${id}: vault`).toBe(true);
      expect(b.parts.some((p) => p.mat === 'doorSteel'), `${id}: steel door`).toBe(true);
      expect(b.openings.filter((o) => o.exterior && o.kind === 'door' && o.state === 'open').length, `${id}: ATM door`).toBeGreaterThanOrEqual(2);
      expect(b.openings.some((o) => o.state === 'shutter'), `${id}: the ATM shutter`).toBe(true);
    }
    expect(def('shop.bank_toshi').storeys).toBe(3);
    // Petrol station: fuel to be found, a canopy over the pumps.
    const gas = bp('shop.gas');
    expect(gas.search.filter((s) => s.table === 'fuel').length).toBeGreaterThanOrEqual(2);
    expect(gas.rooms.some((r) => r.use === 'garage')).toBe(true);
    expect(ROOM_LOOT.fuel!.fuel).toBeGreaterThan(0);
    // Tenant konbini: nothing above its ceiling slab, the slab covers the whole footprint (an upper building can stand on it).
    const ten = bp('shop.konbini_tenant');
    expect(def('shop.konbini_tenant').storeys).toBe(1);
    expect(ten.height).toBeLessThanOrEqual(def('shop.konbini_tenant').plinth + ARCH.storey.shop + 1e-6);
    expect(ten.parts.some((p) => p.level === 1 && p.x0 <= 0 && p.x1 >= ten.w && p.z0 <= 0 && p.z1 >= ten.d)).toBe(true);
    // Roadside konbini: the car park in front of the building.
    const road = bp('shop.konbini_road');
    const front = Math.max(...road.rooms.map((r) => r.z1));
    expect(road.d - front).toBeGreaterThan(5);
    // Izakaya: tatami rooms upstairs; ramen: a counter; conveyor sushi: booths; fast food: the pickup window on the lane side.
    expect(bp('shop.izakaya').rooms.filter((r) => r.level === 1 && r.use === 'tatami').length).toBe(2);
    expect(bp('shop.ramen').search.some((s) => s.kind === 'counter')).toBe(true);
    expect(bp('shop.kaitenzushi').search.filter((s) => s.kind === 'table').length).toBeGreaterThanOrEqual(4);
    const ff = bp('shop.fastfood');
    expect(ff.openings.some((o) => o.kind === 'window' && o.exterior && o.axis === 'z' && o.x > ff.w - 5)).toBe(true);
    // Business hotel: 8-10 storeys of the same floor, the dead lift, about half the rooms locked.
    const biz = bp('shop.hotel_biz');
    expect(def('shop.hotel_biz').storeys).toBeGreaterThanOrEqual(8);
    expect(def('shop.hotel_biz').storeys).toBeLessThanOrEqual(10);
    expect(biz.stairs.some((s) => s.kind === 'shaft' && !s.usable)).toBe(true);
    const guest = biz.rooms.filter((r) => r.level > 0 && r.use === 'bedroom');
    const locked = guest.filter((r) => r.locked).length / guest.length;
    expect(locked).toBeGreaterThan(0.25);
    expect(locked).toBeLessThan(0.75);
    const perFloor = new Set(biz.rooms.filter((r) => r.level > 0).map((r) => `${r.x0.toFixed(2)},${r.z0.toFixed(2)},${r.x1.toFixed(2)},${r.z1.toFixed(2)}`));
    expect(perFloor.size * 8).toBe(biz.rooms.filter((r) => r.level > 0).length); // the same plan on every guest floor
    // Resort: low and long, a pool in the garden.
    const resort = def('shop.hotel_resort');
    expect(resort.storeys).toBeLessThanOrEqual(3);
    expect(resort.size.w[0]).toBeGreaterThan(resort.size.d[1] * 1.5);
    // Onsen ryokan: the large bath and its dressing room, tatami guest rooms; minshuku: tatami rooms upstairs.
    const onsen = bp('shop.ryokan_onsen');
    expect(onsen.rooms.filter((r) => r.level === 0 && r.use === 'bath').length).toBe(2);
    expect(onsen.rooms.filter((r) => r.level === 1 && r.use === 'tatami').length).toBeGreaterThanOrEqual(6);
    expect(bp('shop.minshuku').rooms.filter((r) => r.level === 1 && r.use === 'tatami').length).toBe(2);
  });

  it('stays well inside the triangle budget', () => {
    for (const id of MINE) {
      const d = def(id);
      const tris = triangleCount(generateBlueprint(d, d.size.w[1], d.size.d[1], 11));
      expect(tris.shell, id).toBeLessThanOrEqual(ARCH.limits.shop.shell);
      for (const n of tris.interior) expect(n, id).toBeLessThanOrEqual(ARCH.limits.shop.interior);
    }
  });

  it('walks from the street through the front door to the highest open room of every enterable type (turned east)', () => {
    for (const id of MINE) {
      const d = def(id);
      const b = createFlatBuilder(0);
      addEnterable(b, id, 100, 100, d.size.w[0], d.size.d[0], 1 as Rot);
      const map = finishMap(b);
      const p = map.placements[0]!;
      const det = detailOf(p);
      const open = det.rooms.filter((r) => !r.locked);
      const top = Math.max(...open.map((r) => r.level));
      const goal = open.filter((r) => r.level === top).sort((a, c) => (c.wx1 - c.wx0) * (c.wz1 - c.wz0) - (a.wx1 - a.wx0) * (a.wz1 - a.wz0))[0]!;
      // Aim at the way into the room (its middle may be under a table).
      const into = det.links.find((l) => l.b === goal.id || l.a === goal.id)!;
      const target: Vec3 = into.b === goal.id ? into.wpts[into.wpts.length - 1]! : into.wpts[0]!;
      // The front faces east. Start 5 m out from the first open outer door (the closed shops' is at the back).
      const o = det.links.find((l) => l.a === -1)!.wpts[0]!;
      const [cx, cz] = [(p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2];
      const dx = Math.abs(o[0] - cx) / (p.x1 - p.x0) > Math.abs(o[2] - cz) / (p.z1 - p.z0) ? Math.sign(o[0] - cx) : 0;
      const dz = dx === 0 ? Math.sign(o[2] - cz) : 0;
      const start: Vec3 = [o[0] + dx * 5, 0, o[2] + dz * 5];
      const path = indoorPath(map, start, target, 0.35);
      expect(path, id).not.toBeNull();
      const state = createInitialState(1, 1);
      placePlayer(state.player, map, start[0], start[2], 0);
      state.player.pos[1] = supportAt(map, start[0], start[2], 0.05);
      expect(walkThrough(map, state, path!), `${id}: did not get to the ${goal.use} on storey ${goal.level}`).toBe(-1);
      expect(state.player.pos[1], id).toBeCloseTo(p.base + goal.y, 1);
    }
  });

  it('stands every type in the yard without overlaps, inside the map', () => {
    const map = yardMap();
    const entries = yardEntries();
    for (const id of MINE) expect(entries.filter((e) => e.def === id).length, id).toBe(2);
    const ps = map.placements;
    for (const a of ps) {
      expect(a.x0 >= 0 && a.z0 >= 0 && a.x1 <= map.size && a.z1 <= map.size, `${a.def} outside the map`).toBe(true);
      for (const b of ps) if (a !== b) expect(a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0, `${a.def} overlaps ${b.def}`).toBe(true);
    }
  });
});
