// Enterable buildings (07d). The first block runs over EVERY type in the catalog — a new type is
// tested the moment it is registered (docs/buildings_guide.md). The rest checks the framework with
// the samples: walking in, up the stairs, shooting out of a window, zombies following through doors.

import { describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame, type GameState, type InputFrame } from '../src/core/types.ts';
import { ARCH } from '../src/data/architecture.ts';
import { BALANCE } from '../src/data/balance.ts';
import { addEnterable, createFlatBuilder } from '../src/gen/builder.ts';
import {
  BUILDING_DEFS, buildingDef, detailOf, envelopeOf, generateBlueprint, localColliders, triangleCount, type BuildingBlueprint, type BuildingDef, type Rot,
} from '../src/gen/buildings/index.ts';
import { finishMap, type TacticalMap } from '../src/gen/index.ts';
import { createSim, type Sim } from '../src/sim/index.ts';
import { areaOf } from '../src/sim/tactical/area.ts';
import { pushOut, raycastWorld, segmentHitsStatic, supportAt, type Vec3 } from '../src/sim/tactical/collision.ts';
import { indoorPath, roomRoute, whereIs } from '../src/sim/tactical/indoor.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';
import { yardEntries } from '../src/sim/tactical/yard.ts';
import { addZombie } from '../src/sim/tactical/zombies.ts';

const DT = BALANCE.time.fixedStep;
const input = (over: Partial<InputFrame> = {}): InputFrame => ({ ...emptyInputFrame(), ...over });

/** Sizes every type is tried at: smallest, largest, in between. */
function sizes(def: BuildingDef): [number, number][] {
  const { w, d } = def.size;
  return [[w[0], d[0]], [w[1], d[1]], [(w[0] + w[1]) / 2, (d[0] * 2 + d[1]) / 3]];
}

/** A flat map with one building at (100, 100). */
function oneBuilding(defId: string, w: number, d: number, rot: Rot = 0): TacticalMap {
  const b = createFlatBuilder(0);
  addEnterable(b, defId, 100, 100, w, d, rot);
  return finishMap(b);
}

/** Is a walker of `radius` at (x, z) on the floor `y` clear of the building's boxes (body height)? `among`: only these (07d-2e). */
function clearAt(bp: BuildingBlueprint, x: number, y: number, z: number, radius: number, among?: ReturnType<typeof localColliders>): boolean {
  for (const c of among ?? colliderCache(bp)) {
    if (c.y1 <= y + 0.5 || c.y0 >= y + 1.7) continue;
    const qx = Math.min(c.x1, Math.max(c.x0, x));
    const qz = Math.min(c.z1, Math.max(c.z0, z));
    if ((x - qx) ** 2 + (z - qz) ** 2 < radius * radius) return false;
  }
  return true;
}
/** 07d-2e: the colliders that overlap the box round the points (padded by `pad`) at body height over their floors. */
function nearWays(bp: BuildingBlueprint, pts: readonly [number, number, number][], pad: number): ReturnType<typeof localColliders> {
  const x0 = Math.min(...pts.map((p) => p[0])) - pad;
  const x1 = Math.max(...pts.map((p) => p[0])) + pad;
  const z0 = Math.min(...pts.map((p) => p[2])) - pad;
  const z1 = Math.max(...pts.map((p) => p[2])) + pad;
  const y0 = Math.min(...pts.map((p) => p[1])) + 0.5;
  const y1 = Math.max(...pts.map((p) => p[1])) + 1.7;
  return colliderCache(bp).filter((c) => c.x1 >= x0 && c.x0 <= x1 && c.z1 >= z0 && c.z0 <= z1 && c.y1 > y0 && c.y0 < y1);
}
const colliders = new WeakMap<BuildingBlueprint, ReturnType<typeof localColliders>>();
function colliderCache(bp: BuildingBlueprint): ReturnType<typeof localColliders> {
  let c = colliders.get(bp);
  if (!c) colliders.set(bp, (c = localColliders(bp)));
  return c;
}

/** Steer the player through world waypoints (feet); returns the index of the first one not reached, or -1. */
function walkThrough(map: TacticalMap, state: GameState, pts: readonly Vec3[], secondsEach = 25): number {
  const p = state.player;
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty, tz] = pts[i]!;
    let ok = false;
    for (let s = 0; s < secondsEach / DT; s++) {
      const dx = tx - p.pos[0];
      const dz = tz - p.pos[2];
      if (Math.hypot(dx, dz) < 0.3 && Math.abs(ty - p.pos[1]) < 0.35) {
        ok = true;
        break;
      }
      p.yaw = Math.atan2(-dx, -dz);
      updatePlayer(p, map, input({ moveZ: Math.min(1, Math.hypot(dx, dz) / 0.6 + 0.2) }), DT);
    }
    if (!ok) return i;
  }
  return -1;
}

function standAt(map: TacticalMap, state: GameState, x: number, y: number, z: number): void {
  placePlayer(state.player, map, x, z, 0);
  state.player.pos[1] = supportAt(map, x, z, y + 0.05);
}

// ---------------------------------------------------------------------------------------------
// Every registered type
// ---------------------------------------------------------------------------------------------

describe('every building type in the catalog (07d)', () => {
  it('has at least the three samples, each with a sane definition', () => {
    for (const id of ['house.wood2', 'shop.konbini', 'office.zakkyo5']) expect(buildingDef(id).id).toBe(id);
    for (const def of BUILDING_DEFS) {
      expect(def.size.w[0]).toBeLessThanOrEqual(def.size.w[1]);
      expect(def.size.d[0]).toBeLessThanOrEqual(def.size.d[1]);
      expect(def.storeys).toBeGreaterThanOrEqual(1);
      expect(def.storeyHeight).toBeGreaterThan(2.3);
    }
  });

  for (const def of BUILDING_DEFS) {
    describe(def.id, () => {
      const limits = def.limits ?? ARCH.limits[def.category];
      const env = envelopeOf(def);

      it('is deterministic and stays within its triangle budget and generation time', () => {
        for (const [w, d] of sizes(def)) {
          for (const seed of [1, 2, 3]) {
            const a = generateBlueprint(def, w, d, seed);
            const b = generateBlueprint(def, w, d, seed);
            expect(JSON.stringify(a)).toBe(JSON.stringify(b));
            const tris = triangleCount(a);
            expect(tris.shell, `${def.id} ${w}×${d} seed ${seed}: outside triangles`).toBeLessThanOrEqual(limits.shell);
            for (const n of tris.interior) expect(n, `${def.id} ${w}×${d} seed ${seed}: triangles of a storey`).toBeLessThanOrEqual(limits.interior);
          }
        }
        const times: number[] = [];
        for (let i = 0; i < 9; i++) {
          const t0 = performance.now();
          generateBlueprint(def, def.size.w[1], def.size.d[1], 100 + i);
          times.push(performance.now() - t0);
        }
        // The fastest of 9 runs: the cost of the work itself. A median picked up the load of the other
        // test workers (4 vCPUs, parallel files) and failed at random in several sessions.
        expect(Math.min(...times)).toBeLessThan(ARCH.generateMs);
      });

      it('keeps its parts inside the footprint and its collision inside the envelope', () => {
        for (const [w, d] of sizes(def)) {
          const bp = generateBlueprint(def, w, d, 5);
          const m = ARCH.maxOverhang + 1e-6;
          for (const p of bp.parts) {
            expect(p.x0 >= -m && p.x1 <= w + m && p.z0 >= -m && p.z1 <= d + m, `${def.id}: a ${p.mat} part sticks out of the footprint`).toBe(true);
            expect(p.y0).toBeGreaterThanOrEqual(-ARCH.foundation - 1e-6);
            expect(p.y1, `${def.id}: a ${p.mat} part is above the envelope (roofRise too small?)`).toBeLessThanOrEqual(env.top + 1e-6);
            expect(p.x1 - p.x0 > 0 && p.y1 - p.y0 > 0 && p.z1 - p.z0 > 0).toBe(true);
          }
          for (const c of localColliders(bp)) {
            expect(c.x0 >= -1e-6 && c.x1 <= w + 1e-6 && c.z0 >= -1e-6 && c.z1 <= d + 1e-6, `${def.id}: something solid outside the footprint (make it solid: false or move it in)`).toBe(true);
          }
          expect(bp.storeys[0]!.y).toBeCloseTo(def.plinth, 6);
          expect(def.plinth).toBeLessThanOrEqual(0.5); // the step-up from the ground
        }
      });

      it('reaches every room that is not locked from outside, and every search point is somewhere to stand', () => {
        for (const [w, d] of sizes(def)) {
          for (const seed of [1, 2, 3, 4]) {
            const bp = generateBlueprint(def, w, d, seed);
            const reach = new Set<number>([-1]);
            for (let changed = true; changed; ) {
              changed = false;
              for (const l of bp.links) {
                if (reach.has(l.a) !== reach.has(l.b)) {
                  reach.add(l.a);
                  reach.add(l.b);
                  changed = true;
                }
              }
            }
            for (const r of bp.rooms) if (!r.locked) expect(reach.has(r.id), `${def.id} seed ${seed}: room ${r.id} (${r.use}, storey ${r.level}) cannot be reached`).toBe(true);
            expect(bp.links.some((l) => l.a === -1)).toBe(true);
            for (const s of bp.search) {
              expect(clearAt(bp, s.pos[0], s.pos[1], s.pos[2], 0.3), `${def.id} seed ${seed}: search point in room ${s.room} is inside something`).toBe(true);
            }
            expect(bp.search.length).toBeGreaterThan(0);
          }
        }
      });

      it('lets a walker go in a straight line between the ways in and out of every room', () => {
        for (const [w, d] of sizes(def)) {
          for (const seed of [1, 2, 3]) {
            const bp = generateBlueprint(def, w, d, seed);
            const ends = new Map<number, [number, number, number][]>();
            for (const l of bp.links) {
              const add = (room: number, p: [number, number, number]): void => {
                if (room < 0) return;
                ends.set(room, [...(ends.get(room) ?? []), p]);
              };
              add(l.a, l.pts[0]!);
              add(l.b, l.pts[l.pts.length - 1]!);
            }
            for (const [room, pts] of ends) {
              // 07d-2e: only the colliders near the room's ways can be within reach (the same check, faster on big sites).
              const near = nearWays(bp, pts, 0.3);
              for (const p of pts) expect(clearAt(bp, p[0], p[1], p[2], 0.3, near), `${def.id} seed ${seed}: a way point in room ${room} is inside something`).toBe(true);
              for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                  const a = pts[i]!;
                  const b = pts[j]!;
                  const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.1);
                  for (let k = 0; k <= n; k++) {
                    const x = a[0] + ((b[0] - a[0]) * k) / n;
                    const z = a[2] + ((b[2] - a[2]) * k) / n;
                    expect(clearAt(bp, x, a[1], z, 0.28, near), `${def.id} seed ${seed}: something stands between two ways in room ${room} (${bp.rooms[room]!.use}) at (${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(true);
                  }
                }
              }
            }
          }
        }
      });

      it('can be walked: every door, archway and stair, both ways, turned every way', () => {
        for (const rot of [0, 1, 2, 3] as Rot[]) {
          const [w, d] = rot % 2 === 0 ? sizes(def)[0]! : sizes(def)[1]!;
          const map = oneBuilding(def.id, w, d, rot);
          const det = detailOf(map.placements[0]!);
          const state = createInitialState(1, 1);
          det.links.forEach((l, i) => {
            for (const forward of [true, false]) {
              const pts = forward ? l.wpts : [...l.wpts].reverse();
              const [sx, sy, sz] = pts[0]!;
              standAt(map, state, sx, sy, sz);
              const miss = walkThrough(map, state, pts.slice(1));
              expect(miss, `${def.id} rot ${rot}: link ${i} (${l.kind} ${l.a}->${l.b}) ${forward ? 'forward' : 'back'}: stuck before way point ${miss + 1} at (${state.player.pos.map((v) => v.toFixed(2)).join(', ')})`).toBe(-1);
            }
          });
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------------------------
// The framework, with the samples
// ---------------------------------------------------------------------------------------------

describe('walking in, up and out (07d)', () => {
  it('walks from the street through the front door to the top floor of each sample', () => {
    for (const id of ['house.wood2', 'shop.konbini', 'office.zakkyo5']) {
      const def = buildingDef(id);
      const map = oneBuilding(id, def.size.w[0], def.size.d[0], 1);
      const p = map.placements[0]!;
      const state = createInitialState(1, 1);
      const det = detailOf(p);
      const topRooms = det.rooms.filter((r) => !r.locked && r.level === Math.max(...det.rooms.filter((q) => !q.locked).map((q) => q.level)));
      const goal = topRooms[0]!;
      const target: Vec3 = [(goal.wx0 + goal.wx1) / 2, goal.wy, (goal.wz0 + goal.wz1) / 2];
      // The front faces east (rot 1): start 6 m out in the street.
      const start: Vec3 = [p.x1 + 6, 0, (p.z0 + p.z1) / 2];
      const path = indoorPath(map, start, target, 0.35);
      expect(path, id).not.toBeNull();
      standAt(map, state, start[0], 0, start[2]);
      expect(walkThrough(map, state, path!), `${id}: did not get to the ${goal.use}`).toBe(-1);
      expect(state.player.pos[1]).toBeCloseTo(p.base + goal.y, 1);
      expect(whereIs(map, state.player.pos[0], state.player.pos[1], state.player.pos[2])?.room).toBe(goal.id);
    }
  });

  it('stands on every floor, cannot walk through walls or windows, and the roof of the office can be reached', () => {
    const map = oneBuilding('office.zakkyo5', 11, 16, 0);
    const det = detailOf(map.placements[0]!);
    expect(det.bp.roofAccess).toBe(true);
    const roof = det.rooms.find((r) => r.use === 'roof')!;
    expect(roof.level).toBe(5);
    const path = indoorPath(map, [105, 0, 125], [(roof.wx0 + roof.wx1) / 2, roof.wy, (roof.wz0 + roof.wz1) / 2], 0.35);
    expect(path).not.toBeNull();
    const state = createInitialState(1, 1);
    standAt(map, state, 105, 0, 125);
    expect(walkThrough(map, state, path!)).toBe(-1);
    expect(state.player.pos[1]).toBeGreaterThan(16);
    // Walls and glass: push a walker against every outer window from inside: it stays inside.
    for (const o of det.bp.openings.filter((q) => q.kind === 'window' && q.exterior && q.y0 - det.bp.storeys[q.level]!.y < 0.5)) {
      const [wx, wz] = [o.x, o.z];
      const pos: [number, number] = [100 + wx, 100 + wz];
      pushOut(map, pos, 0.35, map.placements[0]!.base + det.bp.storeys[o.level]!.y, 1.8);
      const inside = pos[0] > 100.05 && pos[0] < 100 + 11 - 0.05 && pos[1] > 100.05 && pos[1] < 100 + 16 - 0.05;
      const outside = pos[0] < 100 || pos[0] > 111 || pos[1] < 100 || pos[1] > 116;
      expect(inside || outside).toBe(true); // pushed off the glass to one side, never left in it
    }
  });

  it('lets bullets and sight through a window but not through the wall beside it', () => {
    const map = oneBuilding('house.wood2', 9, 7.5, 0);
    const p = map.placements[0]!;
    const det = detailOf(p);
    const win = det.bp.openings.find((o) => o.kind === 'window' && o.exterior && o.level === 1 && Math.abs(o.z - p.d + 0.075) < 0.2 && o.width > 1)!;
    expect(win).toBeDefined();
    const eye: Vec3 = [p.x0 + win.x, p.base + det.bp.storeys[1]!.y + 1.5, p.z0 + win.z - 1.5];
    const out: Vec3 = [p.x0 + win.x, eye[1] - 1, p.z0 + win.z + 30];
    expect(segmentHitsStatic(map, eye, out)).toBe(false);
    const onWall: Vec3 = [p.x0 + win.x + win.width / 2 + 0.4, eye[1], p.z0 + win.z];
    const wallTarget: Vec3 = [eye[0] + (onWall[0] - eye[0]) * 4, eye[1], eye[2] + (onWall[2] - eye[2]) * 4];
    expect(segmentHitsStatic(map, eye, wallTarget)).toBe(true);
    const hit = raycastWorld(map, eye, [0, 0, -1], 50);
    expect(hit?.kind).toBe('building'); // the back of the room
    expect(hit!.dist).toBeLessThan(p.d);
    // ...and the player cannot climb out of it.
    const state = createInitialState(1, 1);
    standAt(map, state, eye[0], eye[1] - 1.5, eye[2] + 0.6);
    for (let i = 0; i < 300; i++) {
      state.player.yaw = Math.PI; // facing south, at the glass
      updatePlayer(state.player, map, input({ moveZ: 1 }), DT);
    }
    expect(state.player.pos[2]).toBeLessThan(p.z0 + p.d);
  });

  it('keeps people out of locked doors and shutters', () => {
    const map = oneBuilding('shop.konbini', 13, 11, 0);
    const p = map.placements[0]!;
    const det = detailOf(p);
    const back = det.bp.openings.find((o) => o.kind === 'door' && o.state === 'locked' && o.exterior)!;
    expect(back).toBeDefined();
    const state = createInitialState(1, 1);
    standAt(map, state, p.x0 + back.x, 0, p.z0 - 3);
    for (let i = 0; i < 600; i++) {
      state.player.yaw = Math.PI; // facing south: at the back door
      updatePlayer(state.player, map, input({ moveZ: 1 }), DT);
    }
    expect(state.player.pos[2]).toBeLessThan(p.z0);
    // The broken automatic door at the front is open and 1.8 m wide.
    const front = det.bp.openings.find((o) => o.kind === 'door' && o.exterior && o.state === 'open')!;
    expect(front.width).toBeCloseTo(ARCH.door.wide, 3);
    expect(det.links.some((l) => l.a === -1 && l.width >= 1.7)).toBe(true);
  });

  it('gives the house five rooms to live in and a 押し入れ, the shop a back room and a toilet, the office two tenants a floor', () => {
    const house = generateBlueprint(buildingDef('house.wood2'), 9, 7.6, 3);
    const lived = house.rooms.filter((r) => ['living', 'kitchen', 'bath', 'bedroom', 'tatami'].includes(r.use));
    expect(lived.length).toBe(5);
    expect(house.rooms.some((r) => r.use === 'closet')).toBe(true);
    expect(house.stairs.filter((s) => s.kind === 'stairs').length).toBe(1);
    const shop = generateBlueprint(buildingDef('shop.konbini'), 14, 11, 3);
    for (const use of ['sales', 'backroom', 'toilet'] as const) expect(shop.rooms.some((r) => r.use === use)).toBe(true);
    const office = generateBlueprint(buildingDef('office.zakkyo5'), 11, 16, 3);
    for (let l = 0; l < 5; l++) {
      const tenants = office.rooms.filter((r) => r.level === l && !['hall', 'lobby', 'stairs'].includes(r.use));
      expect(tenants.length).toBe(2);
    }
  });
});

describe('zombies in buildings (07d)', () => {
  function yardGame(): { state: GameState; sim: Sim; map: TacticalMap; run(s: number): void } {
    const state = createInitialState(9, 1);
    state.flags.range = true;
    state.flags.yard = true;
    const sim = createSim({ grid: null });
    sim.tick(state, DT, input());
    const map = areaOf(state)!.map;
    return {
      state, sim, map,
      run(seconds) {
        for (let i = 0; i < Math.round(seconds / DT); i++) sim.tick(state, DT, input());
      },
    };
  }
  const placementOf = (map: TacticalMap, def: string, rot = 0): number => yardEntries().find((e) => e.def === def && e.rot === rot)!.enter;

  it('follow the player in through the front door and up the stairs', () => {
    const g = yardGame();
    const pi = placementOf(g.map, 'house.wood2');
    const det = detailOf(g.map.placements[pi]!);
    const bed = det.rooms.find((r) => r.use === 'bedroom')!;
    standAt(g.map, g.state, (bed.wx0 + bed.wx1) / 2, bed.wy, (bed.wz0 + bed.wz1) / 2);
    g.state.player.hp = 1e9;
    const p = det.place;
    const z = addZombie(g.state, areaOf(g.state)!, 'walker', (p.x0 + p.x1) / 2, p.z1 + 10, 0)!;
    z.state = 'chase';
    z.target = 'player';
    z.goal = [g.state.player.pos[0], g.state.player.pos[2]];
    let best = Infinity;
    for (let s = 0; s < 120 && best > 1.2; s++) {
      g.run(1);
      best = Math.min(best, Math.hypot(z.pos[0] - g.state.player.pos[0], z.pos[2] - g.state.player.pos[2]) + Math.abs(z.pos[1] - g.state.player.pos[1]));
      if ((z.state as string) === 'attack') best = 0;
    }
    expect(best).toBeLessThan(1.2);
    expect(z.pos[1]).toBeGreaterThan(p.base + det.bp.storeys[1]!.y - 0.3);
  });

  it('go round to the open door instead of through a locked one, and brutes do not fit through a house door', () => {
    const g = yardGame();
    const pi = placementOf(g.map, 'shop.konbini');
    const det = detailOf(g.map.placements[pi]!);
    const backroom = det.rooms.find((r) => r.use === 'backroom')!;
    standAt(g.map, g.state, (backroom.wx0 + backroom.wx1) / 2, backroom.wy, (backroom.wz0 + backroom.wz1) / 2);
    g.state.player.hp = 1e9;
    const p = det.place;
    const back = det.bp.openings.find((o) => o.kind === 'door' && o.state === 'locked' && o.exterior)!;
    // Behind the shop (its back is north, z0), right at the locked door.
    const z = addZombie(g.state, areaOf(g.state)!, 'walker', p.x0 + back.x, p.z0 - 1.5, Math.PI)!;
    z.state = 'chase';
    z.target = 'player';
    z.goal = [g.state.player.pos[0], g.state.player.pos[2]];
    let wentRound = false;
    let reached = false;
    for (let s = 0; s < 150 && !reached; s += 0.5) {
      g.run(0.5);
      if (z.pos[2] > p.z1) wentRound = true;
      if ((z.state as string) === 'attack' || Math.hypot(z.pos[0] - g.state.player.pos[0], z.pos[2] - g.state.player.pos[2]) < 1.2) reached = true;
    }
    expect(wentRound).toBe(true);
    expect(reached).toBe(true);
    // The rooms a brute (radius 0.5) can get into: not past a 0.9 m door.
    const house = detailOf(g.map.placements[placementOf(g.map, 'house.wood2')]!);
    expect(roomRoute(house, -1, house.rooms.find((r) => r.use === 'living')!.id, 0.5)).toBeNull();
    expect(roomRoute(house, -1, house.rooms.find((r) => r.use === 'living')!.id, 0.32)).not.toBeNull();
  });

  it('can be shot from an upstairs window', () => {
    const g = yardGame();
    const pi = placementOf(g.map, 'house.wood2');
    const det = detailOf(g.map.placements[pi]!);
    const p = det.place;
    // A front window upstairs (the front faces the street).
    const win = det.bp.openings.find((o) => o.kind === 'window' && o.exterior && o.level === 1 && o.width > 1 && o.z > p.d - 0.5)!;
    const fy = p.base + det.bp.storeys[1]!.y;
    standAt(g.map, g.state, p.x0 + win.x, fy, p.z0 + win.z - 0.7);
    const target = addZombie(g.state, areaOf(g.state)!, 'walker', p.x0 + win.x, p.z1 + 7, 0)!;
    target.dummy = 1;
    g.state.flags.noSway = true;
    const aim = g.state.player.aim;
    // Aim at its chest: from the eye to the target.
    const eye: Vec3 = [g.state.player.pos[0], g.state.player.pos[1] + g.state.player.eye, g.state.player.pos[2]];
    const dx = target.pos[0] - eye[0];
    const dz = target.pos[2] - eye[2];
    const dy = target.pos[1] + 1.25 - eye[1];
    g.state.player.yaw = Math.atan2(-dx, -dz);
    g.state.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    aim.scopeT = 1;
    const before = target.hp;
    g.sim.tick(g.state, DT, input({ fire: true, scope: true }));
    g.sim.tick(g.state, DT, input({ scope: true }));
    for (let i = 0; i < 30; i++) g.sim.tick(g.state, DT, input({ scope: true }));
    expect(target.hp < before || target.state === 'down' || !g.state.tactical!.zombies.includes(target)).toBe(true);
  });
});

describe('search points inside buildings (07d)', () => {
  it('puts a building\'s search points at its shelves, with their floor and loot table', () => {
    const b = createFlatBuilder(0, { lootSpots: 12 });
    addEnterable(b, 'office.zakkyo5', 100, 100, 11, 16, 0);
    const map = finishMap(b);
    expect(map.lootSpots.length).toBeGreaterThan(3);
    const det = detailOf(map.placements[0]!);
    for (const s of map.lootSpots) {
      expect(s.y).toBeDefined();
      expect(s.table).toBeDefined();
      const room = whereIs(map, s.pos[0], s.y!, s.pos[1]);
      expect(room?.enter).toBe(0);
      expect(det.rooms[room!.room]?.locked).not.toBe(true);
    }
    expect(new Set(map.lootSpots.map((s) => s.y)).size).toBeGreaterThan(1); // on several floors
  });
});

describe('the base\'s buildings (07d D)', () => {
  it('the headquarters is enterable: survivors get a spot in its rooms and walk in through its door', async () => {
    const { foundBase } = await import('../src/sim/build/blueprints.ts');
    const { syncMap, hqOf } = await import('../src/sim/build/structures.ts');
    const { indoorSpot, routeTo } = await import('../src/sim/colony/ai.ts');
    const state = createInitialState(3, 1);
    state.world.homeCell = 0;
    foundBase(state);
    const map = finishMap(createFlatBuilder(0, { isHome: true }));
    syncMap(state, map);
    const hq = hqOf(state)!;
    const p = map.placements.find((q) => q.structure === hq.id)!;
    expect(p.def).toBe('base.hq');
    const det = detailOf(p);
    const spot = indoorSpot(map, hq, ['command'], 7)!;
    const where = whereIs(map, spot[0], p.base + det.bp.storeys[0]!.y, spot[1])!;
    expect(det.rooms[where.room]!.use).toBe('command');
    // From 30 m out in front of it: through the door (its two way points are on the path).
    const door = det.links.find((l) => l.a === -1)!;
    const path = routeTo(map, null, [(p.x0 + p.x1) / 2 + 30, (p.z0 + p.z1) / 2 + 30], spot);
    const near = (q: [number, number, number]): boolean => path.some((r) => Math.hypot(r[0] - q[0], r[1] - q[2]) < 0.05);
    expect(near(door.wpts[0]!) && near(door.wpts[1]!)).toBe(true);
    // A walker following it gets there without going through a wall.
    const st = createInitialState(1, 1);
    standAt(map, st, (p.x0 + p.x1) / 2 + 30, 0, (p.z0 + p.z1) / 2 + 30);
    expect(walkThrough(map, st, path.map((q) => [q[0], supportAt(map, q[0], q[1], 1), q[1]] as Vec3))).toBe(-1);
  });
});
