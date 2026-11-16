// One place that answers "what is this number right now?" and "is this switched on?".
//
//   getMod(state, 'wall.hp', 150)      (base + sum of adds) * product of muls
//   hasFlag(state, 'militia')
//   techDone(state, 'F3')              the colony really has the node
//   techAvailable(state, 'F3')         ... or everything is unlocked for debugging (flags.unlockAll)
//
// Sources, compiled into one table: the researched nodes (data/techs.ts), the buildings that stand
// (data/buildings.ts `mods` / `flags`), and the difficulty. Survivor traits stay per person (data/traits.ts) and are
// multiplied in where a single survivor's output is computed.
//
// The table is cached per GameState and rebuilt when the researched list, the structures
// (build.gridRev) or the difficulty change. Code that edits those in place in an unusual way
// (tests, debug tools) can call invalidateMods(state).

import type { GameState } from '../../core/types.ts';
import { BUILDINGS } from '../../data/buildings.ts';
import { DIFFICULTY_MODS, TECHS, type FlagId, type ModKey, type TechEffect } from '../../data/techs.ts';

export interface ModTable {
  add: Partial<Record<ModKey, number>>;
  mul: Partial<Record<ModKey, number>>;
  flags: Set<string>;
}

interface Cache {
  done: readonly string[];
  doneLen: number;
  gridRev: number;
  structures: number;
  difficulty: number;
  table: ModTable;
}
const caches = new WeakMap<GameState, Cache>();
let builds = 0;

function apply(table: ModTable, e: TechEffect | { kind: 'modifier'; key: ModKey; op: 'add' | 'mul'; value: number }): void {
  if (e.kind === 'modifier') {
    if (e.op === 'add') table.add[e.key] = (table.add[e.key] ?? 0) + e.value;
    else table.mul[e.key] = (table.mul[e.key] ?? 1) * e.value;
  } else if (e.kind === 'flag') table.flags.add(e.flag);
}

function compile(state: GameState): ModTable {
  builds++;
  const table: ModTable = { add: {}, mul: {}, flags: new Set() };
  for (const e of DIFFICULTY_MODS[state.difficulty] ?? []) apply(table, e);
  for (const id of state.research.done) for (const e of TECHS[id]?.effects ?? []) apply(table, e);
  // Buildings: each kind counts once, however many stand.
  const standing = new Set<string>();
  for (const st of state.build.structures) if (st.progress >= 1 && st.ruinUntil === undefined) standing.add(st.def);
  for (const id of standing) {
    const def = BUILDINGS[id];
    if (!def) continue;
    for (const f of def.flags ?? []) table.flags.add(f);
    for (const m of def.mods ?? []) apply(table, { kind: 'modifier', ...m });
  }
  return table;
}

/** The compiled table (cached). Its identity changes whenever its content may have. */
export function modTable(state: GameState): ModTable {
  const r = state.research;
  const b = state.build;
  const c = caches.get(state);
  if (c && c.done === r.done && c.doneLen === r.done.length && c.gridRev === b.gridRev && c.structures === b.structures.length && c.difficulty === state.difficulty) return c.table;
  const table = compile(state);
  caches.set(state, { done: r.done, doneLen: r.done.length, gridRev: b.gridRev, structures: b.structures.length, difficulty: state.difficulty, table });
  return table;
}

export function invalidateMods(state: GameState): void {
  caches.delete(state);
}

/** How many times a table has been compiled (tests: the cache works). */
export function modBuilds(): number {
  return builds;
}

/** `base` with every modifier for `key` applied: additions first, then factors. */
export function getMod(state: GameState, key: ModKey, base: number): number {
  const t = modTable(state);
  return (base + (t.add[key] ?? 0)) * (t.mul[key] ?? 1);
}

export function hasFlag(state: GameState, flag: FlagId): boolean {
  return modTable(state).flags.has(flag);
}

/** The colony has researched this node. */
export function techDone(state: GameState, id: string): boolean {
  return state.research.done.includes(id);
}

/** Something gated by `tech` may be used: no gate, researched, or the debug override. */
export function techAvailable(state: GameState, tech: string | readonly string[] | undefined): boolean {
  if (tech === undefined || state.flags.unlockAll === true) return true;
  return typeof tech === 'string' ? techDone(state, tech) : tech.some((id) => techDone(state, id));
}
