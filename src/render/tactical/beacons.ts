// Supply beacons (07c): a tall, faint blue column of light over the headquarters and over every
// outpost compound in view, and a short one over every ammunition cache that still holds rounds,
// so that the way to ammunition can be seen from afar (the HUD gives the direction and the
// distance too). The caches themselves are olive crates. Two draw calls; the light shows through the fog.

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import { heightAt } from '../../sim/tactical/collision.ts';
import { supplyPoints } from '../../sim/world/outposts.ts';
import type { RenderContext, SubRenderer } from '../index.ts';
import { around, cellOffset, neighbourMap, renderGrid } from './neighbours.ts';

const B = RENDER.beacons;
const MAX = 64;

export function createBeaconRenderer(): SubRenderer {
  const geo = new THREE.CylinderGeometry(B.radius, B.radius * 1.6, B.height, 8, 1, true).translate(0, B.height / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ color: B.color, transparent: true, opacity: B.opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 4;
  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  const crateMat = new THREE.MeshLambertMaterial({ color: B.crate });
  const crates = new THREE.InstancedMesh(crateGeo, crateMat, MAX * 2);
  crates.frustumCulled = false;
  crates.count = 0;
  let ctx: RenderContext;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  return {
    id: 'beacons',
    init(c: RenderContext) {
      ctx = c;
      ctx.scene.add(mesh, crates);
    },
    update(state: GameState) {
      const map = mapOf(state);
      if (!map || state.flags.range) {
        mesh.count = 0;
        crates.count = 0;
        return;
      }
      // From the overhead camera the light would only clutter the base; the crates stay.
      mesh.visible = state.mode !== 'command';
      let n = 0;
      let nc = 0;
      const cam = ctx.camera.position;
      const mapOfCell = (cell: number) => (cell === state.player.cell ? map : neighbourMap(state, cell));
      const cells = around(state).filter((c): c is number => c !== null && mapOfCell(c) !== null);
      for (const p of supplyPoints(state, mapOfCell, renderGrid(), cells)) {
        if (n >= MAX) break;
        const off = cellOffset(state, p.cell, map.size);
        if (!off) continue;
        const there = mapOfCell(p.cell);
        if (!there) continue;
        const x = p.pos[0] + off[0];
        const z = p.pos[1] + off[1];
        const y = heightAt(there, p.pos[0], p.pos[1]);
        const cache = p.kind === 'cache';
        // Close by, the place itself is in view: the light would only blind.
        const near = Math.hypot(x - cam.x, z - cam.z) < (cache ? B.hideNearCache : B.hideNear);
        if (!near) {
          m.compose(v.set(x, y, z), q.identity(), sc.set(cache ? 0.5 : 1, cache ? B.cacheHeight / B.height : 1, cache ? 0.5 : 1));
          mesh.setMatrixAt(n++, m);
        }
        if (cache && nc + 2 <= MAX * 2) {
          // An ammunition crate and its lid.
          q.setFromAxisAngle(v.set(0, 1, 0), (p.index ?? 0) * 1.3 + p.cell * 0.7);
          crates.setMatrixAt(nc++, m.compose(v.set(x, y + 0.3, z), q, sc.set(1.1, 0.6, 0.6)));
          crates.setMatrixAt(nc++, m.compose(v.set(x, y + 0.63, z), q, sc.set(1.16, 0.08, 0.66)));
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      crates.count = nc;
      crates.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      crates.removeFromParent();
      geo.dispose();
      mat.dispose();
      crateGeo.dispose();
      crateMat.dispose();
    },
  };
}
