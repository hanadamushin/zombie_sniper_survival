// Self-Defense Force sites (07d-2f): the ten field camps ('military') and the five bases ('base':
// the garrisons small / middle / large, the naval base, the air base). The catalog test in
// buildings.test.ts already checks every type (determinism, triangles, reachability, straight ways,
// walking every link turned four ways); this file checks what is particular to them: the variants
// differ, the seed changes the details, there is ammunition, medicine and fuel to find, the
// watchtower and the ship's bridge can be climbed, and the key: the commander's safe opens the
// locked armories and depots (their doors' collision goes, the rooms join the graph, the search
// points behind them become map loot spots).

import { describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame, type GameState } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { ROOM_LOOT } from '../src/data/colony.ts';
import { addEnterable, createFlatBuilder } from '../src/gen/builder.ts';
import { BUILDING_DEFS, detailOf, generateBlueprint, openBlueprint, type BuildingBlueprint, type BuildingDef } from '../src/gen/buildings/index.ts';
import { finishMap, type TacticalMap } from '../src/gen/index.ts';
import { createSim } from '../src/sim/index.ts';
import { applyKeys, areaOf } from '../src/sim/tactical/area.ts';
import { segmentHitsStatic, supportAt, type Vec3 } from '../src/sim/tactical/collision.ts';
import { indoorPath } from '../src/sim/tactical/indoor.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';
import { yardEntries } from '../src/sim/tactical/yard.ts';

const CAMPS = BUILDING_DEFS.filter((d) => d.category === 'military');
const BASES = ['jgsdf_s', 'jgsdf_m', 'jgsdf_l', 'jmsdf', 'jasdf'].map((v) => BUILDING_DEFS.find((d) => d.id === `base.${v}`)!);
const MINE = [...CAMPS, ...BASES];
const mid = (d: BuildingDef): [number, number] => [(d.size.w[0] + d.size.w[1]) / 2, (d.size.d[0] + d.size.d[1]) / 2];
const cache = new Map<string, BuildingBlueprint>();
const bp = (def: BuildingDef, seed = 3): BuildingBlueprint => {
  const key = `${def.id}:${seed}`;
  let b = cache.get(key);
  if (!b) cache.set(key, (b = generateBlueprint(def, ...mid(def), seed)));
  return b;
};
const DT = BALANCE.time.fixedStep;

function walkThrough(map: TacticalMap, state: GameState, pts: readonly Vec3[]): number {
  const p = state.player;
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty, tz] = pts[i]!;
    let ok = false;
    for (let s = 0; s < 60 / DT; s++) {
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

function standAt(map: TacticalMap, state: GameState, x: number, y: number, z: number): void {
  placePlayer(state.player, map, x, z, 0);
  state.player.pos[1] = supportAt(map, x, z, y + 0.05);
}

describe('self-defense force sites (07d-2f)', () => {
  it('registers ten camps and five bases, each one its own layout', () => {
    expect(CAMPS.length).toBe(10);
    expect(BASES.every((d) => d !== undefined)).toBe(true);
    // Different programmes: the rooms by use, and the size of the site.
    const sig = (def: BuildingDef): string => {
      const b = bp(def);
      const uses = new Map<string, number>();
      for (const r of b.rooms) uses.set(r.use, (uses.get(r.use) ?? 0) + 1);
      return `${b.w}x${b.d}:` + [...uses].sort().map(([u, n]) => `${u}${n}`).join(',');
    };
    const sigs = MINE.map(sig);
    expect(new Set(sigs).size).toBe(MINE.length);
  });

  it('changes the details with the seed (vehicles burnt or not, tents fallen, tints)', () => {
    for (const def of MINE) {
      const a = JSON.stringify(bp(def, 1).parts);
      const b = JSON.stringify(bp(def, 2).parts);
      expect(a === b, `${def.id}: seeds 1 and 2 look the same`).toBe(false);
    }
  });

  it('holds ammunition, medicine and fuel', () => {
    const tables = new Set<string>();
    for (const def of MINE) for (const s of bp(def).search) tables.add(s.table);
    const has = (res: string): boolean => [...tables].some((t) => (ROOM_LOOT[t] as Record<string, number> | undefined)?.[res]);
    for (const res of ['ammo', 'medicine', 'fuel']) expect(has(res), res).toBe(true);
    // Every camp has the field table somewhere (ammunition, medicine and fuel together).
    for (const def of CAMPS) expect(bp(def).search.some((s) => s.table === 'field'), def.id).toBe(true);
  });

  it('puts the arms behind locked doors that the commander\'s safe opens', () => {
    for (const def of [...BASES, CAMPS.find((d) => d.variant === 'camp_command')!]) {
      const b = bp(def);
      expect(b.keyLinks?.length ?? 0, `${def.id}: doors the key opens`).toBeGreaterThan(0);
      const safe = b.search.filter((s) => s.key);
      expect(safe.length, `${def.id}: the safe`).toBeGreaterThan(0);
      for (const s of safe) expect(b.rooms[s.room]!.locked, `${def.id}: the safe is in a room one can get into`).toBeFalsy();
      const armory = b.rooms.filter((r) => r.key);
      expect(armory.length).toBeGreaterThan(0);
      for (const r of armory) expect(r.locked).toBe(true);
      // The weapons are only behind the key doors.
      for (const s of b.search.filter((q) => q.table === 'weapons')) expect(b.rooms[s.room]!.key, `${def.id}: weapons in the open`).toBe(true);
      // Opened: the leaves are gone, every room can be reached.
      const o = openBlueprint(b, true);
      expect(o.parts.length).toBeLessThan(b.parts.length);
      expect(o.rooms.every((r) => !r.key || !r.locked)).toBe(true);
      const reach = new Set<number>([-1]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const l of o.links) {
          if (reach.has(l.a) && !reach.has(l.b)) reach.add(l.b), (grew = true);
          if (reach.has(l.b) && !reach.has(l.a)) reach.add(l.a), (grew = true);
        }
      }
      for (const r of armory) expect(reach.has(r.id), `${def.id}: armory ${r.id} after the key`).toBe(true);
    }
  });

  it('opens the armory of a garrison once its key is found: the door stops blocking, the way leads in', () => {
    const b = createFlatBuilder(0, { lootSpots: 10000 });
    const def = BASES[0]!;
    const [w, d] = mid(def);
    addEnterable(b, def.id, 50, 50, w, d, 0);
    const map = finishMap(b);
    const state = createInitialState(1, 1);
    // The map's loot spots: the key first, the armory's shelves among them (they need the key).
    const spots = map.lootSpots;
    expect(spots[0]!.key).toBe(true);
    expect(spots.some((s) => s.table === 'weapons')).toBe(true);
    state.tactical = { cell: 0, mapSeed: 1, zombies: [], corpses: [], bullets: [], reserve: 0, wind: [0, 0], lootSpots: spots.map((s) => ({ id: s.id, pos: s.pos, taken: false, key: s.key, enter: s.enter, y: s.y, table: s.table })) };
    applyKeys(state, map);
    const det0 = detailOf(map.placements[0]!);
    const link = det0.bp.keyLinks![0]!;
    const det = (): ReturnType<typeof detailOf> => detailOf(map.placements[0]!);
    const toWorld = (q: [number, number, number]): Vec3 => {
      const p = map.placements[0]!;
      return [p.x0 + q[0], p.base + q[1], p.z0 + q[2]];
    };
    const [pa, pb] = link.pts.map(toWorld) as [Vec3, Vec3];
    const eye = (q: Vec3): Vec3 => [q[0], q[1] + 1.4, q[2]];
    expect(segmentHitsStatic(map, eye(pa), eye(pb)), 'the locked door blocks').toBe(true);
    expect(indoorPath(map, pa, pb, 0.35), 'no way in while locked').toBeNull();
    standAt(map, state, ...pa);
    expect(walkThrough(map, state, [pb])).toBe(0);
    // The safe is searched.
    state.tactical.lootSpots[0]!.taken = true;
    applyKeys(state, map);
    expect(map.placements[0]!.open).toBe(true);
    expect(det().links.length).toBe(det0.links.length + det0.bp.keyLinks!.length);
    expect(segmentHitsStatic(map, eye(pa), eye(pb)), 'the door is open').toBe(false);
    expect(indoorPath(map, pa, pb, 0.35)).not.toBeNull();
    standAt(map, state, ...pa);
    expect(walkThrough(map, state, [pb])).toBe(-1);
    // A new visit (nothing taken) shuts it again: the cached map is shared.
    state.tactical.lootSpots[0]!.taken = false;
    applyKeys(state, map);
    expect(map.placements[0]!.open).toBeUndefined();
  });

  it('opens the command camp\'s weapons container when the safe is searched with E (the whole sim)', () => {
    const state = createInitialState(9, 1);
    state.flags.range = true;
    state.flags.yard = true;
    const sim = createSim({ grid: null });
    sim.tick(state, DT, emptyInputFrame());
    const map = areaOf(state)!.map;
    const pi = yardEntries().find((e) => e.def === 'military.camp_command' && e.rot === 0)!.enter;
    const key = state.tactical!.lootSpots.find((s) => s.key && s.enter === pi)!;
    expect(key).toBeDefined();
    expect(map.placements[pi]!.open).toBeUndefined();
    standAt(map, state, key.pos[0], key.y!, key.pos[1]);
    state.flags.range = false;
    state.tactical!.hideouts = [];
    sim.tick(state, DT, { ...emptyInputFrame(), interact: true });
    state.flags.range = true;
    expect(key.taken).toBe(true);
    expect(map.placements[pi]!.open).toBe(true);
    expect(state.colony.log.some((e) => e.text === 'log.keyFound')).toBe(true);
    // The container's shelves can now be walked to.
    const arms = state.tactical!.lootSpots.find((s) => s.enter === pi && s.table === 'weapons')!;
    expect(indoorPath(map, [key.pos[0], key.y!, key.pos[1]], [arms.pos[0], arms.y!, arms.pos[1]], 0.35)).not.toBeNull();
  });

  it('lets one climb the watchtower and the bridge of the destroyer', () => {
    for (const [def, use, min] of [[CAMPS.find((d) => d.variant === 'camp_watch')!, 'tower', 6], [BASES[3]!, 'command', 9]] as const) {
      const b = createFlatBuilder(0);
      const [w, d] = mid(def);
      addEnterable(b, def.id, 50, 50, w, d, 0);
      const map = finishMap(b);
      const det = detailOf(map.placements[0]!);
      const top = det.rooms.filter((r) => r.use === use && !r.locked).sort((a, c) => c.wy - a.wy)[0]!;
      expect(top.wy - map.placements[0]!.base, def.id).toBeGreaterThan(min);
      const door = det.links.find((l) => l.a === -1)!;
      const state = createInitialState(1, 1);
      const start = door.wpts[0]!;
      // From the outer door nearest the highest room.
      const doors = det.links.filter((l) => l.a === -1).sort((p, q) => Math.hypot(p.wpts[0]![0] - top.wx0, p.wpts[0]![2] - top.wz0) - Math.hypot(q.wpts[0]![0] - top.wx0, q.wpts[0]![2] - top.wz0));
      const from = doors[0]?.wpts[0] ?? start;
      const path = indoorPath(map, from, [(top.wx0 + top.wx1) / 2, top.wy, (top.wz0 + top.wz1) / 2], 0.35);
      expect(path, def.id).not.toBeNull();
      standAt(map, state, ...from);
      expect(walkThrough(map, state, path!), def.id).toBe(-1);
      expect(state.player.pos[1]).toBeCloseTo(top.wy, 0);
    }
  });
});
