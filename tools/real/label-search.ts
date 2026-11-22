// Find GSI z14 annotations by name around a point (R1 / R3 method, as a tool): the SDF sites outside the
// "town tiles" the converter reads, and sites annotated under other names.
//   node tools/real/label-search.ts <lat> <lon> <radius km> <regex> [--ctg]
// Prints name, annotation category, lat / lon and the cell with its area-local position (game metres).
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';
import { fetchCached, mapLimit } from './lib/fetch.ts';
import { decodeMvt } from './lib/mvt.ts';
import { tilesFor, xToLon, yToLat } from './lib/tiles.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
const [lat, lon, rKm] = process.argv.slice(2, 5).map(Number) as [number, number, number];
const re = new RegExp(process.argv[5] ?? '自衛隊');
const showCtg = process.argv.includes('--ctg');
const dLat = rKm / 111;
const dLon = rKm / (111 * Math.cos((lat * Math.PI) / 180));
const Z = 14;
const tiles = tilesFor(lon - dLon, lat - dLat, lon + dLon, lat + dLat, Z);
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
const seen = new Set<string>();
await mapLimit(tiles, async ([tx, ty]) => {
  const key = `${Z}/${tx}/${ty}`;
  const buf = await fetchCached(`https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/${key}.pbf`, `gsi/bvmap/${key}.pbf`);
  if (!buf) return;
  for (const l of decodeMvt(buf)) {
    if (l.name !== 'label') continue;
    for (const f of l.features) {
      const name = String(f.props.knj ?? '');
      if (!re.test(name) || !f.geom[0]?.[0]) continue;
      const [px, py] = f.geom[0][0];
      const la = yToLat(ty + py / l.extent, Z);
      const lo = xToLon(tx + px / l.extent, Z);
      const fy = ((latTop - la) * kmPerLat) / 10;
      const fx = ((lo - lon0) * kmPerLon) / 10;
      const id = Math.floor(fy) * grid.gridW + Math.floor(fx);
      const x = Math.round((fx - Math.floor(fx)) * 1024);
      const z = Math.round((fy - Math.floor(fy)) * 1024);
      const line = `${name}${showCtg ? ` [${String(f.props.annoCtg)}]` : ''}: ${la.toFixed(4)}, ${lo.toFixed(4)} -> cell ${id} (${x}, ${z})${grid.cells[id] ? '' : ' sea'}`;
      if (!seen.has(line)) {
        seen.add(line);
        console.log(line);
      }
    }
  }
});
