// Trees, tall grass and rocks. Placement follows the ground class, slope and the wooded-patch
// noise of the land; roads, fields, buildings, the home base and vantage points stay clear.

import { chance, rand, randRange } from '../core/rng.ts';
import { TACTICAL } from '../data/tactical.ts';
import { hAt, homeDist, N, rngOf, SIZE, TILE, tileIndex, type Builder } from './builder.ts';
import { sampleGradient } from './height.ts';
import { fbm, smoothstep } from './noise.ts';
import { GROUND } from './types.ts';

const T = TACTICAL;

function quantile(values: number[], q: number): number {
  const sorted = values.slice().sort((a, c) => a - c);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))]!;
}

export function heightStats(b: Builder): { min: number; max: number; median: number } {
  const sample: number[] = [];
  for (let iz = 0; iz < N; iz += 4) for (let ix = 0; ix < N; ix += 4) sample.push(b.height[iz * N + ix]!);
  return { min: quantile(sample, 0), max: quantile(sample, 1), median: quantile(sample, 0.5) };
}

export function scatterFlora(b: Builder): void {
  const land = b.params.land;
  const F = T.flora[land];
  const rng = rngOf(b, 'flora');
  const seedW = Math.floor(rand(rng) * 0x7fffffff);
  const seedK = Math.floor(rand(rng) * 0x7fffffff);
  const stats = heightStats(b);
  const grad: [number, number] = [0, 0];
  const slopeAt = (x: number, z: number): number => {
    sampleGradient(b.height, N, TILE, x, z, grad);
    return Math.hypot(grad[0], grad[1]);
  };
  const wood = (x: number, z: number): number => {
    let m = fbm(x / 170, z / 170, seedW, 3);
    // Rural hills are wooded; their fields lie on the low ground.
    if (land === 'rural') m += Math.min(0.5, Math.max(0, (hAt(b, x, z) - stats.median - 6) / 30));
    return m;
  };
  const probe: number[] = [];
  for (let z = 16; z < SIZE; z += 32) for (let x = 16; x < SIZE; x += 32) probe.push(wood(x, z));
  const th = F.wooded > 0 ? quantile(probe, 1 - F.wooded) : Infinity;
  const clearOfVantage = (x: number, z: number): boolean => b.vantages.every((v) => Math.hypot(v.pos[0] - x, v.pos[2] - z) > (v.kind === 'hill' ? T.vantage.hillClear : 13));
  const homeClear = (x: number, z: number): boolean => !b.params.isHome || homeDist(x, z) > T.homeFlatRadius + 8;
  const parks = b.areas.filter((a) => a.kind === 'park');
  const inPark = (x: number, z: number): boolean => parks.some((a) => x > a.x0 + 2 && x < a.x1 - 2 && z > a.z0 + 2 && z < a.z1 - 2);
  const town = land === 'urban' || land === 'suburb';

  // --- trees: one candidate per 5 m cell ---
  const C = 5;
  const perCell = (F.treesPerHa / 10000) * C * C;
  for (let cz = 0; cz < SIZE / C; cz++) {
    for (let cx = 0; cx < SIZE / C; cx++) {
      const x = (cx + rand(rng)) * C;
      const z = (cz + rand(rng)) * C;
      const roll = rand(rng);
      if (x < 3 || z < 3 || x > SIZE - 3 || z > SIZE - 3) continue;
      const ti = tileIndex(x, z);
      const g = b.ground[ti]!;
      if (b.occupied[ti] || (g !== GROUND.grass && g !== GROUND.forest && g !== GROUND.park)) continue;
      let p: number;
      const park = inPark(x, z);
      const m = wood(x, z);
      if (park) p = 0.1;
      else if (town && g === GROUND.grass) p = F.street * 0.05;
      else p = perCell * (smoothstep(th, th + 0.1, m) + 0.035);
      if (land === 'mountain') p *= 1 - smoothstep(0.5, 0.78, (hAt(b, x, z) - stats.min) / Math.max(1, stats.max - stats.min));
      if (roll >= p) continue;
      if (!homeClear(x, z) || !clearOfVantage(x, z) || slopeAt(x, z) > 1.1) continue;
      const conifer = rand(rng) < F.conifer + 0.25 * fbm(x / 90, z / 90, seedK, 2);
      const size = rand(rng);
      const h = conifer ? 9 + size * 9 : 6 + size * 6.5;
      const r = conifer ? 1.7 + size * 1.4 : 2.4 + size * 2.2;
      // Keep the view from hill tops: nothing nearby may rise above the eyes of someone standing there.
      const top = hAt(b, x, z) + h;
      if (b.vantages.some((v) => v.kind === 'hill' && top > v.pos[1] + 1 && Math.hypot(v.pos[0] - x, v.pos[2] - z) < T.vantage.hillView)) continue;
      b.trees.push(x, z, h, r, conifer ? 0 : 1);
      if (m > th && g === GROUND.grass && !park) b.ground[ti] = GROUND.forest;
    }
  }
  // Forest floor under the wooded patches, even where no trunk landed in the tile.
  if (F.wooded > 0) {
    for (let ty = 0; ty < SIZE / TILE; ty++) {
      for (let tx = 0; tx < SIZE / TILE; tx++) {
        const i = ty * (SIZE / TILE) + tx;
        if (b.ground[i] === GROUND.grass && homeClear((tx + 0.5) * TILE, (ty + 0.5) * TILE) && wood((tx + 0.5) * TILE, (ty + 0.5) * TILE) > th + 0.03) b.ground[i] = GROUND.forest;
      }
    }
  }

  // --- tall grass / shrubs ---
  const G = Math.sqrt(10000 / F.grassPerHa);
  const seedG = Math.floor(rand(rng) * 0x7fffffff);
  for (let cz = 0; cz < SIZE / G; cz++) {
    for (let cx = 0; cx < SIZE / G; cx++) {
      const x = (cx + rand(rng)) * G;
      const z = (cz + rand(rng)) * G;
      const size = rand(rng);
      if (x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
      const ti = tileIndex(x, z);
      const g = b.ground[ti]!;
      if (b.occupied[ti] || (g !== GROUND.grass && g !== GROUND.forest && g !== GROUND.park)) continue;
      if (fbm(x / 60, z / 60, seedG, 2) < -0.1 || !homeClear(x, z)) continue;
      b.grass.push(x, z, 0.5 + size * 0.9);
    }
  }

  // --- rocks ---
  const rocks = Math.round(F.rocks);
  for (let i = 0, tries = 0; i < rocks && tries < rocks * 12; tries++) {
    const x = randRange(rng, 6, SIZE - 6);
    const z = randRange(rng, 6, SIZE - 6);
    const size = rand(rng);
    const keep = rand(rng);
    const ti = tileIndex(x, z);
    const g = b.ground[ti]!;
    if (b.occupied[ti] || g === GROUND.road || g === GROUND.track || g === GROUND.field || g === GROUND.paved) continue;
    if (!homeClear(x, z) || !clearOfVantage(x, z)) continue;
    const slope = slopeAt(x, z);
    if (keep > 0.25 + slope * 1.3) continue;
    const r = 0.45 + size * size * 2.6;
    b.rocks.push({ x, z, y: hAt(b, x, z), r, h: r * (chance(rng, 0.2) ? 1.5 : randRange(rng, 0.6, 1.1)) });
    i++;
  }
}
