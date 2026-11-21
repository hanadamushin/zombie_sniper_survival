// R1: the real map of Hokkaido — the landmarks stand in Sapporo and Hakodate with a firing position
// on their roofs, railway tunnels (the Seikan approach, the Sapporo subway) are not built as track,
// the dense centre of Sapporo keeps blocks between its streets, the SDF sites are the real ones, and
// the sight-line rules of the real areas hold in sample cells.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LINE, LINE_TUNNEL } from '../src/gen/real/format.ts';
import { heightAt } from '../src/sim/tactical/collision.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { checkCell, mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from '../tools/real/lib/game.ts';
import { sightCell } from '../tools/real/sightlines.ts';

const grid = loadGrid();
const INDEX = new URL('../public/data/areas/hokkaido/index.json', import.meta.url);
const have = existsSync(INDEX);
if (have) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const SAPPORO = at(43.0606, 141.3545);
const HAKODATE = at(41.7942, 140.7538);
const SEIKAN = at(41.576, 140.356);

describe.skipIf(!have)('Hokkaido areas from the real data (R1)', () => {
  it('has every land cell of the region', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, unknown> };
    const land = grid.landIds.filter((id) => grid.cells[id]!.region === 0);
    expect(Object.keys(index.cells).length).toBe(land.length);
  });

  it('stands the TV tower in Sapporo and Goryōkaku Tower in Hakodate, their roofs firing positions', { timeout: 60_000 }, () => {
    for (const [cell, def] of [[SAPPORO, 'landmark.sapporo_tv_tower'], [HAKODATE, 'landmark.goryokaku_tower']] as const) {
      const map = mapFor(grid, cell);
      const pl = map.placements.find((p) => p.def === def);
      expect(pl, def).toBeDefined();
      const v = map.vantages.find((q) => q.pos[0] >= pl!.x0 && q.pos[0] <= pl!.x1 && q.pos[2] >= pl!.z0 && q.pos[2] <= pl!.z1);
      expect(v, def).toBeDefined();
      expect(v!.pos[1] - heightAt(map, v!.pos[0], v!.pos[2])).toBeGreaterThan(80);
    }
  });

  it('does not build railway tunnels: the Seikan approach is open only at Yunosato, the Sapporo subway underground', () => {
    const seikan = readRealArea(SEIKAN)!;
    const rails = seikan.lines.filter((l) => l.kind === LINE.rail);
    const len = (pts: Float32Array): number => {
      let s = 0;
      for (let i = 2; i < pts.length; i += 2) s += Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
      return s;
    };
    const open = rails.filter((l) => !(l.flags & LINE_TUNNEL)).reduce((s, l) => s + len(l.pts), 0);
    const tunnel = rails.filter((l) => l.flags & LINE_TUNNEL).reduce((s, l) => s + len(l.pts), 0);
    expect(tunnel).toBeGreaterThan(open * 3);
    const sapporo = readRealArea(SAPPORO)!;
    expect(sapporo.lines.some((l) => l.kind === LINE.rail && l.flags & LINE_TUNNEL)).toBe(true);
  });

  it('keeps blocks between the streets of central Sapporo (no municipal wide-street grid)', { timeout: 60_000 }, () => {
    const area = readRealArea(SAPPORO)!;
    expect(area.lines.filter((l) => l.kind === LINE.wide).length).toBeLessThan(20);
    expect(mapFor(grid, SAPPORO).buildings.length).toBeGreaterThan(450);
  });

  it('lists the real SDF sites (training areas left out, one large garrison per HQ)', () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { cells: Record<string, { sdf: { kind: string; name: string }[] }> };
    const sdf = Object.values(index.cells).flatMap((c) => c.sdf);
    const names = sdf.map((s) => s.name);
    expect(names.some((n) => /演習場|司令部|総監部/.test(n))).toBe(false);
    for (const n of ['札幌駐屯地', '真駒内駐屯地', '東千歳駐屯地', '北千歳駐屯地', '旭川駐屯地', '千歳基地', '函館基地隊']) expect(names.some((m) => m.includes(n)), n).toBe(true);
    expect(sdf.filter((s) => s.kind === 'gsdf_l').map((s) => s.name).sort()).toEqual(['陸上自衛隊旭川駐屯地', '陸上自衛隊札幌駐屯地', '陸上自衛隊帯広駐屯地', '陸上自衛隊東千歳駐屯地', '陸上自衛隊真駒内駐屯地'].sort());
  });

  it('passes the automatic inspection and the sight-line rules in sample cells', { timeout: 180_000 }, () => {
    for (const cell of [SAPPORO, HAKODATE, SEIKAN, at(43.6636, 142.8542), at(44.123, 145.085)]) {
      expect(checkCell(grid, 'hokkaido', cell).problems, String(cell)).toEqual([]);
      expect(sightCell(grid, cell).problems, String(cell)).toEqual([]);
    }
  });
});
