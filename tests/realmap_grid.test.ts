// R9: the strategic map after the nationwide rebuild — designated cities are labelled at their city
// halls (R3), the label and the municipality of a cell are of the cell's own prefecture (R5: 尼崎市 on an
// 大阪府 cell), temporary stations never represent a cell (R7: 津島ノ宮), no sea crossing joins a cell
// to itself (R8: 関門橋) and no airport is listed twice (R8: 福岡空港（奈多地区）).
import { describe, expect, it } from 'vitest';
import { REAL_GRID } from '../src/data/realmap.ts';
import { loadGrid } from '../tools/real/lib/game.ts';

const grid = loadGrid();
const at = (lat: number, lon: number): number =>
  Math.floor(((grid.proj.latTop - lat) * grid.proj.kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - grid.proj.lon0) * grid.proj.kmPerLon) / grid.cellKm);
const placeCell = (name: string): number | undefined => grid.places.find((p) => p.name === name)?.cell;

describe('real strategic map (R9)', () => {
  it('labels the designated cities at their city halls', () => {
    const halls: [string, number, number][] = [
      ['横浜市', 35.4478, 139.6317],
      ['川崎市', 35.5308, 139.7029],
      ['さいたま市', 35.8617, 139.6455],
      ['名古屋市', 35.1815, 136.9066],
      ['大阪市', 34.6937, 135.5022],
      ['神戸市', 34.6901, 135.1955],
      ['福岡市', 33.5902, 130.4017],
      ['浜松市', 34.7108, 137.7261],
    ];
    for (const [name, lat, lon] of halls) expect(placeCell(name), name).toBe(at(lat, lon));
  });

  it('labels a cell with a municipality of its own prefecture', () => {
    // 尼崎市 moves to its most populated 兵庫県 cell (20110), where a bigger city's label may win.
    const amagasaki = placeCell('尼崎市');
    if (amagasaki !== undefined) expect(grid.prefNames[grid.cells[amagasaki]!.pref]).toBe('兵庫県');
    expect(grid.prefNames[grid.cells[20111]!.pref]).toBe('大阪府');
    expect(grid.places.find((p) => p.cell === 20111)?.name).not.toBe('尼崎市');
    expect(grid.prefNames[grid.cells[placeCell('下関市')!]!.pref]).toBe('山口県');
    // The cell's municipality too (a designated city's wards counted together): 21573 was 下関市,
    // 18646 大田区, 20111 尼崎市.
    expect(grid.cells[21573]!.real!.muni).toBe('北九州市');
    expect(grid.cells[18646]!.real!.muni).toBe('川崎市');
    expect(grid.cells[20111]!.real!.muni).toBe('大阪市');
  });

  it('never picks a temporary station for a cell', () => {
    for (const s of Object.values(grid.cells)) if (s?.real?.station) expect(REAL_GRID.temporaryStations).not.toContain(s.real.station.name);
    expect(grid.cells[21097]!.real!.station!.name).toBe('詫間');
  });

  it('has no sea crossing within one cell and no airport twice', () => {
    for (const l of grid.seaLinks ?? []) expect(l.a, l.name).not.toBe(l.b);
    const names = grid.landIds.flatMap((id) => (grid.cells[id]!.real?.airports ?? []).map((a) => a.name));
    expect(names.length).toBeGreaterThan(70);
    const base = names.map((n) => n.replace(/[（(].*[）)]$/, ''));
    expect(new Set(base).size).toBe(base.length);
    expect(names.some((n) => n.includes('奈多'))).toBe(false);
  });
});
