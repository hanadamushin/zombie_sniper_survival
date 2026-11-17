// Supply beacons (07c): a tall, faint blue column of light over the headquarters and over every
// outpost compound in view, so that the way to ammunition can be seen from afar (the HUD gives
// the direction and the distance too). One draw call; drawn through the fog.

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import { heightAt } from '../../sim/tactical/collision.ts';
import { supplyPoints } from '../../sim/world/outposts.ts';
import type { RenderContext, SubRenderer } from '../index.ts';
import { cellOffset, neighbourMap } from './neighbours.ts';

const B = RENDER.beacons;
const MAX = 12;

export function createBeaconRenderer(): SubRenderer {
  const geo = new THREE.CylinderGeometry(B.radius, B.radius * 1.6, B.height, 8, 1, true).translate(0, B.height / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ color: B.color, transparent: true, opacity: B.opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 4;
  const m = new THREE.Matrix4();
  return {
    id: 'beacons',
    init(ctx: RenderContext) {
      ctx.scene.add(mesh);
    },
    update(state: GameState) {
      const map = mapOf(state);
      if (!map || state.flags.range || state.mode === 'command') {
        mesh.count = 0;
        return;
      }
      let n = 0;
      for (const p of supplyPoints(state, (cell) => (cell === state.player.cell ? map : neighbourMap(state, cell)))) {
        if (n >= MAX) break;
        const off = cellOffset(state, p.cell, map.size);
        if (!off) continue;
        const there = p.cell === state.player.cell ? map : neighbourMap(state, p.cell);
        if (!there) continue;
        m.makeTranslation(p.pos[0] + off[0], heightAt(there, p.pos[0], p.pos[1]), p.pos[1] + off[1]);
        mesh.setMatrixAt(n++, m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
