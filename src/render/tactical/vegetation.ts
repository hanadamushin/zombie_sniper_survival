// Trees (instanced, split into chunks for frustum / distance culling), rocks, and tall grass
// (only the tufts near the camera are drawn).

import * as THREE from 'three';
import { RENDER } from '../../data/render.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { hash01 } from '../../gen/noise.ts';
import type { Built } from './terrain.ts';

const F = RENDER.flora;

function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const count = flat.reduce((s, p) => s + p.getAttribute('position').count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const p of flat) {
    pos.set(p.getAttribute('position').array, o * 3);
    nor.set(p.getAttribute('normal').array, o * 3);
    col.set(p.getAttribute('color').array, o * 3);
    o += p.getAttribute('position').count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const p of [...parts, ...flat]) p.dispose();
  return geo;
}

/** Unit trees: total height 1, canopy radius 1 (scaled per instance by (r, h, r)). */
function coniferGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.CylinderGeometry(0.07, 0.11, 0.4, 5, 1, true).translate(0, 0.2, 0), F.trunk),
    paint(new THREE.ConeGeometry(1, 0.5, 7, 1, true).translate(0, 0.47, 0), F.conifer),
    paint(new THREE.ConeGeometry(0.68, 0.45, 7, 1, true).translate(0, 0.775, 0), F.conifer),
  ]);
}
function broadleafGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5, 1, true).translate(0, 0.25, 0), F.trunk),
    paint(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.36, 1).translate(0, 0.66, 0), F.broadleaf),
    // 07b: the upper clump is an octahedron (8 triangles instead of 20) to pay for the undergrowth.
    paint(new THREE.OctahedronGeometry(0.66, 0).scale(1, 0.34, 1).translate(0.25, 0.84, 0.15), F.broadleaf),
  ]);
}

/** Three blades standing in a fan; darker at the root. Unit height. */
function grassGeometry(): THREE.BufferGeometry {
  const root = new THREE.Color(F.grass);
  const tip = new THREE.Color(F.grassTip);
  const pos: number[] = [];
  const col: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI + 0.3;
    const lean = 0.25;
    const cx = Math.cos(a);
    const sz = Math.sin(a);
    const ox = Math.cos(a * 2.7) * 0.18;
    const oz = Math.sin(a * 1.9) * 0.18;
    pos.push(ox - cx * 0.2, 0, oz - sz * 0.2, ox + cx * 0.2, 0, oz + sz * 0.2, ox + sz * lean, 0.7 + 0.1 * k, oz - cx * lean);
    col.push(root.r, root.g, root.b, root.r, root.g, root.b, tip.r, tip.g, tip.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // Lit like the ground it stands on: all normals point up.
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  return geo;
}

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
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  disposables.push(material);
  const treeGeo = [coniferGeometry(), broadleafGeometry()];
  disposables.push(...treeGeo);
  const treeMeshes: { mesh: THREE.InstancedMesh; x: number; z: number }[] = [];
  lists.forEach((list, li) => {
    if (list.length === 0) return;
    const kind = Math.floor(li / (chunks * chunks));
    const mesh = new THREE.InstancedMesh(treeGeo[kind]!, material, list.length);
    list.forEach((ti, k) => {
      q.setFromAxisAngle(up, hash01(ti, 1, seed) * Math.PI * 2);
      m.compose(v.set(trees.x[ti]!, trees.y[ti]! - 0.15, trees.z[ti]!), q, s.set(trees.r[ti]!, trees.h[ti]!, trees.r[ti]!));
      mesh.setMatrixAt(k, m);
      const shade = 0.78 + 0.4 * hash01(ti, 2, seed);
      mesh.setColorAt(k, color.setRGB(shade * (0.95 + 0.15 * hash01(ti, 3, seed)), shade, shade * 0.92));
    });
    mesh.computeBoundingSphere();
    const c = li % (chunks * chunks);
    treeMeshes.push({ mesh, x: ((c % chunks) + 0.5) * chunkSize, z: (Math.floor(c / chunks) + 0.5) * chunkSize });
    group.add(mesh);
    disposables.push(mesh);
  });

  // --- rocks ---
  if (map.rocks.length > 0) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, map.rocks.length);
    map.rocks.forEach((r, i) => {
      q.setFromAxisAngle(up, hash01(i, 4, seed) * Math.PI * 2);
      m.compose(v.set(r.x, r.y + r.h * 0.1, r.z), q, s.set(r.r, r.h * 0.85, r.r * (0.8 + 0.3 * hash01(i, 5, seed))));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.setHex(F.rock).multiplyScalar(0.8 + 0.4 * hash01(i, 6, seed)));
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
  const grassGeo = grassGeometry();
  const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
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
      for (const t of treeMeshes) t.mesh.visible = Math.hypot(t.x - camera.x, t.z - camera.z) < reach;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
