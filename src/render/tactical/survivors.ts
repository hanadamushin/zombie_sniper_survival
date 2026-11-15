// Survivors inside the base and people in hiding at search points (the base itself: structures.ts).
// Same technique as the zombies (render/tactical/zombies.ts): instanced boxes, one draw call for
// all figures, one for the blob shadows. To keep anyone from being shot
// by mistake they look nothing like the dead: upright, brisk, in clean saturated work clothes,
// each job with its own colour and something to carry.

import * as THREE from 'three';
import type { GameState, JobId, Survivor } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import { standHeight } from '../../sim/build/defense.ts';
import { heightAt } from '../../sim/tactical/collision.ts';
import type { FrameInfo, RenderContext, SubRenderer } from '../index.ts';

const R = RENDER.survivors;
const PARTS = 7;
const root = new THREE.Matrix4();
const upper = new THREE.Matrix4();
const a = new THREE.Matrix4();
const b = new THREE.Matrix4();
const out = new THREE.Matrix4();
const color = new THREE.Color();

interface Look {
  /** Last drawn position and facing, and the distance walked (gait phase). */
  x: number;
  z: number;
  yaw: number;
  walk: number;
}

export function createSurvivorRenderer(): SubRenderer {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), R.max * PARTS);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, color.set(0xffffff));
  mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  const blobs = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: R.blobOpacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    R.max,
  );
  blobs.frustumCulled = false;
  blobs.count = 0;
  blobs.renderOrder = 2;
  let n = 0;
  let clock = 0;
  const looks = new Map<number, Look>();

  /** parent * T(p) * Rx(rx) * T(0, cy, cz) * S(s) */
  const part = (parent: THREE.Matrix4, px: number, py: number, pz: number, rx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: number): void => {
    a.makeRotationX(rx).setPosition(px, py, pz);
    b.makeScale(sx, sy, sz).setPosition(0, cy, cz);
    out.multiplyMatrices(parent, a).multiply(b);
    mesh.setMatrixAt(n, out);
    mesh.setColorAt(n, color.set(hex));
    n++;
  };

  /** One person. `kind`: what they are doing (task kind) — decides the pose. */
  const figure = (x: number, y: number, z: number, yaw: number, kind: string, job: JobId | 'hidden', seed: number, phase: number, t: number): void => {
    const pal = job === 'hidden' ? R.hidden : R.job[job];
    const skin = R.skin[seed % R.skin.length]!;
    const legs = R.legs[(seed >> 2) % R.legs.length]!;
    const H = 1.72;
    const hip = 0.86;
    const W = 0.44;
    let lean = 0, armL = 0, armR = 0, legL = 0, legR = 0, drop = 0;
    root.makeRotationY(yaw).setPosition(x, y, z);
    const swing = Math.sin(phase);
    if (kind === 'sleep' || kind === 'rest') {
      a.makeRotationX(-Math.PI / 2);
      root.multiply(a);
      root.elements[13] = y + 0.2;
    } else if (kind === 'eat') {
      drop = hip - 0.28;
      legL = legR = -Math.PI / 2 + 0.15;
      armR = -0.9 - 0.5 * Math.max(0, Math.sin(t * 2.2 + seed));
      armL = -0.4;
    } else if (kind === 'walk') {
      legL = 0.55 * swing;
      legR = -0.55 * swing;
      armL = -0.5 * swing;
      armR = 0.5 * swing;
      lean = 0.05;
    } else if (kind === 'work') {
      const beat = Math.sin(t * 3 + seed);
      if (job === 'farming') { lean = 0.75 + 0.15 * beat; armL = -0.6; armR = -0.6 - 0.3 * beat; }
      else if (job === 'construction' || job === 'crafting') { lean = 0.2; armR = -1.4 + 0.8 * beat; armL = -0.5; }
      else if (job === 'defense') { armL = -0.9; armR = -0.7; }
      else if (job === 'scavenging') { lean = 0.35 + 0.2 * beat; armL = -0.8; armR = -0.4; }
      else { lean = 0.1; armL = -0.8 + 0.1 * beat; armR = -0.8 - 0.1 * beat; }
    } else if (kind === 'wave') {
      armR = -2.7 + 0.35 * Math.sin(t * 6);
    } else {
      armL = 0.05 * Math.sin(t + seed);
      armR = -armL;
    }
    const hipY = hip - drop;
    a.makeRotationX(-lean).setPosition(0, hipY, 0);
    upper.multiplyMatrices(root, a);
    const torso = 0.6;
    part(upper, 0, 0, 0, 0, torso / 2, 0, W, torso, 0.24, pal.top);
    part(upper, 0, torso + 0.13, 0, 0, 0, 0, 0.21, 0.24, 0.22, skin);
    part(upper, -(W + 0.1) / 2, torso - 0.05, 0, armL, -0.3, 0, 0.1, 0.6, 0.1, pal.top);
    part(upper, (W + 0.1) / 2, torso - 0.05, 0, armR, -0.3, 0, 0.1, 0.6, 0.1, pal.top);
    part(root, -W * 0.24, hipY, 0, legL, -hip / 2, 0, 0.15, hip, 0.15, legs);
    part(root, W * 0.24, hipY, 0, legR, -hip / 2, 0, 0.15, hip, 0.15, legs);
    // What they carry / wear: the quickest way to tell jobs apart from a distance.
    switch (job) {
      case 'farming': part(upper, 0, torso + 0.27, 0, 0, 0, 0, 0.5, 0.05, 0.5, pal.prop); break; // straw hat
      case 'construction': part(upper, 0, torso + 0.27, 0, 0, 0, 0, 0.26, 0.1, 0.27, pal.prop); break; // helmet
      case 'defense': part(upper, 0.2, torso - 0.25, -0.2, -0.5, 0, 0, 0.06, 0.06, 1.0, pal.prop); break; // long gun
      case 'scavenging': part(upper, 0, torso * 0.55, 0.2, 0, 0, 0, 0.34, 0.44, 0.18, pal.prop); break; // backpack
      case 'medical': part(upper, 0, torso * 0.62, -0.125, 0, 0, 0, 0.16, 0.16, 0.02, pal.prop); break; // red cross
      case 'research': part(upper, 0, torso * 0.3, -0.16, 0, 0, 0, 0.26, 0.3, 0.04, pal.prop); break; // clipboard
      case 'crafting': part(upper, 0, torso * 0.3, -0.125, 0, 0, 0, 0.36, 0.5, 0.02, pal.prop); break; // apron
      default: part(upper, 0, torso + 0.26, 0, 0, 0, 0, 0.22, 0.04, 0.23, job === 'hidden' ? pal.prop : skin); // hair / cap
    }
    void H;
  };

  const drawSurvivor = (s: Survivor, y: number, dt: number): void => {
    let look = looks.get(s.id);
    if (!look) looks.set(s.id, (look = { x: s.pos[0], z: s.pos[1], yaw: (s.id * 2.4) % 6.28, walk: 0 }));
    const dx = s.pos[0] - look.x, dz = s.pos[1] - look.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4 && d < 5) {
      look.walk += d;
      const want = Math.atan2(-dx, -dz);
      let diff = want - look.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      look.yaw += diff * Math.min(1, dt * 10);
    }
    look.x = s.pos[0];
    look.z = s.pos[1];
    figure(s.pos[0], y, s.pos[1], look.yaw, s.task?.kind ?? 'free', s.job, s.id * 7 + 3, look.walk * 4.4, clock);
  };

  return {
    id: 'survivors',
    init(ctx: RenderContext) {
      ctx.scene.add(mesh, blobs);
    },
    reset() {
      looks.clear();
    },
    update(state: GameState, frame: FrameInfo) {
      const map = mapOf(state);
      const t = state.tactical;
      n = 0;
      let nb = 0;
      clock += frame.realDt * (state.time.speed === 0 ? 0 : 1);
      if (!map || !t || state.flags.range) {
        mesh.count = 0;
        blobs.count = 0;
        return;
      }
      const blob = (x: number, y: number, z: number, lying: boolean): void => {
        b.makeScale(lying ? 0.5 : 0.42, 1, lying ? 1 : 0.42);
        b.setPosition(x, y + 0.05, z);
        blobs.setMatrixAt(nb++, b);
      };
      if (map.params.isHome) {
        for (const s of state.colony.survivors) {
          if (s.location.kind !== 'home' || s.status === 'dead' || nb >= R.max) continue;
          // Guards who have reached their tower stand on its deck (06).
          const y = s.task?.target != null && s.task.kind === 'work' ? standHeight(state, map, s.pos[0], s.pos[1]) : heightAt(map, s.pos[0], s.pos[1]);
          drawSurvivor(s, y, frame.realDt);
          blob(s.pos[0], y, s.pos[1], s.task?.kind === 'sleep' || s.task?.kind === 'rest');
        }
      }
      for (const h of t.hideouts ?? []) {
        if (h.met || nb >= R.max) continue;
        const y = heightAt(map, h.pos[0], h.pos[1]);
        const p = state.player.pos;
        figure(h.pos[0], y, h.pos[1], Math.atan2(-(p[0] - h.pos[0]), -(p[2] - h.pos[1])), 'wave', 'hidden', h.spot * 7 + 1, 0, clock);
        blob(h.pos[0], y, h.pos[1], false);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      blobs.count = nb;
      blobs.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const m of [mesh, blobs]) {
        m.removeFromParent();
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
  };
}
