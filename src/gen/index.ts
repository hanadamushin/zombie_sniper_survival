// Deterministic tactical-map generation — owner: 03.
//
//   const map = generateTacticalMap({ mapSeed, land, isHome, lootSpots });
//
// Pure: the same parameters always give the same map (it is never saved; sim and render rebuild
// it from the seed). No Three.js, no DOM. Sub-streams come from fork(seedRng(mapSeed), label).
//
// Pipeline: terrain -> home flattening -> roads / buildings (lands.ts) -> hill vantage points ->
// trees / grass / rocks (flora.ts) -> extra towers until there are enough vantage points ->
// loot spots -> spawn points -> nav grid, spatial hash, apron.

import { randInt, randRange } from '../core/rng.ts';
import { TACTICAL } from '../data/tactical.ts';
import { addTower, createBuilder, hAt, homeDist, N, rectFree, rngOf, SIZE, TILE, TILES, tileIndex, type Builder } from './builder.ts';
import { scatterCover } from './cover.ts';
import { cacheAmmo } from './caches.ts';
import { BALANCE } from '../data/balance.ts';
import { heightStats, scatterFlora } from './flora.ts';
import { sampleHeight } from './height.ts';
import { layout, terrainFn } from './lands.ts';
import { smoothstep } from './noise.ts';
import { detailOf } from './buildings/index.ts';
import { GROUND, type Brush, type GenParams, type LootSpot, type Solid, type StaticHash, type TacticalMap } from './types.ts';

export * from './types.ts';
export { sampleHeight, sampleGradient } from './height.ts';

const T = TACTICAL;
const MID = SIZE / 2;

function flattenHome(b: Builder): void {
  let sum = 0;
  let count = 0;
  for (let z = MID - 60; z <= MID + 60; z += 12) {
    for (let x = MID - 60; x <= MID + 60; x += 12) {
      sum += hAt(b, x, z);
      count++;
    }
  }
  const level = sum / count;
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const d = homeDist(ix * TILE, iz * TILE);
      if (d >= T.homeBlendRadius) continue;
      const w = 1 - smoothstep(T.homeFlatRadius + 6, T.homeBlendRadius, d);
      const i = iz * N + ix;
      b.height[i] = b.height[i]! * (1 - w) + level * w;
    }
  }
}

/** Hill tops that rise clearly above the surrounding ground. */
function findHillVantages(b: Builder, median: number): void {
  const V = T.vantage;
  const step = 16;
  const cands: { x: number; z: number; h: number }[] = [];
  for (let z = 48; z <= SIZE - 48; z += step) {
    for (let x = 48; x <= SIZE - 48; x += step) {
      const h = hAt(b, x, z);
      if (h < median + V.hillProminence || b.occupied[tileIndex(x, z)]) continue;
      let top = true;
      for (let dz = -3; dz <= 3 && top; dz++) for (let dx = -3; dx <= 3; dx++) if (hAt(b, x + dx * step, z + dz * step) > h) { top = false; break; }
      if (top) cands.push({ x, z, h });
    }
  }
  cands.sort((a, c) => c.h - a.h || a.z - c.z || a.x - c.x);
  const chosen: typeof cands = [];
  for (const c of cands) {
    if (chosen.length >= 4) break;
    if (chosen.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= V.separation)) chosen.push(c);
  }
  for (const c of chosen) b.vantages.push({ pos: [c.x, c.h, c.z], kind: 'hill' });
}

const goodVantages = (b: Builder, median: number): number => b.vantages.filter((v) => v.pos[1] >= median + 6).length;

/** Guarantee the minimum number of elevated firing positions by adding lookout towers. */
function fillVantages(b: Builder, median: number): void {
  const V = T.vantage;
  const rng = rngOf(b, 'towers');
  for (let round = 0; round < 6 && goodVantages(b, median) < V.min; round++) {
    let best: { x: number; z: number; h: number } | null = null;
    for (let i = 0; i < 80; i++) {
      const x = randRange(rng, 60, SIZE - 60);
      const z = randRange(rng, 60, SIZE - 60);
      if (b.params.isHome && homeDist(x, z) < T.homeFlatRadius + 30) continue;
      if (!rectFree(b, x - 4.5, z - 4.5, x + 4.5, z + 4.5, 12)) continue;
      if (b.vantages.some((v) => Math.hypot(v.pos[0] - x, v.pos[2] - z) < V.separation - round * 25)) continue;
      const h = hAt(b, x, z);
      if (!best || h > best.h) best = { x, z, h };
    }
    if (best) addTower(b, best.x, best.z, Math.max(V.towerHeight, median + 7 - best.h), randInt(rng, 0, 3) as 0 | 1 | 2 | 3);
  }
}

function placeLootSpots(b: Builder): LootSpot[] {
  const rng = rngOf(b, 'loot');
  const pool = b.buildings.filter((bd) => bd.lootable);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const blocked = (x: number, z: number): boolean =>
    x < 3 || z < 3 || x > SIZE - 3 || z > SIZE - 3 || b.solids.some((s) => x > s.x0 - 0.5 && x < s.x1 + 0.5 && z > s.z0 - 0.5 && z < s.z1 + 0.5);
  const spots: LootSpot[] = [];
  for (const bd of pool) {
    if (spots.length >= b.params.lootSpots) break;
    if (bd.enter !== undefined) {
      // 07d: an enterable building is searched at its shelves, desks and lockers (each one a spot).
      const det = detailOf(b.placements[bd.enter]!);
      for (const sp of det.search) {
        if (spots.length >= b.params.lootSpots) break;
        if (det.bp.rooms[sp.room]?.locked) continue;
        spots.push({ id: spots.length, pos: [sp.wpos[0], sp.wpos[2]], building: bd.id, y: sp.wpos[1], table: sp.table });
      }
      continue;
    }
    const cx = (bd.x0 + bd.x1) / 2;
    const cz = (bd.z0 + bd.z1) / 2;
    const doors: [number, number][] = [[cx, bd.z1 + 1.3], [cx, bd.z0 - 1.3], [bd.x1 + 1.3, cz], [bd.x0 - 1.3, cz]];
    const first = randInt(rng, 0, 3);
    for (let k = 0; k < 4; k++) {
      const door = doors[(first + k) % 4]!;
      if (blocked(door[0], door[1])) continue;
      spots.push({ id: spots.length, pos: door, building: bd.id });
      break;
    }
  }
  return spots;
}

/**
 * Ammunition caches (07c): in front of a building that is not a search point, or else beside a
 * road; never in the middle of the home base. As many as cacheAmmo() says.
 */
function placeCaches(b: Builder, loot: LootSpot[]): { pos: [number, number]; ammo: number }[] {
  const ammo = cacheAmmo(b.params.mapSeed, b.params.land);
  if (ammo.length === 0) return [];
  const rng = rngOf(b, 'caches.place');
  const C = BALANCE.world.caches;
  const used = new Set(loot.map((l) => l.building));
  const blocked = (x: number, z: number): boolean =>
    x < 8 || z < 8 || x > SIZE - 8 || z > SIZE - 8 || (b.params.isHome && homeDist(x, z) < C.homeClear) ||
    b.solids.some((s) => x > s.x0 - 0.8 && x < s.x1 + 0.8 && z > s.z0 - 0.8 && z < s.z1 + 0.8);
  const spots: [number, number][] = [];
  const pool = b.buildings.filter((bd) => bd.kind !== 'tower' && !used.has(bd.id));
  for (let tries = 0; tries < 60 && spots.length < ammo.length && pool.length > 0; tries++) {
    const bd = pool.splice(randInt(rng, 0, pool.length - 1), 1)[0]!;
    const cx = (bd.x0 + bd.x1) / 2;
    const cz = (bd.z0 + bd.z1) / 2;
    const door: [number, number] = [[cx, bd.z1 + 1.6], [cx, bd.z0 - 1.6], [bd.x1 + 1.6, cz], [bd.x0 - 1.6, cz]][randInt(rng, 0, 3)] as [number, number];
    if (!blocked(door[0], door[1]) && spots.every((p) => Math.hypot(p[0] - door[0], p[1] - door[1]) > 40)) spots.push(door);
  }
  for (let tries = 0; tries < 200 && spots.length < ammo.length && b.roads.length > 0; tries++) {
    const road = b.roads[randInt(rng, 0, b.roads.length - 1)]!;
    const pt = road.pts[randInt(rng, 0, road.pts.length - 1)]!;
    const side = road.width / 2 + randRange(rng, 1.5, 3);
    const a = randRange(rng, 0, Math.PI * 2);
    const p: [number, number] = [pt[0] + Math.cos(a) * side, pt[1] + Math.sin(a) * side];
    if (!blocked(p[0], p[1]) && spots.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 40)) spots.push(p);
  }
  for (let tries = 0; tries < 200 && spots.length < ammo.length; tries++) {
    const p: [number, number] = [randRange(rng, 40, SIZE - 40), randRange(rng, 40, SIZE - 40)];
    if (!blocked(p[0], p[1])) spots.push(p);
  }
  return spots.map((pos, i) => ({ pos, ammo: ammo[i]! }));
}

function edgeSpawn(b: Builder): { edge: [number, number]; edgeYaw: number } {
  const onEdge = (p: [number, number]): boolean => p[0] <= 0.5 || p[1] <= 0.5 || p[0] >= SIZE - 0.5 || p[1] >= SIZE - 0.5;
  // Prefer the road end closest to the middle of its side (towns have many).
  let best: { p: [number, number]; q: [number, number]; score: number } | null = null;
  for (const road of b.roads) {
    const ends: [[number, number], [number, number]][] = [
      [road.pts[0]!, road.pts[1]!],
      [road.pts[road.pts.length - 1]!, road.pts[road.pts.length - 2]!],
    ];
    for (const [p, q] of ends) {
      if (!onEdge(p)) continue;
      const score = Math.abs(p[0] - MID) + Math.abs(p[1] - MID) - road.width;
      if (!best || score < best.score) best = { p, q, score };
    }
  }
  if (!best) return { edge: [MID, SIZE - 10], edgeYaw: 0 };
  const dx = best.q[0] - best.p[0];
  const dz = best.q[1] - best.p[1];
  const len = Math.hypot(dx, dz) || 1;
  const inset = 10;
  const m = T.player.edgeMargin + 4;
  const clamp = (v: number): number => Math.min(SIZE - m, Math.max(m, v));
  return {
    edge: [clamp(best.p[0] + (dx / len) * inset), clamp(best.p[1] + (dz / len) * inset)],
    // Forward is (-sin yaw, -cos yaw).
    edgeYaw: Math.atan2(-dx, -dz),
  };
}

function buildWalkGrid(b: Builder): Uint8Array {
  const walk = new Uint8Array(TILES * TILES).fill(1);
  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {
      const i = ty * N + tx;
      const h00 = b.height[i]!;
      const h10 = b.height[i + 1]!;
      const h01 = b.height[i + N]!;
      const h11 = b.height[i + N + 1]!;
      const edge = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00), Math.abs(h11 - h10), Math.abs(h11 - h01)) / TILE;
      if (edge > T.navMaxSlope) walk[ty * TILES + tx] = 0;
    }
  }
  const block = (x0: number, z0: number, x1: number, z1: number, grow: number): void => {
    const tx0 = Math.max(0, Math.floor((x0 - grow) / TILE));
    const ty0 = Math.max(0, Math.floor((z0 - grow) / TILE));
    const tx1 = Math.min(TILES - 1, Math.floor((x1 + grow) / TILE));
    const ty1 = Math.min(TILES - 1, Math.floor((z1 + grow) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const cx = (tx + 0.5) * TILE;
        const cz = (ty + 0.5) * TILE;
        if (cx > x0 - grow && cx < x1 + grow && cz > z0 - grow && cz < z1 + grow) walk[ty * TILES + tx] = 0;
      }
    }
  };
  for (const s of b.solids) {
    if (s.kind === 'building') block(s.x0, s.z0, s.x1, s.z1, 0.6);
    else if (s.kind === 'stair') block(s.x0, s.z0, s.x1, s.z1, 0.2);
    else if (s.kind === 'rock' && s.x1 - s.x0 > 2.4) block(s.x0, s.z0, s.x1, s.z1, 0.3);
  }
  return walk;
}

/** Bucket solids and tree trunks into the 16 m hash used by collision queries. */
export function buildStaticHash(solids: readonly Solid[], treeX: Float32Array, treeZ: Float32Array, treeCount: number, brush: readonly Brush[] = []): StaticHash {
  const cell = T.hashCell;
  const n = SIZE / cell;
  const hash: StaticHash = { cell, n, solids: Array.from({ length: n * n }, () => []), trees: Array.from({ length: n * n }, () => []), brush: Array.from({ length: n * n }, () => []) };
  const clamp = (v: number): number => Math.min(n - 1, Math.max(0, v));
  solids.forEach((s, index) => {
    const cx1 = clamp(Math.floor(s.x1 / cell));
    const cz1 = clamp(Math.floor(s.z1 / cell));
    for (let cz = clamp(Math.floor(s.z0 / cell)); cz <= cz1; cz++) for (let cx = clamp(Math.floor(s.x0 / cell)); cx <= cx1; cx++) hash.solids[cz * n + cx]!.push(index);
  });
  brush.forEach((br, index) => {
    const cx1 = clamp(Math.floor((Math.max(br.ax, br.bx) + br.r) / cell));
    const cz1 = clamp(Math.floor((Math.max(br.az, br.bz) + br.r) / cell));
    for (let cz = clamp(Math.floor((Math.min(br.az, br.bz) - br.r) / cell)); cz <= cz1; cz++) {
      for (let cx = clamp(Math.floor((Math.min(br.ax, br.bx) - br.r) / cell)); cx <= cx1; cx++) hash.brush[cz * n + cx]!.push(index);
    }
  });
  for (let i = 0; i < treeCount; i++) hash.trees[clamp(Math.floor(treeZ[i]! / cell)) * n + clamp(Math.floor(treeX[i]! / cell))]!.push(i);
  return hash;
}

/** Turn a builder into the immutable map (nav grid, hash, typed arrays). */
export function finishMap(b: Builder, terrain?: (x: number, z: number) => number): TacticalMap {
  for (const r of b.rocks) {
    const half = r.r * 0.72;
    b.solids.push({ x0: r.x - half, z0: r.z - half, x1: r.x + half, z1: r.z + half, y0: r.y - 2, y1: r.y + r.h * 0.8, kind: 'rock', ref: -1 });
  }
  const tn = b.trees.length / 5;
  const trees = { n: tn, x: new Float32Array(tn), z: new Float32Array(tn), y: new Float32Array(tn), h: new Float32Array(tn), r: new Float32Array(tn), kind: new Uint8Array(tn) };
  for (let i = 0; i < tn; i++) {
    trees.x[i] = b.trees[i * 5]!;
    trees.z[i] = b.trees[i * 5 + 1]!;
    trees.y[i] = hAt(b, trees.x[i]!, trees.z[i]!);
    trees.h[i] = b.trees[i * 5 + 2]!;
    trees.r[i] = b.trees[i * 5 + 3]!;
    trees.kind[i] = b.trees[i * 5 + 4]!;
  }
  const gn = b.grass.length / 3;
  const grass = { n: gn, x: new Float32Array(gn), z: new Float32Array(gn), y: new Float32Array(gn), s: new Float32Array(gn) };
  for (let i = 0; i < gn; i++) {
    grass.x[i] = b.grass[i * 3]!;
    grass.z[i] = b.grass[i * 3 + 1]!;
    grass.y[i] = hAt(b, grass.x[i]!, grass.z[i]!);
    grass.s[i] = b.grass[i * 3 + 2]!;
  }

  // Coarse surroundings for the renderer; samples on the playable square use the real heights.
  const rings = T.apronRings;
  const ac = T.apronCell;
  const apronN = SIZE / ac + rings * 2 + 1;
  const apron = new Float32Array(apronN * apronN);
  for (let j = 0; j < apronN; j++) {
    for (let i = 0; i < apronN; i++) {
      const x = (i - rings) * ac;
      const z = (j - rings) * ac;
      const inside = x >= 0 && x <= SIZE && z >= 0 && z <= SIZE;
      apron[j * apronN + i] = inside || !terrain ? sampleHeight(b.height, N, TILE, x, z) : terrain(x, z);
    }
  }

  const spawn = edgeSpawn(b);
  const loot = placeLootSpots(b);
  return {
    params: b.params,
    size: SIZE,
    tile: TILE,
    n: N,
    tiles: TILES,
    height: b.height,
    ground: b.ground,
    walk: buildWalkGrid(b),
    buildings: b.buildings,
    placements: b.placements,
    solids: b.solids,
    ladders: b.ladders,
    roads: b.roads,
    areas: b.areas,
    trees,
    grass,
    rocks: b.rocks,
    brush: b.brush,
    props: b.props,
    lootSpots: loot,
    caches: placeCaches(b, loot),
    vantages: b.vantages,
    spawn: { home: [MID, MID], edge: spawn.edge, edgeYaw: spawn.edgeYaw },
    hash: buildStaticHash(b.solids, trees.x, trees.z, tn, b.brush),
    apron,
    apronN,
  };
}

export function generateTacticalMap(params: GenParams): TacticalMap {
  const b = createBuilder(params);
  const terrain = terrainFn(b);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) b.height[iz * N + ix] = terrain(ix * TILE, iz * TILE);
  if (params.land === 'urban') b.ground.fill(GROUND.paved);
  if (params.isHome) flattenHome(b);
  layout(b, params.land);
  const { median } = heightStats(b);
  findHillVantages(b, median);
  fillVantages(b, median);
  scatterFlora(b);
  scatterCover(b);
  // Bare rock on the steepest ground (texture + flora rules of later sessions).
  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {
      const i = ty * N + tx;
      const slope = Math.max(Math.abs(b.height[i + 1]! - b.height[i]!), Math.abs(b.height[i + N]! - b.height[i]!)) / TILE;
      const t = ty * TILES + tx;
      if (slope > 0.85 && (b.ground[t] === GROUND.grass || b.ground[t] === GROUND.forest)) b.ground[t] = GROUND.rock;
    }
  }
  return finishMap(b, terrain);
}

/** Seed of the operation area of a cell: stable for a given game, different per cell. */
export function mapSeedFor(gameSeed: number, cell: number): number {
  let h = (gameSeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (cell + 0x7f4a7c15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
