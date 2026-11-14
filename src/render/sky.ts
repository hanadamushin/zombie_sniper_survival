// Sky colour, fog and lights driven by the time of day. Built-in sub-renderer.

import * as THREE from 'three';
import { daylight, hourFloat } from '../core/time.ts';
import { RENDER } from '../data/render.ts';
import type { RenderContext, SubRenderer } from './index.ts';

const S = RENDER.sky;

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

export function createSkyRenderer(): SubRenderer {
  const colors: SkyColors = { sky: new THREE.Color(), fog: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), light: 1 };
  const background = new THREE.Color();
  const fog = new THREE.Fog(0xffffff, RENDER.fog.near, RENDER.fog.far);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);

  return {
    id: 'sky',
    init(ctx: RenderContext) {
      ctx.scene.background = background;
      ctx.scene.fog = fog;
      ctx.scene.add(hemi, sun, sun.target);
    },
    update(state) {
      const hour = hourFloat(state.time);
      skyColors(hour, colors);
      background.copy(colors.sky);
      fog.color.copy(colors.fog);
      hemi.color.copy(colors.sky);
      hemi.groundColor.copy(colors.ground);
      hemi.intensity = THREE.MathUtils.lerp(S.ambientNight, S.ambientDay, colors.light);
      sun.color.copy(colors.sun);
      sun.intensity = THREE.MathUtils.lerp(S.sunNight, S.sunDay, colors.light);
      // Sun (or moon at night) arcs east -> west; the light always comes from above the horizon.
      const a = ((hour - 6) / 12) * Math.PI;
      sun.position.set(Math.cos(a) * 300, Math.abs(Math.sin(a)) * 300 + 120, 120);
    },
  };
}
