// Sight-blocking vegetation and box scenery of an operation area (07b), four draw calls:
//   boxes  — hedges (a row of boxes following the ground), wrecks, logs, greenhouse frames
//   blobs  — bushes, thickets, the undergrowth of bamboo groves
//   reeds  — head-high spikes filling the reed beds
//   culms  — bamboo
// What is drawn is at least as tall and as wide as the capsule the sim uses for lines of sight
// (TacticalMap.brush), so that what hides a zombie from the player also hides the player from it.

import * as THREE from 'three';
import { RENDER } from '../../data/render.ts';
import { sampleHeight, type Brush, type TacticalMap } from '../../gen/index.ts';
import { hash01 } from '../../gen/noise.ts';
import type { Built } from './terrain.ts';

const P = RENDER.brush;

/** Vertex colours running from `low` at y = 0 to `high` at y = 1. */
function gradient(geo: THREE.BufferGeometry, low: number, high: number, y0 = 0, y1 = 1): THREE.BufferGeometry {
  const a = new THREE.Color(low);
  const b = new THREE.Color(high);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0))));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function mergeColored(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const count = flat.reduce((s, p) => s + p.getAttribute('position').count, 0);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const p of flat) {
    pos.set(p.getAttribute('position').array, o * 3);
    col.set(p.getAttribute('color').array, o * 3);
    o += p.getAttribute('position').count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  for (const p of [...parts, ...flat]) p.dispose();
  return geo;
}

/** Bamboo: a thin stem of unit height with two leafy tufts near the top. */
function culmGeometry(): THREE.BufferGeometry {
  const stem = gradient(new THREE.CylinderGeometry(0.05, 0.07, 1, 3, 1, true).translate(0, 0.5, 0), P.bambooStem, P.bambooStem);
  const leafA = gradient(new THREE.OctahedronGeometry(1, 0).scale(0.95, 0.14, 0.95).translate(0.15, 0.72, 0), P.bambooLeaf, P.bambooTip, 0.6, 1);
  const leafB = gradient(new THREE.OctahedronGeometry(1, 0).scale(0.7, 0.12, 0.7).translate(-0.1, 0.92, 0.1), P.bambooLeaf, P.bambooTip, 0.6, 1);
  return mergeColored([stem, leafA, leafB]);
}

interface Box {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Rotation about the vertical axis, then about the box's own long (x) axis. */
  yaw: number;
  roll: number;
  color: number;
  shade: number;
}

/** Jittered grid points inside a capsule. */
function fill(br: Brush, spacing: number, salt: number, seed: number, fn: (x: number, z: number, k: number) => void): void {
  const x0 = Math.min(br.ax, br.bx) - br.r;
  const z0 = Math.min(br.az, br.bz) - br.r;
  const nx = Math.ceil((Math.abs(br.bx - br.ax) + br.r * 2) / spacing);
  const nz = Math.ceil((Math.abs(br.bz - br.az) + br.r * 2) / spacing);
  const dx = br.bx - br.ax;
  const dz = br.bz - br.az;
  const len2 = dx * dx + dz * dz;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (Math.round(x0) + i) * 7919 + (Math.round(z0) + j) * 104729 + salt;
      const x = x0 + (i + hash01(k, 1, seed)) * spacing;
      const z = z0 + (j + hash01(k, 2, seed)) * spacing;
      const u = len2 > 0 ? Math.min(1, Math.max(0, ((x - br.ax) * dx + (z - br.az) * dz) / len2)) : 0;
      if ((x - br.ax - dx * u) ** 2 + (z - br.az - dz * u) ** 2 < br.r * br.r) fn(x, z, k);
    }
  }
}

export interface BrushPart extends Built {
  /** Camera position in the map's own frame: the fine undergrowth is only drawn close by (07c). */
  update(x: number, z: number): void;
}

export function buildBrush(map: TacticalMap): BrushPart {
  const seed = map.params.mapSeed;
  const ground = (x: number, z: number): number => sampleHeight(map.height, map.n, map.tile, x, z);
  const boxes: Box[] = [];
  const blobs: { x: number; y: number; z: number; r: number; h: number; k: number; color: number }[] = [];
  const reeds: { x: number; y: number; z: number; w: number; h: number; k: number }[] = [];
  const culms: { x: number; y: number; z: number; h: number; k: number }[] = [];

  map.brush.forEach((br, bi) => {
    const salt = bi * 31;
    if (br.kind === 'hedge') {
      const len = Math.hypot(br.bx - br.ax, br.bz - br.az);
      const n = Math.max(1, Math.round((len + br.r * 2) / P.hedgePiece));
      const piece = (len + br.r * 2) / n;
      const ux = len > 0 ? (br.bx - br.ax) / len : 1;
      const uz = len > 0 ? (br.bz - br.az) / len : 0;
      const yaw = Math.atan2(-uz, ux);
      for (let i = 0; i < n; i++) {
        const d = -br.r + (i + 0.5) * piece;
        const x = br.ax + ux * d;
        const z = br.az + uz * d;
        const k = salt + i;
        const h = br.h * (1 + 0.22 * hash01(k, 3, seed));
        const g0 = ground(x - ux * piece * 0.5, z - uz * piece * 0.5);
        const g1 = ground(x + ux * piece * 0.5, z + uz * piece * 0.5);
        const gm = ground(x, z);
        // From below the lowest ground under the piece to h above the highest.
        const bottom = Math.min(g0, g1, gm) - 0.5;
        const sy = Math.max(g0, g1, gm) + h - bottom;
        boxes.push({
          x, y: bottom + sy / 2, z,
          sx: piece + 0.5, sy, sz: br.r * 2 * (0.95 + 0.25 * hash01(k, 4, seed)),
          yaw: yaw + (hash01(k, 5, seed) - 0.5) * 0.16, roll: 0, color: P.hedge, shade: 0.8 + 0.4 * hash01(k, 6, seed),
        });
      }
    } else if (br.kind === 'bush') {
      blobs.push({ x: br.ax, y: ground(br.ax, br.az), z: br.az, r: br.r, h: br.h, k: salt, color: P.bush });
    } else if (br.kind === 'reeds') {
      fill(br, P.reedSpacing, salt, seed, (x, z, k) => {
        reeds.push({ x, y: ground(x, z), z, w: P.reedWidth * (0.8 + 0.5 * hash01(k, 3, seed)), h: br.h * (1.1 + 0.35 * hash01(k, 4, seed)), k });
      });
    } else {
      fill(br, P.bambooSpacing, salt, seed, (x, z, k) => {
        culms.push({ x, y: ground(x, z), z, h: br.h * (0.85 + 0.4 * hash01(k, 3, seed)), k });
      });
      // Bamboo grass underneath: what actually closes the view at eye level.
      fill(br, P.bambooUnder, salt + 7, seed, (x, z, k) => {
        blobs.push({ x, y: ground(x, z), z, r: P.bambooUnder * 0.8, h: 2.3 + 0.6 * hash01(k, 5, seed), k, color: P.bambooLeaf });
      });
    }
  });

  for (const [pi, p] of map.props.entries()) {
    const yaw = p.alongX ? 0 : Math.PI / 2;
    const ax = p.alongX ? 1 : 0;
    const az = p.alongX ? 0 : 1;
    const at = (along: number, across: number, y: number, sx: number, sy: number, sz: number, color: number, shade = 1, roll = 0): void => {
      boxes.push({ x: p.x + ax * along - az * across, y: p.y + y, z: p.z + az * along + ax * across, sx, sy, sz, yaw, roll, color, shade });
    };
    const top = p.h; // above p.y (the lowest ground under it)
    if (p.kind === 'log') {
      at(0, 0, top / 2 - 0.2, p.w, top + 0.4, p.d, P.log, 0.8 + 0.4 * p.tint);
    } else if (p.kind === 'car') {
      const paint = P.wreck[Math.floor(p.tint * P.wreck.length) % P.wreck.length]!;
      at(0, 0, top - 1.5 + 0.55, p.w, 0.8, p.d, paint, 0.9);
      at(-p.w * 0.06, 0, top - 0.32, p.w * 0.5, 0.64, p.d * 0.88, paint, 0.62);
      at(0, 0, (top - 1.5) / 2, p.w * 0.9, Math.max(0.3, top - 1.5) + 0.3, p.d * 0.9, P.wreckDark, 1);
    } else if (p.kind === 'truck') {
      const paint = P.wreck[Math.floor(p.tint * P.wreck.length) % P.wreck.length]!;
      const base = top - 2.7;
      at(p.w / 2 - 0.9, 0, base + 1.5, 1.8, 2.1, p.d, paint, 0.85);
      at(-0.95, 0, base + 1.65, p.w - 1.9, 2.1, p.d, P.wreckBox, 0.8 + 0.3 * hash01(pi, 2, seed));
      at(0, 0, base / 2 + 0.2, p.w * 0.92, base + 0.6, p.d * 0.85, P.wreckDark, 1);
    } else {
      // Greenhouse frame: hoops of two posts and two rafters, a ridge pole and two eave poles.
      const eave = top * 0.62;
      const half = p.d / 2;
      const rise = top - eave;
      const rafter = Math.hypot(half, rise);
      const pitch = Math.atan2(rise, half);
      const pipe = 0.07;
      const hoops = Math.max(2, Math.round(p.w / 2.4));
      for (let i = 0; i <= hoops; i++) {
        const along = -p.w / 2 + (p.w * i) / hoops;
        if (hash01(pi * 53 + i, 9, seed) < 0.12) continue; // some have fallen
        at(along, -half, eave / 2 - 0.2, pipe, eave + 0.4, pipe, P.frame);
        at(along, half, eave / 2 - 0.2, pipe, eave + 0.4, pipe, P.frame);
        at(along, -half / 2, eave + rise / 2, pipe, pipe, rafter, P.frame, 1, p.alongX ? -pitch : pitch);
        at(along, half / 2, eave + rise / 2, pipe, pipe, rafter, P.frame, 1, p.alongX ? pitch : -pitch);
      }
      at(0, 0, top, p.w, pipe, pipe, P.frame);
      at(0, -half, eave, p.w, pipe, pipe, P.frame);
      at(0, half, eave, p.w, pipe, pipe, P.frame);
      // Rags of sheeting on the weather side.
      for (let i = 0; i < hoops; i++) {
        if (hash01(pi * 53 + i, 10, seed) > 0.35) continue;
        at(-p.w / 2 + (p.w * (i + 0.5)) / hoops, -half, eave * 0.5, p.w / hoops, eave * 0.9, 0.03, P.sheet, 0.85 + 0.2 * hash01(pi * 53 + i, 11, seed));
      }
    }
  }

  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const color = new THREE.Color();
  /** Fine undergrowth is split into the four 512 m quadrants of the map, so that far ones can be hidden (07c). */
  const half = map.size / 2;
  const quadrants: { mesh: THREE.InstancedMesh; x0: number; z0: number }[] = [];
  const add = <T extends { x: number; z: number }>(name: string, geo: THREE.BufferGeometry, material: THREE.Material, list: T[], each: (mesh: THREE.InstancedMesh, k: number, item: T) => void): void => {
    disposables.push(geo, material);
    const split = name !== 'brush-boxes';
    for (let qd = 0; qd < (split ? 4 : 1); qd++) {
      const x0 = (qd % 2) * half;
      const z0 = Math.floor(qd / 2) * half;
      const items = split ? list.filter((it) => (it.x >= half ? half : 0) === x0 && (it.z >= half ? half : 0) === z0) : list;
      if (items.length === 0) continue;
      const mesh = new THREE.InstancedMesh(geo, material, items.length);
      items.forEach((it, k) => each(mesh, k, it));
      mesh.computeBoundingSphere();
      mesh.name = name;
      group.add(mesh);
      disposables.push(mesh);
      if (split) quadrants.push({ mesh, x0, z0 });
    }
  };

  add('brush-boxes', new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), boxes, (mesh, i, bx) => {
    q.setFromAxisAngle(up, bx.yaw);
    if (bx.roll !== 0) q.multiply(q2.setFromAxisAngle(xAxis, bx.roll));
    mesh.setMatrixAt(i, m.compose(v.set(bx.x, bx.y, bx.z), q, s.set(bx.sx, bx.sy, bx.sz)));
    mesh.setColorAt(i, color.setHex(bx.color).multiplyScalar(bx.shade));
  });
  add('brush-blobs', new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), blobs, (mesh, i, bl) => {
    q.setFromAxisAngle(up, hash01(bl.k, 7, seed) * Math.PI * 2);
    mesh.setMatrixAt(i, m.compose(v.set(bl.x, bl.y + bl.h * 0.42, bl.z), q, s.set(bl.r * 1.08, bl.h * 0.64, bl.r * 1.08)));
    const shade = 0.75 + 0.45 * hash01(bl.k, 8, seed);
    mesh.setColorAt(i, color.setHex(bl.color).multiplyScalar(shade));
  });
  add('brush-reeds', gradient(new THREE.ConeGeometry(0.5, 1, 4, 1, true).translate(0, 0.5, 0), P.reedRoot, P.reedTip), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), reeds, (mesh, i, r) => {
    q.setFromAxisAngle(up, hash01(r.k, 7, seed) * Math.PI * 2);
    mesh.setMatrixAt(i, m.compose(v.set(r.x, r.y - 0.1, r.z), q, s.set(r.w, r.h, r.w)));
    const shade = 0.8 + 0.4 * hash01(r.k, 8, seed);
    mesh.setColorAt(i, color.setRGB(shade, shade, shade * 0.92));
  });
  add('brush-culms', culmGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), culms, (mesh, i, c) => {
    q.setFromAxisAngle(up, hash01(c.k, 7, seed) * Math.PI * 2);
    mesh.setMatrixAt(i, m.compose(v.set(c.x, c.y - 0.1, c.z), q, s.set(1, c.h, 1)));
    const shade = 0.8 + 0.4 * hash01(c.k, 8, seed);
    mesh.setColorAt(i, color.setRGB(shade, shade, shade));
  });

  return {
    object: group,
    update(x, z) {
      // Hedges and wrecks always; reeds, bushes and bamboo only in the quadrants within reach (they are most of the triangles).
      for (const qd of quadrants) {
        const d = Math.hypot(Math.max(qd.x0 - x, 0, x - qd.x0 - half), Math.max(qd.z0 - z, 0, z - qd.z0 - half));
        qd.mesh.visible = d < P.fineRange;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
