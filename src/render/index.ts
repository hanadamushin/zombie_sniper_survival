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
import { createShotRenderer } from './tactical/shots.ts';
import { createEffectsRenderer } from './tactical/effects.ts';
import { createTacticalRenderer } from './tactical/index.ts';
import { createScopeRenderer } from './tactical/scope.ts';
import { createSignalRenderer } from './tactical/signals.ts';
import { createBeaconRenderer } from './tactical/beacons.ts';
import { createStashRenderer } from './tactical/stash.ts';
import { createStructureRenderer } from './tactical/structures.ts';
import { createSurvivorRenderer } from './tactical/survivors.ts';
import { createZombieRenderer } from './tactical/zombies.ts';

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
  /** Automatic resolution (RENDER.resolution): current scale, and a switch (screenshots / tests turn it off). */
  resolutionScale(): number;
  setAutoResolution(on: boolean): void;
  /** Settings (08): automatic resolution off, drawing at this share of the full resolution (0.5..1). */
  setFixedScale(scale: number): void;
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

  // --- automatic resolution: a safety net for slow GPUs (nobody has tested on real hardware yet) ---
  const Q = RENDER.resolution;
  let scale = 1;
  let auto = true;
  let avgMs = 16;
  let slow = 0;
  let fast = 0;
  let wait: number = Q.upSeconds;
  let sinceRaise = Infinity;
  const setScale = (next: number): void => {
    scale = Math.min(1, Math.max(Q.min, next));
    width = 0; // forces resize() to apply the new pixel ratio
  };
  const adapt = (realDt: number): void => {
    if (!auto || realDt <= 0) return;
    const dt = Math.min(0.25, realDt);
    avgMs += (dt * 1000 - avgMs) * Math.min(1, dt / Q.smooth);
    sinceRaise += dt;
    if (avgMs > Q.slowMs) {
      fast = 0;
      slow += dt;
      if (slow >= Q.downSeconds && scale > Q.min) {
        // A raise that did not hold: wait longer before trying again.
        if (sinceRaise < Q.failSeconds) wait = Math.min(Q.upSeconds * Q.maxBackoff, wait * 2);
        setScale(scale - Q.step * (avgMs > Q.slowMs * 2 ? 2 : 1));
        slow = 0;
      }
    } else {
      slow = 0;
      if (avgMs < Q.fastMs && scale < 1) {
        fast += dt;
        if (fast >= wait) {
          setScale(scale + Q.step);
          fast = 0;
          sinceRaise = 0;
        }
      } else fast = 0;
    }
  };

  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio) * scale);
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
      adapt(realDt);
      resize(); // cheap when unchanged; also covers container-driven size changes
      const frame: FrameInfo = { alpha, realDt, width, height };
      for (const s of subs) s.update(state, frame);
      renderer.render(scene, camera);
    },
    reset(state) {
      for (const s of subs) s.reset?.(state);
    },
    resolutionScale: () => scale,
    setAutoResolution(on) {
      auto = on;
      if (!on) setScale(1);
    },
    setFixedScale(next) {
      auto = false;
      setScale(next);
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
  api.register(createStructureRenderer()); // 06: walls, moats, towers, buildings, blueprints
  api.register(createZombieRenderer());
  api.register(createSurvivorRenderer());
  api.register(createSignalRenderer()); // 07b: smoke / light over hideouts
  api.register(createBeaconRenderer()); // 07c: where to get ammunition
  api.register(createStashRenderer()); // O1: clue boards, Hashima's boats, the stash's heap
  api.register(createEffectsRenderer());
  api.register(createShotRenderer()); // 08: the streak behind the player's own round
  api.register(createScopeRenderer()); // last: drawn over everything
  return api;
}
