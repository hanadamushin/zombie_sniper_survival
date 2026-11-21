// Prints the strategic-map facts of the cells of some real places (R0 acceptance check).
//   node tools/real/cities-check.ts
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
const PLACES: [string, number, number][] = [
  ['札幌駅', 43.0687, 141.3508], ['仙台駅', 38.2601, 140.8822], ['東京駅', 35.6812, 139.7671], ['新宿駅', 35.6896, 139.7006],
  ['名古屋駅', 35.1709, 136.8815], ['大阪駅', 34.7025, 135.4959], ['広島駅', 34.3976, 132.4752], ['博多駅', 33.5897, 130.4207],
  ['松山市駅', 33.8357, 132.7638], ['高松駅', 34.3507, 134.0467], ['高知駅', 33.5671, 133.5436], ['徳島駅', 34.0740, 134.5514],
  ['那覇空港', 26.2063, 127.6466], ['新千歳空港', 42.7752, 141.6923],
];
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
for (const [name, lat, lon] of PLACES) {
  const id = Math.floor(((latTop - lat) * kmPerLat) / 10) * grid.gridW + Math.floor(((lon - lon0) * kmPerLon) / 10);
  const c = grid.cells[id];
  if (!c) {
    console.log(`${name}: cell ${id} is sea`);
    continue;
  }
  const r = c.real;
  const place = grid.places.find((p) => p.cell === id);
  const hub = c.hubId !== undefined ? grid.hubs[c.hubId]!.name : '-';
  console.log(`${name}: cell ${id} ${grid.prefNames[c.pref]} ${r?.muni ?? ''} town=${r?.town} pop0=${c.pop0} land=${c.land} elev=${r?.elev}m label=${place?.name ?? '-'} station=${r?.station ? `${r.station.name}(${r.station.grade}, ${r.station.pax})` : '-'} airports=${r?.airports?.map((a) => `${a.name}/${a.size}`).join(',') ?? '-'} hub=${hub} schools=${r?.schools} hospitals=${r?.hospitals}`);
}
