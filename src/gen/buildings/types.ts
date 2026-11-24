// Enterable buildings (07d): the contract every building type is written against.
//
//   BuildingDef        one type ("木造 2 階建ての家"): its size range, storeys and generate()
//   BuildingBlueprint  what generate() returns — plain data, no Three.js: parts (simple shapes with a
//                      material), openings (doors / windows), storeys, rooms, stairs, search points and
//                      the room graph zombies walk. Drawing AND collision are both made from the parts,
//                      so what you see is what you bump into.
//   BuildingPlacement  what an operation-area map keeps: which type, where, which way it faces, its
//                      seed. The blueprint is only generated when something comes close (gen/buildings/index.ts).
//
// Local frame of a blueprint: x in [0, w] (width), z in [0, d] (depth), y up from the ground level
// (y = 0 is the highest ground under the footprint). The FRONT (main entrance) is the z = d side.
// Placements turn the local frame in 90° steps (gen/buildings/place.ts), so every box stays axis-aligned.

import type { RngState } from '../../core/rng.ts';
import type { BuildingKind } from '../types.ts';

export type BuildingCategory = 'house' | 'apartment' | 'shop' | 'office' | 'public' | 'transport' | 'military' | 'base' | 'landmark';

/** Surface materials (render colours: data/render.ts RENDER.materials; behaviour: materials.ts). */
export type MaterialId =
  | 'concrete' | 'plaster' | 'mortar' | 'siding' | 'brick' | 'wood' | 'woodDark' | 'tile' | 'slate' | 'metalRoof'
  | 'steel' | 'rust' | 'glass' | 'shutter' | 'door' | 'doorSteel' | 'frame'
  | 'flooring' | 'tatami' | 'carpet' | 'tileFloor' | 'vinyl' | 'paper' | 'fabric'
  | 'shelf' | 'counter' | 'appliance' | 'sign' | 'blood' | 'debris' | 'plant' | 'asphalt'
  | 'olive'
  | 'paint';

export type PartShape = 'box' | 'gable' | 'hip' | 'wedge' | 'cyl';
/** Which half of the building a part belongs to: `shell` is the outside (mid range), `interior` only appears close by. */
export type PartLayer = 'shell' | 'interior';

/**
 * One simple shape. The shape fills the box [x0, x1] × [y0, y1] × [z0, z1]:
 *   box    the box itself
 *   gable  pitched roof, ridge along `axis` at y1, eaves at y0 on the two long sides
 *   hip    hipped roof, ridge along `axis` (shortened by the hips), eaves at y0 all round
 *   wedge  a ramp that rises from y0 to y1 towards `slope` (shed roofs, ramps; not for stairs — use steps)
 *   cyl    L1: a 12-sided prism standing in the box (round in plan; an ellipse when the box is not
 *          square), its top scaled by `taper` (1 straight, 0 a cone): towers, columns, tanks, finials
 */
export interface Part {
  shape: PartShape;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  mat: MaterialId;
  layer: PartLayer;
  /** Storey the part belongs to (-1: the whole building, e.g. the roof). */
  level: number;
  /** gable / hip: ridge direction. */
  axis?: 'x' | 'z';
  /** wedge: the side it rises towards. */
  slope?: 'x+' | 'x-' | 'z+' | 'z-';
  /** L1: cyl: the top's size relative to the bottom (default 1). */
  taper?: number;
  /** 0..1: picks the colour from the material's palette. */
  tint?: number;
  /** false: drawn only (decoration). Default: the material decides (materials.ts). */
  solid?: boolean;
  /** What a bullet strikes (impact effect): stairs and furniture; walls and floors otherwise. */
  role?: 'stair' | 'furniture';
  /** true: collision only, not drawn (the barrier left in a broken window). */
  hidden?: boolean;
  /** 07d-2f: the leaf of a door that opens with the area's key (gone once the placement is `open`). */
  key?: boolean;
  /**
   * L1: turn about the vertical axis through the part's centre (radians, counter-clockwise seen from
   * above, as three.js turns about +y): the local x axis goes to (cos, -sin) in (x, z). The box
   * [x0, x1] × [z0, z1] is the part's size before the turn. Diagonal walls, star points, round towers
   * (a ring of turned boxes). A turned solid part collides as a row of small axis-aligned boxes along
   * its long side (colliders.ts).
   */
  yaw?: number;
}

/**
 * Door / window states:
 *   door   open (people and zombies pass) · locked (a closed door, nobody passes) · shutter (a rolled-down shutter)
 *   window glazed · broken — either way bullets and sight pass and people do not
 */
export type OpeningState = 'open' | 'locked' | 'shutter' | 'glazed' | 'broken';

export interface Opening {
  kind: 'door' | 'window';
  state: OpeningState;
  level: number;
  /** Centre of the opening on the wall's centre line (local), its sill and head heights. */
  x: number;
  z: number;
  y0: number;
  y1: number;
  /** Clear width (m) and the axis the wall runs along. */
  width: number;
  axis: 'x' | 'z';
  /** True for the outer walls. */
  exterior: boolean;
  /** 07d-2f: a locked door that opens once the area's key is found (the HQ safe). */
  key?: boolean;
}

/** Room purposes: they pick what can be found there (data/colony.ts ROOM_LOOT) and what people do there (base). */
export type RoomUse =
  | 'hall' | 'stairs' | 'living' | 'kitchen' | 'bedroom' | 'tatami' | 'closet' | 'bath' | 'toilet' | 'genkan'
  | 'sales' | 'backroom' | 'storage' | 'office' | 'clinic' | 'bar' | 'classroom' | 'lab' | 'workshop' | 'canteen'
  | 'barracks' | 'command' | 'garage' | 'machine' | 'roof' | 'lobby' | 'platform' | 'armory'
  | 'ward'
  | 'train'
  | 'baggage'
  | 'tower';

/** A rectangular room on one storey. Spaces that are not rectangles are several rooms joined by `join` links. */
export interface Room {
  id: number;
  level: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Floor height (local y). */
  y: number;
  use: RoomUse;
  /** Not reachable on purpose (behind a locked door / shutter): the reachability test skips it. */
  locked?: boolean;
  /** 07d-2f: locked only until the area's key is found (an armory, an ammunition depot). */
  key?: boolean;
}

/** Furniture kinds a search point can be. */
export type FurnitureKind = 'shelf' | 'desk' | 'locker' | 'cabinet' | 'fridge' | 'counter' | 'closet' | 'crate' | 'bed' | 'table';

/** Loot table ids (data/colony.ts ROOM_LOOT). Default: the room's use. */
export type LootTableId = RoomUse | 'pharmacy' | 'grocery' | 'tools' | 'weapons'
  | 'fuel'
  | 'stock'
  | 'field'
  | 'safe';

export interface SearchPoint {
  /** Where the searcher stands (local; y = floor). */
  pos: [number, number, number];
  room: number;
  kind: FurnitureKind;
  table: LootTableId;
  /** 07d-2f: searching it finds the area's key (opens every `key` door of the area). */
  key?: boolean;
}

/**
 * Edge of the room graph: from room `a` to room `b` (-1 = outside the building). `pts` are the
 * waypoints from a's side to b's side (local, feet height): two for a door or a join, the foot of
 * the flight, landings and the top for stairs. Walk them in order (reverse for b -> a).
 */
export interface NavLink {
  a: number;
  b: number;
  kind: 'door' | 'join' | 'stairs' | 'ladder';
  /** Narrowest clear width along the way (m): who fits. */
  width: number;
  pts: [number, number, number][];
  /** Index into openings for doors. */
  opening?: number;
}

export interface Storey {
  /** Floor level (local y) and the height to the next floor (or to the eaves). */
  y: number;
  height: number;
}

/** Vertical ways and why they can or cannot be used. */
export interface StairInfo {
  kind: 'stairs' | 'ladder' | 'shaft';
  from: number;
  to: number;
  /** Plan rectangle (local). */
  rect: [number, number, number, number];
  /** False for lift shafts and the like (a hole, nothing to climb). */
  usable: boolean;
}

export interface BuildingBlueprint {
  def: string;
  w: number;
  d: number;
  /** Top of everything (local y). */
  height: number;
  /** Floors in order; with roof access the last entry is the roof (its height 0). */
  storeys: Storey[];
  roofAccess: boolean;
  parts: Part[];
  openings: Opening[];
  rooms: Room[];
  stairs: StairInfo[];
  search: SearchPoint[];
  links: NavLink[];
  /** Climb zones (local), like TacticalMap.ladders: inside one the player moves between y0 and y1. */
  ladders: { x0: number; z0: number; x1: number; z1: number; y0: number; y1: number; nx: number; nz: number }[];
  /** 07d-2f: the ways through the `key` doors, added to `links` once the placement is `open`. */
  keyLinks?: NavLink[];
  /** L1: firing positions on the outside of an exterior-only landmark (local, feet): its deck or roof, reached by an outside ladder. */
  vantages?: [number, number, number][];
  /**
   * L1: what a landmark does to the ground of its lot (local polygons, inside the footprint): a moat
   * or a canal (`water`: the ground dug `depth` m under the lot's ground, the surface `drop` m under
   * it), a lawn, a paved square. gen/real/landmarks.ts applies them when the landmark is placed.
   */
  ground?: GroundFeature[];
}

/** L1: a polygon of a landmark's ground (BuildingBlueprint.ground). */
export interface GroundFeature {
  kind: 'water' | 'grass' | 'paved' | 'gravel';
  /** Local (x, z) points, either winding. */
  poly: [number, number][];
  /** water: depth of the bed and of the surface under the lot's ground (m). */
  depth?: number;
  drop?: number;
}

export type RoofKind = 'flat' | 'gable' | 'hip' | 'shed';

export interface GenerateParams {
  /** Footprint chosen within the def's size range (m). */
  w: number;
  d: number;
  /** Placement seed (the rng passed to generate() is seeded from it). */
  seed: number;
}

export interface BuildingDef {
  /** `<category>.<variant>`, unique. */
  id: string;
  category: BuildingCategory;
  variant: string;
  /** How the building reads from afar and counts in map statistics (03's kinds). */
  kind: BuildingKind;
  /** Footprint range (m) along local x (width, the front) and z (depth). */
  size: { w: readonly [number, number]; d: readonly [number, number] };
  storeys: number;
  /** Floor-to-floor height and the ground-floor level above the ground (m). */
  storeyHeight: number;
  plinth: number;
  roof: RoofKind;
  /** Height above the eaves of what stands on top (pitched roof, stair house on a flat roof, parapet) (m). */
  roofRise: number;
  /** Can be searched at all (false: the search points stay, but the map does not offer it as a search building). */
  lootable?: boolean;
  /** Override of ARCH.limits[category]. */
  limits?: { shell: number; interior: number };
  /**
   * L1: a landmark seen only from outside (nobody goes in: the doors stay shut). Every part is `shell`,
   * there are no rooms or search points; it is drawn as its outside out to the fog (never the far box)
   * and the catalog test checks the outside only (docs/realmap_guide.md §7).
   */
  exteriorOnly?: boolean;
  /**
   * L6: a place of remembrance (the landmark table's `memorial`, src/data/landmarks/types.ts): no props
   * of the fall, no ladder, no firing position; no zombies placed and nothing to search round it.
   */
  memorial?: boolean;
  generate(rng: RngState, params: GenerateParams): BuildingBlueprint;
}

/** 90° turns: the side the front faces. 0 south (+z), 1 east (+x), 2 north (-z), 3 west (-x). */
export type Rot = 0 | 1 | 2 | 3;

/**
 * An enterable building on a map: only this is kept until something comes close. World
 * footprint [x0, x1] × [z0, z1] (rot 1 / 3 swap the local w and d), ground level `base`.
 */
export interface BuildingPlacement {
  def: string;
  seed: number;
  rot: Rot;
  /** Local width and depth. */
  w: number;
  d: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  base: number;
  /** Top of the building above `base` (envelope). */
  height: number;
  /** Eaves above `base` (the far box) and the roof form drawn above it. */
  eaves: number;
  roof: RoofKind;
  /** TacticalMap.buildings id, or -1 (structures of the home base). */
  building: number;
  /** Home-base structure id when it is one (06). */
  structure?: number;
  /** 07d-2f: the area's key has been found: the building's `key` doors are open. */
  open?: boolean;
}
