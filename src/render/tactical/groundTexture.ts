// Ground textures of an operation area: the colour map (pixels from groundPixels.ts, which a worker
// can build too — 07c) and the tiling close-up detail.

import * as THREE from 'three';
import type { TacticalMap } from '../../gen/index.ts';
import { hash01 } from '../../gen/noise.ts';
import { buildGroundPixels } from './groundPixels.ts';

export { buildGroundPixels, landColor } from './groundPixels.ts';

/** `pixels`: already built elsewhere (the background worker, 07c); otherwise built here. */
export function buildGroundTexture(map: TacticalMap, anisotropy: number, pixels?: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(pixels ?? buildGroundPixels(map), map.size, map.size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** Small tiling grey noise used for close-up ground detail. */
export function buildDetailTexture(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      // Tileable: blend four shifted lattice hashes.
      const v = (hash01(x, z, 1) + hash01((x + 1) % n, z, 1) + hash01(x, (z + 1) % n, 1) + hash01((x + 3) % n, (z + 5) % n, 2)) / 4;
      const g = Math.round(40 + v * 215);
      data.set([g, g, g, 255], (z * n + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
