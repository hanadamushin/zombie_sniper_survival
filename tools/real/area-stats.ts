// R9: summary of the area files of every region (before / after a rebuild):
//   node tools/real/area-stats.ts [areasDir] [--cells id,id]
// Per region: areas, total / average / largest size, cells whose land is mostly beach or "none"
// (unread land use, R3 / R4: >= 30 % of the land), rails drawn on the surface vs in tunnels (km of
// area metres), police / fire / SDF counted from the index. With --cells: per cell surface / tunnel rail
// length, land-use shares and the stations.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeRealArea, LINE, LINE_TUNNEL, LU, type RealArea } from '../../src/gen/real/format.ts';
import { REGIONS } from './lib/regions.ts';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && !/^\d/.test(a)) ?? new URL('../../public/data/areas/', import.meta.url).pathname;
const only = args.includes('--cells') ? args[args.indexOf('--cells') + 1]!.split(',').map(Number) : null;

function railLength(a: RealArea): { surface: number; tunnel: number } {
  let surface = 0;
  let tunnel = 0;
  for (const l of a.lines) {
    if (l.kind !== LINE.rail && l.kind !== LINE.shinkansen) continue;
    let len = 0;
    for (let i = 2; i < l.pts.length; i += 2) len += Math.hypot(l.pts[i]! - l.pts[i - 2]!, l.pts[i + 1]! - l.pts[i - 1]!);
    if (l.flags & LINE_TUNNEL) tunnel += len;
    else surface += len;
  }
  return { surface, tunnel };
}
function landShares(a: RealArea): { land: number; beachOrNone: number } {
  let land = 0;
  let bad = 0;
  for (const c of a.landuse) {
    if (c === LU.sea) continue;
    land++;
    if (c === LU.beach || c === LU.none) bad++;
  }
  return { land, beachOrNone: land ? bad / land : 0 };
}
const read = (region: string, cell: number): RealArea => decodeRealArea(gunzipSync(readFileSync(`${dir}/${region}/${cell}.bin`)));

if (only) {
  for (const region of REGIONS) {
    let files: string[] = [];
    try {
      files = readdirSync(`${dir}/${region}`);
    } catch {
      continue;
    }
    for (const cell of only) {
      if (!files.includes(`${cell}.bin`)) continue;
      const a = read(region, cell);
      const r = railLength(a);
      const s = landShares(a);
      const st = a.pois.filter((p) => p.kind === 1).map((p) => p.name);
      console.log(`${region} ${cell}: rail surface ${(r.surface / 1000).toFixed(2)} km, tunnel ${(r.tunnel / 1000).toFixed(2)} km; beach/none ${(s.beachOrNone * 100).toFixed(0)} % of land; stations ${st.join('・')}`);
    }
  }
} else {
  console.log('| 地方 | 区域 | 合計 MB | 平均 KB | 最大 KB | 陸の 3 割以上が海浜・なし | 地上の線路 km | トンネルの線路 km | 警察 | 消防 | 自衛隊 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  let all = 0;
  for (const region of REGIONS) {
    let files: string[];
    try {
      files = readdirSync(`${dir}/${region}`).filter((f) => f.endsWith('.bin'));
    } catch {
      continue;
    }
    let total = 0;
    let max = 0;
    let bad = 0;
    let surface = 0;
    let tunnel = 0;
    for (const f of files) {
      const size = statSync(`${dir}/${region}/${f}`).size;
      total += size;
      max = Math.max(max, size);
      const a = read(region, Number(f.replace('.bin', '')));
      if (landShares(a).beachOrNone >= 0.3) bad++;
      const r = railLength(a);
      surface += r.surface;
      tunnel += r.tunnel;
    }
    all += total;
    const index = JSON.parse(readFileSync(`${dir}/${region}/index.json`, 'utf8')) as { cells: Record<string, { police: number; fire: number; sdf: unknown[] }> };
    const cells = Object.values(index.cells);
    const sum = (k: 'police' | 'fire'): number => cells.reduce((s, c) => s + c[k], 0);
    const sdf = cells.reduce((s, c) => s + c.sdf.length, 0);
    console.log(`| ${region} | ${files.length} | ${(total / 1e6).toFixed(2)} | ${(total / files.length / 1024).toFixed(1)} | ${(max / 1024).toFixed(1)} | ${bad} | ${(surface / 1000).toFixed(0)} | ${(tunnel / 1000).toFixed(0)} | ${sum('police')} | ${sum('fire')} | ${sdf} |`);
  }
  console.log(`total ${(all / 1e6).toFixed(2)} MB`);
}
