// Ground textures of an operation area: the colour map (pixels from groundPixels.ts, which a worker
// can build too — 07c) and the tiling close-up detail.

import * as THREE from 'three';
import type { TacticalMap } from '../../gen/index.ts';
import { detailTexture } from './assets.ts';
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

/** Small tiling grey noise used for close-up ground detail (assets.ts detailTexture, average 128). */
export function buildDetailTexture(): THREE.DataTexture {
  const n = 64;
  const tex = new THREE.DataTexture(detailTexture(), n, n, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
