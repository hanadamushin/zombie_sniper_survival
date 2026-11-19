// Ground colour map of an operation area: 1 texel per metre, from the map's ground classes,
// heights, areas and roads. The pattern itself is assets.ts groundPixels() (built in code; no
// Three.js, so the background worker can run it — 07c). Patterns use world coordinates so that
// neighbouring areas meet without a seam.

import type { Land } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { groundPixels } from './assets.ts';

type Rgb = readonly [number, number, number];
const P = RENDER.ground;
const rgb = (hex: number): Rgb => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const GRASS: Record<Land, Rgb> = { urban: rgb(P.grass.urban), suburb: rgb(P.grass.suburb), rural: rgb(P.grass.rural), forest: rgb(P.grass.forest), mountain: rgb(P.grass.mountain) };
const PAVED = rgb(P.paved);

/** Average ground colour of a land (apron, far terrain). */
export function landColor(land: Land): Rgb {
  return land === 'urban' ? PAVED : GRASS[land];
}

/** RGBA pixels (sRGB), size x size, rows along z. */
export function buildGroundPixels(map: TacticalMap): Uint8Array {
  const world = map.params.world;
  return groundPixels({
    size: map.size,
    tile: map.tile,
    land: map.params.land,
    seed: world ? world.seed : map.params.mapSeed,
    gx: world ? world.gx : 0,
    gy: world ? world.gy : 0,
    ground: map.ground,
    height: map.height,
    areas: map.areas,
    roads: map.roads,
  });
}
