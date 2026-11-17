// Procedural ground colour map of an operation area (pixels only: no Three.js, so that a worker can build it — 07c): 1 texel per metre, built from the map's
// ground classes, slope, areas (fields, parks, car parks), roads and building pads.
// No image files: everything is computed (CLAUDE.md), then uploaded as a DataTexture.

import type { Land } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { GROUND, sampleGradient, type TacticalMap } from '../../gen/index.ts';
import { fbm, hash01, noise2, smoothstep } from '../../gen/noise.ts';

type Rgb = readonly [number, number, number];
const P = RENDER.ground;
const rgb = (hex: number): Rgb => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

const GRASS: Record<Land, Rgb> = { urban: rgb(P.grass.urban), suburb: rgb(P.grass.suburb), rural: rgb(P.grass.rural), forest: rgb(P.grass.forest), mountain: rgb(P.grass.mountain) };
const FOREST = rgb(P.forestFloor);
const ROCK = rgb(P.rock);
const PAVED = rgb(P.paved);
const ASPHALT = rgb(P.asphalt);
const SIDEWALK = rgb(P.sidewalk);
const DIRT = rgb(P.dirt);
const LINE = rgb(P.roadLine);
const FIELD_A = rgb(P.fieldA);
const FIELD_B = rgb(P.fieldB);
const PADDY = rgb(P.paddy);
const PARK = rgb(P.park);
const PLAZA = rgb(P.plaza);

/** Average ground colour of a land (apron, far terrain). */
export function landColor(land: Land): Rgb {
  return land === 'urban' ? PAVED : GRASS[land];
}

export function buildGroundPixels(map: TacticalMap): Uint8Array {
  const S = map.size;
  const px = new Uint8Array(S * S * 4);
  const land = map.params.land;
  const seed = map.params.mapSeed;
  const town = land === 'urban' || land === 'suburb';
  const tiles = map.tiles;
  const grad: [number, number] = [0, 0];

  const mix = (i: number, c: Rgb, a: number): void => {
    px[i] = px[i]! + (c[0] - px[i]!) * a;
    px[i + 1] = px[i + 1]! + (c[1] - px[i + 1]!) * a;
    px[i + 2] = px[i + 2]! + (c[2] - px[i + 2]!) * a;
  };
  /** Smooth 0..1 weight of a ground class around (x, z) (bilinear over tile centres). */
  const classWeight = (x: number, z: number, cls: number): number => {
    const gx = Math.min(tiles - 1.001, Math.max(0, x / map.tile - 0.5));
    const gz = Math.min(tiles - 1.001, Math.max(0, z / map.tile - 0.5));
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (tx: number, tz: number): number => (map.ground[tz * tiles + tx] === cls ? 1 : 0);
    return (at(ix, iz) * (1 - fx) + at(ix + 1, iz) * fx) * (1 - fz) + (at(ix, iz + 1) * (1 - fx) + at(ix + 1, iz + 1) * fx) * fz;
  };

  // --- base: grass / forest floor / rock / paving with mottling ---
  const baseGrass = GRASS[land];
  for (let z = 0; z < S; z++) {
    for (let x = 0; x < S; x++) {
      const i = (z * S + x) * 4;
      const wx = x + 0.5;
      const wz = z + 0.5;
      const big = fbm(wx / 90, wz / 90, seed + 11, 3);
      const fine = noise2(wx / 3.1, wz / 3.1, seed + 23);
      const shade = 1 + big * 0.16 + fine * 0.06;
      let c: Rgb = baseGrass;
      const cls = map.ground[Math.floor(z / map.tile) * tiles + Math.floor(x / map.tile)]!;
      if (cls === GROUND.paved) c = PAVED;
      px[i] = c[0] * shade;
      px[i + 1] = c[1] * shade;
      px[i + 2] = c[2] * shade;
      px[i + 3] = 255;
      if (cls !== GROUND.paved) {
        const wooded = classWeight(wx, wz, GROUND.forest);
        if (wooded > 0) mix(i, FOREST, wooded * (0.8 + fine * 0.2));
        sampleGradient(map.height, map.n, map.tile, wx, wz, grad);
        const rocky = smoothstep(0.62, 0.95, Math.hypot(grad[0], grad[1]) + fine * 0.08);
        if (rocky > 0) mix(i, ROCK, rocky * (0.9 + big * 0.3));
        // Dry patches break up the green.
        const dry = smoothstep(0.25, 0.6, fbm(wx / 37, wz / 37, seed + 37, 2));
        if (dry > 0 && land !== 'urban') mix(i, DIRT, dry * 0.22);
      }
    }
  }

  const fillRect = (x0: number, z0: number, x1: number, z1: number, color: (x: number, z: number) => Rgb | null, alpha = 1): void => {
    const ix0 = Math.max(0, Math.floor(x0));
    const iz0 = Math.max(0, Math.floor(z0));
    const ix1 = Math.min(S - 1, Math.ceil(x1) - 1);
    const iz1 = Math.min(S - 1, Math.ceil(z1) - 1);
    for (let z = iz0; z <= iz1; z++) {
      for (let x = ix0; x <= ix1; x++) {
        const c = color(x + 0.5, z + 0.5);
        if (c) mix((z * S + x) * 4, c, alpha * (0.94 + 0.12 * hash01(x, z, seed)));
      }
    }
  };

  // --- areas ---
  for (const a of map.areas) {
    const alongX = a.x1 - a.x0 >= a.z1 - a.z0;
    if (a.kind === 'field') {
      const tone: Rgb = [0, 1, 2].map((k) => FIELD_A[k]! + (FIELD_B[k]! - FIELD_A[k]!) * a.variant) as unknown as Rgb;
      const dark: Rgb = [tone[0] * 0.78, tone[1] * 0.8, tone[2] * 0.76];
      fillRect(a.x0, a.z0, a.x1, a.z1, (x, z) => (Math.floor((alongX ? z : x) / 1.5) % 2 === 0 ? tone : dark));
    } else if (a.kind === 'paddy') {
      const tone: Rgb = [PADDY[0] * (0.9 + a.variant * 0.2), PADDY[1] * (0.9 + a.variant * 0.2), PADDY[2]];
      fillRect(a.x0, a.z0, a.x1, a.z1, (x, z) => (Math.floor((alongX ? z : x) / 1) % 3 === 0 ? [tone[0] * 0.8, tone[1] * 0.85, tone[2] * 0.9] : tone));
    } else if (a.kind === 'park') {
      fillRect(a.x0, a.z0, a.x1, a.z1, () => PARK, 0.85);
    } else if (a.kind === 'parking') {
      fillRect(a.x0, a.z0, a.x1, a.z1, (x, z) => (Math.floor((alongX ? x - a.x0 : z - a.z0) / 2.7) % 2 === 0 && Math.floor((alongX ? z - a.z0 : x - a.x0) / 6) % 3 !== 2 && (alongX ? x - a.x0 : z - a.z0) % 2.7 < 1 ? LINE : ASPHALT), 0.95);
    } else if (a.kind === 'plaza') {
      fillRect(a.x0, a.z0, a.x1, a.z1, (x, z) => (Math.floor(x) % 6 === 0 || Math.floor(z) % 6 === 0 ? SIDEWALK : PLAZA));
    }
  }

  // --- building pads ---
  for (const b of map.buildings) {
    if (b.kind === 'tower') continue;
    const pad = b.kind === 'barn' || b.kind === 'shed' || (!town && b.kind === 'house') ? DIRT : SIDEWALK;
    fillRect(b.x0 - 1.2, b.z0 - 1.2, b.x1 + 1.2, b.z1 + 1.2, () => pad, 0.8);
  }

  // --- roads (drawn last: they cut through everything) ---
  // Two passes: sidewalks / verges of every road first, then the surfaces, so that crossings stay clean.
  for (const pass of [0, 1]) for (const road of map.roads) {
    const half = road.width / 2;
    const walk = town ? (land === 'urban' ? 3 : 1.5) : 0;
    const reach = half + walk + 1;
    const surface = road.kind === 'track' ? DIRT : ASPHALT;
    const lined = road.kind === 'avenue' || road.kind === 'street';
    let along = 0;
    for (let s = 0; s + 1 < road.pts.length; s++) {
      const [ax, az] = road.pts[s]!;
      const [bx, bz] = road.pts[s + 1]!;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-6) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      const ix0 = Math.max(0, Math.floor(Math.min(ax, bx) - reach));
      const iz0 = Math.max(0, Math.floor(Math.min(az, bz) - reach));
      const ix1 = Math.min(S - 1, Math.ceil(Math.max(ax, bx) + reach));
      const iz1 = Math.min(S - 1, Math.ceil(Math.max(az, bz) + reach));
      for (let z = iz0; z <= iz1; z++) {
        for (let x = ix0; x <= ix1; x++) {
          const rx = x + 0.5 - ax;
          const rz = z + 0.5 - az;
          const t = Math.min(len, Math.max(0, rx * ux + rz * uz));
          const d = Math.hypot(rx - ux * t, rz - uz * t);
          if (d > reach) continue;
          const i = (z * S + x) * 4;
          if (pass === 0) {
            if (d <= half) continue;
            if (walk > 0) mix(i, SIDEWALK, (1 - smoothstep(half + walk - 0.5, half + walk + 0.5, d)) * 0.95);
            else mix(i, surface, (1 - smoothstep(half, half + 1, d)) * 0.7);
            continue;
          }
          if (d > half) continue;
          const n = 0.92 + 0.14 * hash01(x, z, seed + 5);
          mix(i, [surface[0] * n, surface[1] * n, surface[2] * n], 1);
          if (!lined) {
            // Wheel ruts on lanes and tracks.
            if (Math.abs(d - half * 0.45) < 0.45) mix(i, [surface[0] * 0.8, surface[1] * 0.8, surface[2] * 0.8], 0.6);
            continue;
          }
          const run = along + t;
          // Centre line: exactly one texel wide (texel centres never sit on the axis of a road at an integer coordinate).
          const side = rx * uz - rz * ux;
          if (side >= 0 && side < 1 && Math.floor(run / 4) % 2 === 0) mix(i, LINE, 0.65);
          else if (road.kind === 'avenue' && Math.abs(d - half + 0.8) < 0.5) mix(i, LINE, 0.55);
        }
      }
      along += len;
    }
  }
  return px;
}

