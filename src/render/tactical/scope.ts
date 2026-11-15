// Scope overlay: one full-screen triangle drawn over the scene. Outside the circle it is black,
// inside there is a slight vignette, the wandering shadow of the eye box, and the mil-dot reticle.
//
// The reticle sits in the first focal plane: it is drawn in mil, converted to pixels with the
// current field of view (px per mil = 0.001 * (H / 2) / tan(fov / 2)). Zooming in enlarges the
// reticle together with the target, so one dot spacing is always 1 mil (10 cm at 100 m).

import * as THREE from 'three';
import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import { viewTan } from '../../sim/tactical/weapon.ts';
import type { FrameInfo, RenderContext, SubRenderer } from '../index.ts';

const S = RENDER.scope;

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec2 uRes;
uniform float uPxPerMil;
uniform float uAmount;
uniform float uRadius;
uniform float uEdge;
uniform vec2 uShadow;
uniform vec3 uColor;
uniform float uVignette;
uniform vec4 uLine;   // line half width (mil), dot radius (mil), post half width (mil), post start (mil)
uniform float uDots;

float band(float d, float half_, float px) { return 1.0 - smoothstep(half_ - px, half_ + px, abs(d)); }

void main() {
  vec2 p = gl_FragCoord.xy - 0.5 * uRes;
  float r = length(p);
  float e = uAmount * uAmount * (3.0 - 2.0 * uAmount);
  // The tube closes in from beyond the corners of the screen while the rifle comes up.
  float R = mix(length(uRes) * 0.75, uRadius, e);
  float mask = smoothstep(R - uEdge, R + uEdge, r);
  // Eye-box shadow: a second, softer circle that lags behind when the view turns.
  float sh = smoothstep(R * 0.78, R * 1.04, length(p - uShadow));
  float vig = uVignette * pow(clamp(r / R, 0.0, 1.0), 4.0);
  float dark = max(mask, max(sh * 0.96, vig)) * e;

  // Reticle, in mil.
  vec2 q = p / uPxPerMil;
  float px = 0.5 / uPxPerMil;
  vec2 a = abs(q);
  float ret = 0.0;
  // fine cross hairs out to the posts (the upper one stays fine all the way)
  ret = max(ret, band(q.x, uLine.x, px) * step(a.y, uLine.w + 40.0 * step(0.0, q.y)));
  ret = max(ret, band(q.y, uLine.x, px) * step(a.x, uLine.w));
  // thick posts: left, right, bottom
  ret = max(ret, band(q.y, uLine.z, px) * step(uLine.w, a.x));
  ret = max(ret, band(q.x, uLine.z, px) * step(uLine.w, -q.y));
  // dots at every whole mil
  vec2 n = clamp(floor(a + 0.5), 1.0, uDots);
  float dx = length(vec2(a.x - n.x, q.y));
  float dy = length(vec2(q.x, a.y - n.y));
  ret = max(ret, 1.0 - smoothstep(uLine.y - px, uLine.y + px, min(dx, dy)));
  // half-mil ticks once there is room for them
  float room = smoothstep(6.0, 9.0, uPxPerMil);
  vec2 h = clamp(floor(a) + 0.5, 0.5, uDots - 0.5);
  float tick = max(band(a.x - h.x, uLine.x, px) * step(a.y, 0.16), band(a.y - h.y, uLine.x, px) * step(a.x, 0.16));
  ret = max(ret, tick * room);
  ret *= smoothstep(0.75, 1.0, uAmount) * (1.0 - mask);

  gl_FragColor = vec4(uColor * (1.0 - dark), max(dark, ret * 0.92));
}`;

export function createScopeRenderer(): SubRenderer {
  let ctx: RenderContext;
  let mesh: THREE.Mesh;
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uPxPerMil: { value: 4 },
    uAmount: { value: 0 },
    uRadius: { value: 300 },
    uEdge: { value: 4 },
    uShadow: { value: new THREE.Vector2() },
    uColor: { value: new THREE.Color(S.reticle) },
    uVignette: { value: S.vignette },
    uLine: { value: new THREE.Vector4() },
    uDots: { value: S.dots },
  };
  const size = new THREE.Vector2();
  let lastYaw = 0;
  let lastPitch = 0;
  const shadow = new THREE.Vector2();

  return {
    id: 'scope',
    init(c: RenderContext) {
      ctx = c;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
      const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthTest: false, depthWrite: false, fog: false });
      mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1000;
      mesh.visible = false;
      ctx.scene.add(mesh);
    },
    update(state: GameState, frame: FrameInfo) {
      const p = state.player;
      const amount = state.mode === 'tactical' ? p.aim.scopeT : 0;
      mesh.visible = amount > 0;
      const yaw = p.yaw + p.aim.off[0];
      const pitch = p.pitch + p.aim.off[1];
      if (!mesh.visible) {
        lastYaw = yaw;
        lastPitch = pitch;
        shadow.set(0, 0);
        return;
      }
      ctx.renderer.getDrawingBufferSize(size);
      const tan = viewTan(p);
      const pxPerRad = size.y / 2 / tan;
      const pxPerMil = pxPerRad * 0.001;
      uniforms.uRes.value.copy(size);
      uniforms.uPxPerMil.value = pxPerMil;
      uniforms.uAmount.value = amount;
      uniforms.uRadius.value = S.radius * size.y;
      uniforms.uEdge.value = Math.max(1.5, S.edge * size.y);
      uniforms.uLine.value.set(
        Math.max(S.lineMil, (S.lineMinPx * size.y) / 720 / pxPerMil),
        Math.max(S.dotMil, (S.dotMinPx * size.y) / 720 / pxPerMil),
        S.postMil,
        S.postFrom,
      );
      // The eye lags behind the rifle: turning the view pushes the shadow in from the leading edge.
      const dt = Math.max(frame.realDt, 1 / 240);
      let dyaw = yaw - lastYaw;
      dyaw -= Math.round(dyaw / (Math.PI * 2)) * Math.PI * 2;
      const rate = pxPerRad / size.y; // screen heights per radian: the same hand movement looks faster zoomed in
      const tx = Math.max(-S.shadowMax, Math.min(S.shadowMax, (-dyaw / dt) * rate * S.shadowGain)) * size.y;
      const ty = Math.max(-S.shadowMax, Math.min(S.shadowMax, ((pitch - lastPitch) / dt) * rate * S.shadowGain)) * size.y;
      const k = Math.min(1, 10 * dt);
      shadow.x += (tx - shadow.x) * k;
      shadow.y += (ty - shadow.y) * k;
      uniforms.uShadow.value.copy(shadow);
      lastYaw = yaw;
      lastPitch = pitch;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
  };
}
