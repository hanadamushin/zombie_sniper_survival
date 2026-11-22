// R5 (Kinki): the check sites -> cell id and area-local position (game metres).
//   node tools/real/kinki-sites.ts [lat lon ...]
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
export const KINKI_SITES: [string, number, number][] = [
  ['大阪駅(梅田)', 34.7025, 135.4959], ['大阪市役所', 34.6937, 135.5022], ['大阪府庁', 34.6864, 135.5200], ['大阪城', 34.6873, 135.5262],
  ['難波駅', 34.6659, 135.5013], ['天王寺駅', 34.6465, 135.5133], ['新大阪駅', 34.7334, 135.5001], ['大阪港(天保山)', 34.6553, 135.4317],
  ['京都駅', 34.9858, 135.7588], ['京都府庁', 35.0214, 135.7556], ['京都市役所', 35.0112, 135.7681], ['京都御所', 35.0254, 135.7621],
  ['三ノ宮駅', 34.6946, 135.1952], ['神戸市役所', 34.6901, 135.1955], ['兵庫県庁', 34.6913, 135.1830], ['神戸港(メリケンパーク)', 34.6828, 135.1887],
  ['堺市役所', 34.5733, 135.4830], ['堺東駅', 34.5737, 135.4836], ['仁徳天皇陵', 34.5640, 135.4870],
  ['関西国際空港', 34.4347, 135.2440], ['りんくうタウン駅', 34.4114, 135.2962], ['伊丹空港', 34.7855, 135.4382],
  ['琵琶湖(大津・滋賀県庁)', 35.0045, 135.8686], ['琵琶湖大橋', 35.0820, 135.9200], ['琵琶湖(湖の中ほど)', 35.2500, 136.0800], ['彦根', 35.2745, 136.2595], ['竹生島', 35.4210, 136.1440],
  ['大台ヶ原', 34.1810, 136.1100], ['八経ヶ岳', 34.1767, 135.9075], ['高野山', 34.2130, 135.5850], ['熊野本宮', 33.8400, 135.7730], ['十津川', 33.9900, 135.7930],
  ['明石海峡大橋(舞子)', 34.6316, 135.0336], ['明石海峡大橋(淡路)', 34.6070, 135.0130], ['明石駅', 34.6493, 134.9926],
  ['海自 舞鶴(東舞鶴)', 35.4750, 135.3870], ['西舞鶴駅', 35.4442, 135.3307],
  ['陸自 伊丹駐屯地', 34.7880, 135.4140], ['陸自 千僧駐屯地', 34.7790, 135.3990], ['陸自 信太山駐屯地', 34.4910, 135.4500],
  ['奈良県庁', 34.6851, 135.8329], ['和歌山県庁', 34.2261, 135.1675], ['三重県庁(津)', 34.7303, 136.5086], ['姫路城', 34.8394, 134.6939],
];
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
const args = process.argv.slice(2).map(Number);
const list: [string, number, number][] = args.length >= 2 ? [] : KINKI_SITES;
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
