// Building & defense (owner: 06).
//
//   step()    keep the home map's collision boxes in line with the structures, run the raid that
//             is under way (waves), defenders and bites. Zombies meet structures inside
//             sim/tactical/zombies.ts (flow field, wall damage, moats, wire).
//   minute()  raid scheduling (horde warning / arrival, the nightly approach, morning ears),
//             rubble that has lain long enough, hourly self-repair, daily moat upkeep.
// Construction itself is driven by the colony's clock: sim/colony/index.ts hands the builders'
// output to construct() once per game hour.
//
// Files: structures.ts (overlay, collision, damage, building effects), blueprints.ts (placement
// rules, cancel / demolish, the starting base), construction.ts, flowfield.ts, raids.ts
// (scheduling, waves, the battle in numbers when the player is away), defense.ts (defenders).
import { toAbsMinutes } from '../../core/time.ts';
import type { GameState } from '../../core/types.ts';
import { BUILD } from '../../data/buildings.ts';
import { ctxNow, moveStock } from '../colony/stock.ts';
import type { SimContext, System } from '../system.ts';
import { areaOf } from '../tactical/area.ts';
import { cancelStructure, foundBase, placeBlueprint, setPriority } from './blueprints.ts';
import { updateDefenders } from './defense.ts';
import { playerPresent, raidAbandoned, raidMinute, raidStep } from './raids.ts';
import { heightAt } from '../tactical/collision.ts';
import { outpostAt, outpostPrefab } from '../world/outposts.ts';
import { defOf, hasTech, isBuilt, maxHp, syncMap, syncSolids } from './structures.ts';

function homeMap(state: GameState) {
  const area = areaOf(state);
  return area && area.map.params.isHome && !state.flags.range ? area : null;
}

/** In an outpost cell the compound's fence, tents and crates collide too. */
function syncOutpost(state: GameState): void {
  const area = areaOf(state);
  if (!area || state.flags.range) return;
  const o = outpostAt(state, state.tactical!.cell);
  if (!o) return syncSolids(area.map, null, 0, () => {});
  syncSolids(area.map, o, o.tier, (solids) => {
    const prefab = outpostPrefab(area.map, o.tier);
    if (!prefab) return;
    for (const b of prefab.boxes) {
      if (!b.solid) continue;
      const y = heightAt(area.map, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      solids.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, y0: y - 2, y1: y + b.h, kind: 'prop', ref: -1 });
    }
  });
}

/** Things that happen to structures with time. */
function upkeep(state: GameState, ctx: SimContext): void {
  const build = state.build;
  const now = toAbsMinutes(state.time);
  if (build.structures.some((s) => s.ruinUntil !== undefined && s.ruinUntil <= now)) {
    build.structures = build.structures.filter((s) => s.ruinUntil === undefined || s.ruinUntil > now);
    build.gridRev++;
  }
  if (state.time.minute % 60 !== 0) return;
  if (hasTech(state, 'F6b') && !build.raid) {
    for (const st of build.structures) {
      const def = defOf(st);
      if (isBuilt(st) && def.kind === 'wall') st.hp = Math.min(maxHp(state, def), st.hp + maxHp(state, def) * BUILD.selfRepairF6b);
    }
  }
  if (state.time.minute === 0) {
    // Water moats are kept full by pumps; without fuel they drain to ordinary ditches for the day.
    let fuel = 0;
    for (const st of build.structures) if (isBuilt(st)) fuel += defOf(st).fuelPerDay ?? 0;
    if (fuel > 0) moveStock(ctxNow(state, ctx.grid, ctx.emit), 'fuel', -fuel);
  }
}

export const buildSystem: System = {
  id: 'build',
  commands: {
    placeBlueprint(state, cmd, ctx) {
      const reason = placeBlueprint(state, homeMap(state)?.map ?? null, ctx.emit, cmd.def, cmd.tx, cmd.ty, cmd.rot);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    cancelStructure(state, cmd, ctx) {
      const reason = cancelStructure(state, ctx.emit, cmd.id);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    setStructurePriority(state, cmd, ctx) {
      const reason = setPriority(state, cmd.id, cmd.priority);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
  },
  step(state, ctx) {
    const area = homeMap(state);
    if (area) syncMap(state, area.map);
    else syncOutpost(state);
    if (state.build.raid) {
      if (area && playerPresent(state)) raidStep(state, ctx, area);
      else raidAbandoned(state, ctx);
    }
    if (area && playerPresent(state)) updateDefenders(state, area, ctx);
  },
  minute(state, ctx) {
    if (state.world.homeCell === null || state.flags.range) return;
    foundBase(state);
    upkeep(state, ctx);
    raidMinute(state, ctx);
  },
};
