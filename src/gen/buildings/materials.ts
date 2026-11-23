// How each material behaves (07d). Colours live in data/render.ts (RENDER.materials).
//   solid      'full'  blocks people, zombies, bullets and sight
//              'pane'  blocks people and zombies only (glass: bullets and sight pass)
//              'none'  decoration (blood stains, posters, plants): nothing collides
//   glass      drawn see-through

import type { MaterialId } from './types.ts';

export interface MaterialInfo {
  solid: 'full' | 'pane' | 'none';
  glass?: boolean;
}

export const MATERIALS: Readonly<Record<MaterialId, MaterialInfo>> = {
  concrete: { solid: 'full' },
  plaster: { solid: 'full' },
  mortar: { solid: 'full' },
  siding: { solid: 'full' },
  brick: { solid: 'full' },
  wood: { solid: 'full' },
  woodDark: { solid: 'full' },
  tile: { solid: 'full' },
  slate: { solid: 'full' },
  metalRoof: { solid: 'full' },
  steel: { solid: 'full' },
  rust: { solid: 'full' },
  glass: { solid: 'pane', glass: true },
  shutter: { solid: 'full' },
  door: { solid: 'full' },
  doorSteel: { solid: 'full' },
  frame: { solid: 'full' },
  flooring: { solid: 'full' },
  tatami: { solid: 'full' },
  carpet: { solid: 'full' },
  tileFloor: { solid: 'full' },
  vinyl: { solid: 'full' },
  paper: { solid: 'none' },
  fabric: { solid: 'full' },
  shelf: { solid: 'full' },
  counter: { solid: 'full' },
  appliance: { solid: 'full' },
  sign: { solid: 'full' },
  blood: { solid: 'none' },
  debris: { solid: 'none' },
  plant: { solid: 'none' },
  asphalt: { solid: 'full' },
  olive: { solid: 'full' },
  paint: { solid: 'full' },
};

/** Does a part collide, and how? */
export function solidOf(p: { mat: MaterialId; solid?: boolean }): 'full' | 'pane' | 'none' {
  if (p.solid === false) return 'none';
  const s = MATERIALS[p.mat].solid;
  return p.solid === true && s === 'none' ? 'full' : s;
}

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
