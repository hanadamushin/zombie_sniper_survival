// R7 (Shikoku): the check sites -> cell id and area-local position (game metres).
//   node tools/real/shikoku-sites.ts [lat lon ...]
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';

const grid = parseGrid(JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
export const SHIKOKU_SITES: [string, number, number][] = [
  ['松山市駅', 33.8395, 132.7657], ['松山駅', 33.8371, 132.7516], ['愛媛県庁', 33.8416, 132.766], ['松山城', 33.8456, 132.7656], ['松山空港', 33.8272, 132.6997], ['三津浜', 33.8640, 132.7090],
  ['高松駅', 34.3505, 134.0467], ['香川県庁', 34.3401, 134.0434], ['高松城(玉藻城)', 34.3503, 134.051], ['栗林公園', 34.3292, 134.0441], ['高松空港', 34.2142, 134.0156],
  ['高知駅', 33.5672, 133.5432], ['高知県庁', 33.559, 133.5313], ['高知城', 33.5609, 133.5313], ['高知空港', 33.5461, 133.6694], ['桂浜', 33.4971, 133.5747],
  ['徳島駅', 34.0742, 134.5513], ['徳島県庁', 34.0658, 134.5594], ['眉山', 34.0656, 134.525], ['徳島空港(海自徳島)', 34.1328, 134.6067], ['小松島(海自)', 34.004, 134.59],
  ['鳴門(大鳴門橋)', 34.235, 134.644], ['善通寺', 34.227, 133.787], ['丸亀', 34.29, 133.798], ['坂出(瀬戸大橋)', 34.335, 133.84], ['与島', 34.39, 133.82],
  ['今治駅', 34.0663, 132.9978], ['来島海峡大橋', 34.115, 132.993], ['新居浜', 33.96, 133.283], ['西条', 33.918, 133.182],
  ['石鎚山', 33.7675, 133.1153], ['剣山', 33.8536, 134.0944], ['大歩危', 33.869, 133.755],
  ['宇和島', 33.2235, 132.56], ['四万十(中村)', 32.99, 132.934], ['足摺岬', 32.724, 133.02], ['室戸岬', 33.244, 134.177], ['阿南', 33.92, 134.66], ['鬼北町', 33.25, 132.69],
];
const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
const args = process.argv.slice(2).map(Number);
const list: [string, number, number][] = args.length >= 2 ? [] : SHIKOKU_SITES;
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
