// R7: the real map of Shikoku — every land cell of the region has an area, the land use is read for every
// first-level mesh (missing land use is written as beach on land, so beach counts too), the SDF sites are
// the real ones (the 14th Brigade HQ duplicate left out, Zentsuji large, the MSDF air stations of
// Komatsushima and Tokushima added), the four prefectural capitals carry their offices once, and the
// automatic inspection and the sight-line rules of the real areas hold in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LU } from '../src/gen/real/format.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { checkCell } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/shikoku/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const MATSUYAMA = at(33.8395, 132.7657);
const TAKAMATSU = at(34.3505, 134.0467);
const KOCHI = at(33.5597, 133.5311);
const TOKUSHIMA = at(34.0703, 134.5548);
const ISHIZUCHI = at(33.7675, 133.1153);
const IMABARI = at(34.0855, 132.997);
const ZENTSUJI = at(34.227, 133.787);

describe.skipIf(!have)('Shikoku areas from the real data (R7)', () => {
  it('has every land cell of the region', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 6);
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
  });

  it('builds the prefectural capitals with their stations and offices, once each', () => {
    const has = (cell: number, names: string[]): void => {
      const area = readRealArea(cell)!;
      for (const n of names) expect(area.pois.filter((p) => p.name === n).length, `${cell} ${n}`).toBe(1);
      expect(area.pois.some((p) => /県庁舎$/.test(p.name) || p.name === '県庁'), `${cell} duplicate office`).toBe(false);
    };
    has(MATSUYAMA, ['松山市駅', '松山市役所', '愛媛県庁']);
    has(TAKAMATSU, ['高松駅', '高松市役所', '香川県庁']);
    has(KOCHI, ['高知駅', '高知市役所', '高知県庁']);
    has(TOKUSHIMA, ['徳島駅', '徳島市役所', '徳島県庁']);
  });

  it('lists the real SDF sites (the brigade HQ duplicate left out, the MSDF air stations added)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { police: number; fire: number; sdf: { kind: string; name: string }[] }> };
    const cells = Object.values(index.cells);
    const sdf = cells.flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部/.test(n))).toBe(false);
    for (const n of ['善通寺駐屯地', '徳島駐屯地', '松山駐屯地', '高知駐屯地', '小松島航空基地', '徳島航空基地']) expect(names.some((m) => m.includes(n)), n).toBe(true);
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name)).toEqual(['陸上自衛隊善通寺駐屯地']);
    expect(sdf.length).toBe(6);
    expect(index.cells[String(ZENTSUJI)]!.sdf.length).toBe(1);
    expect(cells.reduce((s, c) => s + c.police, 0)).toBeGreaterThan(45);
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 240_000 }, () => {
    for (const cell of [MATSUYAMA, TAKAMATSU, ISHIZUCHI, IMABARI, ZENTSUJI]) {
      expect(checkCell(grid, 'shikoku', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
