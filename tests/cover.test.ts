// 07b: cover and sight lines — "on foot the view is cut short; the far view belongs to the high ground".
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stream } from '../src/core/rng.ts';
import { createInitialState, emptyInputFrame, type GameState, type Land, type StaticGrid } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { COLONY } from '../src/data/colony.ts';
import { TACTICAL } from '../src/data/tactical.ts';
import { createFlatBuilder } from '../src/gen/builder.ts';
import { finishMap, generateTacticalMap, type TacticalMap } from '../src/gen/index.ts';
import { interactionAt, nearestHideout } from '../src/sim/colony/encounters.ts';
import { createSim } from '../src/sim/index.ts';
import { areaOf, mapOf } from '../src/sim/tactical/area.ts';
import { brushBetween, heightAt, isWalkable, raycastWorld, segmentHitsStatic, sightBlocked } from '../src/sim/tactical/collision.ts';
import { RANGE_SPOTS } from '../src/sim/tactical/range.ts';
import { openSightShare } from '../src/sim/tactical/sight.ts';
import { addZombie, hasCover, seesPlayer } from '../src/sim/tactical/zombies.ts';
import { parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { decodeScenario, initWorld } from '../src/sim/world/scenario.ts';
import { beginAt, findStartCandidates } from '../src/sim/world/start.ts';

const MID = TACTICAL.size / 2;
const DT = BALANCE.time.fixedStep;
const EYE = TACTICAL.player.eyeHeight.stand;
const SEEDS = [11, 22, 33, 44, 55, 66];
const gen = (land: Land, seed: number, isHome = false): TacticalMap => generateTacticalMap({ mapSeed: seed * 7919, land, isHome, lootSpots: 4 });
const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;

/** Mean share of open 200 m ground-level sight lines over 12 maps (6 seeds, home and not). */
function openShare(land: Land, blocked?: Parameters<typeof openSightShare>[4]): number {
  const shares: number[] = [];
  for (const seed of SEEDS) for (const isHome of [false, true]) shares.push(openSightShare(gen(land, seed, isHome), 200, 300, seed, blocked));
  return mean(shares);
}

describe('sight lines on foot (07b)', () => {
  // Before 07b (03's terrain, measured the same way): rural 65.7 %, forest 25.0 %.
  it('rural: 25..45 % of 200 m lines at eye height stay open', { timeout: 60_000 }, () => {
    const share = openShare('rural');
    console.log(`rural: ${(share * 100).toFixed(1)} % of 200 m sight lines open`);
    expect(share).toBeGreaterThanOrEqual(0.25);
    expect(share).toBeLessThanOrEqual(0.45);
  });

  it('forest: fewer than 15 % stay open, and the undergrowth is what closes them', { timeout: 60_000 }, () => {
    const share = openShare('forest');
    const trunksOnly = openShare('forest', segmentHitsStatic);
    console.log(`forest: ${(share * 100).toFixed(1)} % of 200 m sight lines open (${(trunksOnly * 100).toFixed(1)} % without the undergrowth)`);
    expect(share).toBeLessThan(0.15);
    expect(trunksOnly).toBeGreaterThan(share + 0.03);
  });

  it('keeps the far view from the firing positions: 300 m and more in most directions', { timeout: 60_000 }, () => {
    for (const land of ['rural', 'forest'] as Land[]) {
      for (const seed of SEEDS.slice(0, 4)) {
        const map = gen(land, seed, seed % 2 === 0);
        // The best of the positions: how many of 48 directions show ground 300..450 m away?
        let best = 0;
        for (const v of map.vantages) {
          const eye: [number, number, number] = [v.pos[0], v.pos[1] + EYE, v.pos[2]];
          let far = 0;
          for (let k = 0; k < 48; k++) {
            const a = (k / 48) * Math.PI * 2;
            let seen = false;
            for (const d of [300, 350, 400, 450]) {
              const x = v.pos[0] + Math.cos(a) * d;
              const z = v.pos[2] + Math.sin(a) * d;
              if (x < 4 || z < 4 || x > map.size - 4 || z > map.size - 4) continue;
              // A standing figure there: its head.
              if (!sightBlocked(map, eye, [x, heightAt(map, x, z) + 1.6, z])) seen = true;
            }
            if (seen) far++;
          }
          best = Math.max(best, far);
        }
        expect(best, `${land} seed ${seed}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('a hedge hides what is behind it from someone on foot, not from above, and never stops a bullet', () => {
    const b = createFlatBuilder(10);
    b.brush.push({ kind: 'hedge', ax: 480, az: 500, bx: 560, bz: 500, r: 1, h: 2.5 });
    b.brush.push({ kind: 'reeds', ax: 300, az: 300, bx: 300, bz: 300, r: 8, h: 2.3 });
    const map = finishMap(b);
    const at = (x: number, z: number, up: number): [number, number, number] => [x, 10 + up, z];
    expect(brushBetween(map, at(512, 520, EYE), at(512, 480, EYE))).toBe(true);
    expect(sightBlocked(map, at(512, 520, EYE), at(512, 480, EYE))).toBe(true);
    // Past the end of the hedge, and along it on one side: open.
    expect(sightBlocked(map, at(600, 520, EYE), at(600, 480, EYE))).toBe(false);
    expect(sightBlocked(map, at(480, 520, EYE), at(560, 520, EYE))).toBe(false);
    // From a 12 m tower 60 m back, the ground 15 m behind the hedge is in view; right behind it is not.
    expect(sightBlocked(map, at(512, 560, 12 + EYE), at(512, 485, 1))).toBe(false);
    expect(sightBlocked(map, at(512, 560, 12 + EYE), at(512, 498.5, 0.3))).toBe(true);
    // Standing in the reeds: hidden from outside; someone taller than the reeds is not.
    expect(sightBlocked(map, at(300, 300, EYE), at(340, 300, EYE))).toBe(true);
    expect(sightBlocked(map, at(300, 300, 3), at(340, 300, 3))).toBe(false);
    // Bullets ignore brush.
    expect(segmentHitsStatic(map, at(512, 520, EYE), at(512, 480, EYE))).toBe(false);
    expect(raycastWorld(map, at(512, 520, EYE), [0, 0, -1], 100)).toBeNull();
  });

  it('adds cover deterministically and keeps it out of the home base and off the roads', () => {
    for (const land of ['rural', 'forest'] as Land[]) {
      const a = gen(land, 33, true);
      const again = gen(land, 33, true);
      expect(JSON.stringify([again.brush, again.props])).toBe(JSON.stringify([a.brush, a.props]));
      expect(a.brush.length).toBeGreaterThan(land === 'rural' ? 150 : 1500);
      const clear = TACTICAL.homeFlatRadius;
      for (const br of a.brush) {
        for (const [x, z] of [[br.ax, br.az], [br.bx, br.bz]] as const) expect(Math.hypot(x - MID, z - MID) - br.r).toBeGreaterThan(clear);
      }
      for (const p of a.props) expect(Math.hypot(p.x - MID, p.z - MID)).toBeGreaterThan(clear);
      // The flat middle is still exactly flat (06 builds on it).
      const level = heightAt(a, MID, MID);
      for (let k = 0; k < 24; k++) expect(Math.abs(heightAt(a, MID + Math.cos(k) * (clear - 4), MID + Math.sin(k) * (clear - 4)) - level)).toBeLessThan(0.05);
    }
    const rural = gen('rural', 22);
    for (const kind of ['hedge', 'bush', 'reeds', 'bamboo'] as const) expect(rural.brush.some((br) => br.kind === kind), kind).toBe(true);
    expect(rural.props.some((p) => p.kind === 'greenhouse')).toBe(true);
    expect(gen('forest', 22).props.filter((p) => p.kind === 'log').length).toBeGreaterThan(80);
    // Still quick enough for the loading screen: under 150 ms a map once warm.
    const times: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      gen(i % 2 ? 'rural' : 'forest', 100 + i);
      times.push(performance.now() - t0);
    }
    // Fastest run: robust to the load of parallel test workers (see buildings.test.ts).
    expect(Math.min(...times)).toBeLessThan(150);
  });
});

// ---------------------------------------------------------------------------------------------

const DATA = new URL('../public/data/', import.meta.url);
const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
const scenario = (() => {
  const buf = readFileSync(new URL('infection_0.bin', DATA));
  return decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
})();
const idle = emptyInputFrame();

function newGame(seed: number): { state: GameState; sim: ReturnType<typeof createSim> } {
  const state = createInitialState(seed, 1);
  initWorld(state, grid, scenario);
  beginAt(state, grid, findStartCandidates(state.world.cells, grid, stream(state, 'world.start'))[0]!.cell);
  const sim = createSim({ grid });
  sim.tick(state, DT, idle);
  return { state, sim };
}

describe('zombies and cover (07b)', () => {
  it('cannot see the player through a hedge until it is close', () => {
    const b = createFlatBuilder();
    b.brush.push({ kind: 'hedge', ax: 480, az: 500, bx: 560, bz: 500, r: 1, h: 2.5 });
    const map = finishMap(b);
    const state = createInitialState(5, 1);
    state.flags.range = true;
    const sim = createSim({ grid: null });
    sim.tick(state, DT, idle);
    const area = areaOf(state)!;
    state.tactical!.zombies.length = 0;
    area.dynamic.clear();
    state.tactical!.rangeT = RANGE_SPOTS.map(() => -1e9);
    Object.assign(area, { map });
    state.player.pos = [512, 0, 512];
    state.time.minute = 12 * 60;
    const z = addZombie(state, area, 'walker', 512, 485, Math.PI)!; // 27 m north of the player, facing south
    expect(seesPlayer(state, map, z)).toBe(false);
    // Around the end of the hedge (it stops at x = 560).
    state.player.pos = [556, 0, 510];
    z.pos = [572, 0, 492];
    z.yaw = Math.atan2(-(556 - 572), -(510 - 492));
    expect(seesPlayer(state, map, z)).toBe(true);
    // Through the leaves at arm's length.
    z.pos = [512, 0, 497];
    z.yaw = Math.PI;
    state.player.pos = [512, 0, 502];
    expect(seesPlayer(state, map, z)).toBe(true);
  });

  it('starts most of them where there is cover', { timeout: 30_000 }, () => {
    let covered = 0;
    let total = 0;
    let ground = 0;
    let groundTotal = 0;
    for (const seed of [3, 12, 21]) {
      const { state } = newGame(seed);
      const map = mapOf(state)!;
      for (const z of state.tactical!.zombies) {
        total++;
        if (hasCover(map, z.pos[0], z.pos[2])) covered++;
      }
      for (let x = 20; x < map.size; x += 37) {
        for (let zz = 20; zz < map.size; zz += 41) {
          if (!isWalkable(map, Math.floor(x / 4), Math.floor(zz / 4))) continue;
          groundTotal++;
          if (hasCover(map, x, zz)) ground++;
        }
      }
    }
    expect(total).toBeGreaterThan(20);
    // Clearly more often than a random spot would be.
    expect(covered / total).toBeGreaterThan(0.6);
    expect(covered / total).toBeGreaterThan(ground / groundTotal + 0.1);
  });
});

describe('the first survivor (07b)', () => {
  it('a new game always has someone hiding 250..450 m from the base, even when the cell is empty of people', { timeout: 30_000 }, () => {
    const ring = COLONY.encounter.firstRing;
    for (const seed of [3, 12, 21, 40]) {
      const state = createInitialState(seed, 1);
      initWorld(state, grid, scenario);
      const cell = findStartCandidates(state.world.cells, grid, stream(state, 'world.start'))[0]!.cell;
      beginAt(state, grid, cell);
      state.world.cells.H[cell] = 0; // nobody left according to the map
      const sim = createSim({ grid });
      sim.tick(state, DT, idle);
      const t = state.tactical!;
      const sure = t.hideouts!.filter((h) => h.sure);
      expect(sure, `seed ${seed}`).toHaveLength(1);
      const hide = sure[0]!;
      const d = Math.hypot(hide.pos[0] - MID, hide.pos[1] - MID);
      expect(d).toBeGreaterThanOrEqual(ring[0] - 2);
      expect(d).toBeLessThanOrEqual(ring[1] + 2);
      // Too far to sense from the base; walk up to them: the HUD names the direction, E talks.
      expect(nearestHideout(state)).toBeNull();
      state.mode = 'tactical';
      state.player.pos = [hide.pos[0], heightAt(mapOf(state)!, hide.pos[0], hide.pos[1] + 30), hide.pos[1] + 30];
      expect(nearestHideout(state)).toMatchObject({ dir: 'N' });
      expect(Math.round(nearestHideout(state)!.dist)).toBe(30);
      state.player.pos = [hide.pos[0], heightAt(mapOf(state)!, hide.pos[0], hide.pos[1]), hide.pos[1]];
      state.tactical!.zombies.length = 0;
      expect(interactionAt(state)?.kind).toBe('talk');
      sim.tick(state, DT, { ...idle, interact: true });
      expect(hide.met).toBe(true);
      expect(state.colony.candidates.length).toBeGreaterThanOrEqual(1);
      expect(state.flags.firstContact).toBe(true);
    }
  });
});
