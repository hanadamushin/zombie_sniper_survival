// R4: the real map of Chubu — every land cell of the region has an area, the land use is read for every
// first-level mesh (also the zips whose entries sit in a backslash folder: the converter writes missing
// land use on land as beach, so "none" alone does not show it), the SDF sites are the real ones (training
// areas left out, one large garrison for the 10th Division), Moriyama's compound is built, and the
// automatic inspection and the sight-line rules of the real areas hold in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LU, POI } from '../src/gen/real/format.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { checkCell, mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/chubu/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const NAGOYA = at(35.1709, 136.8815);
const MORIYAMA = at(35.2051, 136.9693);
const NIIGATA = at(37.9122, 139.0618);
const SHIBATA = at(37.9556, 139.3243);
const FUJI = at(35.3606, 138.7274);
const YARI = at(36.342, 137.6476);
const RYOTSU = at(38.082, 138.437);

describe.skipIf(!have)('Chubu areas from the real data (R4)', () => {
  it('has every land cell of the region', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 3);
    expect(Object.keys(index.cells).length).toBe(land.length);
  });

  it('reads the land use of every cell (no mesh left without data, written as beach)', () => {
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
    // Shibata (a backslash-folder zip, mesh 5639): a town, paddies around it.
    const s = readRealArea(SHIBATA)!;
    expect(s.landuse.filter((c) => c === LU.building).length).toBeGreaterThan(500);
    expect(s.landuse.filter((c) => c === LU.paddy).length).toBeGreaterThan(2000);
  });

  it('builds central Nagoya with its stations, the castle and the offices', () => {
    const area = readRealArea(NAGOYA)!;
    expect(area.pois.filter((p) => p.kind === POI.station).length).toBeGreaterThan(30);
    for (const n of ['名古屋駅', '名古屋城跡', '名古屋市役所', '県庁']) expect(area.pois.some((p) => p.name.includes(n)), n).toBe(true);
  });

  it('lists the real SDF sites (training areas left out, one large garrison for the division HQ)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { police: number; fire: number; sdf: { kind: string; name: string }[] }> };
    const cells = Object.values(index.cells);
    const sdf = cells.flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部|総監部/.test(n))).toBe(false);
    for (const n of ['守山駐屯地', '富士駐屯地', '新発田駐屯地', '高田駐屯地', '松本駐屯地', '金沢駐屯地', '小松基地', '浜松基地', '岐阜基地', '佐渡分屯基地', '御前崎分屯基地']) {
      expect(names.some((m) => m.includes(n)), n).toBe(true);
    }
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name)).toEqual(['陸上自衛隊守山駐屯地']);
    expect(cells.reduce((s, c) => s + c.police, 0)).toBeGreaterThan(150);
  });

  it('builds the Moriyama garrison within 160 m of its annotation', { timeout: 60_000 }, () => {
    const map = mapFor(grid, MORIYAMA);
    const poi = map.pois!.find((p) => p.name.includes('守山駐屯地'))!;
    expect(poi.building).toBeDefined();
    const pl = map.placements.find((p) => p.def === 'base.jgsdf_s' && Math.hypot((p.x0 + p.x1) / 2 - poi.x, (p.z0 + p.z1) / 2 - poi.z) < 170);
    expect(pl).toBeDefined();
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 240_000 }, () => {
    for (const cell of [NAGOYA, NIIGATA, FUJI, YARI, RYOTSU]) {
      expect(checkCell(grid, 'chubu', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
