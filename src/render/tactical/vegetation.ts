// Trees (instanced, split into chunks for frustum / distance culling), rocks, and tall grass
// (only the tufts near the camera are drawn). The shapes come from assets.ts (built in code).

import * as THREE from 'three';
import { RENDER } from '../../data/render.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { hash01 } from '../../gen/noise.ts';
import type { Built } from './terrain.ts';
import { broadleafFar, broadleafNear, coniferFar, coniferNear, grassTuft, rock as rockGeometry } from './assets.ts';

const F = RENDER.flora;

export interface Vegetation extends Built {
  /**
   * Call every frame with the camera position in this map's own frame: refreshes the grass around
   * it and culls far chunks. `grass` false hides the tall grass (a neighbouring map seen from afar, 07c).
   */
  update(camera: THREE.Vector3, viewDistance: number, grass?: boolean): void;
}

export function buildVegetation(map: TacticalMap): Vegetation {
  const seed = map.params.mapSeed;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const color = new THREE.Color();

  // --- trees: (kind, chunk) -> instanced mesh ---
  const chunks = F.treeChunks;
  const chunkSize = map.size / chunks;
  const lists: number[][] = Array.from({ length: 2 * chunks * chunks }, () => []);
  const trees = map.trees;
  for (let i = 0; i < trees.n; i++) {
    const cx = Math.min(chunks - 1, Math.floor(trees.x[i]! / chunkSize));
    const cz = Math.min(chunks - 1, Math.floor(trees.z[i]! / chunkSize));
    lists[(trees.kind[i]! * chunks + cz) * chunks + cx]!.push(i);
  }
  // 07c assets (assets.ts): closed low-poly shapes, so one side is enough.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  disposables.push(material);
  const treeGeo = [coniferNear(), broadleafNear()];
  // Far chunks use a much simpler tree (8 triangles, no trunk).
  const farGeo = [coniferFar(), broadleafFar()];
  disposables.push(...treeGeo, ...farGeo);
  const treeMeshes: { mesh: THREE.InstancedMesh; far: THREE.InstancedMesh; x: number; z: number }[] = [];
  lists.forEach((list, li) => {
    if (list.length === 0) return;
    const kind = Math.floor(li / (chunks * chunks));
    const mesh = new THREE.InstancedMesh(treeGeo[kind]!, material, list.length);
    list.forEach((ti, k) => {
      q.setFromAxisAngle(up, hash01(ti, 1, seed) * Math.PI * 2);
      // The shapes stand on y = 0 and reach a little into the ground.
      m.compose(v.set(trees.x[ti]!, trees.y[ti]!, trees.z[ti]!), q, s.set(trees.r[ti]!, trees.h[ti]!, trees.r[ti]!));
      mesh.setMatrixAt(k, m);
      const shade = 0.78 + 0.4 * hash01(ti, 2, seed);
      mesh.setColorAt(k, color.setRGB(shade * (0.95 + 0.15 * hash01(ti, 3, seed)), shade, shade * 0.92));
    });
    mesh.computeBoundingSphere();
    const c = li % (chunks * chunks);
    // The far version shares the instances (same matrices and colours).
    const far = new THREE.InstancedMesh(farGeo[kind]!, material, list.length);
    far.instanceMatrix = mesh.instanceMatrix;
    far.instanceColor = mesh.instanceColor;
    far.boundingSphere = mesh.boundingSphere;
    far.visible = false;
    treeMeshes.push({ mesh, far, x: ((c % chunks) + 0.5) * chunkSize, z: (Math.floor(c / chunks) + 0.5) * chunkSize });
    group.add(mesh, far);
    disposables.push(mesh);
  });

  // --- rocks ---
  if (map.rocks.length > 0) {
    const geo = rockGeometry();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, map.rocks.length);
    map.rocks.forEach((r, i) => {
      // Quarter turns only: the rock's collision box is not rotated, and the shape covers it in every quarter turn.
      q.setFromAxisAngle(up, Math.floor(hash01(i, 4, seed) * 4) * (Math.PI / 2));
      m.compose(v.set(r.x, r.y, r.z), q, s.set(r.r, r.h * 0.85, r.r * (0.8 + 0.3 * hash01(i, 5, seed))));
      mesh.setMatrixAt(i, m);
      const shade = 0.8 + 0.4 * hash01(i, 6, seed);
      mesh.setColorAt(i, color.setRGB(shade, shade, shade));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
    disposables.push(geo, mat, mesh);
  }

  // --- tall grass: buckets of 32 m, the nearest tufts are instanced on demand ---
  const grass = map.grass;
  const cell = 32;
  const gn = Math.ceil(map.size / cell);
  const buckets: number[][] = Array.from({ length: gn * gn }, () => []);
  for (let i = 0; i < grass.n; i++) buckets[Math.min(gn - 1, Math.floor(grass.z[i]! / cell)) * gn + Math.min(gn - 1, Math.floor(grass.x[i]! / cell))]!.push(i);
  // Normals all point up (lit like the ground): smooth shading and front faces only (assets.ts).
  const grassGeo = grassTuft();
  const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, F.grassMax);
  grassMesh.count = 0;
  grassMesh.frustumCulled = false;
  group.add(grassMesh);
  disposables.push(grassGeo, grassMat, grassMesh);
  let lastX = Infinity;
  let lastZ = Infinity;

  const refreshGrass = (cx: number, cz: number): void => {
    const range = F.grassRange;
    let k = 0;
    const c0x = Math.max(0, Math.floor((cx - range) / cell));
    const c1x = Math.min(gn - 1, Math.floor((cx + range) / cell));
    const c0z = Math.max(0, Math.floor((cz - range) / cell));
    const c1z = Math.min(gn - 1, Math.floor((cz + range) / cell));
    for (let bz = c0z; bz <= c1z && k < F.grassMax; bz++) {
      for (let bx = c0x; bx <= c1x && k < F.grassMax; bx++) {
        for (const gi of buckets[bz * gn + bx]!) {
          const d = Math.hypot(grass.x[gi]! - cx, grass.z[gi]! - cz);
          if (d > range) continue;
          // Shrink towards the edge of the range so that tufts do not pop in.
          const size = grass.s[gi]! * Math.min(1, (range - d) / 30);
          q.setFromAxisAngle(up, hash01(gi, 8, seed) * Math.PI * 2);
          m.compose(v.set(grass.x[gi]!, grass.y[gi]! - 0.05, grass.z[gi]!), q, s.set(size * 1.3, size, size * 1.3));
          grassMesh.setMatrixAt(k, m);
          const shade = 0.8 + 0.35 * hash01(gi, 9, seed);
          grassMesh.setColorAt(k, color.setRGB(shade, shade, shade * 0.9));
          if (++k >= F.grassMax) break;
        }
      }
    }
    grassMesh.count = k;
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  };

  return {
    object: group,
    update(camera, viewDistance, grass = true) {
      grassMesh.visible = grass;
      if (grass && Math.hypot(camera.x - lastX, camera.z - lastZ) > 12) {
        lastX = camera.x;
        lastZ = camera.z;
        refreshGrass(camera.x, camera.z);
      }
      const reach = viewDistance + chunkSize * 0.75;
      for (const t of treeMeshes) {
        const d = Math.hypot(t.x - camera.x, t.z - camera.z);
        const shown = d < reach;
        const near = d < F.treeNear + chunkSize * 0.75;
        t.mesh.visible = shown && near;
        t.far.visible = shown && !near;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
