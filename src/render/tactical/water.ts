// R0: water surfaces of a real area (map.water: a level per height sample, NaN where dry) — the sea
// at 0 and rivers / lakes a little below their banks. One mesh per map (1 draw call). Flat sea tiles
// are merged into rectangles so that a coastal area does not cost a quad per 4 m tile.

import * as THREE from 'three';
import { RENDER } from '../../data/render.ts';
import type { TacticalMap } from '../../gen/index.ts';
import type { Built } from './terrain.ts';

let material: THREE.MeshLambertMaterial | null = null;

export function buildWater(map: TacticalMap): Built {
  const group = new THREE.Group();
  const W = map.water;
  if (!W) return { object: group, dispose: () => undefined };
  const n = map.n;
  const tiles = map.tiles;
  const t = map.tile;
  const lvl = (ix: number, iz: number): number => W[iz * n + ix]!;
  // Level of each tile corner (a dry corner next to water takes the mean of the wet ones).
  const wet = new Uint8Array(tiles * tiles);
  const flat = new Uint8Array(tiles * tiles);
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const c = [lvl(tx, ty), lvl(tx + 1, ty), lvl(tx, ty + 1), lvl(tx + 1, ty + 1)];
      const k = c.filter(Number.isFinite).length;
      if (k >= 2) wet[ty * tiles + tx] = 1;
      if (k === 4 && c.every((v) => v === 0)) flat[ty * tiles + tx] = 1;
    }
  }
  const pos: number[] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number, a: number, b: number, c: number, d: number): void => {
    pos.push(x0, a, z0, x0, c, z1, x1, b, z0, x1, b, z0, x0, c, z1, x1, d, z1);
  };
  const lift = RENDER.water.lift;
  // Sea: rectangles of flat tiles.
  const used = new Uint8Array(tiles * tiles);
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      if (!flat[ty * tiles + tx] || used[ty * tiles + tx]) continue;
      let w = 1;
      while (tx + w < tiles && flat[ty * tiles + tx + w] && !used[ty * tiles + tx + w]) w++;
      let h = 1;
      for (; ty + h < tiles; h++) {
        let ok = true;
        for (let k = 0; k < w; k++) if (!flat[(ty + h) * tiles + tx + k] || used[(ty + h) * tiles + tx + k]) ok = false;
        if (!ok) break;
      }
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) used[(ty + j) * tiles + tx + k] = 1;
      quad(tx * t, ty * t, (tx + w) * t, (ty + h) * t, lift, lift, lift, lift);
    }
  }
  // Rivers, lakes and the shore: one quad per tile.
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const i = ty * tiles + tx;
      if (!wet[i] || used[i]) continue;
      const c = [lvl(tx, ty), lvl(tx + 1, ty), lvl(tx, ty + 1), lvl(tx + 1, ty + 1)];
      const ok = c.filter(Number.isFinite);
      const mean = ok.reduce((s, v) => s + v, 0) / ok.length;
      const v = c.map((x) => (Number.isFinite(x) ? x : mean) + lift);
      quad(tx * t, ty * t, (tx + 1) * t, (ty + 1) * t, v[0]!, v[1]!, v[2]!, v[3]!);
    }
  }
  if (pos.length === 0) return { object: group, dispose: () => undefined };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();
  material ??= new THREE.MeshLambertMaterial({ color: RENDER.water.color, transparent: true, opacity: RENDER.water.opacity });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'water';
  group.add(mesh);
  return { object: group, dispose: () => geometry.dispose() };
}
