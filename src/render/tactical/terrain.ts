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

function terrainGeometry(map: TacticalMap): THREE.BufferGeometry {
  const n = map.n;
  const tile = map.tile;
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  const h = (ix: number, iz: number): number => map.height[Math.min(n - 1, Math.max(0, iz)) * n + Math.min(n - 1, Math.max(0, ix))]!;
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      pos[i * 3] = ix * tile;
      pos[i * 3 + 1] = map.height[i]!;
      pos[i * 3 + 2] = iz * tile;
      const gx = (h(ix + 1, iz) - h(ix - 1, iz)) / (2 * tile);
      const gz = (h(ix, iz + 1) - h(ix, iz - 1)) / (2 * tile);
      const inv = 1 / Math.hypot(gx, 1, gz);
      nor[i * 3] = -gx * inv;
      nor[i * 3 + 1] = inv;
      nor[i * 3 + 2] = -gz * inv;
      uv[i * 2] = ix / (n - 1);
      uv[i * 2 + 1] = iz / (n - 1);
    }
  }
  // Same diagonal as gen/height.ts: (ix, iz + 1) -> (ix + 1, iz).
  const index = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < n - 1; iz++) {
    for (let ix = 0; ix < n - 1; ix++) {
      const a = iz * n + ix;
      const b = a + n;
      index[k++] = a;
      index[k++] = b;
      index[k++] = a + 1;
      index[k++] = b;
      index[k++] = b + 1;
      index[k++] = a + 1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
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

export function buildTerrain(map: TacticalMap, renderer: THREE.WebGLRenderer): Built {
  detailTexture ??= buildDetailTexture();
  const detail = detailTexture;
  const texture = buildGroundTexture(map, Math.min(RENDER.groundAnisotropy, renderer.capabilities.getMaxAnisotropy()));
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
  const ground = new THREE.Mesh(terrainGeometry(map), material);
  ground.name = 'terrain';
  const apronMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const apron = new THREE.Mesh(apronGeometry(map), apronMaterial);
  apron.name = 'apron';
  const group = new THREE.Group();
  group.add(ground, apron);
  return {
    object: group,
    dispose() {
      ground.geometry.dispose();
      apron.geometry.dispose();
      material.dispose();
      apronMaterial.dispose();
      texture.dispose();
    },
  };
}
