// R4 (Chubu): the check sites -> cell id and area-local position (game metres).
//   node tools/real/chubu-sites.ts [lat lon ...]
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
export const CHUBU_SITES: [string, number, number][] = [
  ['名古屋駅', 35.1709, 136.8815], ['名古屋市役所・愛知県庁', 35.1810, 136.9066], ['栄', 35.1700, 136.9085], ['金山駅', 35.1430, 136.9010],
  ['新潟駅', 37.9122, 139.0618], ['新潟県庁', 37.9026, 139.0236], ['新潟市役所', 37.9161, 139.0364], ['新潟港(佐渡汽船)', 37.9268, 139.0558],
  ['両津港', 38.0820, 138.4370], ['小木港', 37.8136, 138.2830], ['直江津港', 37.1868, 138.2486],
  ['静岡駅', 34.9716, 138.3890], ['静岡県庁', 34.9769, 138.3831], ['清水港', 35.0160, 138.4950],
  ['浜松駅', 34.7037, 137.7349], ['浜松市役所', 34.7108, 137.7262],
  ['中部国際空港', 34.8584, 136.8054], ['小松空港(空自小松)', 36.3940, 136.4067], ['浜松基地(空自)', 34.7500, 137.7030],
  ['守山駐屯地', 35.2051, 136.9693], ['富士駐屯地', 35.3600, 138.8800], ['板妻駐屯地', 35.2930, 138.9060], ['滝ヶ原駐屯地', 35.3240, 138.8790],
  ['富士山', 35.3606, 138.7274], ['河口湖', 35.5100, 138.7600], ['富士宮', 35.2220, 138.6210],
  ['槍ヶ岳', 36.3420, 137.6476], ['奥穂高岳', 36.2894, 137.6480], ['上高地', 36.2507, 137.6380], ['立山', 36.5761, 137.6197], ['白馬岳', 36.7587, 137.7586],
  ['富山(県庁)', 36.6953, 137.2113], ['金沢(県庁)', 36.5947, 136.6256], ['金沢駅', 36.5781, 136.6481], ['福井(県庁)', 36.0652, 136.2216],
  ['甲府(県庁)', 35.6642, 138.5684], ['長野(県庁)', 36.6513, 138.1810], ['岐阜(県庁)', 35.3912, 136.7223], ['松本', 36.2380, 137.9720],
];
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
const args = process.argv.slice(2).map(Number);
const list: [string, number, number][] = args.length >= 2 ? [] : CHUBU_SITES;
for (let i = 0; i + 1 < args.length; i += 2) list.push([`${args[i]},${args[i + 1]}`, args[i]!, args[i + 1]!]);
for (const [name, lat, lon] of list) {
  const fy = ((latTop - lat) * kmPerLat) / 10;
  const fx = ((lon - lon0) * kmPerLon) / 10;
  const id = Math.floor(fy) * grid.gridW + Math.floor(fx);
  const c = grid.cells[id];
  const x = Math.round((fx - Math.floor(fx)) * 1024);
  const z = Math.round((fy - Math.floor(fy)) * 1024);
  console.log(`${name}: cell ${id} (${x}, ${z}) ${c ? `${grid.prefNames[c.pref]} ${c.real?.muni ?? ''} ${c.land} pop0=${c.pop0}` : 'sea'}`);
}
