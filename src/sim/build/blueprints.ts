// Blueprints: where something may be built, placing, cancelling, demolishing, priorities, and
// the structures a new base starts with.

import type { GameEvent } from '../../core/events.ts';
import type { GameState, ResourceId, Structure } from '../../core/types.ts';
import { BUILD, BUILDINGS, footprint, type BuildingDef } from '../../data/buildings.ts';
import { TACTICAL } from '../../data/tactical.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { ctxNow, moveStock } from '../colony/stock.ts';
import { getMod } from '../research/modifiers.ts';
import { defOf, hqOf, isBuilt, isRuin, isUnlocked, maxHp, overlayOf, refreshCapacity, TILE, TILES } from './structures.ts';

type Emit = (e: GameEvent) => void;

/** Buildable radius around the headquarters (m). */
export function buildRadius(state: GameState): number {
  return getMod(state, 'build.radius', BUILD.radius);
}

/** Centre of the base in metres: the headquarters, or the middle of the map before there is one. */
export function baseCentre(state: GameState): [number, number] {
  const hq = hqOf(state);
  if (!hq) return [TACTICAL.size / 2, TACTICAL.size / 2];
  const [w, d] = footprint(defOf(hq), hq.rot);
  return [(hq.tx + w / 2) * TILE, (hq.ty + d / 2) * TILE];
}

function heightSpan(map: TacticalMap, tx: number, ty: number, w: number, d: number): number {
  let lo = Infinity, hi = -Infinity;
  for (let y = ty; y <= ty + d; y++) {
    for (let x = tx; x <= tx + w; x++) {
      const h = map.height[y * map.n + x]!;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  return hi - lo;
}

function treeInside(map: TacticalMap, x0: number, z0: number, x1: number, z1: number): boolean {
  const hash = map.hash;
  const clamp = (v: number): number => Math.min(hash.n - 1, Math.max(0, Math.floor(v / hash.cell)));
  for (let cz = clamp(z0 - 1); cz <= clamp(z1 + 1); cz++) {
    for (let cx = clamp(x0 - 1); cx <= clamp(x1 + 1); cx++) {
      for (const ti of hash.trees[cz * hash.n + cx]!) {
        const x = map.trees.x[ti]!, z = map.trees.z[ti]!;
        if (x > x0 - 0.8 && x < x1 + 0.8 && z > z0 - 0.8 && z < z1 + 0.8) return true;
      }
    }
  }
  return false;
}

/**
 * Why `def` cannot go at (tx, ty), or null when it can. `map` is the home map when it is loaded;
 * without it only the levelled ground in the middle can be built on.
 */
export function placementError(state: GameState, map: TacticalMap | null, defId: string, tx: number, ty: number, rot: number): string | null {
  const def = BUILDINGS[defId];
  if (!def || def.fixed) return 'unknownBuilding';
  if (!isUnlocked(defId, state)) return 'locked';
  if (def.unique && state.build.structures.some((s) => s.def === defId && !isRuin(s))) return 'unique';
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return 'badPlace';
  const [w, d] = footprint(def, rot);
  if (tx < 2 || ty < 2 || tx + w > TILES - 2 || ty + d > TILES - 2) return 'outside';
  const [cx, cz] = baseCentre(state);
  const radius = buildRadius(state);
  const far = Math.max(...[[tx, ty], [tx + w, ty], [tx, ty + d], [tx + w, ty + d]].map(([x, y]) => Math.hypot(x! * TILE - cx, y! * TILE - cz)));
  if (far > radius) return 'tooFar';
  const ov = overlayOf(state, map ? map.walk : null);
  for (let y = ty; y < ty + d; y++) {
    for (let x = tx; x < tx + w; x++) {
      const t = y * TILES + x;
      const i = ov.occ[t]!;
      if (i > 0 && !isRuin(state.build.structures[i - 1]!)) return 'occupied';
      if (map && !map.walk[t]) return 'blocked';
    }
  }
  const mid = TACTICAL.size / 2;
  const insideFlat = Math.max(...[[tx, ty], [tx + w, ty], [tx, ty + d], [tx + w, ty + d]].map(([x, y]) => Math.hypot(x! * TILE - mid, y! * TILE - mid))) <= TACTICAL.homeFlatRadius;
  if (!insideFlat) {
    if (!map) return 'needMap';
    if (heightSpan(map, tx, ty, w, d) > BUILD.maxSlope) return 'steep';
    if (treeInside(map, tx * TILE, ty * TILE, (tx + w) * TILE, (ty + d) * TILE)) return 'blocked';
  }
  return null;
}

function makeStructure(state: GameState, def: BuildingDef, tx: number, ty: number, rot: number, built: boolean): Structure {
  return { id: state.nextId++, def: def.id, tx, ty, rot: (rot & 3) as 0 | 1 | 2 | 3, hp: built ? maxHp(state, def) : 0, progress: built ? 1 : 0, delivered: {}, level: 1, priority: 1 };
}

/** Clear rubble under a new footprint. */
function clearRubble(state: GameState, tx: number, ty: number, w: number, d: number): void {
  state.build.structures = state.build.structures.filter((s) => {
    if (!isRuin(s)) return true;
    const [sw, sd] = footprint(defOf(s), s.rot);
    return s.tx + sw <= tx || s.tx >= tx + w || s.ty + sd <= ty || s.ty >= ty + d;
  });
}

export function placeBlueprint(state: GameState, map: TacticalMap | null, emit: Emit, defId: string, tx: number, ty: number, rot: number): string | null {
  const error = placementError(state, map, defId, tx, ty, rot);
  if (error) return error;
  const def = BUILDINGS[defId]!;
  const [w, d] = footprint(def, rot);
  clearRubble(state, tx, ty, w, d);
  const st = makeStructure(state, def, tx, ty, rot, false);
  state.build.structures.push(st);
  state.build.gridRev++; // (the occupancy changed; costs did not, but one revision counter serves both)
  emit({ type: 'blueprintPlaced', id: st.id, def: st.def });
  return null;
}

/** Cancel a blueprint (everything delivered comes back) or pull down a finished structure (part of it does). */
export function cancelStructure(state: GameState, emit: Emit, id: number): string | null {
  const st = state.build.structures.find((s) => s.id === id);
  if (!st) return 'unknownStructure';
  const def = defOf(st);
  if (def.fixed) return 'fixed';
  const c = ctxNow(state, null, emit);
  if (st.progress < 1) {
    for (const res of Object.keys(st.delivered) as Exclude<ResourceId, 'ears'>[]) moveStock(c, res, st.delivered[res] ?? 0);
  } else if (!isRuin(st)) {
    const share = BUILD.demolishRefund * (def.hp > 0 ? Math.max(0, st.hp) / maxHp(state, def) : 1);
    for (const res of Object.keys(def.cost) as Exclude<ResourceId, 'ears'>[]) moveStock(c, res, Math.floor((def.cost[res] ?? 0) * share));
  }
  state.build.structures = state.build.structures.filter((s) => s !== st);
  state.build.gridRev++;
  refreshCapacity(state);
  emit({ type: 'structureRemoved', id: st.id, def: st.def });
  return null;
}

export function setPriority(state: GameState, id: number, priority: 0 | 1 | 2): string | null {
  const st = state.build.structures.find((s) => s.id === id);
  if (!st) return 'unknownStructure';
  st.priority = priority;
  return null;
}

/**
 * A base starts with its headquarters and one field (the field 05 only pretended to have). Also
 * repairs saves from before 06. Idempotent.
 */
export function foundBase(state: GameState): void {
  if (state.world.homeCell === null || state.flags.range) return;
  if (state.build.structures.some((s) => s.def === 'hq')) return;
  if (state.flags.defeat) return;
  const put = (id: string, at: readonly number[]): void => {
    const def = BUILDINGS[id]!;
    const [w, d] = footprint(def, 0);
    clearRubble(state, at[0]!, at[1]!, w, d);
    state.build.structures.push(makeStructure(state, def, at[0]!, at[1]!, 0, true));
  };
  put('hq', BUILD.start.hq);
  if (!state.build.structures.some((s) => s.def === 'farm')) put('farm', BUILD.start.farm);
  state.build.gridRev++;
  refreshCapacity(state);
}

/** Debug / tests: put a finished structure down without asking anyone. */
export function buildNow(state: GameState, defId: string, tx: number, ty: number, rot = 0): Structure {
  const def = BUILDINGS[defId];
  if (!def) throw new Error(`unknown building ${defId}`);
  const st = makeStructure(state, def, tx, ty, rot, true);
  state.build.structures.push(st);
  state.build.gridRev++;
  refreshCapacity(state);
  return st;
}

export { isBuilt };
