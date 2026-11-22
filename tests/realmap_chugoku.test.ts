// R6: the real map of Chugoku — every land cell of the region has an area, the land use is read for every
// first-level mesh (missing land use is written as beach on land, so beach counts too), the SDF sites are
// the real ones (training areas and the brigade HQ duplicate left out, Kaitaichi large, the Takaosan radar
// site and the Etajima school added), the five prefectural capitals carry their offices once, the
// Nihonbara compound is built, and the automatic inspection and the sight-line rules of the real areas hold
// in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LU, POI } from '../src/gen/real/format.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { checkCell, mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/chugoku/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const HIROSHIMA = at(34.3955, 132.4536);
const OKAYAMA = at(34.6661, 133.9177);
const MATSUE = at(35.4723, 133.0505);
const TOTTORI = at(35.5036, 134.2377);
const YAMAGUCHI = at(34.1859, 131.4714);
const DAISEN = at(35.371, 133.546);
const KURE = at(34.24, 132.555);
const SETO = at(34.4385, 133.807);
const NIHONBARA = at(35.08, 134.07);

describe.skipIf(!have)('Chugoku areas from the real data (R6)', () => {
  it('has every land cell of the region', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 5);
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
    // Matsue: the town on Lake Shinji (lake water as water, not sea).
    const m = readRealArea(MATSUE)!;
    expect(m.landuse.filter((c) => c === LU.building).length).toBeGreaterThan(1000);
    expect(m.landuse.filter((c) => c === LU.water).length).toBeGreaterThan(5000);
  });

  it('builds the prefectural capitals with their stations and offices, once each', () => {
    const has = (cell: number, names: string[]): void => {
      const area = readRealArea(cell)!;
      for (const n of names) expect(area.pois.filter((p) => p.name === n).length, `${cell} ${n}`).toBe(1);
      expect(area.pois.some((p) => /県庁舎$/.test(p.name) || p.name === '県庁'), `${cell} duplicate office`).toBe(false);
    };
    has(HIROSHIMA, ['広島駅', '広島市役所', '広島県庁']);
    has(OKAYAMA, ['岡山駅', '岡山市役所', '岡山県庁']);
    has(MATSUE, ['島根県庁']);
    has(TOTTORI, ['鳥取県庁']);
    has(YAMAGUCHI, ['山口県庁']);
    expect(readRealArea(HIROSHIMA)!.pois.some((p) => p.name === '広島市中区役所')).toBe(false);
  });

  it('lists the real SDF sites (training areas and the HQ duplicate left out)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { police: number; fire: number; sdf: { kind: string; name: string }[] }> };
    const cells = Object.values(index.cells);
    const sdf = cells.flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部/.test(n))).toBe(false);
    for (const n of ['海田市駐屯地', '出雲駐屯地', '米子駐屯地', '日本原駐屯地', '三軒屋駐屯地', '山口駐屯地', '呉地方総監部', '第1術科学校', '岩国航空基地', '小月航空基地', '下関基地隊', '美保基地', '防府北基地', '防府南基地', '高尾山分屯基地']) {
      expect(names.some((m) => m.includes(n)), n).toBe(true);
    }
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name)).toEqual(['陸上自衛隊海田市駐屯地']);
    expect(sdf.length).toBe(15);
    expect(cells.reduce((s, c) => s + c.police, 0)).toBeGreaterThan(70);
  });

  it('builds the Nihonbara garrison near its annotation', { timeout: 60_000 }, () => {
    const map = mapFor(grid, NIHONBARA);
    const poi = map.pois!.find((p) => p.kind === POI.gsdf && p.name.includes('日本原駐屯地'))!;
    expect(poi.building).toBeDefined();
    const b = map.buildings[poi.building!]!;
    expect(Math.hypot((b.x0 + b.x1) / 2 - poi.x, (b.z0 + b.z1) / 2 - poi.z)).toBeLessThan(170);
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 240_000 }, () => {
    for (const cell of [HIROSHIMA, OKAYAMA, DAISEN, KURE, SETO]) {
      expect(checkCell(grid, 'chugoku', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
