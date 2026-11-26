// Draws the operation area and, inside a world (07c), the neighbouring cells' areas around it, so
// that the land goes on past the edge and the player can walk into it. Every map's meshes are
// built once and moved when the current cell changes (walking across); maps that drop out of the
// 3 × 3 neighbourhood are disposed. Neighbours come from the background worker
// (neighbours.ts). A neighbour's meshes are built one part per frame (terrain, buildings, trees,
// brush), so that no single frame carries a whole map; the current map is built at once.
//
// Draw calls per map: terrain 1 (+ apron 1 for stand-alone maps) + boxes 1 + roofs 1 + rocks 1
// + grass 1 (current map only) + brush 4 + trees (2 kinds x visible chunks). Maps whose square is
// further than RENDER.terrainLod.neighbours from the camera are hidden, and their terrain chunks
// beyond the fog are left out.

import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import type { RenderContext, SubRenderer } from '../index.ts';
import { buildBrush, type BrushPart } from './brush.ts';
import { buildBuildings } from './buildings.ts';
import { buildEnterables, type EnterablePart } from './enterables.ts';
import { around, cellOffset, groundPixelsOf, neighbourMap } from './neighbours.ts';
import { buildTerrain, type Built, type TerrainPart } from './terrain.ts';
import { buildVegetation, type Vegetation } from './vegetation.ts';
import { buildWater } from './water.ts';
import * as THREE from 'three';

let lastBuildMs = 0;
/** How long the last rebuild of the current map's meshes took (ms) — perf checks. */
export const worldBuildMs = (): number => lastBuildMs;

interface Entry {
  map: TacticalMap;
  group: THREE.Group;
  parts: Built[];
  terrain: TerrainPart | null;
  vegetation: Vegetation | null;
  brush: BrushPart | null;
  buildings: ReturnType<typeof buildBuildings> | null;
  enterables: EnterablePart | null;
  /** Parts still to build, in order. */
  todo: ('terrain' | 'water' | 'buildings' | 'enterables' | 'vegetation' | 'brush')[];
}

let pendingWork = 0;
let stageCount = { far: 0, mid: 0, near: 0, pending: 0 };
/** 07d: enterable buildings at each drawing stage over every map drawn, and those waiting to go up. */
export const enterableStats = (): { far: number; mid: number; near: number; pending: number } => ({ ...stageCount });
/** Neighbour maps still being built or awaited (perf checks wait for 0: steady frames only). */
export const worldPending = (): number => pendingWork;

export function createTacticalRenderer(): SubRenderer {
  let ctx: RenderContext;
  const entries = new Map<TacticalMap, Entry>();
  const local = new THREE.Vector3();

  const start = (map: TacticalMap): Entry => {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const entry: Entry = { map, group, parts: [], terrain: null, buildings: null, vegetation: null, brush: null, enterables: null, todo: map.water ? ['terrain', 'water', 'buildings', 'enterables', 'vegetation', 'brush'] : ['terrain', 'buildings', 'enterables', 'vegetation', 'brush'] };
    entries.set(map, entry);
    return entry;
  };
  /** Build the next part of an entry. */
  const step = (e: Entry): void => {
    const what = e.todo.shift();
    let part: Built;
    if (what === 'terrain') part = e.terrain = buildTerrain(e.map, ctx.renderer, { apron: !e.map.params.world, pixels: groundPixelsOf(e.map) });
    else if (what === 'water') part = buildWater(e.map);
    else if (what === 'buildings') part = e.buildings = buildBuildings(e.map);
    else if (what === 'enterables') part = e.enterables = buildEnterables(e.map);
    else if (what === 'vegetation') part = e.vegetation = buildVegetation(e.map);
    else if (what === 'brush') part = e.brush = buildBrush(e.map);
    else return;
    e.parts.push(part);
    e.group.add(part.object);
  };
  const drop = (e: Entry): void => {
    e.group.removeFromParent();
    for (const p of e.parts) p.dispose();
    entries.delete(e.map);
  };
  const clear = (): void => {
    for (const e of [...entries.values()]) drop(e);
  };

  return {
    id: 'tactical-world',
    init(c) {
      ctx = c;
    },
    reset() {
      clear();
    },
    update(state: GameState) {
      const current = mapOf(state);
      if (!current) {
        clear();
        return;
      }
      const L = RENDER.terrainLod;
      const cam = ctx.camera.position;
      // Which maps belong around the player now, and where.
      const wanted = new Map<TacticalMap, [number, number]>([[current, [0, 0]]]);
      let missing = 0;
      if (current.params.world && !state.flags.range) {
        for (const cell of around(state)) {
          if (cell === null || cell === state.player.cell) continue;
          const off = cellOffset(state, cell, current.size);
          if (!off) continue;
          // Only what the fog lets through.
          const dx = Math.max(off[0] - cam.x, 0, cam.x - off[0] - current.size);
          const dz = Math.max(off[1] - cam.z, 0, cam.z - off[1] - current.size);
          // From the command layer's overhead camera the whole neighbourhood would be in view: there, only the edge nearby.
          if (Math.hypot(dx, dz) > (state.mode === 'command' ? L.neighboursFromAbove : L.neighbours)) continue;
          const map = neighbourMap(state, cell);
          if (map) wanted.set(map, off);
          else missing++; // asked of the worker
        }
      }
      for (const e of [...entries.values()]) if (!wanted.has(e.map)) drop(e);
      let budget = 1; // neighbour parts built this frame
      let stages: number = RENDER.enterables.perFrame; // 07d: enterable buildings going up a stage this frame
      const tris = { tris: RENDER.enterables.triBudget }; // 07d-3: their outsides and insides, all maps together
      pendingWork = missing;
      const sc = { far: 0, mid: 0, near: 0, pending: 0 };
      for (const [map, off] of wanted) {
        let e = entries.get(map);
        if (!e) {
          e = start(map);
          if (map === current) {
            // What the player stands on: all of it at once.
            const t0 = performance.now();
            while (e.todo.length > 0) step(e);
            lastBuildMs = performance.now() - t0;
          }
        }
        if (e.todo.length > 0 && budget > 0) {
          step(e);
          budget--;
        }
        pendingWork += e.todo.length;
        e.group.position.set(off[0], 0, off[1]);
        local.set(cam.x - off[0], cam.y, cam.z - off[1]);
        e.terrain?.update(local.x, local.z);
        // Tall grass only near the camera (on a neighbour: when standing close to its edge).
        const away = Math.hypot(Math.max(-local.x, 0, local.x - map.size), Math.max(-local.z, 0, local.z - map.size));
        e.vegetation?.update(local, RENDER.fog.far, away < RENDER.flora.grassRange);
        e.brush?.update(local.x, local.z);
        e.buildings?.update(local.x, local.z);
        if (e.enterables) {
          stages = e.enterables.update(local.x, local.y, local.z, stages, tris);
          pendingWork += e.enterables.pending();
          const [f, m, n] = e.enterables.stages();
          sc.far += f;
          sc.mid += m;
          sc.near += n;
          sc.pending += e.enterables.pending();
        }
      }
      stageCount = sc;
    },
    dispose: clear,
  };
}
