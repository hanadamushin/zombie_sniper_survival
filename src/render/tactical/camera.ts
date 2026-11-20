// Camera rig: first person in the tactical mode (eye at player.pos + player.eye), an overhead
// view for the command / world / menu layers. Replaces the M0 placeholder rig.
//
// 04 (scope): call rig.setFov(degrees) to zoom, rig.setFov(null) to return to the default.

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { commandView, VIEW_LIMITS } from '../../core/view.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import { heightAt } from '../../sim/tactical/collision.ts';
import { viewFovDeg } from '../../sim/tactical/weapon.ts';
import { settings } from '../../settings.ts';
import type { FrameInfo, RenderContext, SubRenderer } from '../index.ts';

export interface CameraRig extends SubRenderer {
  /** Vertical field of view override in degrees (null = follow the player's scope: sim/tactical/weapon.ts viewFovDeg). */
  setFov(fov: number | null): void;
  fov(): number;
}

const DEG = Math.PI / 180;
/**
 * Settings (08): the field of view without the scope. Only the un-scoped end changes; through the
 * scope the picture is exactly the sim's (the mil reticle depends on it).
 */
function tacticalFov(scopeT: number, simFov: number): number {
  if (settings.fov === RENDER.camera.fov || scopeT >= 1) return simFov;
  const k = Math.tan((settings.fov * DEG) / 2) / Math.tan((RENDER.camera.fov * DEG) / 2);
  const tan = Math.tan((simFov * DEG) / 2) * (1 + (k - 1) * (1 - scopeT));
  return (2 * Math.atan(tan)) / DEG;
}

export function createCameraRig(): CameraRig {
  const C = RENDER.camera;
  let camera: THREE.PerspectiveCamera;
  let fov: number = C.fov;
  let override: number | null = null;
  // Sim positions of the last two rendered frames, for interpolation between fixed steps.
  const prev = new THREE.Vector3();
  const curr = new THREE.Vector3();
  let eyeY = 0;
  let fresh = true;
  let groundY = 0;
  let areaKey: unknown = null;
  /** 08: a small roll kick on each shot, settling back (presentation only; the sim's recoil is separate). */
  let kick = 0;
  let kickT = 0;

  return {
    id: 'camera',
    init(ctx: RenderContext) {
      camera = ctx.camera;
      ctx.events.on('shotFired', (e) => {
        const S = RENDER.shots;
        kick = S.shakeRoll * (e.scoped ? S.shakeScoped : 1) * (Math.random() < 0.5 ? -1 : 1);
        kickT = 0;
      });
      camera.rotation.order = 'YXZ';
      // Screen point -> point on the ground under the overhead camera (the base is level, so a plane will do).
      const ndc = new THREE.Vector3();
      commandView.pick = (clientX, clientY) => {
        const rect = ctx.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        camera.updateMatrixWorld();
        ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5).unproject(camera);
        const dx = ndc.x - camera.position.x, dy = ndc.y - camera.position.y, dz = ndc.z - camera.position.z;
        if (dy >= -1e-6) return null;
        const k = (groundY - camera.position.y) / dy;
        return [camera.position.x + dx * k, camera.position.z + dz * k];
      };
    },
    setFov(next) {
      override = next;
    },
    fov: () => fov,
    reset() {
      fresh = true;
      commandView.ready = false;
      commandView.preview = null;
      commandView.highlight = null;
    },
    update(state: GameState, frame: FrameInfo) {
      const p = state.player;
      const [x, y, z] = p.pos;
      const jumped = Math.abs(x - curr.x) + Math.abs(z - curr.z) > 8;
      if (fresh || jumped) {
        prev.set(x, y, z);
        curr.set(x, y, z);
        eyeY = y;
        fresh = false;
      } else if (x !== curr.x || y !== curr.y || z !== curr.z) {
        prev.copy(curr);
        curr.set(x, y, z);
      }
      fov = override ?? (state.mode === 'tactical' ? tacticalFov(p.aim.scopeT, viewFovDeg(p)) : C.fov);
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (state.mode === 'tactical') {
        const a = frame.alpha;
        const ix = prev.x + (curr.x - prev.x) * a;
        const iy = prev.y + (curr.y - prev.y) * a;
        const iz = prev.z + (curr.z - prev.z) * a;
        // Stairs and ledges move the feet in jumps; the eye follows smoothly.
        eyeY += (iy - eyeY) * Math.min(1, C.stepRate * Math.max(frame.realDt, 1 / 240));
        if (Math.abs(iy - eyeY) > 1.5) eyeY = iy;
        camera.position.set(ix, eyeY + p.eye, iz);
        // Sway and recoil move the whole picture; the reticle stays in the middle (04).
        kickT += frame.realDt;
        const roll = kick * Math.exp(-RENDER.shots.shakeDecay * kickT) * Math.cos(kickT * 40);
        camera.rotation.set(p.pitch + p.aim.off[1], p.yaw + p.aim.off[0], Math.abs(roll) > 1e-5 ? roll : 0);
      } else {
        // Command / world / menu: an overhead camera the player can pan, zoom and turn (06).
        // It starts above the player, looking north, and is re-centred when the area changes.
        const V = commandView;
        const map = mapOf(state);
        if (!V.ready || areaKey !== map) {
          areaKey = map;
          V.x = x;
          V.z = z;
          V.yaw = 0;
          V.dist = VIEW_LIMITS.defaultDist;
          V.ready = true;
        }
        const size = map?.size ?? 1024;
        V.x = Math.min(size, Math.max(0, V.x));
        V.z = Math.min(size, Math.max(0, V.z));
        groundY = map ? heightAt(map, V.x, V.z) : y;
        const pitch = C.commandPitch;
        const h = Math.cos(pitch) * V.dist;
        camera.position.set(V.x + Math.sin(V.yaw) * h, groundY + Math.sin(pitch) * V.dist, V.z + Math.cos(V.yaw) * h);
        camera.lookAt(V.x, groundY, V.z);
        eyeY = y;
      }
    },
  };
}
