// L1: the landmarks (名所, docs/realmap_guide.md §7). The table (src/data/landmarks/) against the
// catalog and the names; the landmark yards (`?landmarks=<region>`) with the ladders up to the decks climbed;
// every landmark of the table standing in its real area (for the regions whose area data is there).
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { LANDMARKS, LANDMARK_GRID, LANDMARK_REGIONS } from '../src/data/landmarks/index.ts';
import { BUILDING_DEFS, buildingDef, detailOf, hasBuildingDef, toWorld } from '../src/gen/buildings/index.ts';
import { landmarksIn, realToArea } from '../src/gen/real/landmarks.ts';
import { GROUND } from '../src/gen/types.ts';
import { supportAt } from '../src/sim/tactical/collision.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';
import { yardEntries, yardMap } from '../src/sim/tactical/yard.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { ja } from '../src/ui/i18n/ja.ts';
import { mapFor } from '../tools/real/check.ts';
import { gameState, loadGrid, loadRealIndexes } from '../tools/real/lib/game.ts';
import { landmarkDef } from '../src/gen/buildings/defs/landmark/common.ts';
import { generateBlueprint } from '../src/gen/buildings/index.ts';
import { beginAt } from '../src/sim/world/start.ts';
import { mapOf } from '../src/sim/tactical/area.ts';
import { createSim } from '../src/sim/index.ts';

const DT = BALANCE.time.fixedStep;
const landmarkDefs = BUILDING_DEFS.filter((d) => d.category === 'landmark');

describe('the landmark table (L1)', () => {
  it('uses the strategic map grid', () => {
    const g = JSON.parse(readFileSync(new URL('../public/data/grid.json', import.meta.url), 'utf8')) as { proj: Record<string, number>; cellKm: number; w: number };
    expect(LANDMARK_GRID.lon0).toBe(g.proj.lon0);
    expect(LANDMARK_GRID.latTop).toBe(g.proj.latTop);
    expect(LANDMARK_GRID.kmPerLon).toBe(g.proj.kmPerLon);
    expect(LANDMARK_GRID.kmPerLat).toBe(g.proj.kmPerLat);
    expect(LANDMARK_GRID.cellKm).toBe(g.cellKm);
    expect(LANDMARK_GRID.gridW).toBe(g.w);
    // Sapporo's TV tower: cell 4800, R1's shrunk point (810, 173).
    const a = realToArea(43.0611, 141.3564);
    expect(a.cell).toBe(4800);
    expect(a.x).toBeCloseTo(810, 0);
    expect(a.z).toBeCloseTo(173, 0);
  });

  it('places only exterior-only landmark types, every landmark type is placed somewhere, and each has its name', () => {
    for (const s of LANDMARKS) {
      expect(hasBuildingDef(s.id), s.id).toBe(true);
      const def = buildingDef(s.id);
      expect(def.category).toBe('landmark');
      expect(def.exteriorOnly, s.id).toBe(true);
      expect([0, 1, 2, 3]).toContain(s.rot);
    }
    for (const d of landmarkDefs) {
      expect(LANDMARKS.some((s) => s.id === d.id), `${d.id} is in no table`).toBe(true);
      expect((ja as Record<string, string>)[d.id], `${d.id} has no name in ja.ts`).toBeTruthy();
    }
  });
});

// L6: one yard per region (all of them no longer fit in one map).
const YARDS = LANDMARK_REGIONS.map((r, i) => ({ name: r.name, i })).filter((r) => LANDMARK_REGIONS[r.i]!.spots.length > 0);

describe('the landmark yards (L1, L6: one per region)', () => {
  it('stand every landmark type once, each in the yard of its region, with its ground', () => {
    const ids = YARDS.flatMap((r) => yardEntries(4, r.i).map((e) => e.def));
    expect(ids.sort()).toEqual(landmarkDefs.map((d) => d.id).sort());
    for (const r of YARDS) for (const e of yardEntries(4, r.i)) expect(LANDMARK_REGIONS[r.i]!.spots.some((s) => s.id === e.def), `${e.def} in ${r.name}`).toBe(true);
    // The moat of Goryōkaku and the Otaru canal are water.
    const map = yardMap(4, 0);
    for (const id of ['landmark.goryokaku', 'landmark.otaru_canal']) {
      const p = map.placements.find((q) => q.def === id)!;
      let wet = 0;
      for (let ty = Math.floor(p.z0 / 4); ty < Math.ceil(p.z1 / 4); ty++) for (let tx = Math.floor(p.x0 / 4); tx < Math.ceil(p.x1 / 4); tx++) if (map.ground[ty * map.tiles + tx] === GROUND.water) wet++;
      expect(wet, id).toBeGreaterThan(50);
    }
  });

  // L4: in the catalog's order the rows of 57 landmarks ran past the map's south edge (Kunōzan and the
  // Fuji Sengen shrine stood at z 986–1070 of a 1024 m map) and nothing failed.
  it('keeps every landmark inside its yard, 8 m from its edges', () => {
    for (const r of YARDS) {
      const map = yardMap(4, r.i);
      for (const e of yardEntries(4, r.i)) {
        const p = map.placements[e.enter]!;
        expect(p.x0 >= 8 && p.z0 >= 8 && p.x1 <= map.size - 8 && p.z1 <= map.size - 8, `${r.name}: ${p.def} at (${p.x0}, ${p.z0})–(${p.x1}, ${p.z1})`).toBe(true);
      }
    }
  });

  it('lets the player climb each tower ladder to its deck', () => {
    for (const r of YARDS) {
      const map = yardMap(4, r.i);
      for (const e of yardEntries(4, r.i)) {
        const p = map.placements[e.enter]!;
        const det = detailOf(p);
        for (const l of det.ladders) {
          const state = createInitialState(1, 1);
          const pl = state.player;
          const cx = (l.x0 + l.x1) / 2;
          const cz = (l.z0 + l.z1) / 2;
          placePlayer(pl, map, cx - l.nx * 0.5, cz - l.nz * 0.5, 0);
          pl.pos[1] = supportAt(map, pl.pos[0], pl.pos[2], 0.5);
          pl.yaw = Math.atan2(-l.nx, -l.nz);
          pl.pitch = 0.6;
          let s = 0;
          for (; s < 200 / DT && pl.pos[1] < l.y1 - 0.03; s++) updatePlayer(pl, map, { ...emptyInputFrame(), moveZ: 1 }, DT);
          expect(pl.pos[1], `${p.def}: stuck on the ladder`).toBeGreaterThan(l.y1 - 0.1);
          for (let k = 0; k < 2 / DT; k++) updatePlayer(pl, map, { ...emptyInputFrame(), moveZ: 1 }, DT);
          // Stepped off onto the deck (not back down the ladder), and a firing position is up here.
          expect(pl.pos[1], `${p.def}: did not step onto the deck`).toBeGreaterThan(l.y1 - 0.5);
          expect(map.vantages.some((v) => Math.abs(v.pos[1] - l.y1) < 0.5 && v.pos[0] >= p.x0 && v.pos[0] <= p.x1 && v.pos[2] >= p.z0 && v.pos[2] <= p.z1), p.def).toBe(true);
        }
      }
    }
  });
});

// The real areas: every landmark whose cell's area file is there (each region adds its own data).
const grid = loadGrid();
const regions = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu'];
const have = regions.filter((r) => existsSync(new URL(`../public/data/areas/${r}/index.json`, import.meta.url)));
if (have.length) loadRealIndexes(grid);
afterAll(() => clearRealAreas());
const cells = [...new Set(LANDMARKS.map((s) => realToArea(s.lat, s.lon).cell))].filter((c) => existsSync(new URL(`../public/data/areas/${regions[grid.cells[c]?.region ?? -1] ?? 'none'}/${c}.bin`, import.meta.url)));

describe.skipIf(cells.length === 0)('the landmarks in the real areas (L1)', () => {
  it('stand near their real point, on their own ground, no other building in their lot', { timeout: 300_000 }, () => {
    for (const cell of cells) {
      const map = mapFor(grid, cell);
      for (const m of landmarksIn(cell)) {
        const p = map.placements.find((q) => q.def === m.spot.id);
        expect(p, `${m.spot.id} (cell ${cell}) was not placed`).toBeDefined();
        // L9: a bridge is laid along its line, not in a lot (tests/bridges.test.ts checks it).
        if (m.spot.bridge) continue;
        const cx = (p!.x0 + p!.x1) / 2;
        const cz = (p!.z0 + p!.z1) / 2;
        const anchor = m.spot.poi ? map.pois?.find((q) => q.name === m.spot.poi) ?? m : m;
        expect(Math.hypot(cx - anchor.x, cz - anchor.z), m.spot.id).toBeLessThanOrEqual(3 * (m.spot.reach ?? 48) * Math.SQRT2 + 1);
        for (const b of map.buildings) {
          if (b.id === p!.building) continue;
          const overlap = Math.min(b.x1, p!.x1) - Math.max(b.x0, p!.x0) > 0.5 && Math.min(b.z1, p!.z1) - Math.max(b.z0, p!.z0) > 0.5;
          expect(overlap, `${m.spot.id}: building ${b.id} in its lot`).toBe(false);
        }
      }
    }
  });
});

// L6: a place of remembrance (the Atomic Bomb Dome; `memorial` in the table). Its four rules: (1) no props
// of the fall, (2) no firing position or ladder, (3) no zombie placed within memorialClear of it (first
// lot and indoors), (4) nothing to search there.
describe('a place of remembrance (L6)', () => {
  const memorials = LANDMARKS.filter((s) => s.memorial);

  it('is marked in the table and on its building type, and only there', () => {
    expect(memorials.map((s) => s.id)).toContain('landmark.genbaku_dome');
    for (const d of landmarkDefs) expect(d.memorial === true, d.id).toBe(memorials.some((s) => s.id === d.id));
  });

  it('(1, 2) has no props of the fall, no ladder, no firing position', () => {
    for (const s of memorials) {
      const def = buildingDef(s.id);
      const bp = generateBlueprint(def, def.size.w[0], def.size.d[0], 7);
      expect(bp.ladders, s.id).toEqual([]);
      expect(bp.vantages ?? [], s.id).toEqual([]);
    }
    // The kit refuses them in a memorial blueprint (a mistake is caught by the catalog test).
    for (const add of ['car', 'tent', 'sandbags', 'crates', 'fallenSign', 'scorch', 'ladder', 'vantage'] as const) {
      const def = landmarkDef({ variant: `memorial_${add}`, size: { w: [20, 20], d: [20, 20] }, eaves: 4, top: 5, memorial: true, build(L) {
        L.box(0, 0, 0, 20, 4, 20, 'paint', { paint: 'white' });
        const call = L[add] as unknown as (...a: number[]) => void;
        call(5, 1, 5, 0, 1, 4);
      } });
      expect(() => generateBlueprint(def, 20, 20, 7), add).toThrow(/memorial/);
    }
    // Window panes are never broken in one.
    const def = landmarkDef({ variant: 'memorial_panes', size: { w: [20, 20], d: [20, 20] }, eaves: 4, top: 5, memorial: true, build(L) {
      L.box(0, 0, 0, 20, 4, 20, 'paint', { paint: 'white' });
      L.windows('x', 20, 1, 1, 19, 12, 1, 3, 1, { broken: 1 });
    } });
    expect(generateBlueprint(def, 20, 20, 7).parts.length).toBe(13);
  });

  const dome = LANDMARKS.find((s) => s.id === 'landmark.genbaku_dome')!;
  const domeCell = realToArea(dome.lat, dome.lon).cell;
  it.skipIf(!cells.includes(domeCell))('(2, 4) in Hiroshima: no firing position, search point or cache within memorialClear', { timeout: 120_000 }, () => {
    const map = mapFor(grid, domeCell);
    const p = map.placements.find((q) => q.def === dome.id)!;
    const near = (x: number, z: number): number => Math.hypot(Math.max(p.x0 - x, 0, x - p.x1), Math.max(p.z0 - z, 0, z - p.z1));
    const clear = BALANCE.world.memorialClear;
    expect(map.vantages.filter((v) => near(v.pos[0], v.pos[2]) < 0.01 && v.kind !== 'hill')).toEqual([]);
    expect(map.ladders.filter((l) => near((l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2) < 0.01)).toEqual([]);
    expect(map.lootSpots.filter((l) => near(l.pos[0], l.pos[1]) <= clear)).toEqual([]);
    expect(map.caches.filter((c) => near(c.pos[0], c.pos[1]) <= clear)).toEqual([]);
    const bd = map.buildings.find((b) => b.id === p.building)!;
    expect(bd.lootable).toBe(false);
  });

  it.skipIf(!cells.includes(domeCell))('(3) in Hiroshima: no zombie of the first lot or indoors placed within memorialClear', { timeout: 300_000 }, () => {
    mapFor(grid, domeCell); // loads the area files round it
    const state = gameState(grid, 12);
    beginAt(state, grid, domeCell);
    const sim = createSim({ grid });
    // The map the game made (the home cell's, with its base: the dome may stand elsewhere than in mapFor's).
    sim.tick(state, DT, emptyInputFrame());
    const p = mapOf(state)!.placements.find((q) => q.def === dome.id)!;
    expect(p).toBeDefined();
    const near = (x: number, z: number): number => Math.hypot(Math.max(p.x0 - x, 0, x - p.x1), Math.max(p.z0 - z, 0, z - p.z1));
    const first = new Map<number, [number, number]>();
    let indoor = 0;
    for (let i = 0; i < 400; i++) {
      if (i > 0) sim.tick(state, DT, emptyInputFrame());
      for (const z of state.tactical!.zombies) {
        if (first.has(z.id)) continue;
        first.set(z.id, [z.pos[0], z.pos[2]]);
        if (z.inside !== undefined) indoor++;
      }
      if (i > 4 && (state.tactical!.indoorLeft ?? 0) === 0) break;
    }
    expect(first.size).toBeGreaterThan(50);
    expect(indoor).toBeGreaterThan(0);
    // Where each stood when it first appeared (one step of a runner at most carried it a little in).
    for (const [id, [x, z]] of first) expect(near(x, z), `zombie ${id} at (${x.toFixed(1)}, ${z.toFixed(1)})`).toBeGreaterThan(BALANCE.world.memorialClear - 0.5);
  });
});

// L7: a firing position reached by steps, not a ladder: Kotohira-gū's lookout at the top of its stairway
// (two flights of 25 stone steps, 0.44 m each, through the great gate). Walk up from the stone torii.
describe('the stairway of Kotohira-gū (L7)', () => {
  it('climbs both flights from the foot to the lookout on the top terrace', () => {
    const region = LANDMARK_REGIONS.findIndex((r) => r.name === 'shikoku');
    const map = yardMap(4, region);
    const e = yardEntries(4, region).find((q) => q.def === 'landmark.kotohiragu')!;
    const p = map.placements[e.enter]!;
    // The stairway's middle (local x 26), 4 m in front of the first step (local z 89), facing up it.
    const [x, z] = toWorld(p, 26, 93);
    const [ux, uz] = toWorld(p, 26, 80);
    const state = createInitialState(1, 1);
    const pl = state.player;
    placePlayer(pl, map, x, z, 0);
    pl.pos[1] = supportAt(map, pl.pos[0], pl.pos[2], 0.5);
    pl.yaw = Math.atan2(-(ux - x), -(uz - z));
    const top = p.base + 22;
    for (let s = 0; s < 60 / DT && pl.pos[1] < top - 0.05; s++) updatePlayer(pl, map, { ...emptyInputFrame(), moveZ: 1 }, DT);
    expect(pl.pos[1], 'stuck on the stairway').toBeGreaterThan(top - 0.1);
    expect(map.vantages.some((v) => Math.abs(v.pos[1] - top) < 0.5 && v.pos[0] >= p.x0 && v.pos[0] <= p.x1 && v.pos[2] >= p.z0 && v.pos[2] <= p.z1)).toBe(true);
  });
});
