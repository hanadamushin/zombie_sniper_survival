// Placeholder ground + camera rig for M0. Session 03 replaces both with the real terrain and
// the first-person / overhead cameras (unregister via renderer.unregister('ground' | 'camera')).

import * as THREE from 'three';
import { RENDER } from '../data/render.ts';
import type { RenderContext, SubRenderer } from './index.ts';

export function createGroundPlaceholder(): SubRenderer {
  let ground: THREE.Mesh | null = null;
  let grid: THREE.GridHelper | null = null;
  return {
    id: 'ground',
    init(ctx: RenderContext) {
      const size = RENDER.areaSize;
      ground = new THREE.Mesh(
        new THREE.PlaneGeometry(size * 3, size * 3).rotateX(-Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: RENDER.placeholderGround }),
      );
      // 64 m grid lines so that camera changes are visible on the empty plane.
      grid = new THREE.GridHelper(size, size / 64, 0x2f3d28, 0x3d4d33);
      grid.position.y = 0.02;
      ctx.scene.add(ground, grid);
    },
    update() {},
    dispose() {
      for (const obj of [ground, grid]) {
        if (!obj) continue;
        obj.removeFromParent();
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    },
  };
}

export function createCameraRig(): SubRenderer {
  let camera: THREE.PerspectiveCamera;
  const C = RENDER.camera;
  return {
    id: 'camera',
    init(ctx: RenderContext) {
      camera = ctx.camera;
      camera.rotation.order = 'YXZ';
    },
    update(state) {
      const [x, y, z] = state.player.pos;
      if (state.mode === 'tactical') {
        camera.position.set(x, y + C.eyeHeight[state.player.stance], z);
        camera.rotation.set(state.player.pitch, state.player.yaw, 0);
      } else {
        // Command / world / menu: look down at the base from behind.
        camera.position.set(x, y + C.commandHeight, z + C.commandBack);
        camera.lookAt(x, y, z);
      }
    },
  };
}
