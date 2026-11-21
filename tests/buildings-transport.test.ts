// Transport buildings (07d-2e): stations and airports. The catalog test in buildings.test.ts already
// checks every type (determinism, triangles, reachability, straight ways, walking every link turned
// four ways); this file checks what is particular to the 'transport' types: the variants really
// differ, the seed changes the details, the trains one can walk into, the footbridge and the bridge
// concourses with their ticket gates, the sealed underground entrances, the complex of the big city
// (deck, department store, hotel roof), the airports' runways, towers, hangar and boarding bridges,
// the two yards, and a walk in from a door to the highest open room of each.

import { describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame, type GameState } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { ROOM_LOOT } from '../src/data/colony.ts';
import { addEnterable, createFlatBuilder } from '../src/gen/builder.ts';
import { BUILDING_DEFS, detailOf, generateBlueprint, type BuildingBlueprint, type BuildingDef, type Rot } from '../src/gen/buildings/index.ts';
import { finishMap, type TacticalMap } from '../src/gen/index.ts';
import { supportAt, type Vec3 } from '../src/sim/tactical/collision.ts';
import { indoorPath } from '../src/sim/tactical/indoor.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';
import { bigForYard, yardEntries, yardMap } from '../src/sim/tactical/yard.ts';

const STATIONS = ['mujin', 'town', 'city', 'pref', 'seirei'].map((v) => `transport.station_${v}`);
const AIRPORTS = ['s', 'm', 'l'].map((v) => `transport.airport_${v}`);
const MINE = [...STATIONS, ...AIRPORTS];
const def = (id: string): BuildingDef => BUILDING_DEFS.find((d) => d.id === id)!;
const mid = (d: BuildingDef): [number, number] => [(d.size.w[0] + d.size.w[1]) / 2, (d.size.d[0] + d.size.d[1]) / 2];
const cache = new Map<string, BuildingBlueprint>();
const bp = (id: string, seed = 3): BuildingBlueprint => {
  const key = `${id}:${seed}`;
  let b = cache.get(key);
  if (!b) {
    const d = def(id);
    const [w, dd] = mid(d);
    cache.set(key, (b = generateBlueprint(d, w, dd, seed)));
  }
  return b;
};
const DT = BALANCE.time.fixedStep;

function walkThrough(map: TacticalMap, state: GameState, pts: readonly Vec3[]): number {
  const p = state.player;
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty, tz] = pts[i]!;
    let ok = false;
    // Rooms on these sites are long (a deck of 80 m): up to 90 s per way point at a walk.
    for (let s = 0; s < 90 / DT; s++) {
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

const open = (b: BuildingBlueprint, use: string): BuildingBlueprint['rooms'] => {
  const reach = reachable(b);
  return b.rooms.filter((r) => r.use === use && !r.locked && reach.has(r.id));
};

describe('transport buildings (07d-2e)', () => {
  it('registers the eight transport types', () => {
    const ids = BUILDING_DEFS.filter((d) => d.category === 'transport').map((d) => d.id);
    expect(ids.sort()).toEqual([...MINE].sort());
  });

  it('makes every type look and divide differently, and the seed change the details', () => {
    const sig = (id: string): string => {
      const b = bp(id);
      const uses = [...new Set(b.rooms.map((r) => r.use))].sort().join(',');
      return `${def(id).storeys}|${b.w}|${b.d}|${b.rooms.length}|${uses}`;
    };
    expect(new Set(MINE.map(sig)).size).toBe(MINE.length);
    for (const id of MINE) {
      const a = JSON.stringify(bp(id, 3).parts);
      const c = JSON.stringify(bp(id, 4).parts);
      expect(a === c, `${id}: seeds 3 and 4 give the same parts`).toBe(false);
    }
  });

  it('gives every purposeful room something to search, from loot tables that exist', () => {
    for (const id of MINE) {
      for (const seed of [1, 2, 3]) {
        const b = bp(id, seed);
        for (const s of b.search) expect(ROOM_LOOT[s.table], `${id}: loot table ${s.table}`).toBeDefined();
        const reach = reachable(b);
        for (const r of b.rooms) {
          if (r.locked || !reach.has(r.id) || ['hall', 'lobby', 'stairs', 'roof', 'platform'].includes(r.use)) continue;
          expect(b.search.some((s) => s.room === r.id), `${id} seed ${seed}: the ${r.use} on storey ${r.level} has nothing to search`).toBe(true);
        }
      }
    }
  });

  it('has trains at every station, some of whose cars one can walk into', () => {
    for (const id of STATIONS) {
      for (const seed of [1, 2, 3, 4]) {
        const b = bp(id, seed);
        const cars = open(b, 'train');
        expect(cars.length, `${id} seed ${seed}: open cars`).toBeGreaterThan(0);
        for (const c of cars) {
          expect(c.x1 - c.x0).toBeGreaterThan(15); // a whole car
          expect(b.search.some((s) => s.room === c.id && s.table === 'train')).toBe(true);
          // Entered by its doors from a platform.
          expect(b.links.some((l) => l.kind === 'door' && ((l.a === c.id && b.rooms[l.b]?.use === 'platform') || (l.b === c.id && b.rooms[l.a]?.use === 'platform')))).toBe(true);
        }
        expect(open(b, 'platform').length).toBeGreaterThan(0);
      }
    }
    // Long rails across the whole site.
    for (const id of STATIONS) expect(bp(id).parts.filter((p) => p.mat === 'steel' && p.x1 - p.x0 >= bp(id).w - 0.01).length).toBeGreaterThanOrEqual(2);
  });

  it('climbs the footbridge of the town station and the bridge concourses through the ticket gates of the city stations', () => {
    const town = bp('transport.station_town');
    expect(open(town, 'hall').some((r) => r.level === 1)).toBe(true);
    expect(town.links.filter((l) => l.kind === 'stairs').length).toBe(2);
    for (const id of ['transport.station_city', 'transport.station_pref', 'transport.station_seirei']) {
      const b = bp(id);
      // The gates: doors on storey 1 joining a bridge room (behind the house) and the concourse.
      const gates = b.openings.filter((o) => o.kind === 'door' && o.level === 1 && o.y1 - o.y0 < 1.2);
      expect(gates.length, id).toBeGreaterThanOrEqual(2);
      expect(gates.some((o) => o.state === 'open')).toBe(true);
      // A stair from storey 0 to the bridge for every island (and the house's core).
      const islands = b.rooms.filter((r) => r.use === 'platform' && r.level === 0);
      const fromIslands = b.links.filter((l) => l.kind === 'stairs' && islands.some((r) => r.id === l.a || r.id === l.b));
      expect(fromIslands.length, id).toBeGreaterThanOrEqual(id.endsWith('city') ? 2 : id.endsWith('pref') ? 3 : 4);
      expect(b.roofAccess).toBe(true);
    }
  });

  it('seals the underground passages and the mall behind shutters, keeps the deck, the store and the hotel roof of the big city', () => {
    for (const id of ['transport.station_pref', 'transport.station_seirei']) {
      expect(bp(id).openings.filter((o) => o.kind === 'door' && o.exterior && o.state === 'shutter' && o.width >= 2.5).length, id).toBeGreaterThanOrEqual(2);
    }
    const b = bp('transport.station_seirei');
    const reach = reachable(b);
    // The deck: storey-1 rooms in front of the blocks with doors into each of the three, stairs down to the plaza.
    const deck = b.rooms.filter((r) => r.level === 1 && r.use === 'roof');
    expect(deck.length).toBe(3);
    const deckDoors = b.links.filter((l) => l.kind === 'door' && (deck.some((r) => r.id === l.a) || deck.some((r) => r.id === l.b)));
    expect(deckDoors.length).toBeGreaterThanOrEqual(5);
    expect(b.links.filter((l) => l.kind === 'stairs' && deck.some((r) => r.id === l.b)).length).toBe(2);
    // The hotel's roof (storey 8, about 34 m up) can be reached; the store's sales floors too.
    const top = b.rooms.filter((r) => reach.has(r.id) && !r.locked).sort((p, q) => q.y - p.y)[0]!;
    expect(top.level).toBe(8);
    expect(top.y).toBeGreaterThan(33);
    expect(open(b, 'sales').filter((r) => r.x1 - r.x0 > 30).length).toBeGreaterThanOrEqual(2);
    expect(open(b, 'bedroom').length).toBeGreaterThan(2);
  });

  it('lays out the airports: runway, apron, terminal deck, tower cab, hangar and boarding bridges', () => {
    for (const id of AIRPORTS) {
      const b = bp(id);
      const runway = b.parts.filter((p) => p.mat === 'asphalt' && p.x1 - p.x0 > b.w * 0.8 && p.z1 - p.z0 >= 29);
      expect(runway.length, id).toBeGreaterThan(0);
      expect(open(b, 'baggage').length).toBeGreaterThanOrEqual(2);
      expect(open(b, 'roof').length).toBeGreaterThan(0); // the deck on the terminal's roof
      expect(b.links.some((l) => l.a === -1 && b.rooms[l.b]!.use === 'baggage')).toBe(true); // out onto the apron
    }
    expect(bp('transport.airport_s').rooms.some((r) => r.use === 'tower')).toBe(false);
    const m = bp('transport.airport_m');
    const cabM = open(m, 'tower');
    expect(cabM.length).toBeGreaterThan(0);
    expect(Math.max(...cabM.map((r) => r.y))).toBeGreaterThan(20);
    expect(open(m, 'garage').length).toBe(1);
    expect(m.openings.some((o) => o.state === 'shutter' && o.width > 20)).toBe(true);
    const l = bp('transport.airport_l');
    expect(Math.max(...open(l, 'tower').map((r) => r.y))).toBeGreaterThan(35);
    const bridges = l.rooms.filter((r) => r.level === 1 && r.use === 'hall' && r.x1 - r.x0 < 3 && r.z1 - r.z0 > 10);
    expect(bridges.length).toBe(6);
    for (const r of bridges) expect(l.search.some((s) => s.room === r.id && s.table === 'baggage')).toBe(true);
    expect(l.rooms.filter((r) => r.use === 'lobby' && r.level === 0).length).toBeGreaterThanOrEqual(2); // two terminals
  });

  it('stands the small stations in the yard and the big types in the big yard, without overlaps', () => {
    const small = yardMap().placements;
    for (const id of MINE) {
      const big = bigForYard(def(id));
      expect(small.filter((p) => p.def === id).length, id).toBe(big ? 0 : 2);
    }
    const ps = yardMap(true).placements;
    for (const id of MINE.filter((i) => bigForYard(def(i)))) expect(ps.filter((p) => p.def === id).length, id).toBe(1);
    expect(yardEntries(true).length).toBe(ps.length);
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i]!;
      expect(a.x0 > 0 && a.z0 > 0 && a.x1 < 1024 && a.z1 < 1024, a.def).toBe(true);
      for (let j = i + 1; j < ps.length; j++) {
        const c = ps[j]!;
        expect(a.x0 < c.x1 && c.x0 < a.x1 && a.z0 < c.z1 && c.z0 < a.z1, `${a.def} and ${c.def} overlap in the big yard`).toBe(false);
      }
    }
  });

  it('walks in from a door to the highest open room of each, turned east', () => {
    for (const id of MINE) {
      const d = def(id);
      const b = createFlatBuilder(0);
      addEnterable(b, id, 100, 100, d.size.w[0], d.size.d[0], 1 as Rot);
      const map = finishMap(b);
      const det = detailOf(map.placements[0]!);
      const reach = reachable(det.bp);
      const rooms = det.rooms.filter((r) => !r.locked && reach.has(r.id));
      const topLevel = Math.max(...rooms.map((r) => r.level));
      const goal = rooms.filter((r) => r.level === topLevel).sort((a, b2) => (b2.x1 - b2.x0) * (b2.z1 - b2.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0]!;
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
      const door = det.links.filter((l) => l.a === -1 && part.has(l.b)).sort((p, q) => q.wpts[0]![0] - p.wpts[0]![0])[0]!;
      const start = door.wpts[0]!;
      const into = det.links.find((l) => l.b === goal.id || l.a === goal.id)!;
      const target: Vec3 = into.b === goal.id ? into.wpts[into.wpts.length - 1]! : into.wpts[0]!;
      const route = indoorPath(map, door.wpts[door.wpts.length - 1]!, target, 0.35);
      expect(route, id).not.toBeNull();
      const state = createInitialState(1, 1);
      placePlayer(state.player, map, start[0], start[2], 0);
      state.player.pos[1] = supportAt(map, start[0], start[2], 0.05);
      expect(walkThrough(map, state, [...door.wpts.slice(1), ...route!]), `${id}: walking to the ${goal.use} on storey ${goal.level}`).toBe(-1);
      expect(state.player.pos[1]).toBeCloseTo(goal.wy, 1);
    }
  }, 120_000);
});
