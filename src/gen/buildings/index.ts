// Enterable buildings (07d) — entry point.
//
//   buildingDef(id) / BUILDING_DEFS            the catalog (catalog/*.ts)
//   envelopeOf(def)                            eaves and top of a type, without generating it
//   makePlacement(...)                         what a map keeps for one building
//   blueprintOf(place)                         the blueprint, generated on first use and cached
//   detailOf(place)                            the blueprint in world coordinates: collision boxes
//                                              (with a 2 m lookup grid), rooms, nav links, ladders, search points
//
// Pure and deterministic: the same placement always gives the same building. The caches are only
// memory (LRU, TACTICAL.interior); nothing here is saved.

import { seedRng } from '../../core/rng.ts';
import { ARCH } from '../../data/architecture.ts';
import { TACTICAL } from '../../data/tactical.ts';
import type { Ladder, Solid } from '../types.ts';
import { buildingDef } from './catalog/index.ts';
import { localColliders } from './colliders.ts';
import { dirToWorld, rectToWorld, toWorld, worldSize } from './place.ts';
import type { BridgeSpan, BuildingBlueprint, BuildingDef, BuildingPlacement, NavLink, Room, Rot, SearchPoint } from './types.ts';

export * from './types.ts';
export { BUILDING_DEFS, CATALOG, buildingDef, hasBuildingDef } from './catalog/index.ts';
export { toLocal, toWorld, rectToWorld, dirToWorld, rotFacing, worldSize } from './place.ts';
export { triangleCount, SHAPE_TRIS, localColliders } from './colliders.ts';

/** Eaves (top of the walls) and top of a type above its ground level. */
export function envelopeOf(def: BuildingDef): { eaves: number; top: number } {
  const eaves = def.plinth + def.storeys * def.storeyHeight;
  return { eaves, top: eaves + def.roofRise };
}

/** Footprint (local w × d) a type takes in a lot of `lw × ld` metres (local), or null when it does not fit. */
export function fitSize(def: BuildingDef, lw: number, ld: number): [number, number] | null {
  if (lw < def.size.w[0] - 1e-6 || ld < def.size.d[0] - 1e-6) return null;
  return [Math.min(lw, def.size.w[1]), Math.min(ld, def.size.d[1])];
}

/** A placement with its front facing `rot`, its world footprint starting at (x0, z0). */
export function makePlacement(defId: string, seed: number, rot: Rot, w: number, d: number, x0: number, z0: number, base: number, building = -1): BuildingPlacement {
  const def = buildingDef(defId);
  const env = envelopeOf(def);
  const [ww, wd] = worldSize(rot, w, d);
  // Sizes in centimetres: placements are compared and cached by value.
  const r = (v: number): number => Math.round(v * 100) / 100;
  return { def: defId, seed: seed >>> 0, rot, w: r(w), d: r(d), x0, z0, x1: x0 + r(ww), z1: z0 + r(wd), base, height: env.top, eaves: env.eaves, roof: def.roof, building };
}

export function placementKey(p: BuildingPlacement): string {
  return `${p.def}:${p.seed}:${p.rot}:${p.w}:${p.d}:${p.x0}:${p.z0}:${p.base}${p.open ? ':open' : ''}${p.span ? `:${spanKey(p.span)}` : ''}${p.steps ? `:s${p.steps.map((q) => `${q.link}@${q.pts[0]![0].toFixed(2)},${q.pts[0]![2].toFixed(2)}`).join(';')}` : ''}`;
}

function lru<V>(max: () => number): { get(key: string, make: () => V): V; clear(): void; readonly size: number } {
  const m = new Map<string, V>();
  return {
    get(key, make) {
      let v = m.get(key);
      if (v !== undefined) {
        m.delete(key);
        m.set(key, v);
        return v;
      }
      v = make();
      m.set(key, v);
      while (m.size > max()) m.delete(m.keys().next().value!);
      return v;
    },
    clear() {
      m.clear();
    },
    get size() {
      return m.size;
    },
  };
}

/** L9: a bridge's span as part of a cache key. */
const spanKey = (s: BridgeSpan): string => `${s.path.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(';')}|${s.ends.join(',')}|${s.water}|${s.from}|${s.to}|${(s.land ?? []).map((q) => q.join('-')).join(',')}${s.deck ? `|${s.deck.width}/${(s.deck.rails ?? []).join(',')}` : ''}`;

/** Generate a blueprint (uncached): what the tests and the preview tool call. L9: `span` lays a bridge along its line. */
export function generateBlueprint(def: BuildingDef, w: number, d: number, seed: number, span?: BridgeSpan): BuildingBlueprint {
  return def.generate(seedRng(seed ^ 0x5bd1e995), span ? { w, d, seed, span } : { w, d, seed });
}

const blueprints = lru<BuildingBlueprint>(() => TACTICAL.interior.blueprints);
export function blueprintOf(p: BuildingPlacement): BuildingBlueprint {
  return blueprints.get(`${p.def}:${p.seed}:${p.w}:${p.d}${p.span ? `:${spanKey(p.span)}` : ''}`, () => generateBlueprint(buildingDef(p.def), p.w, p.d, p.seed, p.span));
}

/** A collision box of a building in world coordinates. `pane`: stops movement only (glass). */
export interface DetailSolid extends Solid {
  pane: boolean;
}

export interface WorldRoom extends Room {
  /** World rectangle and floor height. */
  wx0: number;
  wz0: number;
  wx1: number;
  wz1: number;
  wy: number;
}

export interface BuildingDetail {
  place: BuildingPlacement;
  bp: BuildingBlueprint;
  solids: DetailSolid[];
  /** Lookup grid over the footprint (+1 m): cell size, origin, size, solid indices per cell. */
  cell: number;
  gx0: number;
  gz0: number;
  gnx: number;
  gnz: number;
  cells: number[][];
  ladders: Ladder[];
  rooms: WorldRoom[];
  /** Nav links with world waypoints (feet). */
  links: (NavLink & { wpts: [number, number, number][] })[];
  search: (SearchPoint & { wpos: [number, number, number] })[];
}

const details = lru<BuildingDetail>(() => TACTICAL.interior.details);

/**
 * 07d-2f: the blueprint as it stands once the area's key has been found: the leaves of the key doors
 * are gone, the ways through them are links, the rooms behind them are no longer locked.
 */
export function openBlueprint(bp: BuildingBlueprint, open: boolean): BuildingBlueprint {
  if (!open || !bp.keyLinks) return bp;
  return {
    ...bp,
    parts: bp.parts.filter((q) => !q.key),
    openings: bp.openings.map((o) => (o.key ? { ...o, state: 'open' as const } : o)),
    rooms: bp.rooms.map((r) => (r.key ? { ...r, locked: false } : r)),
    links: [...bp.links, ...bp.keyLinks],
  };
}

function buildDetail(p: BuildingPlacement): BuildingDetail {
  const bp = openBlueprint(blueprintOf(p), p.open === true);
  const y = p.base;
  const ref = p.building;
  const solids: DetailSolid[] = localColliders(bp).map((c) => {
    const r = rectToWorld(p, c.x0, c.z0, c.x1, c.z1);
    return { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: y + c.y0, y1: y + c.y1, kind: c.kind, ref, pane: c.pane };
  });
  const cell = 2;
  const gx0 = p.x0 - 1;
  const gz0 = p.z0 - 1;
  const gnx = Math.max(1, Math.ceil((p.x1 - p.x0 + 2) / cell));
  const gnz = Math.max(1, Math.ceil((p.z1 - p.z0 + 2) / cell));
  const cells: number[][] = Array.from({ length: gnx * gnz }, () => []);
  const ci = (v: number, o: number, n: number): number => Math.min(n - 1, Math.max(0, Math.floor((v - o) / cell)));
  solids.forEach((s, i) => {
    const cx1 = ci(s.x1, gx0, gnx);
    const cz1 = ci(s.z1, gz0, gnz);
    for (let cz = ci(s.z0, gz0, gnz); cz <= cz1; cz++) for (let cx = ci(s.x0, gx0, gnx); cx <= cx1; cx++) cells[cz * gnx + cx]!.push(i);
  });
  const ladders: Ladder[] = bp.ladders.map((l) => {
    const r = rectToWorld(p, l.x0, l.z0, l.x1, l.z1);
    const [nx, nz] = dirToWorld(p.rot, l.nx, l.nz);
    return { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: y + l.y0, y1: y + l.y1, nx, nz };
  });
  const rooms: WorldRoom[] = bp.rooms.map((rm) => {
    const r = rectToWorld(p, rm.x0, rm.z0, rm.x1, rm.z1);
    return { ...rm, wx0: r[0], wz0: r[1], wx1: r[2], wz1: r[3], wy: y + rm.y };
  });
  const pt = (q: readonly [number, number, number]): [number, number, number] => {
    const [wx, wz] = toWorld(p, q[0], q[2]);
    return [wx, y + q[1], wz];
  };
  return {
    place: p, bp, solids, cell, gx0, gz0, gnx, gnz, cells, ladders, rooms,
    links: bp.links.map((l, li) => {
      const wpts = l.pts.map(pt);
      // 09b: the way in starts at the foot of the door steps.
      const st = p.steps?.find((q) => q.link === li);
      if (st) {
        const extra = st.pts.map((q): [number, number, number] => [q[0], q[1], q[2]]);
        if (l.a === -1) wpts.unshift(...extra);
        else wpts.push(...extra.reverse());
      }
      return { ...l, wpts };
    }),
    search: bp.search.map((s) => ({ ...s, wpos: pt(s.pos) })),
  };
}

export function detailOf(p: BuildingPlacement): BuildingDetail {
  return details.get(placementKey(p), () => buildDetail(p));
}

/** Room of a building at a world point (feet at y), or -1. Prefers the smallest room; tolerant by `pad` in plan. */
export function roomAtWorld(det: BuildingDetail, x: number, y: number, z: number, pad = 0.05): number {
  let best = -1;
  let area = Infinity;
  for (const r of det.rooms) {
    if (Math.abs(y - r.wy) > 1.2 || x < r.wx0 - pad || x > r.wx1 + pad || z < r.wz0 - pad || z > r.wz1 + pad) continue;
    const a = (r.wx1 - r.wx0) * (r.wz1 - r.wz0);
    if (a < area) {
      area = a;
      best = r.id;
    }
  }
  return best;
}

/** Forget the cached blueprints and details (tests). */
export function clearBuildingCaches(): void {
  blueprints.clear();
  details.clear();
}

export const BUILDING_FOUNDATION = ARCH.foundation;
