// R5: the real map of Kinki — every land cell of the region has an area, the land use is read for every
// first-level mesh (missing land use is written as beach on land, so beach counts too), the SDF sites are
// the real ones (training areas and HQ duplicates left out, Itami and Senzo large, the radar sites and the
// Hanshin base looked up outside the town tiles), central Osaka / Kyoto / Kobe carry their stations and
// offices, the Hosono and Imazu compounds are built, and the automatic inspection and the sight-line rules
// of the real areas hold in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LU, POI } from '../src/gen/real/format.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { checkCell, mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/kinki/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const UMEDA = at(34.7025, 135.4959);
const OSAKA_CASTLE = at(34.6873, 135.5262);
const KYOTO = at(34.9858, 135.7588);
const KOBE = at(34.6901, 135.1955);
const OTSU = at(35.0045, 135.8686);
const HAKKYO = at(34.1767, 135.9075);
const MAIZURU = at(35.4748, 135.3714);
const AKASHI = at(34.6316, 135.0336);
const HOSONO = at(34.75, 135.79);
const IMAZU = at(35.406, 136.017);

describe.skipIf(!have)('Kinki areas from the real data (R5)', () => {
  it('has every land cell of the region', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 4);
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
    // Otsu: the town on the shore of Lake Biwa (lake water as water, not sea).
    const o = readRealArea(OTSU)!;
    expect(o.landuse.filter((c) => c === LU.building).length).toBeGreaterThan(2000);
    expect(o.landuse.filter((c) => c === LU.water).length).toBeGreaterThan(3000);
  });

  it('builds central Osaka, Kyoto and Kobe with their stations and offices', () => {
    const has = (cell: number, names: string[]): void => {
      const area = readRealArea(cell)!;
      for (const n of names) expect(area.pois.some((p) => p.name.includes(n)), `${cell} ${n}`).toBe(true);
    };
    expect(readRealArea(UMEDA)!.pois.filter((p) => p.kind === POI.station).length).toBeGreaterThan(20);
    has(OSAKA_CASTLE, ['大阪市役所', '大阪府庁', '天王寺駅', '難波駅', '大坂城跡']);
    has(KYOTO, ['京都駅', '京都市役所', '京都府庁']);
    has(KOBE, ['神戸市役所', '兵庫県庁']);
  });

  it('lists the real SDF sites (training areas and HQ duplicates left out)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { police: number; fire: number; sdf: { kind: string; name: string }[] }> };
    const cells = Object.values(index.cells);
    const sdf = cells.flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部|中部方面総監部/.test(n))).toBe(false);
    for (const n of ['伊丹駐屯地', '千僧駐屯地', '川西駐屯地', '信太山駐屯地', '桂駐屯地', '大久保駐屯地', '今津駐屯地', '姫路駐屯地', '舞鶴地方総監部', '阪神基地隊', '奈良基地', '経ヶ岬分屯基地', '串本分屯基地', '笠取山分屯基地']) {
      expect(names.some((m) => m.includes(n)), n).toBe(true);
    }
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name).sort()).toEqual(['陸上自衛隊伊丹駐屯地', '陸上自衛隊千僧駐屯地']);
    expect(sdf.length).toBe(26);
    expect(cells.reduce((s, c) => s + c.police, 0)).toBeGreaterThan(150);
  });

  it('builds the Hosono and Imazu garrisons near their annotations', { timeout: 60_000 }, () => {
    for (const [cell, name] of [[HOSONO, '祝園分屯地'], [IMAZU, '今津駐屯地']] as const) {
      const map = mapFor(grid, cell);
      const poi = map.pois!.find((p) => p.kind === POI.gsdf && p.name.includes(name))!;
      expect(poi.building, name).toBeDefined();
      const b = map.buildings[poi.building!]!;
      expect(Math.hypot((b.x0 + b.x1) / 2 - poi.x, (b.z0 + b.z1) / 2 - poi.z), name).toBeLessThan(170);
    }
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 240_000 }, () => {
    for (const cell of [UMEDA, KYOTO, HAKKYO, MAIZURU, AKASHI]) {
      expect(checkCell(grid, 'kinki', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
