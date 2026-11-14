// TacticalMap: the generated operation area of one cell. NOT part of GameState — it is rebuilt
// from (mapSeed, land, isHome, lootSpots) whenever needed and shared by sim and render.
//
// Coordinates: x east, z south, y up, metres. The playable square is [0, size] x [0, size];
// north is -z. Height sample (ix, iz) sits at (ix * tile, iz * tile); nav tile (tx, ty) covers
// [tx * tile, (tx + 1) * tile) x [ty * tile, (ty + 1) * tile).

import type { Land } from '../core/types.ts';

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
}

export type SolidKind = 'building' | 'stair' | 'rock' | 'prop';

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

export interface LootSpot {
  id: number;
  /** Where the player stands to search (in front of the door). */
  pos: [number, number];
  building: number;
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
}

export interface GenParams {
  mapSeed: number;
  land: Land;
  isHome: boolean;
  /** Number of searchable buildings wanted (sim/world/derive.ts cellTactical().lootSpots). */
  lootSpots: number;
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
  solids: Solid[];
  ladders: Ladder[];
  roads: Road[];
  areas: Area[];
  trees: Trees;
  grass: Grass;
  rocks: Rock[];
  lootSpots: LootSpot[];
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
