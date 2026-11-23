// L3b: why a landmark of the table (src/data/landmarks/) stands far from its real point, or not at all
// (docs/realmap_guide.md §7): prints, round its shrunk point, a character per candidate centre (every
// 8 m) saying what a lot of its size would hit, and a plain map of the lines and water there.
//   node tools/real/landmark-why.ts <landmark id or part of it> [--radius m] [--drain 0..1] [--cut] [--level m] [--size w,d]
// --drain / --cut / --level override the table's drain / cutRoads / level (try a fix before writing it
// in the table); --size tries another lot (local w × d, before the turn). Candidate characters:
//   . free   E area edge   o another landmark   ~ water   M motorway  N national road  R railway
//   S shinkansen  p / w / l a road the lot may not cut   H too much slope   @ the point
// An approximation of sites.ts planLandmark (the area is generated as the game does, then read: the
// ground under the other sites is already levelled, the landmark itself is ignored).
import { CUTS, SITES } from '../../src/data/placement.ts';
import { LANDMARKS } from '../../src/data/landmarks/index.ts';
import { buildingDef } from '../../src/gen/buildings/index.ts';
import { LINE } from '../../src/gen/real/format.ts';
import { realToArea } from '../../src/gen/real/landmarks.ts';
import { clipLength, LineIndex } from '../../src/gen/real/sites.ts';
import { GROUND } from '../../src/gen/types.ts';
import { mapFor } from './check.ts';
import { loadGrid, loadRealIndexes, readRealArea } from './lib/game.ts';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const spot = LANDMARKS.find((s) => s.id === args[0] || s.id.includes(args[0] ?? '\u0000'));
if (!spot) {
  console.log('usage: node tools/real/landmark-why.ts <landmark id> [--radius m] [--drain 0..1] [--cut] [--level m] [--size w,d]');
  process.exit(1);
}
const def = buildingDef(spot.id);
const [w, d] = opt('size')?.split(',').map(Number) ?? [def.size.w[1], def.size.d[1]];
const [lw, ld] = spot.rot % 2 === 0 ? [w!, d!] : [d!, w!];
const big = Math.max(lw, ld) >= SITES.big;
const drain = Number(opt('drain') ?? spot.drain ?? 0);
const cut = args.includes('--cut') || spot.cutRoads ? CUTS.landmarkRoads! : CUTS.landmark!;
const range = Number(opt('level') ?? spot.level ?? (big ? SITES.levelRange.big : SITES.levelRange.small));
const R = Number(opt('radius') ?? 144);

const grid = loadGrid();
loadRealIndexes(grid);
const a = realToArea(spot.lat, spot.lon);
const real = readRealArea(a.cell);
if (!real) {
  console.log(`cell ${a.cell}: no area file`);
  process.exit(1);
}
const map = mapFor(grid, a.cell);
const anchor = spot.poi ? map.pois?.find((q) => q.name === spot.poi) ?? a : a;
const lines = new LineIndex(real);
const T = 4;
const N = map.tiles + 1;
const wetAt = (x: number, z: number): boolean => map.ground[Math.floor(z / T) * map.tiles + Math.floor(x / T)] === GROUND.water;
const hAt = (x: number, z: number): number => map.height[Math.round(z / T) * N + Math.round(x / T)]!;
const others = map.placements.filter((p) => p.def.startsWith('landmark.') && p.def !== spot.id);
const KC: Record<number, string> = { [LINE.motorway]: 'M', [LINE.national]: 'N', [LINE.prefectural]: 'p', [LINE.wide]: 'w', [LINE.local]: 'l', [LINE.rail]: 'R', [LINE.shinkansen]: 'S' };
const scratch = new Set<number>();

function why(cx: number, cz: number): string {
  const [x0, z0, x1, z1] = [cx - lw / 2, cz - ld / 2, cx + lw / 2, cz + ld / 2];
  const e = SITES.edge.small;
  if (x0 < e || z0 < e || x1 > 1024 - e || z1 > 1024 - e) return 'E';
  const g = SITES.gap;
  for (const o of others) if (o.x0 < x1 + g && o.x1 > x0 - g && o.z0 < z1 + g && o.z1 > z0 - g) return 'o';
  let wet = 0;
  let all = 0;
  for (let z = z0 + 2; z < z1; z += T) for (let x = x0 + 2; x < x1; x += T) {
    all++;
    if (wetAt(x, z)) wet++;
  }
  if (wet > all * Math.max(drain, big ? SITES.drain : 0)) return '~';
  for (const si of lines.near(x0 - 12, z0 - 12, x1 + 12, z1 + 12, scratch)) {
    const s = lines.segs[si]!;
    if (cut.includes(s.kind)) continue;
    const pad = s.hw + g;
    if (clipLength(s.ax, s.az, s.bx, s.bz, x0 - pad, z0 - pad, x1 + pad, z1 + pad) > 0) return KC[s.kind] ?? '?';
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let z = z0; z <= z1; z += T) for (let x = x0; x <= x1; x += T) {
    const h = hAt(x, z);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  return hi - lo > range ? 'H' : '.';
}

const placed = map.placements.find((p) => p.def === spot.id);
console.log(`${spot.id}: cell ${a.cell}, point (${anchor.x.toFixed(0)}, ${anchor.z.toFixed(0)}), lot ${lw}×${ld} (rot ${spot.rot}), drain ${drain}, level ${range} m, cuts ${cut.join(',')}`);
console.log(placed ? `placed at (${((placed.x0 + placed.x1) / 2).toFixed(0)}, ${((placed.z0 + placed.z1) / 2).toFixed(0)}), ${Math.hypot((placed.x0 + placed.x1) / 2 - anchor.x, (placed.z0 + placed.z1) / 2 - anchor.z).toFixed(0)} m from the point` : 'not placed');
const px = Math.round(anchor.x / 8) * 8;
const pz = Math.round(anchor.z / 8) * 8;
console.log(`candidate centres every 8 m, ±${R} m (north up):`);
for (let dz = -R; dz <= R; dz += 8) {
  let row = '';
  for (let dx = -R; dx <= R; dx += 8) row += dx === 0 && dz === 0 ? '@' : why(px + dx, pz + dz);
  console.log(row);
}
console.log('the ground round the point (8 m a character): # railway, = motorway / national road, - other road, ~ water, o landmark');
for (let z = pz - R; z <= pz + R; z += 8) {
  let row = '';
  for (let x = px - R; x <= px + R; x += 8) {
    let c = wetAt(x, z) ? '~' : ' ';
    if (others.some((o) => x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1)) c = 'o';
    for (const si of lines.near(x - 4, z - 4, x + 4, z + 4, scratch)) {
      const s = lines.segs[si]!;
      if (clipLength(s.ax, s.az, s.bx, s.bz, x - 4 - s.hw, z - 4 - s.hw, x + 4 + s.hw, z + 4 + s.hw) <= 0) continue;
      const k = s.kind >= LINE.rail ? '#' : s.kind <= LINE.national ? '=' : '-';
      if (k === '#' || (k === '=' && c !== '#') || (k === '-' && (c === ' ' || c === '~'))) c = k;
    }
    row += x === px && z === pz ? '@' : c;
  }
  console.log(row);
}
