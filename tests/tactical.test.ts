import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rand, seedRng } from '../src/core/rng.ts';
import { deserialize, serialize } from '../src/core/save.ts';
import { createInitialState, emptyInputFrame, STATE_VERSION, type GameState, type InputFrame, type Land, type StaticGrid } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { TACTICAL } from '../src/data/tactical.ts';
import { addBuilding, addLadder, addStairs, addTower, createFlatBuilder } from '../src/gen/builder.ts';
import { finishMap, generateTacticalMap, GROUND, mapSeedFor, type TacticalMap } from '../src/gen/index.ts';
import { createSim } from '../src/sim/index.ts';
import { areaPending, mapOf } from '../src/sim/tactical/area.ts';
import { createSpatialHash, heightAt, isWalkable, raycastWorld, segmentHitsStatic, supportAt } from '../src/sim/tactical/collision.ts';
import { headingDeg, updatePlayer, viewRay } from '../src/sim/tactical/player.ts';
import { parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { decodeScenario, initWorld } from '../src/sim/world/scenario.ts';
import { beginAt } from '../src/sim/world/start.ts';

const LANDS: Land[] = ['urban', 'suburb', 'rural', 'forest', 'mountain'];
const P = TACTICAL.player;
const DT = BALANCE.time.fixedStep;
const MID = TACTICAL.size / 2;

const gen = (land: Land, mapSeed = 4242, isHome = false, lootSpots = 6): TacticalMap => generateTacticalMap({ mapSeed, land, isHome, lootSpots });
const median = (map: TacticalMap): number => Array.from(map.height).sort((a, b) => a - b)[Math.floor(map.height.length / 2)]!;

function newPlayer(map: TacticalMap, x: number, z: number, yaw = 0): GameState['player'] {
  const player = createInitialState(1, 1).player;
  player.pos = [x, heightAt(map, x, z), z];
  player.yaw = yaw;
  return player;
}
const input = (over: Partial<InputFrame> = {}): InputFrame => ({ ...emptyInputFrame(), ...over });
function run(player: GameState['player'], map: TacticalMap, frame: InputFrame, seconds: number): void {
  const held = { ...frame, stance: null, lookDX: 0, lookDY: 0 };
  for (let i = 0; i < Math.round(seconds / DT); i++) updatePlayer(player, map, i === 0 ? frame : held, DT);
}

describe('tactical map generation', () => {
  it('is deterministic: same parameters, same map', () => {
    for (const land of LANDS) {
      const a = gen(land);
      const b = gen(land);
      expect(b.height).toEqual(a.height);
      expect(b.walk).toEqual(a.walk);
      expect(b.ground).toEqual(a.ground);
      expect(b.trees.x).toEqual(a.trees.x);
      expect(b.grass.z).toEqual(a.grass.z);
      expect(JSON.stringify([b.buildings, b.solids, b.ladders, b.roads, b.areas, b.rocks, b.lootSpots, b.vantages, b.spawn]))
        .toBe(JSON.stringify([a.buildings, a.solids, a.ladders, a.roads, a.areas, a.rocks, a.lootSpots, a.vantages, a.spawn]));
    }
    expect(gen('rural', 1).height).not.toEqual(gen('rural', 2).height);
    expect(mapSeedFor(7, 100)).toBe(mapSeedFor(7, 100));
    expect(mapSeedFor(7, 100)).not.toBe(mapSeedFor(7, 101));
    expect(mapSeedFor(8, 100)).not.toBe(mapSeedFor(7, 100));
  });

  it('gives every land its character', () => {
    const relief = (m: TacticalMap): number => m.height.reduce((a, b) => Math.max(a, b), -Infinity) - m.height.reduce((a, b) => Math.min(a, b), Infinity);
    const maps = Object.fromEntries(LANDS.map((l) => [l, gen(l)])) as Record<Land, TacticalMap>;
    expect(maps.urban.height).toHaveLength(257 * 257);
    expect(maps.urban.walk).toHaveLength(256 * 256);
    expect(relief(maps.urban)).toBeLessThan(6);
    expect(relief(maps.rural)).toBeGreaterThan(15);
    expect(relief(maps.forest)).toBeGreaterThan(40);
    expect(relief(maps.mountain)).toBeGreaterThan(100);
    expect(maps.urban.buildings.length).toBeGreaterThan(300);
    expect(maps.urban.buildings.some((b) => b.height > 30)).toBe(true);
    expect(maps.suburb.buildings.filter((b) => b.kind === 'house').length).toBeGreaterThan(300);
    expect(maps.rural.areas.filter((a) => a.kind === 'field' || a.kind === 'paddy').length).toBeGreaterThan(15);
    expect(maps.rural.buildings.length).toBeGreaterThan(5);
    expect(maps.rural.buildings.length).toBeLessThan(80);
    expect(maps.forest.trees.n).toBeGreaterThan(4000);
    expect(maps.forest.trees.n).toBeGreaterThan(maps.rural.trees.n * 2);
    expect(maps.mountain.rocks.length).toBeGreaterThan(maps.rural.rocks.length);
    // Urban avenues give sight lines across the whole map.
    expect(maps.urban.roads.some((r) => r.kind === 'avenue')).toBe(true);
  });

  it('always offers at least three reachable high firing positions', () => {
    for (const land of LANDS) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const map = gen(land, seed * 7919, seed % 2 === 0);
        const m = median(map);
        const high = map.vantages.filter((v) => v.pos[1] >= m + 6);
        expect(high.length, `${land} seed ${seed}`).toBeGreaterThanOrEqual(3);
        for (const v of map.vantages) {
          expect(v.pos[0]).toBeGreaterThan(0);
          expect(v.pos[0]).toBeLessThan(map.size);
          // Roofs and towers come with stairs or a ladder.
          if (v.kind !== 'hill') expect(map.buildings.some((b) => b.access !== 'none' && Math.abs(b.base + b.height - v.pos[1]) < 1e-6)).toBe(true);
        }
      }
    }
  });

  it('keeps the middle of a home cell flat and empty', () => {
    for (const land of LANDS) {
      const map = gen(land, 99, true);
      const R = TACTICAL.homeFlatRadius;
      const level = heightAt(map, MID, MID);
      for (let a = 0; a < 16; a++) {
        for (const r of [20, 60, 100, R - 4]) {
          expect(Math.abs(heightAt(map, MID + Math.cos(a) * r, MID + Math.sin(a) * r) - level)).toBeLessThan(0.05);
        }
      }
      const inside = (x: number, z: number): boolean => Math.hypot(x - MID, z - MID) < R;
      expect(map.solids.some((s) => inside(Math.min(s.x1, Math.max(s.x0, MID)), Math.min(s.z1, Math.max(s.z0, MID))))).toBe(false);
      for (let i = 0; i < map.trees.n; i++) expect(inside(map.trees.x[i]!, map.trees.z[i]!)).toBe(false);
      expect(map.areas.some((a) => (a.kind === 'field' || a.kind === 'paddy') && inside(Math.min(a.x1, Math.max(a.x0, MID)), Math.min(a.z1, Math.max(a.z0, MID))))).toBe(false);
      expect(map.spawn.home).toEqual([MID, MID]);
    }
  });

  it('puts the edge spawn on a road, and loot spots on free ground next to buildings', () => {
    for (const land of LANDS) {
      const want = { urban: 30, suburb: 20, rural: 8, forest: 3, mountain: 1 }[land];
      const map = gen(land, 31337, false, want);
      const [sx, sz] = map.spawn.edge;
      const tile = map.ground[Math.floor(sz / 4) * 256 + Math.floor(sx / 4)];
      expect([GROUND.road, GROUND.track]).toContain(tile);
      expect(Math.min(sx, sz, map.size - sx, map.size - sz)).toBeLessThan(16);
      expect(supportAt(map, sx, sz, Infinity)).toBeCloseTo(heightAt(map, sx, sz), 6);
      expect(map.lootSpots).toHaveLength(want);
      // 07d: an enterable building gives a spot per shelf inside (on its floor); the others one at the door.
      const outside = map.lootSpots.filter((s) => s.y === undefined);
      expect(new Set(outside.map((s) => s.building)).size).toBe(outside.length);
      for (const spot of map.lootSpots) {
        const b = map.buildings[spot.building]!;
        if (spot.y !== undefined) {
          expect(b.enter).toBeDefined();
          expect(spot.pos[0] > b.x0 && spot.pos[0] < b.x1 && spot.pos[1] > b.z0 && spot.pos[1] < b.z1).toBe(true);
          continue;
        }
        const dx = Math.max(b.x0 - spot.pos[0], 0, spot.pos[0] - b.x1);
        const dz = Math.max(b.z0 - spot.pos[1], 0, spot.pos[1] - b.z1);
        expect(Math.hypot(dx, dz)).toBeGreaterThan(0.5);
        expect(Math.hypot(dx, dz)).toBeLessThan(2);
      }
    }
    expect(gen('rural', 5, false, 0).lootSpots).toHaveLength(0);
  });

  it('marks buildings and cliffs as not walkable', () => {
    const map = gen('suburb');
    const b = map.buildings.find((x) => x.kind === 'house')!;
    expect(isWalkable(map, Math.floor((b.x0 + b.x1) / 8), Math.floor((b.z0 + b.z1) / 8))).toBe(false);
    expect(isWalkable(map, Math.floor(map.spawn.edge[0] / 4), Math.floor(map.spawn.edge[1] / 4))).toBe(true);
    expect(isWalkable(map, -1, 3)).toBe(false);
    expect(isWalkable(map, 256, 3)).toBe(false);
    const walkable = map.walk.reduce((s, v) => s + v, 0) / map.walk.length;
    expect(walkable).toBeGreaterThan(0.6);
  });

  it('generates fast enough for a loading screen', () => {
    const t0 = performance.now();
    for (const land of LANDS) gen(land, 77);
    expect((performance.now() - t0) / LANDS.length).toBeLessThan(600);
  });
});

/** Flat ground at y = 10 with one 10 x 10 x 6 m box at x, z in [100, 110], a tree and stairs. */
function testMap(): TacticalMap {
  const b = createFlatBuilder(10);
  const box = addBuilding(b, 'warehouse', 100, 100, 110, 110, 6);
  addStairs(b, box, 1); // east wall
  const hut = addBuilding(b, 'shop', 200, 100, 208, 106, 4);
  addLadder(b, hut, 3); // south wall, in the middle
  addTower(b, 300, 300, 12, 3);
  b.trees.push(150, 150, 12, 3, 0);
  return finishMap(b);
}

describe('collision queries', () => {
  const map = testMap();

  it('interpolates heights like the render mesh', () => {
    const hilly = gen('forest');
    expect(heightAt(hilly, 40, 80)).toBeCloseTo(hilly.height[20 * 257 + 10]!, 5);
    // On the shared diagonal of a quad both triangles agree.
    const a = hilly.height[20 * 257 + 11]!;
    const c = hilly.height[21 * 257 + 10]!;
    expect(heightAt(hilly, 42, 82)).toBeCloseTo((a + c) / 2, 4);
    expect(heightAt(map, 3.3, 900.1)).toBe(10);
    expect(heightAt(map, -50, 5000)).toBe(10); // clamped
  });

  it('hits the ground where expected', () => {
    const down = raycastWorld(map, [50, 12, 50], [0, -1, 0], 100)!;
    expect(down.kind).toBe('terrain');
    expect(down.dist).toBeCloseTo(2, 3);
    expect(down.normal[1]).toBeCloseTo(1, 5);
    // 45° downwards: 2 m above the ground => sqrt(8) m away.
    const slanted = raycastWorld(map, [50, 12, 50], [1, -1, 0], 100)!;
    expect(slanted.dist).toBeCloseTo(Math.sqrt(8), 2);
    expect(slanted.pos[0]).toBeCloseTo(52, 2);
    expect(raycastWorld(map, [50, 12, 50], [1, 0, 0], 1.5)).toBeNull();
    expect(raycastWorld(map, [50, 12, 50], [0, 1, 0], 500)).toBeNull();
  });

  it('hits the first wall of a building, from any side', () => {
    const hit = raycastWorld(map, [50, 12, 105], [1, 0, 0], 800)!;
    expect(hit.kind).toBe('building');
    expect(hit.dist).toBeCloseTo(50, 6);
    expect(hit.normal).toEqual([-1, 0, 0]);
    expect(map.solids[hit.index]!.ref).toBe(0);
    const fromNorth = raycastWorld(map, [105, 13, 20], [0, 0, 2], 800)!; // direction need not be normalised
    expect(fromNorth.dist).toBeCloseTo(80, 6);
    expect(fromNorth.normal).toEqual([0, 0, -1]);
    const roof = raycastWorld(map, [105, 40, 105], [0, -1, 0], 800)!;
    expect(roof.kind).toBe('building');
    expect(roof.pos[1]).toBeCloseTo(16, 6);
    expect(roof.normal).toEqual([0, 1, 0]);
    // Over the roof, and too short to reach the wall.
    expect(raycastWorld(map, [50, 17, 105], [1, 0, 0], 800)).toBeNull();
    expect(raycastWorld(map, [50, 12, 105], [1, 0, 0], 49.9)).toBeNull();
    // A long shot from across the map still finds it.
    const far = raycastWorld(map, [900, 11.5, 109], [-1, 0, 0], 800)!;
    expect(far.kind).toBe('building');
    expect(far.dist).toBeCloseTo(790, 6);
    expect(raycastWorld(map, [900, 11.5, 109], [-1, 0, 0], 789)).toBeNull();
    // The staircase on the east wall is hit before the wall behind it.
    expect(raycastWorld(map, [900, 10.2, 107], [-1, 0, 0], 800)!.kind).toBe('stair');
  });

  it('hits tree trunks but not the canopy', () => {
    const trunk = raycastWorld(map, [140, 11.5, 150], [1, 0, 0], 100)!;
    expect(trunk.kind).toBe('tree');
    expect(trunk.dist).toBeGreaterThan(9.5);
    expect(trunk.dist).toBeLessThan(10);
    expect(raycastWorld(map, [140, 10 + 12 * 0.8, 150], [1, 0, 0], 100)).toBeNull();
    expect(raycastWorld(map, [140, 11.5, 151], [1, 0, 0], 100)).toBeNull();
  });

  it('answers segment and support queries', () => {
    expect(segmentHitsStatic(map, [90, 11, 105], [120, 11, 105])).toBe(true);
    expect(segmentHitsStatic(map, [90, 11, 105], [99, 11, 105])).toBe(false);
    expect(segmentHitsStatic(map, [90, 17, 105], [120, 17, 105])).toBe(false);
    expect(segmentHitsStatic(map, [90, 11, 95], [120, 11, 95])).toBe(false);
    expect(segmentHitsStatic(map, [50, 11, 50], [60, 9, 50])).toBe(true); // into the ground
    expect(supportAt(map, 105, 105, 16)).toBe(16); // on the roof
    expect(supportAt(map, 105, 105, 10)).toBe(10); // the roof is far above the feet: not a support
    expect(supportAt(map, 50, 50, 10)).toBe(10);
  });

  it('buckets dynamic objects by position', () => {
    const hash = createSpatialHash();
    hash.set(1, 10, 10);
    hash.set(2, 500, 500);
    hash.set(3, 505, 498);
    expect(hash.size).toBe(3);
    expect(hash.query(502, 500, 10, []).sort()).toEqual([2, 3]);
    expect(hash.query(10, 10, 5, [])).toEqual([1]);
    hash.set(1, 501, 501); // moved
    expect(hash.query(10, 10, 5, [])).toEqual([]);
    expect(hash.query(502, 500, 10, []).sort()).toEqual([1, 2, 3]);
    expect(hash.querySegment(0, 0, 1000, 1000, 2, []).sort()).toEqual([1, 2, 3]);
    expect(hash.querySegment(0, 1000, 300, 700, 2, [])).toEqual([]);
    hash.remove(2);
    hash.remove(99);
    expect(hash.query(502, 500, 10, []).sort()).toEqual([1, 3]);
    hash.clear();
    expect(hash.size).toBe(0);
  });
});

describe('player movement', () => {
  const map = testMap();

  it('walks, sprints, crouches and crawls at the specified speeds', () => {
    const cases: [Partial<InputFrame>, number][] = [
      [{ moveZ: 1 }, P.walk],
      [{ moveZ: 1, sprint: true }, P.sprint],
      [{ moveZ: 1, stance: 'crouch' }, P.crouch],
      [{ moveZ: 1, stance: 'prone' }, P.prone],
      [{ moveZ: 1, stance: 'crouch', sprint: true }, P.crouch],
    ];
    for (const [frame, speed] of cases) {
      const p = newPlayer(map, 500, 500);
      run(p, map, input(frame), 1); // settle
      const z0 = p.pos[2];
      run(p, map, input({ ...frame, stance: null }), 2);
      expect((z0 - p.pos[2]) / 2).toBeCloseTo(speed, 2); // yaw 0 walks north (-z)
      expect(p.pos[0]).toBeCloseTo(500, 6);
      expect(p.pos[1]).toBe(10);
    }
    expect([P.walk, P.sprint, P.crouch, P.prone]).toEqual([1.6, 5, 1, 0.4]);
  });

  it('moves relative to where the player looks', () => {
    const p = newPlayer(map, 500, 500, -Math.PI / 2); // facing east
    expect(headingDeg(p.yaw)).toBeCloseTo(90, 6);
    run(p, map, input({ moveZ: 1 }), 2);
    expect(p.pos[0]).toBeGreaterThan(502);
    expect(p.pos[2]).toBeCloseTo(500, 4);
    run(p, map, input({ moveX: 1 }), 2); // strafe right = south
    expect(p.pos[2]).toBeGreaterThan(502);
    // Mouse: right turns right, down looks down, pitch is clamped.
    updatePlayer(p, map, input({ lookDX: 100, lookDY: 100000 }), DT);
    expect(p.yaw).toBeLessThan(-Math.PI / 2);
    expect(p.pitch).toBe(-P.maxPitch);
    const ray = viewRay(p);
    expect(ray.origin[1]).toBeCloseTo(p.pos[1] + P.eyeHeight.stand, 3);
    expect(Math.hypot(...ray.dir)).toBeCloseTo(1, 6);
    expect(ray.dir[1]).toBeLessThan(-0.9);
  });

  it('eases the eye height between stances', () => {
    const p = newPlayer(map, 500, 500);
    expect(p.eye).toBe(1.7);
    updatePlayer(p, map, input({ stance: 'prone' }), DT);
    expect(p.stance).toBe('prone');
    expect(p.eye).toBeLessThan(1.7);
    expect(p.eye).toBeGreaterThan(1.2); // not instant
    run(p, map, input(), 1.5);
    expect(p.eye).toBe(0.3);
    run(p, map, input({ stance: 'crouch' }), 1.5);
    expect(p.eye).toBe(1.0);
  });

  it('drains stamina while sprinting and recovers it at rest', () => {
    const p = newPlayer(map, 500, 900);
    run(p, map, input({ moveZ: 1, sprint: true }), 5);
    expect(p.stamina).toBeCloseTo(P.staminaMax - P.sprintDrain * 5, 0);
    for (let i = 0; i < 600 && !p.winded; i++) updatePlayer(p, map, input({ moveZ: 1, sprint: true }), DT);
    expect(p.winded).toBe(true);
    expect(p.stamina).toBeLessThan(1);
    // Out of breath: back to walking pace until some stamina has returned.
    const z0 = p.pos[2];
    run(p, map, input({ moveZ: 1, sprint: true }), 1);
    expect(z0 - p.pos[2]).toBeLessThan(P.walk * 1.5);
    const s0 = p.stamina;
    run(p, map, input(), 4);
    expect(p.stamina - s0).toBeCloseTo(P.staminaRegenIdle * 4, 1);
    expect(p.winded).toBe(false);
  });

  it('is stopped by walls and trees', () => {
    const p = newPlayer(map, 105, 120); // south of the box, walking north into it
    run(p, map, input({ moveZ: 1 }), 12);
    expect(p.pos[2]).toBeCloseTo(110 + P.radius, 3);
    expect(p.pos[1]).toBe(10);
    // Sliding along the wall still works.
    run(p, map, input({ moveZ: 1, moveX: -1 }), 2);
    expect(p.pos[0]).toBeLessThan(104);
    expect(p.pos[2]).toBeCloseTo(110 + P.radius, 3);
    const t = newPlayer(map, 150, 158);
    run(t, map, input({ moveZ: 1 }), 8);
    expect(Math.hypot(t.pos[0] - 150, t.pos[2] - 150)).toBeGreaterThan(P.radius + 0.3);
    expect(t.pos[2]).toBeGreaterThan(150);
  });

  it('climbs outside stairs to the roof and can fall off without getting stuck', () => {
    // East wall (x = 110): the first flight starts at the south end of the stair run, in the lane next to the wall.
    const steps = map.solids.filter((s) => s.kind === 'stair');
    expect(steps.length).toBeGreaterThan(20);
    const first = steps[0]!;
    const p = newPlayer(map, (first.x0 + first.x1) / 2, first.z0 - 1.5, Math.PI); // facing south (+z)
    run(p, map, input({ moveZ: 1 }), 3.6); // up the first flight onto the landing
    expect(p.pos[1]).toBeCloseTo(13, 1);
    // Step across to the outer lane and walk back north up the second flight.
    run(p, map, input({ moveX: -1 }), 0.75);
    p.yaw = 0;
    run(p, map, input({ moveZ: 1 }), 3.2);
    expect(p.pos[1]).toBeCloseTo(16, 1);
    // From the top landing onto the roof (west).
    p.yaw = Math.PI / 2;
    run(p, map, input({ moveZ: 1 }), 4);
    expect(p.pos[1]).toBe(16);
    expect(p.pos[0]).toBeLessThan(109);
    expect(p.pos[0]).toBeGreaterThan(100);
    // Walk off the west edge: fall to the ground and keep walking.
    run(p, map, input({ moveZ: 1 }), 8);
    expect(p.pos[1]).toBe(10);
    expect(p.pos[0]).toBeLessThan(96);
    expect(p.vel[1]).toBe(0);
    const x0 = p.pos[0];
    run(p, map, input({ moveZ: 1 }), 1);
    expect(p.pos[0]).toBeLessThan(x0 - 1);
  });

  it('climbs ladders up and down', () => {
    const ladder = map.ladders[0]!; // south wall of the hut (z = 106)
    const p = newPlayer(map, (ladder.x0 + ladder.x1) / 2, 109, 0);
    run(p, map, input({ moveZ: 1 }), 6);
    expect(p.pos[1]).toBeCloseTo(14, 1); // on the roof
    expect(p.pos[2]).toBeLessThan(106);
    // Back out over the edge and climb down by holding "back".
    p.pos = [(ladder.x0 + ladder.x1) / 2, ladder.y1, 106.4];
    p.vel = [0, 0, 0];
    run(p, map, input(), 1);
    expect(p.pos[1]).toBeCloseTo(ladder.y1, 2); // holds on
    run(p, map, input({ moveZ: -1 }), 1);
    expect(p.pos[1]).toBeCloseTo(ladder.y1 - P.ladderSpeed, 1);
    expect(p.pos[2]).toBeCloseTo(106.4, 1); // stays on the ladder
    // Looking down, "forward" climbs down as well.
    p.pitch = -1;
    run(p, map, input({ moveZ: 1 }), 1);
    expect(p.pos[1]).toBeCloseTo(ladder.y1 - P.ladderSpeed * 2, 1);
    p.pitch = 0;
    run(p, map, input({ moveZ: -1 }), 4);
    expect(p.pos[1]).toBe(10);
    expect(p.pos[2]).toBeGreaterThan(107); // walked away at the bottom
    // The tower deck is reached the same way.
    const tower = map.ladders[1]!;
    const q = newPlayer(map, (tower.x0 + tower.x1) / 2, tower.z1 + 2, 0);
    run(q, map, input({ moveZ: 1 }), 12);
    expect(q.pos[1]).toBeCloseTo(22, 1);
    expect(Math.abs(q.pos[0] - 300)).toBeLessThan(2.2);
    expect(Math.abs(q.pos[2] - 300)).toBeLessThan(2.2);
  });

  it('slows down on steep ground but never stops', () => {
    const steep = createFlatBuilder(0);
    for (let iz = 0; iz < 257; iz++) for (let ix = 0; ix < 257; ix++) steep.height[iz * 257 + ix] = Math.max(0, 500 - iz * 4) * 1.5; // rises 1.5 m per metre northwards
    const m = finishMap(steep);
    const p = newPlayer(m, 512, 560);
    run(p, m, input({ moveZ: 1 }), 0.5);
    const z0 = p.pos[2];
    run(p, m, input({ moveZ: 1 }), 5);
    const uphill = (z0 - p.pos[2]) / 5;
    run(p, m, input({ moveZ: 1 }), 50);
    expect(p.pos[2]).toBeLessThan(500); // reached the slope
    const z1 = p.pos[2];
    run(p, m, input({ moveZ: 1 }), 5);
    const climbing = (z1 - p.pos[2]) / 5;
    expect(uphill).toBeCloseTo(P.walk, 1);
    expect(climbing).toBeGreaterThan(0.05);
    expect(climbing).toBeLessThan(P.walk * 0.3);
    expect(p.pos[1]).toBeCloseTo(heightAt(m, p.pos[0], p.pos[2]), 5);
  });

  it('never sinks, leaves the map or ends up inside a building on generated maps', () => {
    for (const land of LANDS) {
      const map = gen(land, 2024);
      const rng = seedRng(land.length * 31);
      const p = newPlayer(map, map.spawn.edge[0], map.spawn.edge[1], map.spawn.edgeYaw);
      let frame = input({ moveZ: 1 });
      let stuck = 0;
      let travelled = 0;
      for (let i = 0; i < 60 * 240; i++) {
        if (i % 90 === 0) {
          frame = input({
            moveZ: rand(rng) < 0.85 ? 1 : -1, moveX: Math.round(rand(rng) * 2 - 1), sprint: rand(rng) < 0.6,
            lookDX: (rand(rng) - 0.5) * 500, stance: rand(rng) < 0.1 ? 'crouch' : rand(rng) < 0.5 ? 'stand' : null,
          });
        }
        const bx = p.pos[0];
        const bz = p.pos[2];
        updatePlayer(p, map, frame, DT);
        frame = { ...frame, lookDX: 0, stance: null };
        const step = Math.hypot(p.pos[0] - bx, p.pos[2] - bz);
        travelled += step;
        stuck = step < 1e-4 ? stuck + 1 : 0;
        const [x, y, z] = p.pos;
        expect(Number.isFinite(x + y + z)).toBe(true);
        expect(y).toBeGreaterThanOrEqual(heightAt(map, x, z) - 1e-6);
        expect(Math.min(x, z)).toBeGreaterThanOrEqual(P.edgeMargin);
        expect(Math.max(x, z)).toBeLessThanOrEqual(map.size - P.edgeMargin);
        // Inside a building's footprint only when standing on its roof.
        for (const b of map.buildings) {
          if (b.kind !== 'tower' && b.enter === undefined && x > b.x0 + 0.01 && x < b.x1 - 0.01 && z > b.z0 + 0.01 && z < b.z1 - 0.01) expect(y).toBeGreaterThanOrEqual(b.base + b.height - 1e-6);
        }
      }
      expect(travelled, land).toBeGreaterThan(150);
    }
  });
});

describe('operation area life cycle', () => {
  const DATA = new URL('../public/data/', import.meta.url);
  const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
  const buf = readFileSync(new URL('infection_0.bin', DATA));
  const scenario = decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  const idle = emptyInputFrame();
  const startCell = grid.landIds.find((id) => grid.cells[id]!.land === 'rural' && grid.cells[id + 1]?.land !== undefined)!;

  function begin(seed = 5): { sim: ReturnType<typeof createSim>; state: GameState } {
    const sim = createSim({ grid });
    const state = createInitialState(seed, 1);
    initWorld(state, grid, scenario);
    beginAt(state, grid, startCell);
    return { sim, state };
  }

  it('builds the home area on the first tick, with the player in the middle', () => {
    const { sim, state } = begin();
    expect(state.tactical).toBeNull();
    expect(areaPending(state, grid)).toBe(true);
    sim.tick(state, DT, idle);
    expect(areaPending(state, grid)).toBe(false);
    const map = mapOf(state)!;
    expect(state.tactical).toMatchObject({ cell: startCell, mapSeed: mapSeedFor(state.seed, startCell), zombies: [], wind: [0, 0] });
    expect(map.params).toMatchObject({ land: 'rural', isHome: true, mapSeed: state.tactical!.mapSeed });
    expect(state.player.pos[0]).toBe(MID);
    expect(state.player.pos[2]).toBe(MID);
    expect(state.player.pos[1]).toBeCloseTo(heightAt(map, MID, MID), 6);
    expect(state.tactical!.lootSpots.map((s) => s.pos)).toEqual(map.lootSpots.map((s) => s.pos));
    // The map itself never enters the state.
    expect(JSON.stringify(state).length).toBeLessThan(900_000);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('moves the player with the input and stays deterministic', () => {
    const play = (): string => {
      const { sim, state } = begin(11);
      for (let i = 0; i < 600; i++) sim.tick(state, DT, { ...idle, moveZ: 1, sprint: i > 200, lookDX: i === 100 ? 300 : 0 });
      expect(Math.hypot(state.player.pos[0] - MID, state.player.pos[2] - MID)).toBeGreaterThan(15);
      return JSON.stringify(state);
    };
    expect(play()).toBe(play());
  });

  it('drops the area when travelling, builds the next one on arrival and the same one on return', () => {
    const { sim, state } = begin();
    sim.tick(state, DT, idle);
    const home = mapOf(state)!;
    const neighbour = startCell + 1;
    const seen: string[] = [];
    sim.events.on('cellEntered', () => seen.push(state.tactical === null ? 'entered:none' : 'entered:area'));
    sim.dispatch({ type: 'travel', to: neighbour });
    sim.tick(state, DT, idle);
    sim.tick(state, DT, idle);
    expect(state.world.travel).not.toBeNull();
    expect(state.tactical).toBeNull();
    expect(mapOf(state)).toBeNull();
    expect(areaPending(state, grid)).toBe(false); // nothing to build while on the road
    for (let i = 0; i < 60 * 60 * 6 && state.world.travel; i++) sim.tick(state, DT, idle);
    expect(state.player.cell).toBe(neighbour);
    sim.tick(state, DT, idle);
    expect(seen).toEqual(['entered:none']);
    const away = mapOf(state)!;
    expect(state.tactical!.cell).toBe(neighbour);
    expect(away.params.isHome).toBe(false);
    expect(away.params.mapSeed).not.toBe(home.params.mapSeed);
    // Arrivals start on the road at the edge of the area.
    expect(state.player.pos[0]).toBeCloseTo(away.spawn.edge[0], 1);
    expect(state.player.pos[2]).toBeCloseTo(away.spawn.edge[1], 1);
    expect(state.player.yaw).toBeCloseTo(away.spawn.edgeYaw, 6);

    sim.dispatch({ type: 'travel', to: startCell });
    for (let i = 0; i < 60 * 60 * 6 && (i < 3 || state.world.travel); i++) sim.tick(state, DT, idle);
    sim.tick(state, DT, idle);
    const back = mapOf(state)!;
    expect(back.params).toEqual(home.params);
    expect(back.height).toEqual(home.height);
    expect(back.buildings).toEqual(home.buildings);
    expect(generateTacticalMap(home.params).height).toEqual(home.height);
  });

  it('rebuilds the same area after a save and a load, keeping taken loot spots and the position', () => {
    const { sim, state } = begin();
    for (let i = 0; i < 300; i++) sim.tick(state, DT, { ...idle, moveZ: 1, moveX: 1 });
    const before = mapOf(state)!;
    expect(state.tactical!.lootSpots.length).toBeGreaterThan(0);
    state.tactical!.lootSpots[0]!.taken = true;
    const loaded = deserialize(serialize(state));
    expect(loaded.tactical).not.toBeNull();
    expect(mapOf(loaded)).toBeNull(); // tactical state without its map
    expect(areaPending(loaded, grid)).toBe(true);
    const pos = [...loaded.player.pos];
    const sim2 = createSim({ grid });
    sim2.tick(loaded, DT, idle);
    const after = mapOf(loaded)!;
    expect(after.params).toEqual(before.params);
    expect(after.height).toEqual(before.height);
    expect(loaded.tactical!.lootSpots.map((s) => s.taken)).toEqual(state.tactical!.lootSpots.map((s) => s.taken));
    expect(loaded.tactical!.lootSpots[0]!.taken).toBe(true);
    for (let k = 0; k < 3; k++) expect(loaded.player.pos[k]).toBeCloseTo(pos[k]!, 0);
  });

  it('upgrades version 1 saves', () => {
    const { state } = begin();
    const old = JSON.parse(serialize(state)) as { version: number; player: Record<string, unknown> };
    old.version = 1;
    delete old.player.vel;
    delete old.player.eye;
    delete old.player.winded;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.version).toBe(STATE_VERSION);
    expect(loaded.player.vel).toEqual([0, 0, 0]);
    expect(loaded.player.eye).toBe(1.7);
    expect(loaded.player.winded).toBe(false);
  });
});
