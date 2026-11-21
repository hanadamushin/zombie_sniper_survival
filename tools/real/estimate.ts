// How many tiles a region build downloads (and the whole country), before downloading anything.
//   npm run data:region -- <region> --estimate      (prints the region and the national totals)
// Zoom-14 annotation tiles are only read over towns; without the land-use mesh at hand, the
// estimate counts the zoom-14 tiles of cells with more than 300 residents per km² in full and a
// fifth of the others (towns in sparse cells).
import type { StaticGrid } from '../../src/core/types.ts';
import { REAL_AREA } from '../../src/data/realmap.ts';
import { tilesFor } from './lib/tiles.ts';
import { REGIONS } from './lib/regions.ts';

function count(grid: StaticGrid, cells: number[]): { dem: number; z13: number; z14: number; l03b: number; areas: number } {
  const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
  const dem = new Set<string>();
  const z13 = new Set<string>();
  const z14 = new Set<string>();
  const meshes = new Set<number>();
  let z14Sparse = 0;
  for (const id of cells) {
    const c = grid.cells[id]!;
    const lonW = lon0 + (c.gx * 10) / kmPerLon;
    const lonE = lon0 + ((c.gx + 1) * 10) / kmPerLon;
    const latN = latTop - (c.gy * 10) / kmPerLat;
    const latS = latTop - ((c.gy + 1) * 10) / kmPerLat;
    for (const [x, y] of tilesFor(lonW, latS, lonE, latN, REAL_AREA.build.demZoom)) dem.add(`${x}/${y}`);
    for (const [x, y] of tilesFor(lonW, latS, lonE, latN, 13)) z13.add(`${x}/${y}`);
    const t14 = tilesFor(lonW, latS, lonE, latN, 14);
    if (c.pop0 / 100 >= 300) for (const [x, y] of t14) z14.add(`${x}/${y}`);
    else z14Sparse += t14.length / 5;
    for (const [la, lo] of [[latN, lonW], [latN, lonE], [latS, lonW], [latS, lonE]] as const) meshes.add(Math.floor(la * 1.5) * 100 + Math.floor(lo - 100));
  }
  return { dem: dem.size, z13: z13.size, z14: Math.round(z14.size + z14Sparse), l03b: meshes.size, areas: cells.length };
}

export function estimateTiles(grid: StaticGrid, cells: number[], region: string): void {
  const r = count(grid, cells);
  console.log(`[estimate] ${region}: ${r.areas} cells — DEM z${REAL_AREA.build.demZoom} ${r.dem}, vector z13 ${r.z13}, vector z14 ~${r.z14}, L03-b zips ${r.l03b} (~20 MB each); requests ~${r.dem + r.z13 + r.z14 + r.l03b}`);
  let total = 0;
  for (const key of REGIONS) {
    const ri = REGIONS.indexOf(key);
    const rc = count(grid, grid.landIds.filter((id) => grid.cells[id]!.region === ri));
    const sum = rc.dem + rc.z13 + rc.z14 + rc.l03b;
    total += sum;
    console.log(`[estimate]   ${key.padEnd(9)} ${String(rc.areas).padStart(4)} cells  DEM ${String(rc.dem).padStart(5)}  z13 ${String(rc.z13).padStart(6)}  z14 ~${String(rc.z14).padStart(6)}  L03-b ${String(rc.l03b).padStart(3)}  = ${sum}`);
  }
  console.log(`[estimate] whole country: ~${total} requests (limit 100,000)`);
}
