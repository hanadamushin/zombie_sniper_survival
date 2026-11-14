// Sky colour, fog and lights driven by the time of day. Built-in sub-renderer.
// 03 added the sky dome (gradient to the fog colour at the horizon), sun and moon discs, stars,
// and made the directional light follow whichever of the two is up.

import * as THREE from 'three';
import { daylight, hourFloat } from '../core/time.ts';
import { RENDER } from '../data/render.ts';
import type { RenderContext, SubRenderer } from './index.ts';

const S = RENDER.sky;
const CEL = RENDER.celestial;

export interface SkyColors {
  sky: THREE.Color;
  fog: THREE.Color;
  ground: THREE.Color;
  sun: THREE.Color;
  /** 0 night .. 1 day */
  light: number;
}

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function mix(out: THREE.Color, night: number, twilight: number, day: number, light: number): THREE.Color {
  // night -> twilight over the first half of the transition, twilight -> day over the second half
  if (light < 0.5) return out.copy(tmpA.setHex(night)).lerp(tmpB.setHex(twilight), light * 2);
  return out.copy(tmpA.setHex(twilight)).lerp(tmpB.setHex(day), (light - 0.5) * 2);
}

/** Colours for a continuous hour of day in [0, 24). Writes into `out` (no allocation per frame). */
export function skyColors(hour: number, out: SkyColors): SkyColors {
  const light = daylight(hour);
  mix(out.sky, S.night.sky, S.twilight.sky, S.day.sky, light);
  mix(out.fog, S.night.fog, S.twilight.fog, S.day.fog, light);
  mix(out.ground, S.night.ground, S.twilight.ground, S.day.ground, light);
  mix(out.sun, S.night.sun, S.twilight.sun, S.day.sun, light);
  out.light = light;
  return out;
}

/**
 * Directions towards the sun and the moon for an hour of day. The sun is up between
 * celestial.sunrise and sunset, the moon during the rest; both travel east (+x) -> south -> west.
 */
export function celestialDirs(hour: number, sun: THREE.Vector3, moon: THREE.Vector3): void {
  const dayLen = CEL.sunset - CEL.sunrise;
  const a = ((hour - CEL.sunrise) / dayLen) * Math.PI;
  sun.set(Math.cos(a), Math.sin(a) * 0.9, 0.42).normalize();
  const b = ((((hour - CEL.sunset) % 24) + 24) % 24 / (24 - dayLen)) * Math.PI;
  moon.set(Math.cos(b), Math.sin(b) * 0.8, 0.5).normalize();
}

const DOME_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // at the far plane: only pixels nothing else covered are shaded
  }`;
const DOME_FRAGMENT = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uSunSize;
  uniform float uMoonSize;
  uniform float uStars;
  varying vec3 vDir;
  float hash( vec3 p ) {
    p = fract( p * 0.3183099 + 0.1 );
    p *= 17.0;
    return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
  }
  void main() {
    vec3 d = normalize( vDir );
    float up = max( d.y, 0.0 );
    vec3 col = mix( uHorizon, uZenith, pow( up, 0.55 ) );
    // Stars: one candidate per cell of a direction grid.
    if ( uStars > 0.0 && d.y > 0.0 ) {
      vec3 g = d * 150.0;
      vec3 cell = floor( g );
      float h = hash( cell );
      float star = step( 0.98, h ) * ( 1.0 - smoothstep( 0.0, 0.3, length( fract( g ) - 0.5 ) ) );
      col += vec3( 0.8, 0.85, 1.0 ) * star * uStars * smoothstep( 0.0, 0.25, d.y ) * ( 0.4 + 0.6 * fract( h * 91.7 ) );
    }
    float s = dot( d, uSunDir );
    float sunUp = smoothstep( -0.06, 0.02, uSunDir.y );
    col += uSunColor * ( pow( max( s, 0.0 ), 48.0 ) * 0.35 + pow( max( s, 0.0 ), 6.0 ) * 0.12 ) * sunUp;
    col = mix( col, uSunColor * 1.6, smoothstep( cos( uSunSize ), cos( uSunSize * 0.8 ), s ) * sunUp );
    float m = dot( d, uMoonDir );
    float moonUp = smoothstep( -0.06, 0.02, uMoonDir.y );
    col += uMoonColor * pow( max( m, 0.0 ), 90.0 ) * 0.12 * moonUp;
    col = mix( col, uMoonColor, smoothstep( cos( uMoonSize ), cos( uMoonSize * 0.85 ), m ) * moonUp );
    gl_FragColor = vec4( col, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createSkyRenderer(): SubRenderer {
  const colors: SkyColors = { sky: new THREE.Color(), fog: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), light: 1 };
  const background = new THREE.Color();
  const fog = new THREE.Fog(0xffffff, RENDER.fog.near, RENDER.fog.far);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const ambientNight = new THREE.Color(CEL.ambientNightColor);
  const zenithDay = new THREE.Color(CEL.zenithDay);
  const zenithNight = new THREE.Color(CEL.zenithNight);
  const moonColor = new THREE.Color(CEL.moon);
  const uniforms = {
    uHorizon: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uMoonColor: { value: moonColor },
    uSunDir: { value: sunDir },
    uMoonDir: { value: moonDir },
    uSunSize: { value: CEL.sunSize },
    uMoonSize: { value: CEL.moonSize },
    uStars: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 12),
    new THREE.ShaderMaterial({ uniforms, vertexShader: DOME_VERTEX, fragmentShader: DOME_FRAGMENT, side: THREE.BackSide, depthWrite: false, depthFunc: THREE.LessEqualDepth, fog: false }),
  );
  dome.renderOrder = 10; // after the opaque world, so that hidden sky costs nothing
  dome.frustumCulled = false;
  let camera: THREE.PerspectiveCamera;

  return {
    id: 'sky',
    init(ctx: RenderContext) {
      camera = ctx.camera;
      ctx.scene.background = background;
      ctx.scene.fog = fog;
      ctx.scene.add(hemi, sun, sun.target, dome);
    },
    update(state) {
      const hour = hourFloat(state.time);
      skyColors(hour, colors);
      background.copy(colors.fog);
      fog.color.copy(colors.fog);
      // Ambient: sky-coloured by day, a pale blue at night (so that the night is dark, not black).
      hemi.color.copy(ambientNight).lerp(colors.sky, colors.light);
      hemi.groundColor.copy(colors.ground);
      hemi.intensity = THREE.MathUtils.lerp(S.ambientNight, S.ambientDay, colors.light);

      celestialDirs(hour, sunDir, moonDir);
      // The light comes from the sun while it is up, otherwise from the moon; either fades out at the horizon.
      const sunPower = S.sunDay * THREE.MathUtils.smoothstep(sunDir.y, 0, 0.25);
      const moonPower = S.sunNight * THREE.MathUtils.smoothstep(moonDir.y, 0, 0.3);
      const from = sunPower >= moonPower ? sunDir : moonDir;
      sun.color.copy(sunPower >= moonPower ? colors.sun : moonColor);
      sun.intensity = Math.max(sunPower, moonPower);
      sun.target.position.copy(camera.position);
      sun.position.copy(camera.position).addScaledVector(from, 300);

      uniforms.uHorizon.value.copy(colors.fog);
      uniforms.uZenith.value.copy(zenithNight).lerp(zenithDay, colors.light);
      // At dusk and dawn the zenith picks up some of the horizon colour.
      if (colors.light > 0 && colors.light < 1) uniforms.uZenith.value.lerp(colors.sky, 0.35 * (1 - Math.abs(colors.light * 2 - 1)));
      uniforms.uSunColor.value.copy(colors.sun);
      uniforms.uStars.value = CEL.stars * (1 - THREE.MathUtils.smoothstep(colors.light, 0, 0.35));
      dome.position.copy(camera.position);
      dome.scale.setScalar(camera.far * 0.9);
    },
  };
}
