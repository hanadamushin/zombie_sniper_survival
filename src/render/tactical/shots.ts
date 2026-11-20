// The player's own shot (08): a faint streak that follows each round in flight, so that a miss can
// be read through the scope before the dust rises. One LineSegments object, additive, no depth
// write; segments are rebuilt each frame from the bullets the sim is flying (state.tactical.bullets).

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import type { RenderContext, SubRenderer } from '../index.ts';

const S = RENDER.shots;

export function createShotRenderer(): SubRenderer {
  const pos = new Float32Array(S.maxTracers * 6);
  const col = new Float32Array(S.maxTracers * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: S.tracerOpacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 6;
  const tint = new THREE.Color(S.tracer);

  return {
    id: 'shots',
    init(ctx: RenderContext) {
      ctx.scene.add(lines);
    },
    update(state: GameState) {
      const bullets = state.mode === 'tactical' ? (state.tactical?.bullets ?? []) : [];
      let n = 0;
      for (const b of bullets) {
        if (n >= S.maxTracers) break;
        if (b.dist < S.tracerFrom) continue;
        const speed = Math.hypot(b.vel[0], b.vel[1], b.vel[2]) || 1;
        const len = Math.min(S.tracerLength, b.dist - S.tracerFrom + 1);
        const k = len / speed;
        const o = n * 6;
        pos[o] = b.pos[0] - b.vel[0] * k;
        pos[o + 1] = b.pos[1] - b.vel[1] * k;
        pos[o + 2] = b.pos[2] - b.vel[2] * k;
        pos[o + 3] = b.pos[0];
        pos[o + 4] = b.pos[1];
        pos[o + 5] = b.pos[2];
        // Dark at the tail, brighter at the head.
        col[o] = tint.r * 0.15;
        col[o + 1] = tint.g * 0.15;
        col[o + 2] = tint.b * 0.15;
        col[o + 3] = tint.r;
        col[o + 4] = tint.g;
        col[o + 5] = tint.b;
        n++;
      }
      lines.visible = n > 0;
      if (n === 0) return;
      geo.setDrawRange(0, n * 2);
      geo.getAttribute('position').needsUpdate = true;
      geo.getAttribute('color').needsUpdate = true;
    },
    dispose() {
      lines.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
