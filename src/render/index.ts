// Three.js entry point. Rendering only READS GameState (docs/04_architecture.md §2).
//
// Each visual domain is a SubRenderer registered here (terrain, zombies, structures, scope, ...):
//
//   renderer.register({ id: 'zombies', init(ctx) { ...add meshes to ctx.scene... },
//                       update(state, frame) { ...read state, write instance matrices... } });
//
// Sub-renderers run in registration order every frame, then the scene is drawn once.
// For one-shot effects (muzzle flash, hit marks) subscribe to ctx.events inside init().

import * as THREE from 'three';
import type { EventBus } from '../core/events.ts';
import type { GameState } from '../core/types.ts';
import { RENDER } from '../data/render.ts';
import { createSkyRenderer } from './sky.ts';
import { createCameraRig, type CameraRig } from './tactical/camera.ts';
import { createTacticalRenderer } from './tactical/index.ts';

export interface RenderContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  /** Sim event bus (delivered at the end of each tick). */
  readonly events: EventBus;
}

export interface FrameInfo {
  /** Interpolation factor in [0,1) between the last two sim steps. */
  readonly alpha: number;
  /** Real seconds since the previous rendered frame. */
  readonly realDt: number;
  readonly width: number;
  readonly height: number;
}

export interface SubRenderer {
  readonly id: string;
  /** Called once when registered. Create meshes / materials and add them to ctx.scene. */
  init(ctx: RenderContext): void;
  /** Called every rendered frame before the draw. Read state only. */
  update(state: GameState, frame: FrameInfo): void;
  /** A different GameState object is now active (new game / load): drop caches derived from the old one. */
  reset?(state: GameState): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}

export interface Renderer {
  readonly ctx: RenderContext;
  /** First-person / overhead camera. 04 (scope) zooms through view.setFov(). */
  readonly view: CameraRig;
  register(sub: SubRenderer): void;
  unregister(id: string): void;
  /** Draw one frame. */
  draw(state: GameState, alpha: number, realDt?: number): void;
  reset(state: GameState): void;
  /** Draw calls of the last frame (performance budget: < 150). */
  drawCalls(): number;
  dispose(): void;
}

export function createRenderer(canvas: HTMLCanvasElement, events: EventBus): Renderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const C = RENDER.camera;
  const camera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far);
  const ctx: RenderContext = { renderer, scene, camera, canvas, events };
  const subs: SubRenderer[] = [];
  let width = 0;
  let height = 0;

  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const s of subs) s.resize?.(w, h);
  };
  window.addEventListener('resize', resize);

  const view = createCameraRig();
  const api: Renderer = {
    ctx,
    view,
    register(sub) {
      if (subs.some((s) => s.id === sub.id)) throw new Error(`SubRenderer "${sub.id}" is already registered`);
      subs.push(sub);
      sub.init(ctx);
      if (width > 0) sub.resize?.(width, height);
    },
    unregister(id) {
      const i = subs.findIndex((s) => s.id === id);
      if (i < 0) return;
      subs[i]?.dispose?.();
      subs.splice(i, 1);
    },
    draw(state, alpha, realDt = 0) {
      resize(); // cheap when unchanged; also covers container-driven size changes
      const frame: FrameInfo = { alpha, realDt, width, height };
      for (const s of subs) s.update(state, frame);
      renderer.render(scene, camera);
    },
    reset(state) {
      for (const s of subs) s.reset?.(state);
    },
    drawCalls: () => renderer.info.render.calls,
    dispose() {
      window.removeEventListener('resize', resize);
      for (const s of subs) s.dispose?.();
      subs.length = 0;
      renderer.dispose();
    },
  };

  // Built-ins. Order matters: the camera first (sky dome and grass follow it), the world last.
  api.register(view);
  api.register(createSkyRenderer());
  api.register(createTacticalRenderer());
  return api;
}
