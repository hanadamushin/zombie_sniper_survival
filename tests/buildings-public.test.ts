// Public buildings (07d-2d): schools, police, fire, hospitals, factories. The catalog test in
// buildings.test.ts already checks every type (determinism, triangles, reachability, straight ways,
// walking every link turned four ways); this file checks what is particular to the 'public' types:
// the variants really differ, the seed changes the details, the features each one promises (gyms
// and yards, the rooftop pool, the armoury, the hose tower, the repeated ward floors and the
// medicine, the galleries in the factory halls, the steel stock and the fuel) and a walk in from the
// door to the highest open room of each.

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
import { yardMap } from '../src/sim/tactical/yard.ts';

const SCHOOLS = ['elem_rural', 'elem_city', 'junior_rural', 'junior_city', 'high_rural', 'high_city', 'univ_rural', 'univ_city'].map((v) => `public.${v}`);
const SAFETY = ['koban', 'police', 'fire'].map((v) => `public.${v}`);
const HOSPITALS = ['clinic', 'hospital_mid', 'hospital_large'].map((v) => `public.${v}`);
const FACTORIES = ['machi_koba', 'factory_food', 'factory_metal', 'factory_chem'].map((v) => `public.${v}`);
const MINE = [...SCHOOLS, ...SAFETY, ...HOSPITALS, ...FACTORIES];
const def = (id: string): BuildingDef => BUILDING_DEFS.find((d) => d.id === id)!;
const mid = (d: BuildingDef): [number, number] => [(d.size.w[0] + d.size.w[1]) / 2, (d.size.d[0] + d.size.d[1]) / 2];
const bp = (id: string, seed = 3): BuildingBlueprint => {
  const d = def(id);
  const [w, dd] = mid(d);
  return generateBlueprint(d, w, dd, seed);
};
const DT = BALANCE.time.fixedStep;
/** Rooms one walks through rather than searches. */
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

/** Expected yield of one resource over the search points one can get to. */
function expected(b: BuildingBlueprint, res: string): number {
  const reach = reachable(b);
  return b.search.filter((s) => reach.has(s.room)).reduce((a, s) => a + ((ROOM_LOOT[s.table] as Record<string, number> | undefined)?.[res] ?? 0), 0);
}

describe('public buildings (07d-2d)', () => {
  it('registers the eighteen public types', () => {
    for (const id of MINE) expect(def(id), id).toBeDefined();
    expect(BUILDING_DEFS.filter((d) => d.category === 'public').length).toBeGreaterThanOrEqual(18);
  });

  it('makes every variant look and lay out differently, and the seed change its details', () => {
    const signatures = new Set<string>();
    for (const id of MINE) {
      const d = def(id);
      const [w, dd] = mid(d);
      const b = generateBlueprint(d, w, dd, 7);
      const uses = [...new Set(b.rooms.map((r) => `${r.level}:${r.use}${r.locked ? 'L' : ''}`))].sort().join(',');
      signatures.add(`${d.storeys}|${d.roof}|${d.size.w[0]}|${uses}`);
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

  it('gives every school its blocks, gym and yard, and each its own character', () => {
    for (const id of SCHOOLS) {
      const b = bp(id);
      expect(b.rooms.filter((r) => r.use === 'classroom').length, `${id}: classrooms`).toBeGreaterThanOrEqual(4);
      expect(b.parts.some((p) => p.mat === 'glass' && p.solid === undefined && p.y1 - p.y0 > 1.2 && p.z1 - p.z0 < 0.05 && p.layer === 'shell'), `${id}: the fence or the glass`).toBe(true);
      expect(b.search.length, id).toBeGreaterThan(15);
    }
    for (const id of SCHOOLS.slice(0, 6)) {
      const b = bp(id);
      // The gym: a tall hall (two storeys high) with a stage; some open ground between the gate and the blocks.
      expect(b.rooms.some((r) => r.use === 'hall' && r.level === 0 && (r.x1 - r.x0) * (r.z1 - r.z0) > 200), `${id}: gym`).toBe(true);
      expect(b.parts.some((p) => p.mat === 'paper' && p.layer === 'shell'), `${id}: yard lines`).toBe(true);
      expect(b.rooms.some((r) => r.use === 'genkan'), `${id}: shoe hall`).toBe(true);
    }
    // Rural elementary: wooden, pitched roof, two storeys; the city one has the pool on its roof and the stair to it.
    const er = bp('public.elem_rural');
    expect(def('public.elem_rural').roof).toBe('gable');
    expect(er.parts.filter((p) => p.mat === 'wood' && p.layer === 'shell').length).toBeGreaterThan(10);
    const ec = bp('public.elem_city');
    expect(ec.roofAccess).toBe(true);
    expect(ec.parts.some((p) => p.mat === 'glass' && p.level === 4 && p.x1 - p.x0 > 5)).toBe(true);
    // Junior / high: galleries in the big gyms, two blocks with a walkway, the tall city block.
    expect(bp('public.junior_rural').rooms.some((r) => r.level === 1 && r.use === 'hall' && r.z1 - r.z0 < 1.5)).toBe(true);
    expect(bp('public.high_rural').stairs.filter((s) => s.kind === 'stairs' && s.from === 0).length).toBeGreaterThanOrEqual(5);
    expect(def('public.high_city').storeys).toBe(6);
    expect(bp('public.high_city').roofAccess).toBe(true);
    // Universities: several buildings, lecture rooms, the cafeteria; the city one has its 8-storey tower.
    for (const id of ['public.univ_rural', 'public.univ_city']) {
      const b = bp(id);
      expect(b.rooms.some((r) => r.use === 'canteen' && (r.x1 - r.x0) * (r.z1 - r.z0) > 150), `${id}: cafeteria`).toBe(true);
      expect(b.rooms.filter((r) => r.use === 'lab').length, `${id}: labs`).toBeGreaterThanOrEqual(4);
    }
    expect(def('public.univ_city').storeys).toBe(8);
    expect(bp('public.univ_city').rooms.some((r) => r.level === 7 && r.use === 'lab')).toBe(true);
  });

  it('locks the armoury most of the time and lets it be searched for guns and ammunition when it was forced', () => {
    let locked = 0;
    let forced = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const b = bp('public.police', seed);
      const arm = b.rooms.find((r) => r.use === 'armory')!;
      expect(arm.level).toBe(2);
      const reach = reachable(b);
      if (arm.locked) {
        locked++;
        expect(reach.has(arm.id)).toBe(false);
        expect(b.search.some((s) => s.room === arm.id)).toBe(false);
      } else {
        forced++;
        expect(reach.has(arm.id)).toBe(true);
        expect(b.search.filter((s) => s.room === arm.id && s.table === 'weapons').length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(locked).toBeGreaterThan(forced);
    expect(forced).toBeGreaterThan(0);
    expect(ROOM_LOOT.weapons!.ammo!).toBeGreaterThan(ROOM_LOOT.office!.parts!);
    // The cells are locked; patrol cars in the car park; the roof can be reached.
    const p = bp('public.police');
    expect(p.rooms.some((r) => r.level === 0 && r.use === 'storage' && r.locked)).toBe(true);
    expect(p.roofAccess).toBe(true);
    // The koban: two storeys, the red lamp over the door.
    const k = bp('public.koban');
    expect(k.storeys.length).toBe(2);
    expect(k.parts.some((p2) => p2.mat === 'sign' && p2.z1 > k.d && p2.solid === false)).toBe(true);
  });

  it('builds the fire station with the engine bay and a hose tower whose top is a firing point', () => {
    const b = bp('public.fire');
    const reach = reachable(b);
    const garage = b.rooms.find((r) => r.use === 'garage')!;
    expect(reach.has(garage.id)).toBe(true);
    expect(b.openings.filter((o) => o.exterior && o.level === 0 && o.width > 3 && o.y1 - o.y0 > 3).length).toBeGreaterThanOrEqual(2);
    expect(b.openings.some((o) => o.state === 'shutter' && o.width > 3)).toBe(true);
    const top = b.rooms.find((r) => r.level === def('public.fire').storeys && r.use === 'roof')!;
    expect(reach.has(top.id)).toBe(true);
    expect(top.y).toBeGreaterThan(17);
    expect(b.rooms.some((r) => r.level === 1 && r.use === 'bedroom')).toBe(true);
  });

  it('gives the hospitals repeated ward floors and plenty of medicine', () => {
    const plan = (b: BuildingBlueprint, level: number): string => b.rooms.filter((r) => r.level === level && (r.use === 'ward' || (r.use === 'clinic' && r.z1 - r.z0 < 8))).map((r) => `${r.x0.toFixed(2)},${r.z0.toFixed(2)},${r.x1.toFixed(2)},${r.z1.toFixed(2)},${r.use}`).join(';');
    const midH = bp('public.hospital_mid');
    expect(def('public.hospital_mid').storeys).toBe(6);
    expect(midH.rooms.filter((r) => r.use === 'ward' && r.level === 4).length).toBeGreaterThanOrEqual(6);
    for (let level = 5; level < 6; level++) expect(plan(midH, level)).toBe(plan(midH, 4));
    const large = bp('public.hospital_large');
    for (let level = 3; level < 8; level++) expect(plan(large, level)).toBe(plan(large, 2));
    expect(large.roofAccess).toBe(true);
    expect(large.parts.some((p) => p.mat === 'paper' && p.y0 > 25)).toBe(true); // the helipad
    expect(large.links.some((l) => l.a === -1 && l.width >= 2.5)).toBe(true); // the emergency door
    const med = HOSPITALS.map((id) => expected(bp(id), 'medicine'));
    expect(med[0]!).toBeGreaterThan(0.5);
    expect(med[1]!).toBeGreaterThan(med[0]!);
    expect(med[2]!).toBeGreaterThan(med[1]!);
    expect(med[0]!).toBeGreaterThan(expected(bp('public.high_city'), 'medicine'));
    for (const id of HOSPITALS) {
      const b = bp(id);
      expect(b.search.some((s) => s.table === 'pharmacy'), `${id}: pharmacy shelves`).toBe(true);
    }
  });

  it('gives the factories their halls, galleries, steel and fuel', () => {
    for (const id of FACTORIES.slice(1)) {
      const b = bp(id);
      const reach = reachable(b);
      const gallery = b.rooms.find((r) => r.level === 1 && r.use === 'machine' && Math.min(r.x1 - r.x0, r.z1 - r.z0) < 1.5)!;
      expect(gallery, `${id}: gallery`).toBeDefined();
      expect(reach.has(gallery.id), `${id}: the gallery can be reached`).toBe(true);
      expect(b.search.some((s) => s.room === gallery.id), `${id}: something on the gallery`).toBe(true);
    }
    expect(bp('public.factory_metal').parts.filter((p) => p.shape === 'wedge').length).toBeGreaterThanOrEqual(4); // sawtooth roof
    const steel = expected(bp('public.factory_metal'), 'metal');
    expect(steel).toBeGreaterThan(expected(bp('public.factory_food'), 'metal'));
    expect(bp('public.factory_metal').search.filter((s) => s.table === 'stock').length).toBeGreaterThanOrEqual(3);
    const chem = bp('public.factory_chem');
    expect(chem.search.filter((s) => s.table === 'fuel').length).toBeGreaterThanOrEqual(3);
    expect(chem.roofAccess).toBe(true);
    expect(Math.max(...chem.parts.map((p) => p.y1))).toBeGreaterThan(18); // the stack
    expect(chem.parts.filter((p) => p.shape === 'hip').length).toBeGreaterThanOrEqual(2); // tank caps
    expect(bp('public.factory_food').rooms.some((r) => r.use === 'storage' && r.level === 0 && r.x1 - r.x0 < 7)).toBe(true); // cold store
    const koba = bp('public.machi_koba');
    expect(koba.rooms.some((r) => r.use === 'workshop')).toBe(true);
    expect(koba.search.some((s) => s.table === 'stock') && koba.search.some((s) => s.table === 'tools')).toBe(true);
    expect(koba.rooms.some((r) => r.level === 1 && r.use === 'tatami')).toBe(true);
  });

  it('stands every public type in the yard without two footprints overlapping', () => {
    const map = yardMap();
    const ps = map.placements;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]!;
        const c = ps[j]!;
        expect(a.x0 < c.x1 && c.x0 < a.x1 && a.z0 < c.z1 && c.z0 < a.z1, `${a.def} and ${c.def} overlap in the yard`).toBe(false);
      }
    }
    for (const id of MINE) expect(ps.filter((p) => p.def === id).length, id).toBe(2);
    for (const p of ps) expect(p.z0 > 0 && p.z1 < 1024 && p.x1 < 1024, p.def).toBe(true);
  });

  it('walks in from a door to the highest open room of each, turned east', () => {
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
  }, 60_000);
});
