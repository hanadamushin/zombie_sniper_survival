// Terrain mesh of the operation area (257 x 257 vertices, one ground texture) plus the coarse
// "apron" around it, so that the world does not end at the edge of the playable square.

import * as THREE from 'three';
import { RENDER } from '../../data/render.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { sampleHeight, type TacticalMap } from '../../gen/index.ts';
import { fbm } from '../../gen/noise.ts';
import { buildDetailTexture, buildGroundTexture, landColor } from './groundTexture.ts';

export interface Built {
  object: THREE.Object3D;
  dispose(): void;
}

let detailTexture: THREE.DataTexture | null = null;

/**
 * Terrain mesh with level of detail (07c): all 257 × 257 samples are in the vertex buffer, and the
 * index buffer is rebuilt when the camera moves far enough that a 256 m chunk changes level —
 * every sample (4 m), every 2nd (8 m) or every 4th (16 m), or left out beyond the fog. Each chunk
 * has a skirt hanging below its edges, which hides the cracks between chunks (and maps) of
 * different levels. One draw call per map.
 */
interface LodTerrain {
  geometry: THREE.BufferGeometry;
  /** Choose the levels for a camera at (x, z) in the map's own frame. Returns true when the index buffer changed. */
  update(x: number, z: number): boolean;
}

const CHUNK = 64; // samples per chunk side (256 m)
const SKIRT = 3; // m

function lodTerrain(map: TacticalMap): LodTerrain {
  const n = map.n;
  const tile = map.tile;
  const chunks = (n - 1) / CHUNK;
  // Main samples, then skirt copies of the samples on chunk boundary lines (lowered).
  const onLine = (i: number): boolean => i % CHUNK === 0;
  const skirtIndex = new Int32Array(n * n).fill(-1);
  let extra = 0;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) if (onLine(ix) || onLine(iz)) skirtIndex[iz * n + ix] = n * n + extra++;
  const total = n * n + extra;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const h = (ix: number, iz: number): number => map.height[Math.min(n - 1, Math.max(0, iz)) * n + Math.min(n - 1, Math.max(0, ix))]!;
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      const gx = (h(ix + 1, iz) - h(ix - 1, iz)) / (2 * tile);
      const gz = (h(ix, iz + 1) - h(ix, iz - 1)) / (2 * tile);
      const inv = 1 / Math.hypot(gx, 1, gz);
      const write = (k: number, y: number): void => {
        pos[k * 3] = ix * tile;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = iz * tile;
        nor[k * 3] = -gx * inv;
        nor[k * 3 + 1] = inv;
        nor[k * 3 + 2] = -gz * inv;
        uv[k * 2] = ix / (n - 1);
        uv[k * 2 + 1] = iz / (n - 1);
      };
      write(i, map.height[i]!);
      const sk = skirtIndex[i]!;
      if (sk >= 0) write(sk, map.height[i]! - SKIRT);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(map.size / 2, 0, map.size / 2), map.size * 0.75 + 200);
  geometry.boundingSphere.center.y = map.height[Math.floor(n * n / 2)]!;

  // L9: tiles under a bridge's deck over the water are not drawn (the deck and the water are).
  const decks = map.decks;
  const tiles = map.tiles;
  const hole = (ix: number, iz: number, st: number): boolean => {
    for (let z = iz; z < Math.min(tiles, iz + st); z++) for (let x = ix; x < Math.min(tiles, ix + st); x++) if (decks![z * tiles + x]) return true;
    return false;
  };
  const L = RENDER.terrainLod;
  let signature = '';
  const levels = new Int8Array(chunks * chunks);
  return {
    geometry,
    update(x, z) {
      // Level per chunk from the distance between the camera and the chunk's square.
      let sig = '';
      for (let cz = 0; cz < chunks; cz++) {
        for (let cx = 0; cx < chunks; cx++) {
          const x0 = cx * CHUNK * tile;
          const z0 = cz * CHUNK * tile;
          const span = CHUNK * tile;
          const d = Math.hypot(Math.max(x0 - x, 0, x - x0 - span), Math.max(z0 - z, 0, z - z0 - span));
          const level = d < L.full ? 1 : d < L.half ? 2 : d < L.far ? 4 : 0;
          levels[cz * chunks + cx] = level;
          sig += level;
        }
      }
      if (sig === signature) return false;
      signature = sig;
      const idx: number[] = [];
      for (let cz = 0; cz < chunks; cz++) {
        for (let cx = 0; cx < chunks; cx++) {
          const st = levels[cz * chunks + cx]!;
          if (st === 0) continue;
          const ix0 = cx * CHUNK;
          const iz0 = cz * CHUNK;
          // Same diagonal as gen/height.ts: (ix, iz + 1) -> (ix + 1, iz).
          for (let iz = iz0; iz < iz0 + CHUNK; iz += st) {
            for (let ix = ix0; ix < ix0 + CHUNK; ix += st) {
              if (decks && hole(ix, iz, st)) continue; // L9: under a bridge's deck
              const a = iz * n + ix;
              const b = a + n * st;
              idx.push(a, b, a + st, b, b + st, a + st);
            }
          }
          // Skirts on the four edges (both windings: seen from either side).
          const edge = (i0: number, i1: number): void => {
            const s0 = skirtIndex[i0]!;
            const s1 = skirtIndex[i1]!;
            idx.push(i0, s0, i1, s0, s1, i1, i1, s1, i0, s1, s0, i0);
          };
          for (let k = 0; k < CHUNK; k += st) {
            edge(iz0 * n + ix0 + k, iz0 * n + ix0 + k + st);
            edge((iz0 + CHUNK) * n + ix0 + k, (iz0 + CHUNK) * n + ix0 + k + st);
            edge((iz0 + k) * n + ix0, (iz0 + k + st) * n + ix0);
            edge((iz0 + k) * n + ix0 + CHUNK, (iz0 + k + st) * n + ix0 + CHUNK);
          }
        }
      }
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
      return true;
    },
  };
}

/** Ring of coarse terrain outside the map: a stitching strip per side, then 64 m cells. */
function apronGeometry(map: TacticalMap): THREE.BufferGeometry {
  const S = map.size;
  const ac = TACTICAL.apronCell;
  const rings = TACTICAL.apronRings;
  const an = map.apronN;
  const inner = S / ac; // coarse cells across the map
  const base = landColor(map.params.land);
  const forest = map.params.land === 'forest' || map.params.land === 'mountain';
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const color = new THREE.Color();
  const vertex = (x: number, y: number, z: number): number => {
    const shade = 0.88 + 0.2 * fbm(x / 140, z / 140, map.params.mapSeed + 77, 2) - (forest ? 0.12 : 0);
    color.setRGB((base[0] / 255) * shade, (base[1] / 255) * shade, (base[2] / 255) * shade, THREE.SRGBColorSpace);
    pos.push(x, y, z);
    col.push(color.r, color.g, color.b);
    return pos.length / 3 - 1;
  };
  const coarse = (i: number, j: number): number => map.apron[(j + rings) * an + (i + rings)]!;
  const quad = (a: number, b: number, c: number, d: number): void => {
    index.push(a, b, d, b, c, d); // a, b, c, d counter-clockwise seen from above
  };

  // Coarse cells, skipping the map itself and the bands taken by the strips.
  const ids = new Map<number, number>();
  const cv = (i: number, j: number): number => {
    const key = (j + rings) * an + (i + rings);
    let id = ids.get(key);
    if (id === undefined) {
      id = vertex(i * ac, coarse(i, j), j * ac);
      ids.set(key, id);
    }
    return id;
  };
  for (let j = -rings; j < inner + rings; j++) {
    for (let i = -rings; i < inner + rings; i++) {
      const inX = i >= 0 && i < inner;
      const inZ = j >= 0 && j < inner;
      if ((inX && j >= -1 && j <= inner) || (inZ && i >= -1 && i <= inner)) continue;
      quad(cv(i, j), cv(i, j + 1), cv(i + 1, j + 1), cv(i + 1, j));
    }
  }

  // Strips: exact edge heights on the inside, the coarse edge (linear between samples) outside.
  const tile = map.tile;
  const per = ac / tile;
  const edgeH = (x: number, z: number): number => sampleHeight(map.height, map.n, tile, x, z);
  const outer = (t: number, fixed: number, alongX: boolean): number => {
    const c = Math.min(inner - 1, Math.floor(t / per));
    const f = t / per - c;
    return alongX ? coarse(c, fixed) * (1 - f) + coarse(c + 1, fixed) * f : coarse(fixed, c) * (1 - f) + coarse(fixed, c + 1) * f;
  };
  for (const side of [0, 1, 2, 3]) {
    let prevIn = -1;
    let prevOut = -1;
    for (let t = 0; t <= map.n - 1; t++) {
      const u = t * tile;
      let vin: number;
      let vout: number;
      if (side === 0) { vin = vertex(u, edgeH(u, 0), 0); vout = vertex(u, outer(t, -1, true), -ac); } // north
      else if (side === 1) { vin = vertex(u, edgeH(u, S), S); vout = vertex(u, outer(t, inner + 1, true), S + ac); } // south
      else if (side === 2) { vin = vertex(0, edgeH(0, u), u); vout = vertex(-ac, outer(t, -1, false), u); } // west
      else { vin = vertex(S, edgeH(S, u), u); vout = vertex(S + ac, outer(t, inner + 1, false), u); } // east
      if (t > 0) {
        if (side === 0 || side === 3) quad(prevOut, prevIn, vin, vout);
        else quad(prevIn, prevOut, vout, vin);
      }
      prevIn = vin;
      prevOut = vout;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export interface TerrainPart extends Built {
  /** Camera position in this map's own frame: picks the level of detail of each chunk. */
  update(x: number, z: number): void;
}

/**
 * Terrain of one map. `apron`: also the coarse ground around it (stand-alone maps; inside a world
 * the neighbouring maps are drawn instead). `pixels`: ground colours built by the worker.
 */
export function buildTerrain(map: TacticalMap, renderer: THREE.WebGLRenderer, opts: { apron?: boolean; pixels?: Uint8Array } = {}): TerrainPart {
  detailTexture ??= buildDetailTexture();
  const detail = detailTexture;
  const texture = buildGroundTexture(map, Math.min(RENDER.groundAnisotropy, renderer.capabilities.getMaxAnisotropy()), opts.pixels);
  const material = new THREE.MeshLambertMaterial({ map: texture });
  // Close-up detail: modulate the 1 m/texel colour map with a tiling noise that fades with distance.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tDetail = { value: detail };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tDetail;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float detailNear = texture2D( tDetail, vMapUv * 341.0 ).r * 0.6 + texture2D( tDetail, vMapUv * 73.0 ).r * 0.4;
        diffuseColor.rgb *= mix( 1.0, 0.78 + 0.44 * detailNear, 1.0 - smoothstep( 30.0, 220.0, length( vViewPosition ) ) );`);
  };
  const lod = lodTerrain(map);
  lod.update(map.size / 2, map.size / 2);
  const ground = new THREE.Mesh(lod.geometry, material);
  ground.name = 'terrain';
  const group = new THREE.Group();
  group.add(ground);
  let apron: THREE.Mesh | null = null;
  let apronMaterial: THREE.Material | null = null;
  if (opts.apron !== false) {
    apronMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    apron = new THREE.Mesh(apronGeometry(map), apronMaterial);
    apron.name = 'apron';
    group.add(apron);
  }
  return {
    object: group,
    update(x, z) {
      lod.update(x, z);
    },
    dispose() {
      ground.geometry.dispose();
      apron?.geometry.dispose();
      material.dispose();
      apronMaterial?.dispose();
      texture.dispose();
    },
  };
}
