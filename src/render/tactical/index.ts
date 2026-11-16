// Draws the operation area: terrain, buildings, vegetation. The map comes from
// sim/tactical/area.ts (mapOf); meshes are rebuilt whenever a different map becomes current
// (new game, load, arrival in another cell) and hidden while there is none (on the road).
//
// Draw calls: terrain 1 + apron 1 + boxes 1 + roofs 1 + rocks 1 + grass 1 + trees (2 kinds x
// visible chunks, at most 32) + brush 4 (07b: boxes, blobs, reeds, bamboo) — well inside the budget
// of 100 for this layer.

import type { GameState } from '../../core/types.ts';
import { RENDER } from '../../data/render.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import type { RenderContext, SubRenderer } from '../index.ts';
import { buildBrush } from './brush.ts';
import { buildBuildings } from './buildings.ts';
import { buildTerrain, type Built } from './terrain.ts';
import { buildVegetation, type Vegetation } from './vegetation.ts';

let lastBuildMs = 0;
/** How long the last rebuild of the world meshes took (ms) — perf checks. */
export const worldBuildMs = (): number => lastBuildMs;

export function createTacticalRenderer(): SubRenderer {
  let ctx: RenderContext;
  let current: TacticalMap | null = null;
  let parts: Built[] = [];
  let vegetation: Vegetation | null = null;

  const clear = (): void => {
    for (const p of parts) {
      p.object.removeFromParent();
      p.dispose();
    }
    parts = [];
    vegetation = null;
    current = null;
  };

  return {
    id: 'tactical-world',
    init(c) {
      ctx = c;
    },
    update(state: GameState) {
      const map = mapOf(state);
      if (map !== current) {
        clear();
        if (map) {
          const t0 = performance.now();
          vegetation = buildVegetation(map);
          parts = [buildTerrain(map, ctx.renderer), buildBuildings(map), vegetation, buildBrush(map)];
          for (const p of parts) ctx.scene.add(p.object);
          current = map;
          lastBuildMs = performance.now() - t0;
        }
      }
      vegetation?.update(ctx.camera.position, RENDER.fog.far);
    },
    dispose: clear,
  };
}
