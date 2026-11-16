// Signs of people (07b): a thin column of smoke over every hideout whose people have not been met
// yet, and a small light there at night. From a firing position this is how the player learns
// that somebody is out there; on the ground the HUD ("人の気配") takes over at close range.
// Two draw calls at most: smoke puffs (instanced), lights (points; only at night).

import * as THREE from 'three';
import { daylight } from '../../core/time.ts';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { heightAt } from '../../sim/tactical/collision.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import type { FrameInfo, RenderContext, SubRenderer } from '../index.ts';

const S = RENDER.signals;
const MAX = 8;

export function createSignalRenderer(): SubRenderer {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const smokeMat = new THREE.MeshBasicMaterial({ color: S.smoke, transparent: true, opacity: S.opacity, depthWrite: false });
  const smoke = new THREE.InstancedMesh(geo, smokeMat, MAX * S.puffs);
  smoke.frustumCulled = false;
  smoke.count = 0;
  smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smoke.renderOrder = 3;
  const lightGeo = new THREE.BufferGeometry();
  const lightPos = new Float32Array(MAX * 3);
  lightGeo.setAttribute('position', new THREE.BufferAttribute(lightPos, 3));
  const lightMat = new THREE.PointsMaterial({ color: S.light, size: S.lightPx, sizeAttenuation: false, fog: false });
  const lights = new THREE.Points(lightGeo, lightMat);
  lights.frustumCulled = false;
  lights.visible = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  let clock = 0;

  return {
    id: 'signals',
    init(ctx: RenderContext) {
      ctx.scene.add(smoke, lights);
    },
    update(state: GameState, frame: FrameInfo) {
      const t = state.tactical;
      const map = mapOf(state);
      const hideouts = t?.hideouts;
      if (!t || !map || !hideouts || hideouts.length === 0) {
        smoke.count = 0;
        lights.visible = false;
        return;
      }
      clock += frame.realDt * (state.time.speed === 0 ? 0 : 1);
      const day = daylight(state.time.minute / 60);
      let n = 0;
      let nl = 0;
      for (let hi = 0; hi < hideouts.length && hi < MAX; hi++) {
        const h = hideouts[hi]!;
        if (h.met) continue;
        const y0 = heightAt(map, h.pos[0], h.pos[1]) + S.base;
        // Each puff climbs the column, widening and drifting with a slow sway; the cycle wraps.
        for (let k = 0; k < S.puffs; k++) {
          const u = (clock / S.seconds + k / S.puffs + hi * 0.37) % 1;
          const y = y0 + u * S.height;
          const lean = u * u * S.drift;
          const sway = Math.sin(clock * 0.5 + k * 1.7 + hi) * u * 0.8;
          const r = (S.radius[0] + (S.radius[1] - S.radius[0]) * u) * (1 - 0.6 * u * u * u);
          m.compose(v.set(h.pos[0] + lean + sway, y, h.pos[1] + lean * 0.4 + Math.cos(clock * 0.4 + k) * u * 0.6), q, s.set(r, r * 1.5, r));
          smoke.setMatrixAt(n++, m);
        }
        lightPos[nl * 3] = h.pos[0];
        lightPos[nl * 3 + 1] = y0 - S.base + 1.1;
        lightPos[nl * 3 + 2] = h.pos[1];
        nl++;
      }
      smoke.count = n;
      smoke.instanceMatrix.needsUpdate = true;
      // Smoke is hard to make out in the dark; the fire is not.
      smokeMat.opacity = S.opacity * (0.25 + 0.75 * day);
      lights.visible = nl > 0 && day < S.lightBelow;
      if (lights.visible) {
        lightGeo.setDrawRange(0, nl);
        lightGeo.getAttribute('position').needsUpdate = true;
        lightMat.size = S.lightPx * (0.85 + 0.15 * Math.sin(clock * 9));
      }
    },
    dispose() {
      smoke.removeFromParent();
      lights.removeFromParent();
      geo.dispose();
      smokeMat.dispose();
      lightGeo.dispose();
      lightMat.dispose();
    },
  };
}
