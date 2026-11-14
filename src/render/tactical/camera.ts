// Camera rig: first person in the tactical mode (eye at player.pos + player.eye), an overhead
// view for the command / world / menu layers. Replaces the M0 placeholder rig.
//
// 04 (scope): call rig.setFov(degrees) to zoom, rig.setFov(null) to return to the default.

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import type { FrameInfo, RenderContext, SubRenderer } from '../index.ts';

export interface CameraRig extends SubRenderer {
  /** Vertical field of view override in degrees (null = RENDER.camera.fov). */
  setFov(fov: number | null): void;
  fov(): number;
}

export function createCameraRig(): CameraRig {
  const C = RENDER.camera;
  let camera: THREE.PerspectiveCamera;
  let fov: number = C.fov;
  // Sim positions of the last two rendered frames, for interpolation between fixed steps.
  const prev = new THREE.Vector3();
  const curr = new THREE.Vector3();
  let eyeY = 0;
  let fresh = true;

  return {
    id: 'camera',
    init(ctx: RenderContext) {
      camera = ctx.camera;
      camera.rotation.order = 'YXZ';
    },
    setFov(next) {
      fov = next ?? C.fov;
    },
    fov: () => fov,
    reset() {
      fresh = true;
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
        camera.rotation.set(p.pitch, p.yaw, 0);
      } else {
        // Command / world / menu: look down at the player from behind (south).
        camera.position.set(x, y + C.commandHeight, z + C.commandBack);
        camera.lookAt(x, y, z);
        eyeY = y;
      }
    },
  };
}
