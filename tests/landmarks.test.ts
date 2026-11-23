// L1: the landmarks (名所, docs/realmap_guide.md §7). The table (src/data/landmarks/) against the
// catalog and the names; the landmark yard (`?landmarks=1`) with the ladders up to the decks climbed;
// every landmark of the table standing in its real area (for the regions whose area data is there).
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { LANDMARKS, LANDMARK_GRID } from '../src/data/landmarks/index.ts';
import { BUILDING_DEFS, buildingDef, detailOf, hasBuildingDef } from '../src/gen/buildings/index.ts';
import { landmarksIn, realToArea } from '../src/gen/real/landmarks.ts';
import { GROUND } from '../src/gen/types.ts';
import { supportAt } from '../src/sim/tactical/collision.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';
import { yardEntries, yardMap } from '../src/sim/tactical/yard.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { ja } from '../src/ui/i18n/ja.ts';
import { mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes } from '../tools/real/lib/game.ts';

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

describe('the landmark yard (L1)', () => {
  const map = yardMap(4);
  it('stands every landmark type, with its ground', () => {
    const ids = yardEntries(4).map((e) => e.def);
    expect(ids.sort()).toEqual(landmarkDefs.map((d) => d.id).sort());
    // The moat of Goryōkaku and the Otaru canal are water.
    for (const id of ['landmark.goryokaku', 'landmark.otaru_canal']) {
      const p = map.placements.find((q) => q.def === id)!;
      let wet = 0;
      for (let ty = Math.floor(p.z0 / 4); ty < Math.ceil(p.z1 / 4); ty++) for (let tx = Math.floor(p.x0 / 4); tx < Math.ceil(p.x1 / 4); tx++) if (map.ground[ty * map.tiles + tx] === GROUND.water) wet++;
      expect(wet, id).toBeGreaterThan(50);
    }
  });

  // L4: in the catalog's order the rows of 57 landmarks ran past the map's south edge (Kunōzan and the
  // Fuji Sengen shrine stood at z 986–1070 of a 1024 m map) and nothing failed.
  it('keeps every landmark inside the map, 8 m from its edges', () => {
    for (const e of yardEntries(4)) {
      const p = map.placements[e.enter]!;
      expect(p.x0 >= 8 && p.z0 >= 8 && p.x1 <= map.size - 8 && p.z1 <= map.size - 8, `${p.def} at (${p.x0}, ${p.z0})–(${p.x1}, ${p.z1})`).toBe(true);
    }
  });

  it('lets the player climb each tower ladder to its deck', () => {
    for (const e of yardEntries(4)) {
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
