// Impact effects: dust where a bullet meets the ground, grey chips on walls and rock, splinters
// on trunks, blood on bodies. They are how a miss is read ("low and left"), so the puffs are sized
// to stay visible through the scope at long range. One Points object, CPU-simulated particles.

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import type { FrameInfo, RenderContext, SubRenderer } from '../index.ts';

const E = RENDER.effects;
const MAX = E.max;

const VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
  gl_PointSize = max(1.5, aSize * uScale / max(0.1, vDepth));
  vColor = aColor;
  vAlpha = aAlpha;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uFog;
uniform vec2 uFogRange;
uniform float uLight;
varying vec3 vColor;
varying float vAlpha;
varying float vDepth;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = vAlpha * (1.0 - smoothstep(0.2, 0.5, d));
  if (a < 0.01) discard;
  float f = smoothstep(uFogRange.x, uFogRange.y, vDepth);
  gl_FragColor = vec4(mix(vColor * uLight, uFog, f), a);
}`;

export function createEffectsRenderer(): SubRenderer {
  let ctx: RenderContext;
  let points: THREE.Points;
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const size = new Float32Array(MAX);
  const alpha = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const span = new Float32Array(MAX);
  const grow = new Float32Array(MAX);
  const base = new Float32Array(MAX);
  const weight = new Float32Array(MAX);
  let next = 0;
  let live = 0;
  const uniforms = {
    uScale: { value: 1 },
    uFog: { value: new THREE.Color() },
    uFogRange: { value: new THREE.Vector2(RENDER.fog.near, RENDER.fog.far) },
    uLight: { value: 1 },
  };
  const c = new THREE.Color();
  const buf = new THREE.Vector2();
  const offs: (() => void)[] = [];

  const emit = (x: number, y: number, z: number, vx: number, vy: number, vz: number, hex: number, s: number, g: number, seconds: number, w: number): void => {
    const i = next;
    next = (next + 1) % MAX;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    c.set(hex);
    const shade = 0.8 + Math.random() * 0.4;
    col[i * 3] = c.r * shade;
    col[i * 3 + 1] = c.g * shade;
    col[i * 3 + 2] = c.b * shade;
    base[i] = s;
    grow[i] = g;
    life[i] = seconds;
    span[i] = seconds;
    weight[i] = w;
  };
  const rnd = (m: number): number => (Math.random() * 2 - 1) * m;

  return {
    id: 'effects',
    init(context: RenderContext) {
      ctx = context;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, fog: false }));
      points.frustumCulled = false;
      points.renderOrder = 5;
      points.visible = false;
      ctx.scene.add(points);

      // 08: a little smoke at the muzzle (the suppressor keeps it to a wisp).
      offs.push(ctx.events.on('shotFired', (e) => {
        const [x, y, z] = e.pos;
        const d = e.dir;
        const S = RENDER.shots;
        // Through the scope the field is a few degrees wide: keep the wisp low and short so it never fills the glass.
        const scoped = e.scoped === true;
        for (let i = 0; i < 6; i++) {
          const ahead = 0.9 + Math.random() * 0.5;
          const sp = 0.4 + Math.random() * 0.9;
          if (scoped) emit(x + d[0] * ahead, y + d[1] * ahead - 0.25, z + d[2] * ahead, d[0] * sp + rnd(0.2), -0.1, d[2] * sp + rnd(0.2), S.smoke, 0.04, 0.2, 0.35 + Math.random() * 0.2, 0);
          else emit(x + d[0] * ahead, y + d[1] * ahead - 0.08, z + d[2] * ahead, d[0] * sp + rnd(0.25), 0.25 + Math.random() * 0.35, d[2] * sp + rnd(0.25), S.smoke, 0.05, 0.35, 0.7 + Math.random() * 0.6, -0.15);
        }
      }));
      offs.push(ctx.events.on('bulletHit', (e) => {
        const [x, y, z] = e.pos;
        const d = e.dir ?? [0, 0, -1];
        // Far impacts get a larger puff so they can still be read through the scope.
        const far = 1 + (e.range ?? 0) / 350;
        if (e.zombie !== null) {
          const head = e.part === 'head';
          const n = head ? 18 : 9;
          for (let i = 0; i < n; i++) {
            const sp = 1.5 + Math.random() * (head ? 5 : 3);
            emit(x, y, z, d[0] * sp + rnd(1.2), d[1] * sp + rnd(1.2) + 0.8, d[2] * sp + rnd(1.2), E.blood, (head ? 0.16 : 0.1) * far, 0.5 * far, 0.35 + Math.random() * 0.45, 6);
          }
          return;
        }
        const hex = e.surface === 'terrain' ? E.dust : e.surface === 'tree' ? E.wood : E.stone;
        const up = e.surface === 'terrain' ? 1 : 0.2;
        for (let i = 0; i < 12; i++) {
          // Kicked back towards the shooter and upwards.
          const sp = 0.6 + Math.random() * 2.2;
          emit(x, y + 0.05, z, -d[0] * sp * 0.6 + rnd(0.7), up * (0.8 + Math.random() * 2.4) + rnd(0.3), -d[2] * sp * 0.6 + rnd(0.7), hex, 0.22 * far, 0.9 * far, 0.9 + Math.random() * 0.9, 1.2);
        }
      }));
    },
    update(_state: GameState, frame: FrameInfo) {
      const dt = Math.min(0.05, frame.realDt);
      live = 0;
      for (let i = 0; i < MAX; i++) {
        if (life[i]! <= 0) {
          alpha[i] = 0;
          size[i] = 0;
          continue;
        }
        life[i] = life[i]! - dt;
        const k = 1 - Math.max(0, life[i]!) / span[i]!;
        const drag = Math.exp(-2.2 * dt);
        vel[i * 3] = vel[i * 3]! * drag;
        vel[i * 3 + 1] = (vel[i * 3 + 1]! - weight[i]! * dt) * drag;
        vel[i * 3 + 2] = vel[i * 3 + 2]! * drag;
        pos[i * 3] = pos[i * 3]! + vel[i * 3]! * dt;
        pos[i * 3 + 1] = pos[i * 3 + 1]! + vel[i * 3 + 1]! * dt;
        pos[i * 3 + 2] = pos[i * 3 + 2]! + vel[i * 3 + 2]! * dt;
        size[i] = base[i]! + grow[i]! * k;
        alpha[i] = 0.85 * (1 - k) * Math.min(1, k * 12);
        live++;
      }
      points.visible = live > 0;
      if (!points.visible) return;
      const g = points.geometry;
      for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) g.getAttribute(name).needsUpdate = true;
      ctx.renderer.getDrawingBufferSize(buf);
      uniforms.uScale.value = buf.y / (2 * Math.tan((ctx.camera.fov * Math.PI) / 360));
      const fog = ctx.scene.fog as THREE.Fog | null;
      if (fog) uniforms.uFog.value.copy(fog.color);
      // Roughly follow the daylight so that dust does not glow at night.
      uniforms.uLight.value = fog ? Math.min(1, 0.25 + (fog.color.r + fog.color.g + fog.color.b) / 1.6) : 1;
    },
    dispose() {
      for (const off of offs) off();
      points.removeFromParent();
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    },
  };
}
