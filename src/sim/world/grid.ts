// Static map data: the compact file format of public/data/grid.json and its decoder, plus small
// geometry helpers. Pure (no fetch here — the app loads the JSON and calls parseGrid).

import type { CellId, Hub, Land, StaticCell, StaticGrid } from '../../core/types.ts';

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
  places: [string, number][];
}

export function parseGrid(file: GridFile): StaticGrid {
  const { w, h, cellKm, proj } = file;
  const cells: (StaticCell | null)[] = new Array<StaticCell | null>(w * h).fill(null);
  const landIds: CellId[] = [];
  let id = 0;
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
    places: file.places.map(([name, cell]) => ({ name, cell })),
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
