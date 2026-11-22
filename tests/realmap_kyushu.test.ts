// R8: the real map of Kyushu / Okinawa — every land cell of the region has an area, the land use is read for
// every first-level mesh (missing land use is written as beach on land, so beach counts too), the SDF sites
// are the real ones (training areas and the division / army HQ duplicates left out, Fukuoka, Kita-Kumamoto,
// Kengun and Naha large, the radar sites outside the town tiles added), the prefectural capitals carry their
// offices once, the Kengun compound is built, Okinawa is reached by the sea route, and the automatic
// inspection and the sight-line rules of the real areas hold in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LU, POI } from '../src/gen/real/format.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { findRoute } from '../src/sim/world/travel.ts';
import { checkCell, mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/kyushu/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const HAKATA = at(33.5897, 130.4207);
const KUMAMOTO_CASTLE = at(32.8063, 130.7058);
const KENGUN = at(32.791, 130.768);
const KAGOSHIMA = at(31.5838, 130.5414);
const NAHA = at(26.2061, 127.6466);
const SHIMONOSEKI = at(33.95, 130.9214);
const MOJI = at(33.9468, 130.9622);
const ASO = at(32.8844, 131.104);
const SAKURAJIMA = at(31.5806, 130.6589);
const SASEBO = at(33.1658, 129.7239);

describe.skipIf(!have)('Kyushu / Okinawa areas from the real data (R8)', () => {
  it('has every land cell of the region, the Kanmon Honshu side included', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 7);
    expect(Object.keys(index.cells).length).toBe(land.length);
    expect(index.cells[SHIMONOSEKI]).toBeDefined();
    expect(index.cells[MOJI]).toBeDefined();
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
    // The Kanmon strait between Hikoshima / Shimonoseki and Kokura is sea, the towns on both sides built up.
    const s = readRealArea(SHIMONOSEKI)!;
    expect(s.landuse.filter((c) => c === LU.sea).length).toBeGreaterThan(5000);
    expect(s.landuse.filter((c) => c === LU.building).length).toBeGreaterThan(3000);
    expect(s.pois.some((p) => p.kind === POI.station && p.name === '下関駅')).toBe(true);
  });

  it('builds the prefectural capitals with their stations and offices, once each', () => {
    const has = (cell: number, names: string[]): void => {
      const area = readRealArea(cell)!;
      for (const n of names) expect(area.pois.filter((p) => p.name === n).length, `${cell} ${n}`).toBe(1);
      expect(area.pois.some((p) => /県庁舎$/.test(p.name) || p.name === '県庁'), `${cell} duplicate office`).toBe(false);
    };
    has(HAKATA, ['博多駅', '福岡市役所', '福岡県庁', '福岡空港']);
    has(KUMAMOTO_CASTLE, ['熊本市役所']);
    has(KENGUN, ['熊本県庁']);
    has(KAGOSHIMA, ['鹿児島中央駅', '鹿児島市役所', '鹿児島県庁']);
    has(NAHA, ['那覇市役所', '沖縄県庁', '那覇空港']);
    has(at(32.7503, 129.8694), ['長崎駅', '長崎県庁']);
    has(at(33.2494, 130.2988), ['佐賀県庁']);
    has(at(33.2382, 131.6126), ['大分県庁']);
    has(at(31.9111, 131.4239), ['宮崎県庁']);
    expect(readRealArea(KUMAMOTO_CASTLE)!.pois.some((p) => p.name === '熊本市中央区役所')).toBe(false);
  });

  it('lists the real SDF sites (training areas and the HQ duplicates left out)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { police: number; fire: number; sdf: { kind: string; name: string }[] }> };
    const cells = Object.values(index.cells);
    const sdf = cells.flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部|総監部$/.test(n) && !/地方総監部/.test(n))).toBe(false);
    for (const n of ['福岡駐屯地', '小倉駐屯地', '北熊本駐屯地', '健軍駐屯地', '相浦駐屯地', '那覇駐屯地', '佐世保地方総監部', '大村航空基地', '鹿屋航空基地',
      '那覇航空基地', '沖縄基地隊', '築城基地', '新田原基地', '芦屋基地', '春日基地', '那覇基地', '脊振山分屯基地', '福江島分屯基地', '海栗島分屯基地', '下甑島分屯基地',
      '高畑山分屯基地', '沖永良部島分屯基地', '恩納分屯基地', 'えびの駐屯地', '奄美駐屯地']) {
      expect(names.some((m) => m.includes(n)), n).toBe(true);
    }
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name).sort()).toEqual(['陸上自衛隊健軍駐屯地', '陸上自衛隊北熊本駐屯地', '陸上自衛隊福岡駐屯地', '陸上自衛隊那覇駐屯地'].sort());
    expect(sdf.length).toBe(54);
    expect(cells.reduce((s, c) => s + c.police, 0)).toBeGreaterThan(140);
  });

  it('builds the Kengun garrison near its annotation', { timeout: 60_000 }, () => {
    const map = mapFor(grid, KENGUN);
    const poi = map.pois!.find((p) => p.kind === POI.gsdf && p.name.includes('健軍駐屯地'))!;
    expect(poi.building).toBeDefined();
    const b = map.buildings[poi.building!]!;
    expect(Math.hypot((b.x0 + b.x1) / 2 - poi.x, (b.z0 + b.z1) / 2 - poi.z)).toBeLessThan(170);
  });

  it('reaches Okinawa island over the sea route, between two real areas', () => {
    const route = findRoute(grid, HAKATA, NAHA)!;
    expect(route).not.toBeNull();
    const link = grid.seaLinks!.find((l) => l.name === '沖縄航路')!;
    expect(route.path).toContain(link.a);
    expect(route.path).toContain(link.b);
    expect(grid.cells[link.a]!.real?.area && grid.cells[link.b]!.real?.area).toBeTruthy();
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 300_000 }, () => {
    for (const cell of [HAKATA, SHIMONOSEKI, MOJI, ASO, SAKURAJIMA, SASEBO, NAHA]) {
      expect(checkCell(grid, 'kyushu', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
