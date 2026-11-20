// TacticalMap: the generated operation area of one cell. NOT part of GameState — it is rebuilt
// from (mapSeed, land, isHome, lootSpots) whenever needed and shared by sim and render.
//
// Coordinates: x east, z south, y up, metres. The playable square is [0, size] x [0, size];
// north is -z. Height sample (ix, iz) sits at (ix * tile, iz * tile); nav tile (tx, ty) covers
// [tx * tile, (tx + 1) * tile) x [ty * tile, (ty + 1) * tile).

import type { Land } from '../core/types.ts';
import type { BuildingPlacement } from './buildings/types.ts';

export type BuildingKind = 'house' | 'barn' | 'shed' | 'shop' | 'apartment' | 'office' | 'warehouse' | 'tower';

export interface Building {
  id: number;
  kind: BuildingKind;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Ground floor level and wall height (the roof top is base + height). */
  base: number;
  height: number;
  roof: 'flat' | 'gable';
  /** 0..1, picks the wall colour variation. */
  tint: number;
  lootable: boolean;
  /** How the roof can be reached. */
  access: 'none' | 'stairs' | 'ladder';
  /** 07d: index into TacticalMap.placements when this is an enterable building (drawn and collided from its blueprint). */
  enter?: number;
}

/** 'scenery' (07b): wrecked cars and fallen logs — drawn from TacticalMap.props, not as steel boxes. */
export type SolidKind = 'building' | 'stair' | 'rock' | 'prop' | 'scenery';

/** Axis-aligned collision box. Blocks movement and bullets; its top can be stood on. */
export interface Solid {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y0: number;
  y1: number;
  kind: SolidKind;
  /** Building id for 'building', otherwise -1. */
  ref: number;
  /**
   * 07d: this box is the envelope of an enterable building (TacticalMap.placements[enter]). The
   * collision functions look inside it at the building's own boxes (gen/buildings detailOf).
   */
  enter?: number;
}

/** Climbable zone next to a wall: inside it the player moves vertically between y0 and y1. */
export interface Ladder {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y0: number;
  y1: number;
  /** Unit direction from the ladder towards the wall it is fixed to. */
  nx: number;
  nz: number;
}

export type RoadKind = 'avenue' | 'street' | 'lane' | 'track';
export interface Road {
  kind: RoadKind;
  width: number;
  pts: [number, number][];
}

export type AreaKind = 'field' | 'paddy' | 'park' | 'parking' | 'plaza' | 'yard';
/** Flat-coloured ground patch (render + flora rules). `variant` is 0..1. */
export interface Area {
  kind: AreaKind;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  variant: number;
}

export interface Trees {
  n: number;
  x: Float32Array;
  z: Float32Array;
  /** Ground height at the trunk. */
  y: Float32Array;
  /** Total height and canopy radius. */
  h: Float32Array;
  r: Float32Array;
  /** 0 conifer, 1 broadleaf. */
  kind: Uint8Array;
}

/** Tall grass / shrubs (visual concealment only, no collision). */
export interface Grass {
  n: number;
  x: Float32Array;
  z: Float32Array;
  y: Float32Array;
  /** Size (height in m). */
  s: Float32Array;
}

export interface Rock {
  x: number;
  z: number;
  y: number;
  /** Half extent and height above the ground. */
  r: number;
  h: number;
}

export type BrushKind = 'hedge' | 'bush' | 'reeds' | 'bamboo';
/**
 * Vegetation thick enough to hide what is behind it (07b): a capsule on the ground — the segment
 * (ax, az) -> (bx, bz) widened by r — that stands h above the terrain. A round patch has a == b.
 * No collision and bullets pass; lines of sight do not (sim/tactical/collision.ts sightBlocked).
 */
export interface Brush {
  kind: BrushKind;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  r: number;
  h: number;
}

export type PropKind = 'car' | 'truck' | 'log' | 'greenhouse';
/** Scenery drawn as boxes (07b). Cars, trucks and logs also have a Solid; greenhouse frames do not. */
export interface Prop {
  kind: PropKind;
  /** Centre, ground height there, and the box: length `w` along x (or along z when `alongX` is false), depth `d`, height `h`. */
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  h: number;
  alongX: boolean;
  /** 0..1, picks the colour. */
  tint: number;
}

export interface LootSpot {
  id: number;
  /** Where the player stands to search (in front of the door; 07d: at the shelf inside an enterable building). */
  pos: [number, number];
  building: number;
  /** 07d: floor height of a search point inside a building (absent: on the ground outside). */
  y?: number;
  /** 07d: loot table of the search point (data/colony.ts ROOM_LOOT); absent: the land's table. */
  table?: string;
}

export interface Vantage {
  /** Feet position of someone standing on it. */
  pos: [number, number, number];
  kind: 'hill' | 'roof' | 'tower';
}

/** Tile surface classes (TacticalMap.ground). */
export const GROUND = { grass: 0, road: 1, track: 2, field: 3, paved: 4, rock: 5, forest: 6, park: 7 } as const;

export interface StaticHash {
  cell: number;
  n: number;
  /** Indices into TacticalMap.solids per hash cell. */
  solids: number[][];
  /** Indices into TacticalMap.trees per hash cell (by trunk position). */
  trees: number[][];
  /** Indices into TacticalMap.brush per hash cell (every cell the capsule touches). */
  brush: number[][];
}

/**
 * Where a cell sits in the world and what surrounds it (07c), so that its terrain and roads
 * continue into the neighbouring cells' maps (gen/world.ts). Part of the generation parameters:
 * the same context always gives the same map.
 */
export interface WorldContext {
  /** Game seed: the shared noise of the whole world. */
  seed: number;
  /** Grid position of the cell (x east, y south) and the grid width. */
  gx: number;
  gy: number;
  gridW: number;
  /** 3 × 3 neighbourhood, row by row from the north-west; index 4 is this cell. null: sea or off the grid. */
  around: ({ land: Land; mapSeed: number } | null)[];
}

export interface GenParams {
  mapSeed: number;
  land: Land;
  isHome: boolean;
  /** Number of searchable buildings wanted (sim/world/derive.ts cellTactical().lootSpots). */
  lootSpots: number;
  /** 07c: absent for stand-alone maps (tests, the firing range) — then nothing continues past the edge. */
  world?: WorldContext;
}

export interface TacticalMap {
  params: GenParams;
  size: number;
  tile: number;
  /** Height samples per side (size / tile + 1 = 257) and nav tiles per side (256). */
  n: number;
  tiles: number;
  height: Float32Array;
  /** GROUND class per nav tile. */
  ground: Uint8Array;
  /** 1 = walkable nav tile (no building, not too steep), 0 = blocked. */
  walk: Uint8Array;
  buildings: Building[];
  /**
   * 07d: enterable buildings — only where, which type and which way (gen/buildings). Their
   * blueprints are generated when something comes close. The home map appends the base's
   * buildings after the generated ones (sim/build/structures.ts syncMap).
   */
  placements: BuildingPlacement[];
  solids: Solid[];
  ladders: Ladder[];
  roads: Road[];
  areas: Area[];
  trees: Trees;
  grass: Grass;
  rocks: Rock[];
  /** Sight-blocking vegetation and box scenery (07b). */
  brush: Brush[];
  props: Prop[];
  lootSpots: LootSpot[];
  /** 07c: ammunition caches (gen/caches.ts): where each stands and how many rounds it starts with. */
  caches: { pos: [number, number]; ammo: number }[];
  vantages: Vantage[];
  spawn: {
    /** Centre of the map (home base). */
    home: [number, number];
    /** On a road at the edge of the map, facing inwards. */
    edge: [number, number];
    edgeYaw: number;
  };
  hash: StaticHash;
  /** Coarse heights around the playable square (render only): (apronN x apronN) samples, origin at -apronRings * apronCell. */
  apron: Float32Array;
  apronN: number;
}

/** Trunk radius of a tree of total height h (collision and render agree on this). */
export function trunkRadius(h: number): number {
  return 0.14 + h * 0.018;
}
/** Share of a tree's height that is bare trunk (bullets and sight pass through the canopy above it). */
export const TRUNK_SHARE = 0.55;
