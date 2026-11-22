// R6 (Chugoku): the check sites -> cell id and area-local position (game metres).
//   node tools/real/chugoku-sites.ts [lat lon ...]
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
export const CHUGOKU_SITES: [string, number, number][] = [
  ['広島駅', 34.3976, 132.4754], ['広島市役所', 34.3854, 132.4554], ['広島県庁', 34.3966, 132.4597], ['原爆ドーム', 34.3955, 132.4536],
  ['広島城', 34.4027, 132.4592], ['広島港(宇品)', 34.3523, 132.4659], ['広島空港', 34.4361, 132.9194], ['陸自 海田市駐屯地', 34.3700, 132.5370],
  ['岡山駅', 34.6661, 133.9177], ['岡山市役所', 34.6551, 133.9193], ['岡山県庁', 34.6617, 133.9349], ['岡山城', 34.6649, 133.9360], ['岡山空港', 34.7569, 133.8553],
  ['瀬戸大橋(鷲羽山・下津井)', 34.4385, 133.8070], ['児島駅', 34.4637, 133.8094], ['倉敷駅', 34.6013, 133.7666], ['水島', 34.5200, 133.7400],
  ['尾道駅', 34.4040, 133.1938], ['尾道大橋・新尾道大橋', 34.4010, 133.2050], ['向島', 34.3870, 133.2000], ['福山駅', 34.4893, 133.3626],
  ['下関駅', 33.9500, 130.9214], ['関門橋(壇ノ浦)', 33.9640, 130.9580], ['海自 小月', 34.0450, 131.0500],
  ['海自 呉地方総監部', 34.2400, 132.5550], ['呉駅', 34.2463, 132.5653], ['江田島', 34.2410, 132.4440],
  ['岩国基地', 34.1440, 132.2360], ['岩国駅', 34.1724, 132.2246], ['錦帯橋', 34.1675, 132.1782],
  ['大山', 35.3710, 133.5460], ['蒜山', 35.3000, 133.6500], ['三瓶山', 35.1405, 132.6215], ['恐羅漢山', 34.5967, 132.1250], ['道後山', 35.0750, 133.2350],
  ['鳥取県庁', 35.5036, 134.2377], ['鳥取砂丘', 35.5420, 134.2290], ['島根県庁(松江)', 35.4723, 133.0505], ['宍道湖', 35.4500, 132.9500],
  ['出雲大社', 35.4020, 132.6855], ['山口県庁', 34.1859, 131.4714], ['米子駅', 35.4245, 133.3390], ['美保基地(米子空港)', 35.4922, 133.2364],
  ['防府', 34.0400, 131.5600], ['周南(徳山)', 34.0520, 131.8060], ['萩', 34.4080, 131.3990],
];
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
const args = process.argv.slice(2).map(Number);
const list: [string, number, number][] = args.length >= 2 ? [] : CHUGOKU_SITES;
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
