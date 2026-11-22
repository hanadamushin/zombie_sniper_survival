// R2 (Tohoku): the check sites -> cell id and area-local position (game metres).
//   node tools/real/tohoku-sites.ts [lat lon ...]
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
export const TOHOKU_SITES: [string, number, number][] = [
  ['仙台駅', 38.2601, 140.8822], ['宮城県庁', 38.2688, 140.8721], ['青森県庁', 40.8244, 140.7400], ['岩手県庁(盛岡)', 39.7036, 141.1527],
  ['秋田県庁', 39.7186, 140.1024], ['山形県庁', 38.2404, 140.3633], ['福島県庁', 37.7503, 140.4676],
  ['宮古・浄土ヶ浜', 39.6505, 141.9800], ['釜石', 39.2742, 141.8858], ['気仙沼', 38.9081, 141.5700], ['大船渡', 39.0819, 141.7083],
  ['蔵王(熊野岳)', 38.1436, 140.4400], ['八幡平', 39.9578, 140.8542], ['栗駒山', 38.9608, 140.7883], ['岩手山', 39.8525, 141.0011],
  ['青函トンネル本州側(奥津軽いまべつ)', 41.1447, 140.5156],
  ['仙台駐屯地', 38.2808, 140.9058], ['霞目駐屯地', 38.2386, 140.9200], ['青森駐屯地', 40.8108, 140.6878],
  ['大湊(海自)', 41.2747, 141.1361], ['三沢基地(空自)', 40.7031, 141.3686],
];
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
const args = process.argv.slice(2).map(Number);
const list: [string, number, number][] = args.length >= 2 ? [] : TOHOKU_SITES;
for (let i = 0; i + 1 < args.length; i += 2) list.push([`${args[i]},${args[i + 1]}`, args[i]!, args[i + 1]!]);
for (const [name, lat, lon] of list) {
  const fy = ((latTop - lat) * kmPerLat) / 10;
  const fx = ((lon - lon0) * kmPerLon) / 10;
  const id = Math.floor(fy) * grid.gridW + Math.floor(fx);
  const c = grid.cells[id];
  const x = Math.round((fx - Math.floor(fx)) * 1024);
  const z = Math.round((fy - Math.floor(fy)) * 1024);
  console.log(`${name}: cell ${id} (${x}, ${z}) ${c ? `${grid.prefNames[c.pref]} ${c.real?.muni ?? ''} ${c.kind ?? ''} pop0=${c.pop0}` : 'sea'}`);
}
