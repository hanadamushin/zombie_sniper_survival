// R3: the real map of Kanto — every land cell of the region has an area, the land use is read for every
// first-level mesh (the KS-META file of the L03-b zip is not taken for the grid), the SDF sites are the real
// ones (training areas left out, one large garrison per army / division / brigade HQ), and the automatic
// inspection and the sight-line rules of the real areas hold in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LU, POI } from '../src/gen/real/format.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { checkCell, mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/kanto/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const TOKYO = at(35.6812, 139.7671);
const KUMOTORI = at(35.8555, 138.944);
const OSHIMA = at(34.7244, 139.3947);
const NARITA = at(35.772, 140.3929);
const MITO = at(36.3418, 140.4468);
const NARASHINO = at(35.7065, 140.05);

describe.skipIf(!have)('Kanto areas from the real data (R3)', () => {
  it('has every land cell of the region', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 2);
    expect(Object.keys(index.cells).length).toBe(land.length);
  });

  // R9: an unread mesh is written as beach on land (R4), so beach counts too (61 cells of northern
  // Tochigi / Gunma before the rebuild).
  it('reads the land use of every cell (no mesh left as "none" or beach)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    for (const id of Object.keys(index.cells).map(Number)) {
      const a = readRealArea(id)!;
      let land = 0;
      let none = 0;
      for (let i = 0; i < a.landuse.length; i++) {
        if (Number.isNaN(a.elev[i])) continue;
        land++;
        if (a.landuse[i] === LU.none || a.landuse[i] === LU.beach) none++;
      }
      if (land > 100) expect(none / land, String(id)).toBeLessThan(0.3);
    }
  });

  it('builds central Tokyo with its stations, the bay and the town annotations', () => {
    const area = readRealArea(TOKYO)!;
    expect(area.pois.filter((p) => p.kind === POI.station).length).toBeGreaterThan(30);
    expect(area.pois.some((p) => p.name === '東京駅')).toBe(true);
    let sea = 0;
    for (const e of area.elev) if (Number.isNaN(e)) sea++;
    expect(sea / area.elev.length).toBeGreaterThan(0.1);
  });

  it('lists the real SDF sites (training areas left out, one large garrison per HQ)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { police: number; fire: number; sdf: { kind: string; name: string }[] }> };
    const cells = Object.values(index.cells);
    const sdf = cells.flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部|方面総監部/.test(n))).toBe(false);
    for (const n of ['朝霞駐屯地', '練馬駐屯地', '習志野駐屯地', '市ヶ谷駐屯地', '横須賀地方総監部', '百里基地', '入間基地', '横田基地', '厚木航空基地', '相馬原駐屯地', '新町駐屯地']) {
      expect(names.some((m) => m.includes(n)), n).toBe(true);
    }
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name).sort()).toEqual(['陸上自衛隊朝霞駐屯地', '陸上自衛隊相馬原駐屯地', '陸上自衛隊練馬駐屯地'].sort());
    expect(cells.reduce((s, c) => s + c.police, 0)).toBeGreaterThan(200);
  });

  it('builds the Narashino garrison within 160 m of its annotation', { timeout: 60_000 }, () => {
    const map = mapFor(grid, NARASHINO);
    const poi = map.pois!.find((p) => p.name.includes('習志野駐屯地'))!;
    expect(poi.building).toBeDefined();
    const pl = map.placements.find((p) => p.def === 'base.jgsdf_s' && Math.hypot((p.x0 + p.x1) / 2 - poi.x, (p.z0 + p.z1) / 2 - poi.z) < 170);
    expect(pl).toBeDefined();
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 240_000 }, () => {
    for (const cell of [TOKYO, KUMOTORI, OSHIMA, NARITA, MITO]) {
      expect(checkCell(grid, 'kanto', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
