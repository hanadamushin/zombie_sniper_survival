// Cover (07b): everything that breaks the view of someone walking on the ground, so that the far
// view belongs to the high firing positions. Terrain features (embankments, a creek), sight-blocking
// vegetation (hedges, windbreaks, homestead groves, bamboo, reed beds, thickets) and box scenery
// (lone barns, greenhouse frames, wrecks, fallen logs).
//
// Brush never blocks movement or bullets — only lines of sight (collision.ts sightBlocked) — and
// it keeps away from roads, buildings, the home base and the view from hill tops.

import { chance, rand, randInt, randRange, type RngState } from '../core/rng.ts';
import { TACTICAL } from '../data/tactical.ts';
import { forTiles, hAt, heightRange, homeDist, inHomeZone, N, occupy, rectFree, resample, rngOf, SIZE, TILE, TILES, tileIndex, type Builder } from './builder.ts';
import { hash01, smoothstep } from './noise.ts';
import { editFade } from './world.ts';
import { GROUND, type BrushKind } from './types.ts';

const T = TACTICAL;
const C = T.cover;

// ---------------------------------------------------------------------------------------------
// Terrain features
// ---------------------------------------------------------------------------------------------

/** Distance from (x, z) to a polyline given as points every few metres. */
function forNear(samples: readonly [number, number][], reach: number, fn: (index: number, d: number) => void): void {
  const best = new Float32Array(N * N).fill(Infinity);
  for (const [x, z] of samples) {
    const ix0 = Math.max(0, Math.ceil((x - reach) / TILE));
    const ix1 = Math.min(N - 1, Math.floor((x + reach) / TILE));
    const iz0 = Math.max(0, Math.ceil((z - reach) / TILE));
    const iz1 = Math.min(N - 1, Math.floor((z + reach) / TILE));
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const d = Math.hypot(ix * TILE - x, iz * TILE - z);
        const i = iz * N + ix;
        if (d < best[i]!) best[i] = d;
      }
    }
  }
  for (let i = 0; i < N * N; i++) if (best[i]! < reach) fn(i, best[i]!);
}

function markTiles(b: Builder, samples: readonly [number, number][], half: number, fn: (tile: number) => void): void {
  for (const [x, z] of samples) {
    forTiles(x - half, z - half, x + half, z + half, (i, tx, ty) => {
      if (Math.hypot((tx + 0.5) * TILE - x, (ty + 0.5) * TILE - z) <= half + TILE * 0.35) fn(i);
    });
  }
}

/** Embankment along a polyline: a grassy bank a walker cannot see over, with a path on its crest. */
export function addDike(b: Builder, pts: [number, number][], height: number): void {
  const R = C.rural;
  const samples = resample(pts, 2);
  const reach = R.dikeCrest + R.dikeSlope;
  forNear(samples, reach, (i, d) => {
    // Fade out towards the map edge so that the apron (which does not know the dike) still meets it.
    const x = (i % N) * TILE;
    const z = Math.floor(i / N) * TILE;
    const edge = editFade(x, z);
    const home = b.params.isHome ? smoothstep(T.homeFlatRadius + 4, T.homeFlatRadius + 40, homeDist(x, z)) : 1;
    b.height[i] = b.height[i]! + height * (1 - smoothstep(R.dikeCrest, reach, d)) * edge * home;
  });
  markTiles(b, samples, R.dikeCrest + 2, (i) => {
    b.occupied[i] = 1;
  });
}

/** Creek bed cut into the ground: bare gravel, no trees — a sight lane through the forest. */
export function addCreek(b: Builder, pts: [number, number][]): void {
  const F = C.forest;
  const samples = resample(pts, 2);
  const reach = F.creekBed + F.creekBank;
  forNear(samples, reach, (i, d) => {
    const x = (i % N) * TILE;
    const z = Math.floor(i / N) * TILE;
    const edge = editFade(x, z);
    const home = b.params.isHome ? smoothstep(T.homeFlatRadius + 4, T.homeFlatRadius + 40, homeDist(x, z)) : 1;
    b.height[i] = b.height[i]! - F.creekDepth * (1 - smoothstep(F.creekBed, reach, d)) * edge * home;
  });
  markTiles(b, samples, F.creekBed, (i) => {
    b.ground[i] = GROUND.rock;
    b.occupied[i] = 1;
  });
  b.lanes.push(pts);
}

/** Level the ground under a field plot (a terrace). Returns the level. */
export function terrace(b: Builder, x0: number, z0: number, x1: number, z1: number): number {
  const ix0 = Math.ceil(x0 / TILE);
  const ix1 = Math.floor(x1 / TILE);
  const iz0 = Math.ceil(z0 / TILE);
  const iz1 = Math.floor(z1 / TILE);
  let sum = 0;
  let count = 0;
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
    sum += b.height[iz * N + ix]!;
    count++;
  }
  if (count === 0) return hAt(b, (x0 + x1) / 2, (z0 + z1) / 2);
  const level = sum / count;
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) b.height[iz * N + ix] = level;
  return level;
}

// ---------------------------------------------------------------------------------------------
// Scenery (placed by the layout, before the fields)
// ---------------------------------------------------------------------------------------------

/** Lone barns and sheds, greenhouse frames and wrecked vehicles of the countryside. */
export function ruralScenery(b: Builder, rng: RngState, tryBarn: (x: number, z: number, big: boolean) => boolean): void {
  const R = C.rural;
  const want = randInt(rng, R.barns[0], R.barns[1]);
  for (let i = 0, tries = 0; i < want && tries < want * 30; tries++) {
    if (tryBarn(randRange(rng, 40, SIZE - 40), randRange(rng, 40, SIZE - 40), chance(rng, 0.45))) i++;
  }

  const houses = randInt(rng, R.greenhouses[0], R.greenhouses[1]);
  for (let i = 0, tries = 0; i < houses && tries < houses * 30; tries++) {
    const alongX = chance(rng, 0.5);
    const w = randRange(rng, 18, 30);
    const d = randRange(rng, 5.5, 7);
    const x = randRange(rng, 40, SIZE - 40);
    const z = randRange(rng, 40, SIZE - 40);
    const hx = (alongX ? w : d) / 2;
    const hz = (alongX ? d : w) / 2;
    if (!rectFree(b, x - hx - 2, z - hz - 2, x + hx + 2, z + hz + 2, 12) || inHomeZone(b, x - hx, z - hz, x + hx, z + hz, 12)) continue;
    const [lo, hi] = heightRange(b, x - hx, z - hz, x + hx, z + hz);
    if (hi - lo > 1.2) continue;
    b.props.push({ kind: 'greenhouse', x, z, y: lo, w, d, h: randRange(rng, 2.6, 3.1), alongX, tint: rand(rng) });
    occupy(b, x - hx, z - hz, x + hx, z + hz);
    i++;
  }

  // Wrecks: left where they stopped, on or beside the roads.
  const wrecks = randInt(rng, R.wrecks[0], R.wrecks[1]);
  for (let i = 0, tries = 0; i < wrecks && tries < wrecks * 20 && b.roads.length > 0; tries++) {
    const road = b.roads[randInt(rng, 0, b.roads.length - 1)]!;
    const k = randInt(rng, 0, road.pts.length - 2);
    const [ax, az] = road.pts[k]!;
    const [cx, cz] = road.pts[k + 1]!;
    const t = rand(rng);
    const side = randRange(rng, -1, 1) * (road.width / 2 + 0.6);
    const len = Math.hypot(cx - ax, cz - az) || 1;
    const x = ax + (cx - ax) * t + (-(cz - az) / len) * side;
    const z = az + (cz - az) * t + ((cx - ax) / len) * side;
    const truck = chance(rng, 0.3);
    if (addVehicle(b, x, z, Math.abs(cx - ax) >= Math.abs(cz - az), truck, rand(rng))) i++;
  }
}

function overlapsSolid(b: Builder, x0: number, z0: number, x1: number, z1: number): boolean {
  return b.solids.some((s) => x1 > s.x0 && x0 < s.x1 && z1 > s.z0 && z0 < s.z1);
}

function addVehicle(b: Builder, x: number, z: number, alongX: boolean, truck: boolean, tint: number): boolean {
  const w = truck ? 6.4 : 4.3;
  const d = truck ? 2.3 : 1.8;
  const h = truck ? 2.7 : 1.5;
  const hx = (alongX ? w : d) / 2;
  const hz = (alongX ? d : w) / 2;
  if (x - hx < 12 || z - hz < 12 || x + hx > SIZE - 12 || z + hz > SIZE - 12) return false;
  if (inHomeZone(b, x - hx, z - hz, x + hx, z + hz, 10) || overlapsSolid(b, x - hx - 3, z - hz - 3, x + hx + 3, z + hz + 3)) return false;
  const [lo, hi] = heightRange(b, x - hx, z - hz, x + hx, z + hz);
  if (hi - lo > 1) return false;
  b.props.push({ kind: truck ? 'truck' : 'car', x, z, y: lo, w, d, h: hi - lo + h, alongX, tint });
  b.solids.push({ x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz, y0: lo - 1, y1: hi + h, kind: 'scenery', ref: -1 });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Brush
// ---------------------------------------------------------------------------------------------

interface Rules {
  /** May stand here at all (bounds, roads, buildings, the home base, vantage points)? */
  ok(x: number, z: number, h: number, margin: number): boolean;
  /** Tiles near a sight lane (forest track, creek). */
  lane: Uint8Array;
}

function rulesOf(b: Builder): Rules {
  const V = T.vantage;
  const lane = new Uint8Array(TILES * TILES);
  const clear = C.forest.laneClear;
  const lanes = [...b.lanes, ...(b.params.land === 'forest' ? b.roads.map((r) => r.pts) : [])];
  for (const pts of lanes) markTiles(b, resample(pts, 3), clear, (i) => {
    lane[i] = 1;
  });
  // Building footprints per tile (a hedge may run along a wall, not through it).
  const built = new Uint8Array(TILES * TILES);
  for (const s of b.solids) {
    if (s.kind === 'rock') continue;
    forTiles(s.x0 - C.buildingGap, s.z0 - C.buildingGap, s.x1 + C.buildingGap, s.z1 + C.buildingGap, (i) => {
      built[i] = 1;
    });
  }
  const solids = b.solids.filter((s) => s.kind !== 'rock');
  return {
    lane,
    ok(x, z, h, margin) {
      if (x < C.edge || z < C.edge || x > SIZE - C.edge || z > SIZE - C.edge) return false;
      const ti = tileIndex(x, z);
      const g = b.ground[ti]!;
      if (g === GROUND.road || g === GROUND.track || g === GROUND.paved || g === GROUND.rock) return false;
      if (b.params.isHome && homeDist(x, z) < T.homeFlatRadius + 10 + margin) return false;
      if (built[ti]) {
        const gap = C.buildingGap + margin;
        for (const s of solids) if (x > s.x0 - gap && x < s.x1 + gap && z > s.z0 - gap && z < s.z1 + gap) return false;
      }
      const top = hAt(b, x, z) + h;
      for (const v of b.vantages) {
        const d = Math.hypot(v.pos[0] - x, v.pos[2] - z);
        if (v.kind !== 'hill') {
          if (d < C.vantageGap + margin) return false;
        } else if (d < V.hillClear + margin || (d < V.hillView && top > v.pos[1] + 1)) return false;
      }
      return true;
    },
  };
}

/** Hedge along a -> c: one capsule per stretch of allowed ground (it stops for roads, walls, the base). */
function hedgeLine(b: Builder, rules: Rules, kind: BrushKind, ax: number, az: number, cx: number, cz: number, r: number, h: number, onRun?: (x0: number, z0: number, x1: number, z1: number) => void): void {
  const len = Math.hypot(cx - ax, cz - az);
  if (len < 4) return;
  const k = Math.ceil(len / 2);
  let start = -1;
  const flush = (end: number): void => {
    if (start < 0) return;
    if ((end - start) * (len / k) >= 5) {
      const x0 = ax + ((cx - ax) * start) / k;
      const z0 = az + ((cz - az) * start) / k;
      const x1 = ax + ((cx - ax) * end) / k;
      const z1 = az + ((cz - az) * end) / k;
      b.brush.push({ kind, ax: x0, az: z0, bx: x1, bz: z1, r, h });
      onRun?.(x0, z0, x1, z1);
    }
    start = -1;
  };
  for (let i = 0; i <= k; i++) {
    const x = ax + ((cx - ax) * i) / k;
    const z = az + ((cz - az) * i) / k;
    if (rules.ok(x, z, h, 0)) {
      if (start < 0) start = i;
    } else flush(i - 1);
  }
  flush(k);
}

/** A row of trees along a stretch of hedge. */
function treeRow(b: Builder, rules: Rules, rng: RngState, x0: number, z0: number, x1: number, z1: number, every: number, conifer: number): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  for (let d = every * 0.5; d < len; d += every * randRange(rng, 0.8, 1.25)) {
    const x = x0 + ((x1 - x0) * d) / len + randRange(rng, -0.6, 0.6);
    const z = z0 + ((z1 - z0) * d) / len + randRange(rng, -0.6, 0.6);
    const isConifer = rand(rng) < conifer;
    const size = rand(rng);
    const h = isConifer ? 9 + size * 5 : 6.5 + size * 4.5;
    if (!rules.ok(x, z, h, 1)) continue;
    b.trees.push(x, z, h, isConifer ? 1.6 + size : 2.4 + size * 1.6, isConifer ? 0 : 1);
  }
}

function patch(b: Builder, rules: Rules, rng: RngState, kind: BrushKind, x: number, z: number, length: number, r: number, h: number): boolean {
  const a = rand(rng) * Math.PI;
  const dx = (Math.cos(a) * length) / 2;
  const dz = (Math.sin(a) * length) / 2;
  // The whole capsule must stand on allowed ground (sampled along its axis and at its sides).
  const k = Math.max(1, Math.ceil(length / 4));
  for (let i = 0; i <= k; i++) {
    const px = x - dx + (2 * dx * i) / k;
    const pz = z - dz + (2 * dz * i) / k;
    if (!rules.ok(px, pz, h, r * 0.6) || !rules.ok(px + r * 0.7, pz, h, 0) || !rules.ok(px - r * 0.7, pz, h, 0) || !rules.ok(px, pz + r * 0.7, h, 0) || !rules.ok(px, pz - r * 0.7, h, 0)) return false;
  }
  b.brush.push({ kind, ax: x - dx, az: z - dz, bx: x + dx, bz: z + dz, r, h });
  return true;
}

function ruralCover(b: Builder, rules: Rules): void {
  const R = C.rural;
  const rng = rngOf(b, 'cover');

  // R3: the share of overgrown fields, lower where a real area has hundreds of plots.
  const fields = b.areas.reduce((n, a) => n + (a.kind === 'field' ? 1 : 0), 0);
  const overgrown = Math.min(R.overgrown, R.overgrownMax / Math.max(1, fields));
  const plots = b.areas.reduce((n, a) => n + (a.kind === 'field' || a.kind === 'paddy' ? 1 : 0), 0);
  const plotShare = Math.min(1, R.plotMax / Math.max(1, plots));
  // --- hedges and windbreaks along the north and west side of the field plots ---
  for (const a of b.areas) {
    if (a.kind !== 'field' && a.kind !== 'paddy') continue;
    const factor = (a.kind === 'paddy' ? R.paddyFactor : 1) * plotShare;
    const sides: [number, number, number, number][] = [
      [a.x0 - 1, a.z0 - 1.5, a.x1 + 1, a.z0 - 1.5],
      [a.x0 - 1.5, a.z0 - 1, a.x0 - 1.5, a.z1 + 1],
    ];
    for (const [x0, z0, x1, z1] of sides) {
      const roll = rand(rng);
      const r = randRange(rng, R.hedgeRadius[0], R.hedgeRadius[1]);
      const h = randRange(rng, R.hedgeHeight[0], R.hedgeHeight[1]);
      const gateAt = randRange(rng, 0.2, 0.8);
      if (roll >= (R.hedge + R.windbreak) * factor) continue;
      const windbreak = roll < R.windbreak * factor;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g0 = gateAt - R.gate / 2 / len;
      const g1 = gateAt + R.gate / 2 / len;
      const row = windbreak ? (p0: number, q0: number, p1: number, q1: number): void => treeRow(b, rules, rng, p0, q0, p1, q1, R.windbreakTreeEvery, 0.85) : undefined;
      const hh = windbreak ? R.windbreakHeight : h;
      hedgeLine(b, rules, 'hedge', x0, z0, x0 + (x1 - x0) * g0, z0 + (z1 - z0) * g0, r, hh, row);
      hedgeLine(b, rules, 'hedge', x0 + (x1 - x0) * g1, z0 + (z1 - z0) * g1, x1, z1, r, hh, row);
    }
    // Fields nobody works any more: head-high grass.
    if (a.kind === 'field' && rand(rng) < overgrown) {
      const beds = randInt(rng, R.overgrownBeds[0], R.overgrownBeds[1]);
      for (let i = 0; i < beds; i++) {
        const r = randRange(rng, R.reedRadius[0], R.reedRadius[1]);
        const x = randRange(rng, a.x0 + r, Math.max(a.x0 + r + 1, a.x1 - r));
        const z = randRange(rng, a.z0 + r, Math.max(a.z0 + r + 1, a.z1 - r));
        patch(b, rules, rng, 'reeds', x, z, randRange(rng, 0, Math.min(R.reedLength[1], (a.x1 - a.x0) * 0.5)), r, R.reedHeight);
      }
    }
  }

  // --- homestead groves: a tall hedge and trees on two sides of every farmhouse ---
  // (R3: of about groveMax of them where a real area has hundreds of houses.)
  const houses = b.buildings.reduce((n, bd) => n + (bd.kind === 'house' ? 1 : 0), 0);
  const groveShare = houses > R.groveMax ? R.groveMax / houses : 1;
  for (const bd of b.buildings) {
    if (bd.kind !== 'house') continue;
    if (groveShare < 1 && hash01(bd.id, 0x67, b.params.mapSeed) >= groveShare) continue;
    const g = R.groveGap;
    const north = chance(rng, 0.5);
    const west = chance(rng, 0.5);
    const zc = north ? bd.z0 - g : bd.z1 + g;
    const xc = west ? bd.x0 - g : bd.x1 + g;
    const row = (p0: number, q0: number, p1: number, q1: number): void => treeRow(b, rules, rng, p0, q0, p1, q1, 5, 0.4);
    hedgeLine(b, rules, 'hedge', bd.x0 - g, zc, bd.x1 + g, zc, 1.3, R.groveHeight, row);
    hedgeLine(b, rules, 'hedge', xc, bd.z0 - g, xc, bd.z1 + g, 1.3, R.groveHeight, row);
  }

  const free = (x: number, z: number): boolean => !b.occupied[tileIndex(x, z)];
  // --- bamboo groves ---
  const groves = randInt(rng, R.bamboo[0], R.bamboo[1]);
  for (let i = 0, tries = 0; i < groves && tries < groves * 40; tries++) {
    const x = randRange(rng, 30, SIZE - 30);
    const z = randRange(rng, 30, SIZE - 30);
    const r = randRange(rng, R.bambooRadius[0], R.bambooRadius[1]);
    const length = randRange(rng, R.bambooLength[0], R.bambooLength[1]);
    if (!free(x, z)) continue;
    if (patch(b, rules, rng, 'bamboo', x, z, length, r, R.bambooHeight)) i++;
  }
  // --- reed beds: the lowest of a few candidate spots (hollows, the foot of a bank) ---
  const beds = randInt(rng, R.reeds[0], R.reeds[1]);
  for (let i = 0, tries = 0; i < beds && tries < beds * 30; tries++) {
    let best: [number, number] | null = null;
    let low = Infinity;
    for (let k = 0; k < 5; k++) {
      const x = randRange(rng, 20, SIZE - 20);
      const z = randRange(rng, 20, SIZE - 20);
      const rel = hAt(b, x, z) - (hAt(b, x + 30, z) + hAt(b, x - 30, z) + hAt(b, x, z + 30) + hAt(b, x, z - 30)) / 4;
      if (free(x, z) && rel < low) {
        low = rel;
        best = [x, z];
      }
    }
    const r = randRange(rng, R.reedRadius[0], R.reedRadius[1]);
    const length = randRange(rng, R.reedLength[0], R.reedLength[1]);
    if (best && patch(b, rules, rng, 'reeds', best[0], best[1], length, r, R.reedHeight)) i++;
  }
  // --- bushes on the rough ground between the fields ---
  for (let i = 0, tries = 0; i < R.bushes && tries < R.bushes * 12; tries++) {
    const x = randRange(rng, 8, SIZE - 8);
    const z = randRange(rng, 8, SIZE - 8);
    const r = randRange(rng, R.bushRadius[0], R.bushRadius[1]);
    const h = randRange(rng, R.bushHeight[0], R.bushHeight[1]);
    if (!free(x, z)) continue;
    if (patch(b, rules, rng, 'bush', x, z, 0, r, h)) i++;
  }
}

function forestCover(b: Builder, rules: Rules): void {
  const F = C.forest;
  const rng = rngOf(b, 'cover');
  const cells = Math.round((SIZE * SIZE) / 10000 * F.thicketsPerHa);
  for (let i = 0; i < cells; i++) {
    const x = randRange(rng, 8, SIZE - 8);
    const z = randRange(rng, 8, SIZE - 8);
    const r = randRange(rng, F.thicketRadius[0], F.thicketRadius[1]);
    const h = randRange(rng, F.thicketHeight[0], F.thicketHeight[1]);
    const keep = rand(rng);
    const ti = tileIndex(x, z);
    if (rules.lane[ti] || b.occupied[ti]) continue;
    if (keep > (b.ground[ti] === GROUND.forest ? 1 : F.openFactor)) continue;
    patch(b, rules, rng, 'bush', x, z, 0, r, h);
  }
  // Fallen trunks: low cover to crawl behind.
  for (let i = 0, tries = 0; i < F.logs && tries < F.logs * 10; tries++) {
    const x = randRange(rng, 14, SIZE - 14);
    const z = randRange(rng, 14, SIZE - 14);
    const alongX = chance(rng, 0.5);
    const w = randRange(rng, F.logLength[0], F.logLength[1]);
    const d = randRange(rng, F.logThickness[0], F.logThickness[1]);
    const ti = tileIndex(x, z);
    if (rules.lane[ti] || b.occupied[ti] || b.ground[ti] !== GROUND.forest) continue;
    const hx = (alongX ? w : d) / 2;
    const hz = (alongX ? d : w) / 2;
    if (!rules.ok(x - hx, z - hz, 1, 1) || !rules.ok(x + hx, z + hz, 1, 1)) continue;
    const [lo, hi] = heightRange(b, x - hx, z - hz, x + hx, z + hz);
    if (hi - lo > 1.4) continue;
    b.props.push({ kind: 'log', x, z, y: lo, w, d, h: hi - lo + d * 0.9, alongX, tint: rand(rng) });
    b.solids.push({ x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz, y0: lo - 1, y1: hi + d * 0.9, kind: 'scenery', ref: -1 });
    i++;
  }
}

/** Sight-blocking vegetation of a finished layout. Call after the flora (it may add trees). */
export function scatterCover(b: Builder): void {
  const land = b.params.land;
  if (land !== 'rural' && land !== 'forest') return;
  const rules = rulesOf(b);
  if (land === 'rural') ruralCover(b, rules);
  else forestCover(b, rules);
}
