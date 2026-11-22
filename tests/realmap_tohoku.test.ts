// R2: the real map of Tohoku — every land cell of the region has an area, the SDF sites are the real
// ones (training areas left out, one large garrison per division / army HQ), the dense centre of Sendai
// keeps blocks between its streets, the Seikan approach on the Honshu side is mostly tunnel, and the
// automatic inspection and the sight-line rules of the real areas hold in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LINE, LINE_TUNNEL } from '../src/gen/real/format.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { checkCell, mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/tohoku/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const SENDAI = at(38.2601, 140.8822);
const SEIKAN = at(41.1447, 140.5156);
const MIYAKO = at(39.6505, 141.98);
const ZAO = at(38.1436, 140.44);
const MORIOKA = at(39.7036, 141.1527);

describe.skipIf(!have)('Tohoku areas from the real data (R2)', () => {
  it('has every land cell of the region', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 1);
    expect(Object.keys(index.cells).length).toBe(land.length);
  });

  it('keeps blocks between the streets of central Sendai (no municipal wide-street grid)', { timeout: 60_000 }, () => {
    const area = readRealArea(SENDAI)!;
    expect(area.lines.filter((l) => l.kind === LINE.wide).length).toBeLessThan(25);
    expect(mapFor(grid, SENDAI).buildings.length).toBeGreaterThan(400);
  });

  it('builds the Seikan approach on the Honshu side mostly as tunnel (not track over the hills)', () => {
    const rails = readRealArea(SEIKAN)!.lines.filter((l) => l.kind === LINE.rail);
    const len = (pts: Float32Array): number => {
      let s = 0;
      for (let i = 2; i < pts.length; i += 2) s += Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
      return s;
    };
    expect(rails.filter((l) => l.flags & LINE_TUNNEL).reduce((s, l) => s + len(l.pts), 0)).toBeGreaterThan(300);
  });

  it('lists the real SDF sites (training areas left out, one large garrison per HQ)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { sdf: { kind: string; name: string }[] }> };
    const sdf = Object.values(index.cells).flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部|総監部/.test(n))).toBe(false);
    for (const n of ['仙台駐屯地', '霞目駐屯地', '青森駐屯地', '神町駐屯地', '大湊', '三沢基地', '松島基地', '八戸']) expect(names.some((m) => m.includes(n)), n).toBe(true);
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name).sort()).toEqual(['陸上自衛隊仙台駐屯地', '陸上自衛隊神町駐屯地', '陸上自衛隊青森駐屯地'].sort());
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 240_000 }, () => {
    for (const cell of [SENDAI, SEIKAN, MIYAKO, ZAO, MORIOKA]) {
      expect(checkCell(grid, 'tohoku', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
