// Construction: the builders' output (sim/colony/jobs.ts) turns blueprints into structures —
// materials first, then work — and afterwards goes into repairs and clearing moats.
// Called once per game hour by the colony with everything the builders produced.

import type { GameState, ResourceId, Structure } from '../../core/types.ts';
import { BUILD, type BuildingDef } from '../../data/buildings.ts';
import { logEntry, moveStock, type ColonyCtx } from '../colony/stock.ts';
import { defOf, hasTech, isBuilt, maxHp, moatFilled, refreshCapacity } from './structures.ts';

type Res = Exclude<ResourceId, 'ears'>;

/** Construction output a structure needs in total. */
export function workOf(state: GameState, def: BuildingDef): number {
  return Math.max(1e-6, def.work * (def.kind === 'moat' && hasTech(state, 'F4a') ? BUILD.moatWorkF4a : 1));
}

/** Share of the materials that has arrived on site (1 when nothing is needed). */
export function deliveredShare(st: Structure, def: BuildingDef): number {
  let share = 1;
  for (const res of Object.keys(def.cost) as Res[]) {
    const need = def.cost[res] ?? 0;
    if (need > 0) share = Math.min(share, (st.delivered[res] ?? 0) / need);
  }
  return share;
}

function finish(c: ColonyCtx, st: Structure, def: BuildingDef): void {
  st.progress = 1;
  st.hp = maxHp(c.state, def);
  c.state.build.gridRev++;
  refreshCapacity(c.state);
  c.emit({ type: 'structureBuilt', id: st.id, def: st.def });
  // Walls and moats come by the dozen: one line per kind and hour is plenty.
  const key = `built:${st.def}`;
  if (def.size[0] * def.size[1] > 1 || lastLogged.key !== key || lastLogged.hour !== c.day * 24 + Math.floor(c.minute / 60)) {
    lastLogged = { key, hour: c.day * 24 + Math.floor(c.minute / 60) };
    logEntry(c, 'build', 'log.built', { def: st.def });
  }
}
let lastLogged = { key: '', hour: -1 };

const byPriority = (a: Structure, b: Structure): number => b.priority - a.priority || a.id - b.id;

/** Spend `points` of construction output. Returns what is left (nothing to do, or no materials). */
export function construct(c: ColonyCtx, points: number): number {
  const { state } = c;
  let left = points;
  if (left <= 0) return 0;
  const list = state.build.structures;

  // 1. blueprints, highest priority first
  for (const st of list.filter((s) => s.progress < 1).sort(byPriority)) {
    if (left <= 1e-9) break;
    const def = defOf(st);
    for (const res of Object.keys(def.cost) as Res[]) {
      const missing = (def.cost[res] ?? 0) - (st.delivered[res] ?? 0);
      if (missing > 1e-9) st.delivered[res] = (st.delivered[res] ?? 0) + moveStock(c, res, -missing);
    }
    const total = workOf(state, def);
    const reachable = Math.min(1, deliveredShare(st, def));
    const need = (reachable - st.progress) * total;
    if (need <= 1e-9) {
      if (reachable >= 1) finish(c, st, def);
      continue;
    }
    const spent = Math.min(need, left);
    left -= spent;
    st.progress += spent / total;
    if (st.progress >= 1 - 1e-9) finish(c, st, def);
  }

  // 2. repairs, the most battered first
  if (left > 1e-9) {
    const speed = hasTech(state, 'F4b') ? BUILD.repairSpeedF4b : 1;
    const damaged = list.filter((s) => isBuilt(s) && defOf(s).hp > 0 && s.hp < maxHp(state, defOf(s)) - 1e-6)
      .sort((a, b) => b.priority - a.priority || a.hp / maxHp(state, defOf(a)) - b.hp / maxHp(state, defOf(b)) || a.id - b.id);
    for (const st of damaged) {
      if (left <= 1e-9) break;
      const def = defOf(st);
      const max = maxHp(state, def);
      let hp = Math.min(max - st.hp, (left * speed) / BUILD.repairWork);
      // Materials: the lost share of the building cost, at half price.
      for (const res of Object.keys(def.cost) as Res[]) {
        const perHp = ((def.cost[res] ?? 0) * BUILD.repairCost) / max;
        if (perHp > 0) hp = Math.min(hp, state.colony.stock[res] / perHp);
      }
      if (hp <= 1e-6) continue;
      for (const res of Object.keys(def.cost) as Res[]) moveStock(c, res, -(((def.cost[res] ?? 0) * BUILD.repairCost) / max) * hp);
      st.hp = Math.min(max, st.hp + hp);
      left -= (hp * BUILD.repairWork) / speed;
    }
  }

  // 3. bodies out of the moats
  if (left > 1e-9) {
    for (const st of list) {
      if (left <= 1e-9) break;
      const bodies = st.corpsesInMoat ?? 0;
      if (bodies <= 0 || !isBuilt(st) || defOf(st).kind !== 'moat') continue;
      const was = moatFilled(st);
      const perBody = BUILD.moatClearWork / BUILD.moatFill;
      const removed = Math.min(bodies, left / perBody);
      st.corpsesInMoat = bodies - removed < 1e-6 ? 0 : bodies - removed;
      left -= removed * perBody;
      if (was && !moatFilled(st)) {
        state.build.gridRev++;
        logEntry(c, 'build', 'log.moatCleared', {});
      }
    }
  }
  return Math.max(0, left);
}
