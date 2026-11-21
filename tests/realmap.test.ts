// R0: the real map — the area file format, the height compression, and the areas made from the
// bundled Shikoku data: neighbouring cells meet (ground, water, roads), the ground stays walkable,
// there are firing positions, the home clearing is free, and cells without data stay random.
import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { REAL_AREA, REAL_CHECK } from '../src/data/realmap.ts';
import { decodeRealArea, ELEV_N, encodeRealArea, LINE, LU, LU_N, POI, POP_N, DUR_N, type RealArea } from '../src/gen/real/format.ts';
import { compressHeight } from '../src/gen/real/layout.ts';
import { areaParams, ensureArea } from '../src/sim/tactical/area.ts';
import { clearRealAreas, hasRealData, realPending } from '../src/sim/world/realAreas.ts';
import { checkCell, mapFor, overlaps, seam, walkStats } from '../tools/real/check.ts';
import { gameState, loadGrid, loadRealIndexes } from '../tools/real/lib/game.ts';

const grid = loadGrid();
const haveShikoku = existsSync(new URL('../public/data/areas/shikoku/index.json', import.meta.url));
if (haveShikoku) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

/** Cells of the real Shikoku data used below (Matsuyama, Takamatsu, Kochi, Tokushima, mountains, coast). */
const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const MATSUYAMA = at(33.8395, 132.7657);
const KOCHI = at(33.5597, 133.5311);
const SHIKOKU_MOUNTAINS = at(33.77, 133.25); // 石鎚山 の東

describe('area file format (R0)', () => {
  it('round-trips elevations (0.5 m), the sea, land use, lines and points', () => {
    const elev = new Float32Array(ELEV_N * ELEV_N);
    for (let i = 0; i < elev.length; i++) elev[i] = i % 97 === 0 ? NaN : Math.round(Math.sin(i * 0.01) * 400 * 2) / 2;
    const landuse = new Uint8Array(LU_N * LU_N).map((_, i) => (i % 13 < 6 ? LU.forest : LU.building));
    const area: RealArea = {
      cell: 12345, heightMul: 1.2, elev, landuse, durable: new Uint8Array(DUR_N * DUR_N).fill(3), pop: new Uint16Array(POP_N * POP_N).fill(4321),
      lines: [{ kind: LINE.national, flags: 2, width: 11, pts: Float32Array.from([0, 10.5, 100, 200.5, 1024, 512]) }],
      pois: [{ kind: POI.station, grade: 3, x: 512.5, z: 100, name: '松山駅' }],
    };
    const back = decodeRealArea(encodeRealArea(area));
    expect(back.cell).toBe(12345);
    expect(back.heightMul).toBeCloseTo(1.2);
    for (let i = 0; i < elev.length; i++) {
      if (Number.isNaN(elev[i]!)) expect(back.elev[i]).toBeNaN();
      else expect(back.elev[i]! + 0).toBe(elev[i]! + 0); // -0 comes back as 0
    }
    expect([...back.landuse]).toEqual([...landuse]);
    expect(back.pop[7]).toBe(4321);
    expect([...back.lines[0]!.pts]).toEqual([0, 10.5, 100, 200.5, 1024, 512]);
    expect(back.lines[0]!.width).toBe(11);
    expect(back.pois[0]).toEqual({ kind: POI.station, grade: 3, x: 512.5, z: 100, name: '松山駅' });
  });

  it('compresses heights more in the mountains, monotonically, sea at 0', () => {
    expect(compressHeight(0)).toBe(0);
    let prev = -1;
    for (let e = 0; e <= 3000; e += 50) {
      const h = compressHeight(e);
      expect(h).toBeGreaterThan(prev);
      prev = h;
    }
    const lowSlope = compressHeight(50) / 50;
    const highSlope = (compressHeight(2000) - compressHeight(1900)) / 100;
    expect(lowSlope).toBeGreaterThan(highSlope * 2);
    expect(compressHeight(1982)).toBeLessThan(220); // 石鎚山 stays a hill of a couple of hundred metres
    expect(compressHeight(100, 2)).toBeCloseTo(compressHeight(100) * 2);
    void REAL_AREA;
  });
});

describe.skipIf(!haveShikoku)('Shikoku areas from the real data (R0)', () => {
  it('knows which cells have data; cells elsewhere stay random', () => {
    expect(hasRealData(MATSUYAMA)).toBe(true);
    expect(grid.cells[MATSUYAMA]!.real?.area).toBe('shikoku');
    const tokyo = at(35.6812, 139.7671);
    expect(hasRealData(tokyo)).toBe(false);
    const state = gameState(grid);
    expect(areaParams(state, grid, tokyo)!.real).toBeUndefined();
  });

  it('waits for the data before making the area of a real cell', () => {
    clearRealAreas();
    loadRealIndexes(grid);
    const state = gameState(grid, 5);
    state.player.cell = KOCHI;
    state.world.homeCell = KOCHI;
    state.tactical = null;
    expect(realPending(KOCHI)).toBe(true);
    expect(ensureArea(state, grid)).toBeNull(); // nothing random in the meantime
    const map = mapFor(grid, KOCHI); // loads the files around Kochi
    expect(map.params.real).toBeTruthy();
    expect(ensureArea(state, grid)?.map.params.real).toBeTruthy();
  });

  it('Matsuyama: a town on the plain with its castle hill, rivers, main roads, rail and facilities', { timeout: 60_000 }, () => {
    const map = mapFor(grid, MATSUYAMA);
    expect(map.params.real).toBeTruthy();
    expect(map.buildings.length).toBeGreaterThan(300);
    expect(map.roads.some((r) => r.kind === 'track')).toBe(true); // JR / Iyotetsu
    expect(map.roads.filter((r) => r.width >= 10).length).toBeGreaterThan(5);
    expect(map.pois!.some((p) => p.kind === POI.station && p.name.includes('松山'))).toBe(true);
    expect(map.pois!.some((p) => p.kind === POI.prefOffice || /県庁/.test(p.name))).toBe(true);
    const { walkable, water } = walkStats(map);
    expect(walkable).toBeGreaterThan(REAL_CHECK.walkable);
    expect(water).toBeGreaterThan(0.005); // 石手川・重信川
    expect(water).toBeLessThan(0.2);
    expect(overlaps(map)).toBe(0);
  });

  it('neighbouring real cells meet: ground, water and roads along the shared edge', { timeout: 120_000 }, () => {
    let pairs = 0;
    for (const cell of [MATSUYAMA, KOCHI, SHIKOKU_MOUNTAINS, MATSUYAMA - 1, KOCHI - grid.gridW]) {
      const a = mapFor(grid, cell);
      for (const [n, east] of [[cell + 1, true], [cell + grid.gridW, false]] as const) {
        if (!grid.cells[n]?.real?.area) continue;
        const s = seam(a, mapFor(grid, n), east);
        expect(s.height, `${cell}->${n}`).toBeLessThan(REAL_CHECK.seamHeight);
        expect(s.water, `${cell}->${n} water`).toBe(0);
        expect(s.roads, `${cell}->${n} roads`).toBe(0);
        pairs++;
      }
    }
    expect(pairs).toBeGreaterThanOrEqual(6);
  });

  it('every checked cell is walkable, has firing positions and a free home clearing', { timeout: 180_000 }, () => {
    for (const cell of [MATSUYAMA, KOCHI, SHIKOKU_MOUNTAINS]) {
      const r = checkCell(grid, 'shikoku', cell);
      expect(r.problems, `${cell} ${r.land}`).toEqual([]);
    }
  });
});
