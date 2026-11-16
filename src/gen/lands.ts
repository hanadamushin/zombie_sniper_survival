// Terrain shape and settlement layout per land class.
//   urban   — avenues with long sight lines, mid / high-rise blocks, a few roofs with outside stairs
//   suburb  — street grid with rows of low houses, parks and parking lots
//   rural   — gentle ground, field plots, scattered farmsteads, wooded hills
//   forest / mountain — big relief, a single track, a few huts, ridges to shoot down from

import { chance, pick, rand, randInt, randRange, type RngState } from '../core/rng.ts';
import type { Land } from '../core/types.ts';
import { TACTICAL } from '../data/tactical.ts';
import {
  addBuilding, addLadder, addRoad, addStairs, addTower, forTiles, hAt, heightRange, homeDist, inHomeZone, occupy, rectFree, rngOf,
  SIZE, STAIR_DEPTH, STAIR_LENGTH, TILE, type Builder, type Side,
} from './builder.ts';
import { addCreek, addDike, ruralScenery, terrace } from './cover.ts';
import { fbm, noise2, ridged } from './noise.ts';
import { GROUND, type Building } from './types.ts';

const T = TACTICAL;
const MID = SIZE / 2;

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

/** Raw terrain height function of a map; also valid outside the playable square (apron). */
export function terrainFn(b: Builder): (x: number, z: number) => number {
  const land = b.params.land;
  const P = T.terrain[land];
  const rng = rngOf(b, 'terrain');
  const s1 = Math.floor(rand(rng) * 0x7fffffff);
  const s2 = Math.floor(rand(rng) * 0x7fffffff);
  const s3 = Math.floor(rand(rng) * 0x7fffffff);
  const hills: { x: number; z: number; h: number; s: number }[] = [];
  for (let i = 0; i < P.hills[0]; i++) {
    // Away from the centre (home base) but inside the map, and apart from each other.
    for (let tries = 0; tries < 40; tries++) {
      const x = randRange(rng, 130, SIZE - 130);
      const z = randRange(rng, 130, SIZE - 130);
      if (homeDist(x, z) < 290) continue;
      if (hills.some((o) => Math.hypot(o.x - x, o.z - z) < 300)) continue;
      hills.push({ x, z, h: randRange(rng, P.hills[1], P.hills[2]), s: randRange(rng, 85, 130) });
      break;
    }
  }
  // 07b: knolls and a shorter undulation. Drawn after the hills so that those stay where they were.
  const s4 = Math.floor(rand(rng) * 0x7fffffff);
  for (let i = 0; i < P.knolls[0]; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = randRange(rng, 60, SIZE - 60);
      const z = randRange(rng, 60, SIZE - 60);
      if (homeDist(x, z) < 200) continue;
      if (hills.some((o) => Math.hypot(o.x - x, o.z - z) < o.s + 60)) continue;
      hills.push({ x, z, h: randRange(rng, P.knolls[1], P.knolls[2]), s: randRange(rng, 22, 36) });
      break;
    }
  }
  const detail = land === 'urban' ? 0 : land === 'suburb' ? 0.15 : 0.5;
  const offset = P.amp + 4;
  return (x, z) => {
    let h = offset + P.amp * fbm(x / P.wave, z / P.wave, s1, 4);
    if (P.ridge > 0) {
      const r = ridged(x / (P.wave * 1.5), z / (P.wave * 1.5), s2, 3);
      h += P.ridge * r * r;
    }
    for (const hill of hills) {
      const d2 = (x - hill.x) ** 2 + (z - hill.z) ** 2;
      h += hill.h * Math.exp(-d2 / (2 * hill.s * hill.s));
    }
    if (P.mid > 0) h += P.mid * fbm(x / P.midWave, z / P.midWave, s4, 2);
    if (detail > 0) h += detail * noise2(x / 23, z / 23, s3);
    return h;
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Wandering polyline from a to b: points every ~48 m, pushed sideways by smooth noise. */
function windingPath(rng: RngState, a: [number, number], c: [number, number], wobble: number): [number, number][] {
  const seed = Math.floor(rand(rng) * 0x7fffffff);
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const k = Math.max(2, Math.round(len / 48));
  const px = -(c[1] - a[1]) / len;
  const pz = (c[0] - a[0]) / len;
  const pts: [number, number][] = [];
  for (let i = 0; i <= k; i++) {
    const t = i / k;
    const off = wobble * fbm(t * 3.1, 0.37, seed, 2);
    pts.push([
      Math.min(SIZE, Math.max(0, a[0] + (c[0] - a[0]) * t + px * off)),
      Math.min(SIZE, Math.max(0, a[1] + (c[1] - a[1]) * t + pz * off)),
    ]);
  }
  return pts;
}

/** A line across the map that keeps `clear` metres away from the centre. */
function crossing(rng: RngState, clear: number, wobble: number): [number, number][] {
  const offset = (clear + wobble + rand(rng) * 150) * (chance(rng, 0.5) ? 1 : -1);
  const a = MID + offset + randRange(rng, -60, 60);
  const c = MID + offset + randRange(rng, -60, 60);
  const clampEdge = (v: number): number => Math.min(SIZE - 40, Math.max(40, v));
  return chance(rng, 0.5)
    ? windingPath(rng, [0, clampEdge(a)], [SIZE, clampEdge(c)], wobble)
    : windingPath(rng, [clampEdge(a), 0], [clampEdge(c), SIZE], wobble);
}

function tryBuilding(
  b: Builder, kind: Building['kind'], cx: number, cz: number, w: number, d: number, h: number,
  roof: 'flat' | 'gable', tint: number, maxSlope = 2.5,
): Building | null {
  const x0 = cx - w / 2;
  const z0 = cz - d / 2;
  if (!rectFree(b, x0 - 2, z0 - 2, x0 + w + 2, z0 + d + 2, 12)) return null;
  if (inHomeZone(b, x0, z0, x0 + w, z0 + d)) return null;
  const [lo, hi] = heightRange(b, x0, z0, x0 + w, z0 + d);
  if (hi - lo > maxSlope) return null;
  return addBuilding(b, kind, x0, z0, x0 + w, z0 + d, h, { roof, tint });
}

/** First side of a building with free ground for a staircase / ladder. */
function freeSide(b: Builder, bd: Building, rng: RngState, depth: number, length: number): Side | null {
  const sides: Side[] = [0, 1, 2, 3];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [sides[i], sides[j]] = [sides[j]!, sides[i]!];
  }
  for (const side of sides) {
    const along = side < 2 ? bd.z1 - bd.z0 : bd.x1 - bd.x0;
    if (along < length) continue;
    const m = (along - length) / 2;
    let r: [number, number, number, number];
    if (side === 0) r = [bd.x0 - depth, bd.z0 + m, bd.x0 - 1.01, bd.z1 - m];
    else if (side === 1) r = [bd.x1 + 1.01, bd.z0 + m, bd.x1 + depth, bd.z1 - m];
    else if (side === 2) r = [bd.x0 + m, bd.z0 - depth, bd.x1 - m, bd.z0 - 1.01];
    else r = [bd.x0 + m, bd.z1 + 1.01, bd.x1 - m, bd.z1 + depth];
    if (rectFree(b, r[0], r[1], r[2], r[3], 4)) return side;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Towns (urban / suburb)
// ---------------------------------------------------------------------------------------------

interface Line {
  pos: number;
  width: number;
}

function gridLines(rng: RngState, cfg: (typeof T.town)[keyof typeof T.town]): Line[] {
  const lines: Line[] = [];
  let pos = randRange(rng, 26, 60);
  let k = randInt(rng, 0, cfg.avenueEvery - 1);
  while (pos < SIZE - 26) {
    const avenue = k % cfg.avenueEvery === 0;
    lines.push({ pos: Math.round(pos), width: avenue ? cfg.avenue : cfg.street });
    pos += randRange(rng, cfg.blockMin, cfg.blockMax) + (avenue ? cfg.avenue : cfg.street);
    k++;
  }
  return lines;
}

function splitLots(rng: RngState, x0: number, z0: number, x1: number, z1: number, max: number, out: [number, number, number, number][]): void {
  const w = x1 - x0;
  const d = z1 - z0;
  if (w <= max && d <= max) {
    out.push([x0, z0, x1, z1]);
    return;
  }
  const t = randRange(rng, 0.38, 0.62);
  if (w >= d) {
    const m = Math.round(x0 + w * t);
    splitLots(rng, x0, z0, m, z1, max, out);
    splitLots(rng, m, z0, x1, z1, max, out);
  } else {
    const m = Math.round(z0 + d * t);
    splitLots(rng, x0, z0, x1, m, max, out);
    splitLots(rng, x0, m, x1, z1, max, out);
  }
}

function layoutTown(b: Builder, land: 'urban' | 'suburb'): void {
  const cfg = T.town[land];
  const rng = rngOf(b, 'town');
  const xs = gridLines(rng, cfg);
  const zs = gridLines(rng, cfg);
  for (const l of xs) addRoad(b, l.width >= cfg.avenue ? 'avenue' : 'street', l.width, [[l.pos, 0], [l.pos, SIZE]]);
  for (const l of zs) addRoad(b, l.width >= cfg.avenue ? 'avenue' : 'street', l.width, [[0, l.pos], [SIZE, l.pos]]);

  // Blocks between neighbouring road lines (and between the outermost roads and the map edge).
  const spans = (lines: Line[]): [number, number, boolean][] => {
    const walk = land === 'urban' ? 3 : 1.5;
    const out: [number, number, boolean][] = [];
    let prev = 8;
    let prevAvenue = false;
    for (const l of lines) {
      const end = l.pos - l.width / 2 - walk;
      const avenue = l.width >= cfg.avenue;
      if (end - prev >= 24) out.push([prev, end, prevAvenue || avenue]);
      prev = l.pos + l.width / 2 + walk;
      prevAvenue = avenue;
    }
    if (SIZE - 8 - prev >= 24) out.push([prev, SIZE - 8, prevAvenue]);
    return out;
  };
  const blocks: { x0: number; z0: number; x1: number; z1: number; avenue: boolean }[] = [];
  for (const [x0, x1, ax] of spans(xs)) for (const [z0, z1, az] of spans(zs)) blocks.push({ x0, z0, x1, z1, avenue: ax || az });
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
  }

  const climbables: Building[] = [];
  const farFromClimbables = (x: number, z: number): boolean => climbables.every((c) => Math.hypot((c.x0 + c.x1) / 2 - x, (c.z0 + c.z1) / 2 - z) > 170);
  /** Flat-roofed building that may get an outside staircase (footprint shrinks to make room). */
  const flatBuilding = (kind: Building['kind'], x0: number, z0: number, x1: number, z1: number, h: number, wantStairs: boolean): void => {
    if (inHomeZone(b, x0, z0, x1, z1)) return;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const room = STAIR_DEPTH + 0.8;
    const canClimb = wantStairs && climbables.length < cfg.climbable && farFromClimbables(cx, cz);
    if (canClimb && x1 - x0 >= STAIR_LENGTH + room + 4 && z1 - z0 >= STAIR_LENGTH + 2) {
      const west = chance(rng, 0.5);
      const bd = addBuilding(b, kind, west ? x0 + room : x0, z0, west ? x1 : x1 - room, z1, h, { tint: rand(rng) });
      if (addStairs(b, bd, west ? 0 : 1)) climbables.push(bd);
      return;
    }
    addBuilding(b, kind, x0, z0, x1, z1, h, { tint: rand(rng) });
  };

  for (const blk of blocks) {
    const w = blk.x1 - blk.x0;
    const d = blk.z1 - blk.z0;
    if (inHomeZone(b, blk.x0, blk.z0, blk.x1, blk.z1, -40)) continue;
    const roll = rand(rng);
    if (roll < cfg.openShare && w > 30 && d > 30) {
      const kind = roll < cfg.openShare * 0.5 ? 'park' : land === 'urban' && roll > cfg.openShare * 0.8 ? 'plaza' : 'parking';
      b.areas.push({ kind, x0: blk.x0, z0: blk.z0, x1: blk.x1, z1: blk.z1, variant: rand(rng) });
      if (kind === 'park') forTiles(blk.x0, blk.z0, blk.x1, blk.z1, (i) => {
        b.ground[i] = GROUND.park;
      });
      if (kind === 'parking') {
        occupy(b, blk.x0, blk.z0, blk.x1, blk.z1);
        // A low shop at one end of the car park.
        if (w > 44) flatBuilding('shop', blk.x0 + 2, blk.z0 + 2, blk.x0 + 2 + Math.min(26, w * 0.4), blk.z0 + Math.min(d - 4, 34), randRange(rng, 4.5, 6), true);
      }
      continue;
    }

    if (land === 'urban') {
      const lots: [number, number, number, number][] = [];
      splitLots(rng, blk.x0, blk.z0, blk.x1, blk.z1, cfg.lotMax, lots);
      for (const [x0, z0, x1, z1] of lots) {
        if (chance(rng, 0.07)) continue;
        const inset = randRange(rng, 1.2, 3.2);
        const lw = x1 - x0 - inset * 2;
        const ld = z1 - z0 - inset * 2;
        if (lw < 8 || ld < 8) continue;
        const r = rand(rng);
        // Taller along the avenues and towards the middle of the map.
        const central = 1 - Math.min(1, homeDist((x0 + x1) / 2, (z0 + z1) / 2) / 620);
        let kind: Building['kind'];
        let h: number;
        if (r < 0.22 + (blk.avenue ? 0.22 : 0)) {
          kind = 'office';
          h = Math.round(randRange(rng, 5, 9 + central * 7)) * 3.4;
        } else if (r < 0.72) {
          kind = 'apartment';
          h = randInt(rng, 3, 8) * 3;
        } else if (r < 0.9) {
          kind = 'shop';
          h = randRange(rng, 4.5, 8);
        } else {
          kind = 'warehouse';
          h = randRange(rng, 7, 11);
        }
        flatBuilding(kind, x0 + inset, z0 + inset, x1 - inset, z1 - inset, h, h >= 9 && h <= 34);
      }
      continue;
    }

    // Suburb: an occasional apartment block, otherwise two back-to-back rows of houses.
    if (chance(rng, 0.09) && w > 44 && d > 44) {
      b.areas.push({ kind: 'parking', x0: blk.x0, z0: blk.z0, x1: blk.x1, z1: blk.z1, variant: rand(rng) });
      const floors = randInt(rng, 3, 5);
      const alongX = w >= d;
      const slabs = (alongX ? d : w) > 60 ? 2 : 1;
      for (let s = 0; s < slabs; s++) {
        const t = slabs === 1 ? 0.5 : 0.27 + s * 0.46;
        if (alongX) flatBuilding('apartment', blk.x0 + 5, blk.z0 + d * t - 6, blk.x1 - 5, blk.z0 + d * t + 6, floors * 3, true);
        else flatBuilding('apartment', blk.x0 + w * t - 6, blk.z0 + 5, blk.x0 + w * t + 6, blk.z1 - 5, floors * 3, true);
      }
      occupy(b, blk.x0, blk.z0, blk.x1, blk.z1);
      continue;
    }
    const alongX = w >= d;
    const length = alongX ? w : d;
    const depth = (alongX ? d : w) / 2;
    for (let row = 0; row < 2; row++) {
      let u = 0;
      while (u < length - cfg.lotMin) {
        const lot = Math.min(length - u, randRange(rng, cfg.lotMin, cfg.lotMax));
        const u0 = u;
        u += lot;
        if (chance(rng, 0.08)) continue;
        const hw = Math.min(lot - 3.5, randRange(rng, 7.5, 10.5));
        const hd = Math.min(depth - 5, randRange(rng, 6.5, 9));
        if (hw < 6 || hd < 5) continue;
        const setback = randRange(rng, 2.5, 4);
        const a0 = (alongX ? blk.x0 : blk.z0) + u0 + (lot - hw) / 2;
        const c0 = row === 0 ? (alongX ? blk.z0 : blk.x0) + setback : (alongX ? blk.z1 : blk.x1) - setback - hd;
        const x0 = alongX ? a0 : c0;
        const z0 = alongX ? c0 : a0;
        const x1 = x0 + (alongX ? hw : hd);
        const z1 = z0 + (alongX ? hd : hw);
        if (inHomeZone(b, x0, z0, x1, z1)) continue;
        if (chance(rng, 0.06)) {
          const bd = addBuilding(b, 'shop', x0, z0, x1, z1, randRange(rng, 3.6, 4.6), { tint: rand(rng) });
          if (chance(rng, 0.5)) {
            const side = freeSide(b, bd, rng, 2, 1);
            if (side !== null) addLadder(b, bd, side, randRange(rng, 0.25, 0.75));
          }
        } else {
          addBuilding(b, 'house', x0, z0, x1, z1, chance(rng, 0.25) ? 3.2 : randRange(rng, 5.6, 6.6), { roof: 'gable', tint: rand(rng) });
        }
      }
    }
    b.areas.push({ kind: 'yard', x0: blk.x0, z0: blk.z0, x1: blk.x1, z1: blk.z1, variant: rand(rng) });
  }
}

// ---------------------------------------------------------------------------------------------
// Countryside
// ---------------------------------------------------------------------------------------------

function farmstead(b: Builder, rng: RngState, x: number, z: number): void {
  const house = tryBuilding(b, 'house', x, z, randRange(rng, 8, 11), randRange(rng, 6.5, 8.5), chance(rng, 0.4) ? 3.4 : 5.8, 'gable', rand(rng));
  if (!house) return;
  const a = rand(rng) * Math.PI * 2;
  if (chance(rng, 0.75)) {
    const flat = chance(rng, 0.35);
    const barn = tryBuilding(b, 'barn', x + Math.cos(a) * 17, z + Math.sin(a) * 17, randRange(rng, 9, 13), randRange(rng, 7, 9), randRange(rng, 4.6, 6.2), flat ? 'flat' : 'gable', rand(rng));
    if (barn && flat) {
      const side = freeSide(b, barn, rng, 2, 1);
      if (side !== null) addLadder(b, barn, side, randRange(rng, 0.25, 0.75));
    }
  }
  if (chance(rng, 0.6)) tryBuilding(b, 'shed', x + Math.cos(a + 2.2) * 12, z + Math.sin(a + 2.2) * 12, randRange(rng, 3, 4.5), randRange(rng, 2.6, 3.6), 2.5, 'flat', rand(rng));
}

function layoutRural(b: Builder): void {
  const rng = rngOf(b, 'rural');
  const R = T.cover.rural;
  // Embankments first: the roads cut through them, the fields stop at them.
  const dikes = randInt(rng, R.dikes[0], R.dikes[1]);
  for (let i = 0; i < dikes; i++) addDike(b, crossing(rng, T.homeFlatRadius + 70, 50), randRange(rng, R.dikeHeight[0], R.dikeHeight[1]));
  const main = crossing(rng, T.homeFlatRadius + 40, 45);
  addRoad(b, 'street', 6, main, true);
  // Farm tracks leave the road sideways towards the map edges.
  const horizontal = Math.abs(main[main.length - 1]![0] - main[0]![0]) > SIZE / 2;
  const lanes = randInt(rng, 1, 2);
  const anchors: [number, number][] = [];
  for (let i = 0; i < lanes; i++) {
    const from = main[Math.floor(main.length * (0.25 + 0.5 * i + rand(rng) * 0.15))]!;
    const towardsLow = horizontal ? from[1] > MID : from[0] > MID;
    const far = towardsLow ? 0 : SIZE;
    const slide = randRange(rng, -180, 180);
    const to: [number, number] = horizontal
      ? [Math.min(SIZE - 40, Math.max(40, from[0] + slide)), far]
      : [far, Math.min(SIZE - 40, Math.max(40, from[1] + slide))];
    // Keep the lane out of the home base: bend around the centre if needed.
    const lane = windingPath(rng, from, to, 30).filter(([x, z]) => !b.params.isHome || homeDist(x, z) > T.homeFlatRadius + 20);
    if (lane.length >= 2) {
      addRoad(b, 'lane', 3.5, lane, true);
      anchors.push(lane[Math.floor(lane.length * 0.6)]!);
    }
  }

  // Hamlets: clusters of farmsteads next to the road.
  const hamlets = randInt(rng, 3, 5);
  for (let i = 0; i < hamlets; i++) anchors.push(main[Math.floor(((i + 0.5 + randRange(rng, -0.3, 0.3)) / hamlets) * (main.length - 1))]!);
  let towerNear: [number, number] | null = null;
  for (const [ax, az] of anchors) {
    const count = randInt(rng, 3, 6);
    for (let k = 0; k < count; k++) {
      const angle = rand(rng) * Math.PI * 2;
      const dist = randRange(rng, 16, 70);
      farmstead(b, rng, ax + Math.cos(angle) * dist, az + Math.sin(angle) * dist);
    }
    towerNear ??= [ax, az];
  }
  // Fire-watch tower of the first hamlet.
  if (towerNear) {
    for (let tries = 0; tries < 30; tries++) {
      const angle = rand(rng) * Math.PI * 2;
      const dist = randRange(rng, 12, 60);
      if (addTower(b, towerNear[0] + Math.cos(angle) * dist, towerNear[1] + Math.sin(angle) * dist, T.vantage.towerHeight, pick(rng, [0, 1, 2, 3] as const))) break;
    }
  }

  ruralScenery(b, rng, (x, z, big) => (big
    ? tryBuilding(b, 'barn', x, z, randRange(rng, 9, 13), randRange(rng, 7, 9), randRange(rng, 4.6, 6.2), 'gable', rand(rng))
    : tryBuilding(b, 'shed', x, z, randRange(rng, 3.5, 5.5), randRange(rng, 3, 4), 2.6, 'flat', rand(rng))) !== null);

  // Field plots on the flatter ground, separated by narrow grass balks. Each plot is levelled:
  // on sloping ground they step down as terraces.
  let z = randRange(rng, 10, 30);
  while (z < SIZE - 40) {
    const d = randRange(rng, 44, 72);
    let x = randRange(rng, 10, 30);
    while (x < SIZE - 40) {
      const w = randRange(rng, 48, 96);
      const x0 = x + 1.5;
      const z0 = z + 1.5;
      const x1 = Math.min(SIZE - 10, x + w) - 1.5;
      const z1 = Math.min(SIZE - 10, z + d) - 1.5;
      x += w;
      if (x1 - x0 < 24 || z1 - z0 < 24 || chance(rng, 0.12)) continue;
      if (!rectFree(b, x0, z0, x1, z1, 8) || inHomeZone(b, x0, z0, x1, z1, 12)) continue;
      const [lo, hi] = heightRange(b, x0, z0, x1, z1);
      if (hi - lo > R.terraceMaxRange) continue;
      const paddy = hi - lo < 2.4 && chance(rng, 0.55);
      terrace(b, x0, z0, x1, z1);
      b.areas.push({ kind: paddy ? 'paddy' : 'field', x0, z0, x1, z1, variant: rand(rng) });
      occupy(b, x0, z0, x1, z1);
      forTiles(x0, z0, x1, z1, (i, tx, ty) => {
        const cx = (tx + 0.5) * TILE;
        const cz = (ty + 0.5) * TILE;
        if (cx > x0 && cx < x1 && cz > z0 && cz < z1) b.ground[i] = GROUND.field;
      });
    }
    z += d;
  }
}

function layoutWild(b: Builder, land: 'forest' | 'mountain'): void {
  const rng = rngOf(b, 'wild');
  // A creek bed: with the track, the long sight lanes of the forest.
  if (land === 'forest') addCreek(b, crossing(rng, T.homeFlatRadius + 60, 70));
  const track = crossing(rng, T.homeFlatRadius + 50, land === 'forest' ? 90 : 120);
  addRoad(b, 'track', 4, track, true);

  // Huts along the track: enough for the loot spots of the cell, at least one.
  const want = Math.max(b.params.lootSpots, land === 'forest' ? randInt(rng, 2, 3) : 1);
  let built = 0;
  for (let tries = 0; tries < 400 && built < want; tries++) {
    const [px, pz] = track[randInt(rng, 2, track.length - 3)]!;
    const angle = rand(rng) * Math.PI * 2;
    const dist = randRange(rng, 9, 46);
    const cabin = tryBuilding(b, built % 3 === 2 ? 'shed' : 'house', px + Math.cos(angle) * dist, pz + Math.sin(angle) * dist,
      randRange(rng, 5.5, 8), randRange(rng, 4.5, 6), 3.2, 'gable', rand(rng), 2.2 + tries * 0.02);
    if (cabin) built++;
  }
  if (land === 'forest') {
    // Forestry lookout near the highest stretch of the track.
    let best = track[1]!;
    for (const p of track) if (p[0] > 40 && p[0] < SIZE - 40 && p[1] > 40 && p[1] < SIZE - 40 && hAt(b, p[0], p[1]) > hAt(b, best[0], best[1])) best = p;
    for (let tries = 0; tries < 60; tries++) {
      const angle = rand(rng) * Math.PI * 2;
      const dist = randRange(rng, 8, 30 + tries);
      if (addTower(b, best[0] + Math.cos(angle) * dist, best[1] + Math.sin(angle) * dist, T.vantage.towerHeight + 3, pick(rng, [0, 1, 2, 3] as const))) break;
    }
  }
}

export function layout(b: Builder, land: Land): void {
  if (land === 'urban' || land === 'suburb') layoutTown(b, land);
  else if (land === 'rural') layoutRural(b);
  else layoutWild(b, land);
}
