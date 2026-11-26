// O1: what marks the hidden stashes and their clues in the current area — the notice boards by the
// landmarks' entrances (pale paper until read, then dim), the boats at Hashima's two landings, and
// the heap of crates (Okinawa: olive ammunition boxes) or of timber and steel (Hashima) at a stash's
// supply point while something is left. One instanced draw call of boxes.

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import { clueIsRead, cluesOf, stashSite, stashTotalLeft } from '../../sim/world/stash.ts';
import type { RenderContext, SubRenderer } from '../index.ts';

const C = RENDER.stash;
const MAX = 160;

export function createStashRenderer(): SubRenderer {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.frustumCulled = false;
  mesh.count = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  let n = 0;
  /** A box: centre of its base (x, y, z), size, turned by yaw about its centre. */
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, color: number): void => {
    if (n >= MAX) return;
    q.setFromAxisAngle(up, yaw);
    mesh.setMatrixAt(n, m.compose(v.set(x, y, z), q, s.set(w, h, d)));
    mesh.setColorAt(n, col.setHex(color));
    n++;
  };
  return {
    id: 'stash',
    init(ctx: RenderContext) {
      ctx.scene.add(mesh);
    },
    update(state: GameState) {
      n = 0;
      const map = mapOf(state);
      if (map && !state.flags.range) {
        for (const b of cluesOf(map)) {
          // Two posts and the board, facing the reader (yaw looks from the board's front towards the landmark).
          const [x, y, z] = b.pos;
          const ax = Math.cos(b.yaw);
          const az = -Math.sin(b.yaw);
          // The board stands 1.5 m further than the reader, towards the landmark.
          const fx = x - Math.sin(b.yaw) * 1.5;
          const fz = z - Math.cos(b.yaw) * 1.5;
          for (const side of [-0.55, 0.55]) box(fx + ax * side, y, fz + az * side, 0.08, 1.7, 0.08, b.yaw, C.post);
          box(fx, y + 0.9, fz, 1.3, 0.85, 0.06, b.yaw, C.post);
          box(fx - Math.sin(b.yaw) * -0.04, y + 0.98, fz - Math.cos(b.yaw) * -0.04, 1.1, 0.66, 0.02, b.yaw, clueIsRead(state, b) ? C.read : C.paper);
        }
        const site = stashSite(map);
        if (site) {
          if (site.dock && site.shore) {
            for (const [a, o] of [[site.dock, site.shore], [site.shore, site.dock]] as const) {
              // The boat lies off the landing, towards the other one.
              const dx = o[0] - a[0];
              const dz = o[2] - a[2];
              const len = Math.hypot(dx, dz) || 1;
              const yaw = Math.atan2(-dz, dx);
              const bx = a[0] + (dx / len) * 3.2;
              const bz = a[2] + (dz / len) * 3.2;
              const wy = a[1] - C.boatDrop;
              box(bx, wy, bz, 5.5, 0.9, 2, yaw, C.hull);
              box(bx - (dx / len) * 1.2, wy + 0.9, bz - (dz / len) * 1.2, 1.6, 1.1, 1.4, yaw, C.cabin);
              // A short pier from the landing to the boat.
              box(a[0] + (dx / len) * 1.2, a[1] - 0.25, a[2] + (dz / len) * 1.2, 2.6, 0.25, 1.2, yaw, C.pier);
            }
          }
          if (stashTotalLeft(state, site.id) > 0) {
            const [x, y, z] = site.supply;
            const colors = site.id === 'okinawa' ? [C.ammo, C.ammoDark] : [C.timber, C.steel, C.sacks];
            for (let i = 0; i < 9; i++) {
              const gx = (i % 3) - 1;
              const gz = Math.floor(i / 3) - 1;
              const h = 0.55 + ((i * 7) % 3) * 0.45;
              box(x + gx * 1.15, y, z + gz * 0.9, 1.05, h, 0.8, 0, colors[i % colors.length]!);
            }
          }
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
