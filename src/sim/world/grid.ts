// Static map data: the compact file format of public/data/grid.json and its decoder, plus small
// geometry helpers. Pure (no fetch here — the app loads the JSON and calls parseGrid).

import type { CellFacts, CellId, Hub, Land, StaticCell, StaticGrid } from '../../core/types.ts';

export const LANDS: readonly Land[] = ['urban', 'suburb', 'rural', 'forest', 'mountain'];

/** On-disk shape (struct of arrays over land cells, ascending cell id). Written by tools/build-grid.ts. */
export interface GridFile {
  v: 1;
  w: number;
  h: number;
  cellKm: number;
  proj: StaticGrid['proj'];
  /** Land cell ids, delta-encoded (first value absolute). */
  ids: number[];
  pop: number[];
  /** One digit per land cell: index into LANDS. */
  land: string;
  /** One digit per land cell: 1 = touches the sea. */
  coast: string;
  /** Prefecture code per land cell (1..47). */
  pref: number[];
  prefNames: string[];
  regionNames: string[];
  /** Region index per prefecture code. */
  prefRegion: number[];
  hubs: { name: string; cell: number; intl?: string }[];
  links: [number, number][];
  /** Sea crossings (06): [name, cell a, cell b, minutes]. */
  sea?: [string, number, number, number][];
  places: [string, number][];
  // ---- R0 (real data, tools/real/grid.ts); absent in grids built before R0 ----
  /** Town grade (see StaticCell.real.town) per entry of `places`. */
  placeGrade?: number[];
  /** Mean elevation (m) and its standard deviation within the cell, per land cell. */
  elev?: number[];
  relief?: number[];
  /** Municipality per land cell: index into muniNames (-1: none). */
  muni?: number[];
  muniNames?: string[];
  /** One digit per land cell: grade of its municipality (0 none, 1 village, 2 town, 3 city, 4 prefectural capital, 5 designated city). */
  town?: string;
  /** 4 numbers per land cell: schools, hospitals, police stations, fire stations. */
  fac?: number[];
  /** Busiest station of a cell: [cell, name, grade 0..4, daily passengers]. */
  stations?: [number, string, number, number][];
  /** Airports: [cell, name, size 1..3]. */
  airports?: [number, string, number][];
}

export function parseGrid(file: GridFile): StaticGrid {
  const { w, h, cellKm, proj } = file;
  const cells: (StaticCell | null)[] = new Array<StaticCell | null>(w * h).fill(null);
  const landIds: CellId[] = [];
  let id = 0;
  const stations = new Map((file.stations ?? []).map(([cell, name, grade, pax]) => [cell, { name, grade, pax }]));
  const airports = new Map<number, { name: string; size: number }[]>();
  for (const [cell, name, size] of file.airports ?? []) {
    const list = airports.get(cell) ?? [];
    list.push({ name, size });
    airports.set(cell, list);
  }
  for (let i = 0; i < file.ids.length; i++) {
    id += file.ids[i]!;
    const gx = id % w;
    const gy = Math.floor(id / w);
    const pref = file.pref[i]!;
    cells[id] = {
      id,
      gx,
      gy,
      lat: proj.latTop - ((gy + 0.5) * cellKm) / proj.kmPerLat,
      lon: proj.lon0 + ((gx + 0.5) * cellKm) / proj.kmPerLon,
      pop0: file.pop[i]!,
      land: LANDS[Number(file.land[i])]!,
      coastal: file.coast[i] === '1',
      region: file.prefRegion[pref]!,
      pref,
    };
    if (file.elev) {
      const f = file.fac;
      const real: CellFacts = {
        elev: file.elev[i]!,
        relief: file.relief?.[i] ?? 0,
        muni: file.muniNames?.[file.muni?.[i] ?? -1] ?? '',
        town: Number(file.town?.[i] ?? 0),
        schools: f?.[i * 4] ?? 0,
        hospitals: f?.[i * 4 + 1] ?? 0,
        police: f?.[i * 4 + 2] ?? 0,
        fire: f?.[i * 4 + 3] ?? 0,
      };
      const st = stations.get(id);
      if (st) real.station = st;
      const ap = airports.get(id);
      if (ap) real.airports = ap;
      cells[id]!.real = real;
    }
    landIds.push(id);
  }
  const hubs: Hub[] = file.hubs.map((hub, i) => ({ id: i, name: hub.name, cell: hub.cell, intl: hub.intl ?? null, links: [] }));
  for (const [a, b] of file.links) {
    hubs[a]!.links.push(b);
    hubs[b]!.links.push(a);
  }
  for (const hub of hubs) {
    const cell = cells[hub.cell];
    if (cell) cell.hubId = hub.id;
  }
  return {
    gridW: w,
    gridH: h,
    cellKm,
    proj,
    cells,
    landIds,
    hubs,
    prefNames: file.prefNames,
    regionNames: file.regionNames,
    places: file.places.map(([name, cell], k) => (file.placeGrade ? { name, cell, grade: file.placeGrade[k]! } : { name, cell })),
    seaLinks: (file.sea ?? []).map(([name, a, b, minutes]) => ({ name, a, b, minutes })),
  };
}

/** Chebyshev distance in cells. */
export function cellDistance(grid: StaticGrid, a: CellId, b: CellId): number {
  const w = grid.gridW;
  return Math.max(Math.abs((a % w) - (b % w)), Math.abs(Math.floor(a / w) - Math.floor(b / w)));
}

/** Land cells within `radius` (Chebyshev) of `cell`, including the cell itself. */
export function cellsWithin(grid: StaticGrid, cell: CellId, radius: number): CellId[] {
  const { gridW: w, gridH: h } = grid;
  const cx = cell % w;
  const cy = Math.floor(cell / w);
  const out: CellId[] = [];
  for (let y = Math.max(0, cy - radius); y <= Math.min(h - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(w - 1, cx + radius); x++) {
      const id = y * w + x;
      if (grid.cells[id]) out.push(id);
    }
  }
  return out;
}
