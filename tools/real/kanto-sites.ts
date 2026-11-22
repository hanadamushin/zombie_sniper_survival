// R3 (Kanto): the check sites -> cell id and area-local position (game metres).
//   node tools/real/kanto-sites.ts [lat lon ...]
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
export const KANTO_SITES: [string, number, number][] = [
  ['東京駅', 35.6812, 139.7671], ['新宿駅', 35.6896, 139.7006], ['都庁', 35.6896, 139.6917], ['渋谷駅', 35.6580, 139.7016],
  ['横浜駅', 35.4658, 139.6223], ['神奈川県庁', 35.4478, 139.6425], ['川崎駅', 35.5313, 139.6969],
  ['大宮駅', 35.9064, 139.6238], ['埼玉県庁(浦和)', 35.8570, 139.6489], ['千葉駅', 35.6131, 140.1134], ['千葉県庁', 35.6047, 140.1233],
  ['相模原市役所', 35.5714, 139.3734], ['水戸(茨城県庁)', 36.3418, 140.4468], ['宇都宮(栃木県庁)', 36.5658, 139.8836], ['前橋(群馬県庁)', 36.3911, 139.0608],
  ['成田空港', 35.7720, 140.3929], ['羽田空港', 35.5494, 139.7798],
  ['朝霞駐屯地', 35.7930, 139.5960], ['習志野駐屯地', 35.7065, 140.0500], ['横須賀(海自)', 35.2903, 139.6650],
  ['百里基地', 36.1813, 140.4147], ['入間基地', 35.8419, 139.4106],
  ['雲取山', 35.8555, 138.9440], ['奥多摩駅', 35.8094, 139.0965], ['高尾山', 35.6251, 139.2437],
  ['伊豆大島(三原山)', 34.7244, 139.3947], ['伊豆大島(元町)', 34.7500, 139.3550], ['三宅島', 34.0790, 139.5290], ['八丈島', 33.1100, 139.7900],
];
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
const args = process.argv.slice(2).map(Number);
const list: [string, number, number][] = args.length >= 2 ? [] : KANTO_SITES;
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
