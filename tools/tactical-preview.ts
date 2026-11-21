// Top-down debug images of generated operation areas (1 px = 1 m):
//   node tools/tactical-preview.ts [outDir] [seed]
// writes <land>.png for the five land classes plus rural_home.png / forest_home.png.
// Legend: red ring = vantage point, yellow = loot spot, cyan = edge spawn, magenta = ladder,
// white outline = building with roof access, dark red tint = non-walkable nav tile.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Land } from '../src/core/types.ts';
import { generateTacticalMap, GROUND, sampleHeight, type TacticalMap } from '../src/gen/index.ts';
import { encodePng } from './lib/png.ts';

type Rgb = [number, number, number];
const GROUND_RGB: Record<number, Rgb> = {
  [GROUND.grass]: [104, 128, 78],
  [GROUND.road]: [84, 84, 88],
  [GROUND.track]: [150, 128, 96],
  [GROUND.field]: [150, 150, 84],
  [GROUND.paved]: [128, 128, 126],
  [GROUND.rock]: [120, 116, 110],
  [GROUND.forest]: [70, 96, 62],
  [GROUND.park]: [96, 140, 80],
  [GROUND.water]: [50, 90, 150],
  [GROUND.sand]: [214, 200, 160],
};

export function renderTacticalMap(map: TacticalMap): Buffer {
  const S = map.size;
  const rgb = new Uint8Array(S * S * 3);
  const put = (x: number, z: number, c: Rgb, a = 1): void => {
    const px = Math.round(x);
    const pz = Math.round(z);
    if (px < 0 || pz < 0 || px >= S || pz >= S) return;
    const i = (pz * S + px) * 3;
    for (let k = 0; k < 3; k++) rgb[i + k] = rgb[i + k]! * (1 - a) + c[k]! * a;
  };
  const rect = (x0: number, z0: number, x1: number, z1: number, c: Rgb, a = 1): void => {
    for (let z = Math.floor(z0); z < z1; z++) for (let x = Math.floor(x0); x < x1; x++) put(x, z, c, a);
  };
  const ring = (x: number, z: number, r: number, c: Rgb): void => {
    for (let a = 0; a < 64; a++) for (const rr of [r, r - 1]) put(x + Math.cos((a / 64) * Math.PI * 2) * rr, z + Math.sin((a / 64) * Math.PI * 2) * rr, c);
  };
  const h = (x: number, z: number): number => sampleHeight(map.height, map.n, map.tile, x, z);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of map.height) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }

  for (let z = 0; z < S; z++) {
    for (let x = 0; x < S; x++) {
      const ti = Math.floor(z / map.tile) * map.tiles + Math.floor(x / map.tile);
      const base = GROUND_RGB[map.ground[ti]!]!;
      // Hill shading (light from the north-west) + elevation tint + 10 m contour lines.
      const shade = 1 + Math.max(-0.45, Math.min(0.45, ((h(x - 1, z - 1) - h(x + 1, z + 1)) / 2) * 0.9));
      const e = 0.8 + (0.35 * (h(x, z) - lo)) / Math.max(1, hi - lo);
      const contour = Math.floor(h(x, z) / 10) !== Math.floor(h(x + 1, z) / 10) || Math.floor(h(x, z) / 10) !== Math.floor(h(x, z + 1) / 10) ? 0.75 : 1;
      const i = (z * S + x) * 3;
      for (let k = 0; k < 3; k++) rgb[i + k] = Math.min(255, base[k]! * shade * e * contour);
      if (!map.walk[ti]) put(x, z, [150, 30, 30], 0.3);
    }
  }
  for (const a of map.areas) {
    const c: Rgb = a.kind === 'paddy' ? [110, 150, 120] : a.kind === 'field' ? [170, 160, 90] : a.kind === 'park' ? [90, 150, 80] : a.kind === 'parking' ? [100, 100, 104] : a.kind === 'plaza' ? [160, 150, 140] : [120, 140, 96];
    rect(a.x0, a.z0, a.x1, a.z1, c, a.kind === 'yard' ? 0.25 : 0.6);
  }
  for (let i = 0; i < map.grass.n; i++) put(map.grass.x[i]!, map.grass.z[i]!, [150, 180, 90], 0.6);
  for (let i = 0; i < map.trees.n; i++) {
    const r = map.trees.r[i]! * 0.7;
    const c: Rgb = map.trees.kind[i] ? [60, 110, 50] : [36, 78, 50];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r) put(map.trees.x[i]! + dx, map.trees.z[i]! + dz, c, 0.8);
  }
  // 07b: sight-blocking brush (hedges dark, bushes green, reeds straw, bamboo bright) and box scenery.
  const BRUSH: Record<string, Rgb> = { hedge: [26, 60, 30], bush: [50, 92, 44], reeds: [196, 184, 110], bamboo: [120, 190, 70] };
  for (const br of map.brush) {
    const len = Math.hypot(br.bx - br.ax, br.bz - br.az);
    const steps = Math.max(1, Math.ceil(len));
    for (let s = 0; s <= steps; s++) {
      const cx = br.ax + ((br.bx - br.ax) * s) / steps;
      const cz = br.az + ((br.bz - br.az) * s) / steps;
      for (let dz = -br.r; dz <= br.r; dz++) for (let dx = -br.r; dx <= br.r; dx++) if (dx * dx + dz * dz <= br.r * br.r) put(cx + dx, cz + dz, BRUSH[br.kind]!, 0.85);
    }
  }
  for (const p of map.props) {
    const hx = (p.alongX ? p.w : p.d) / 2;
    const hz = (p.alongX ? p.d : p.w) / 2;
    rect(p.x - hx, p.z - hz, p.x + hx, p.z + hz, p.kind === 'log' ? [96, 70, 44] : p.kind === 'greenhouse' ? [220, 226, 220] : [200, 90, 60], p.kind === 'greenhouse' ? 0.5 : 1);
  }
  for (const r of map.rocks) rect(r.x - r.r * 0.7, r.z - r.r * 0.7, r.x + r.r * 0.7, r.z + r.r * 0.7, [170, 170, 170]);
  for (const s of map.solids) if (s.kind === 'stair' || s.kind === 'prop') rect(s.x0, s.z0, s.x1, s.z1, [230, 230, 230]);
  for (const b of map.buildings) {
    if (b.kind === 'tower') continue;
    const v = Math.min(1, b.height / 40);
    const c: Rgb = b.roof === 'gable' ? [150, 96, 80] : [150 + 90 * v, 140 + 60 * v, 150 - 60 * v];
    if (b.access !== 'none') rect(b.x0 - 1, b.z0 - 1, b.x1 + 1, b.z1 + 1, [255, 255, 255]);
    rect(b.x0, b.z0, b.x1, b.z1, c);
  }
  for (const l of map.ladders) rect(l.x0 - 1, l.z0 - 1, l.x1 + 1, l.z1 + 1, [255, 0, 255]);
  for (const l of map.lootSpots) rect(l.pos[0] - 1.5, l.pos[1] - 1.5, l.pos[0] + 1.5, l.pos[1] + 1.5, [255, 230, 0]);
  for (const v of map.vantages) ring(v.pos[0], v.pos[2], v.kind === 'hill' ? 12 : 8, [255, 40, 40]);
  ring(map.spawn.edge[0], map.spawn.edge[1], 5, [0, 255, 255]);
  if (map.params.isHome) ring(map.spawn.home[0], map.spawn.home[1], 120, [0, 255, 255]);
  return encodePng(S, S, rgb);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? 'tmp/tactical';
  const seed = Number(process.argv[3] ?? 12345);
  mkdirSync(out, { recursive: true });
  const jobs: [string, Land, boolean, number][] = [
    ['urban', 'urban', false, 30], ['suburb', 'suburb', false, 18], ['rural', 'rural', false, 8], ['forest', 'forest', false, 2],
    ['mountain', 'mountain', false, 1], ['rural_home', 'rural', true, 8], ['forest_home', 'forest', true, 2],
  ];
  for (const [name, land, isHome, lootSpots] of jobs) {
    const t0 = performance.now();
    const map = generateTacticalMap({ mapSeed: seed, land, isHome, lootSpots });
    const ms = performance.now() - t0;
    writeFileSync(join(out, `${name}.png`), renderTacticalMap(map));
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of map.height) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    console.log(`${name}: ${ms.toFixed(0)} ms, relief ${(hi - lo).toFixed(0)} m, ${map.buildings.length} buildings, ${map.solids.length} solids, ${map.trees.n} trees, ${map.grass.n} grass, ` +
      `${map.rocks.length} rocks, ${map.lootSpots.length} loot, vantages ${map.vantages.map((v) => `${v.kind}@${v.pos[1].toFixed(0)}`).join(' ')}, walkable ${((map.walk.reduce((s, v) => s + v, 0) / map.walk.length) * 100).toFixed(0)}%`);
  }
}
