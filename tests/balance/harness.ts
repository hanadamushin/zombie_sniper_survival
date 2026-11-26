// Balance harness (09): the bundled data, the bots' policies, a new game, and the invariants that
// every simulated day has to keep.

import { readFileSync } from 'node:fs';
import { stream } from '../../src/core/rng.ts';
import { createInitialState, type CellId, type GameState, type StaticGrid } from '../../src/core/types.ts';
import { BALANCE } from '../../src/data/balance.ts';
import { bedsTotal } from '../../src/sim/build/structures.ts';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';
import { decodeScenario, initWorld, type ScenarioData } from '../../src/sim/world/scenario.ts';
import { beginAt, findStartCandidates, type StartCandidate } from '../../src/sim/world/start.ts';
import { attach, BRANCH_A, SKILLS, type Game, type Policy } from './bot.ts';

const DATA = new URL('../../public/data/', import.meta.url);
let gridCache: StaticGrid | null = null;
export function loadGrid(): StaticGrid {
  return (gridCache ??= parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile));
}
const scenarios = new Map<number, ScenarioData>();
export function loadScenario(n: number): ScenarioData {
  let s = scenarios.get(n);
  if (!s) {
    const buf = readFileSync(new URL(`infection_${n}.bin`, DATA));
    s = decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    scenarios.set(n, s);
  }
  return s;
}

const steps = (table: [number, number][]) => (d: number): number => {
  let v = table[0]![1];
  for (const [day, n] of table) if (d >= day) v = n;
  return v;
};

export const POLICIES: Record<string, Policy> = {
  /** Hunts in the countryside, farms, builds thick walls, expands late. */
  solid: {
    id: 'solid', skill: SKILLS.average, huntHours: 8, searchPerDay: 3,
    pop: steps([[0, 2], [3, 5], [8, 8], [15, 12], [25, 18], [40, 26], [60, 30], [75, 45], [95, 62]]),
    jobs: { farming: 0.3, construction: 0.15, research: 0.25, defense: 0.12, crafting: 0.08 },
    keepDay: 2, outerDay: 25, towers: 4, party: 3, partyDanger: 0.25,
    outposts: steps([[0, 0], [50, 1], [65, 2], [80, 4], [95, 6]]), roam: true, research: true, branch: BRANCH_A,
  },
  /** Pushes toward the towns early: parties, outposts, less wall. */
  expand: {
    id: 'expand', skill: SKILLS.average, huntHours: 9, searchPerDay: 4,
    pop: steps([[0, 3], [3, 6], [8, 10], [15, 15], [25, 22], [40, 30], [60, 45], [80, 62]]),
    jobs: { farming: 0.25, construction: 0.12, research: 0.22, defense: 0.1, crafting: 0.08 },
    keepDay: 5, outerDay: 50, towers: 2, party: 4, partyDanger: 0.4,
    outposts: steps([[0, 0], [10, 1], [22, 2], [35, 3], [50, 4], [65, 6]]), roam: true, research: true, branch: BRANCH_A,
  },
  /** Hires a few people in the first days and then leaves everything alone. */
  idle: {
    id: 'idle', skill: SKILLS.average, huntHours: 2, searchPerDay: 0,
    pop: steps([[0, 4]]),
    jobs: { farming: 0.5, construction: 0, research: 0, defense: 0, crafting: 0 },
    keepDay: -1, outerDay: -1, towers: 0, party: 0, partyDanger: 0,
    outposts: () => 0, roam: false, research: false, branch: BRANCH_A, idle: true,
  },
  /** An excellent shot who lives off the rifle and keeps next to nobody. */
  sniper: {
    id: 'sniper', skill: SKILLS.expert, huntHours: 11, searchPerDay: 4,
    pop: steps([[0, 2], [10, 3]]),
    jobs: { farming: 0.34, construction: 0.1, research: 0.34, defense: 0, crafting: 0.34 },
    keepDay: 3, outerDay: -1, towers: 0, party: 0, partyDanger: 0,
    outposts: () => 0, roam: true, research: true, branch: BRANCH_A,
  },
};

export interface NewGame {
  seed: number;
  difficulty: 0 | 1 | 2;
  /** Start candidate (0, 1: quiet; 2: the busy one) or a cell chosen by the caller. */
  start?: number;
  cell?: CellId;
}

export function startCandidates(seed: number, difficulty: 0 | 1 | 2 = 1): { state: GameState; grid: StaticGrid; candidates: StartCandidate[] } {
  const grid = loadGrid();
  const state = createInitialState(seed, difficulty);
  initWorld(state, grid, loadScenario(seed % BALANCE.infection.scenarioSeeds.length));
  return { state, grid, candidates: findStartCandidates(state.world.cells, grid, stream(state, 'world.start')) };
}

export function newGame(policy: Policy, o: NewGame): Game {
  const { state, grid, candidates } = startCandidates(o.seed, o.difficulty);
  const cell = o.cell ?? candidates[Math.min(o.start ?? 0, candidates.length - 1)]!.cell;
  beginAt(state, grid, cell);
  state.mode = 'command';
  return attach(state, grid, policy);
}

// ---------------------------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------------------------

function scanNumbers(value: unknown, path: string, out: string[]): void {
  if (out.length > 8) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path} is ${value}`);
  } else if (value === undefined) {
    out.push(`${path} is undefined`);
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) scanNumbers(value[i], `${path}[${i}]`, out);
  } else if (value !== null && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) scanNumbers(v, `${path}.${k}`, out); // optional fields may be absent
    }
  }
}

/** What must hold after every simulated day. Returns the violations (empty when all is well). */
export function checkInvariants(state: GameState, deep = true): string[] {
  const out: string[] = [];
  const colony = state.colony;
  for (const [res, v] of Object.entries(colony.stock)) {
    if (!(v >= -1e-6)) out.push(`stock.${res} = ${v}`);
    const cap = (colony.capacity as Record<string, number>)[res] ?? Infinity;
    if (v > cap + 1e-6) out.push(`stock.${res} = ${v} over capacity ${cap}`);
  }
  for (const [res, v] of Object.entries(state.player.inv)) if (!((v ?? 0) >= 0)) out.push(`player.inv.${res} = ${v}`);
  if (!(colony.market.food >= -1e-6)) out.push(`market.food = ${colony.market.food}`);
  // People: one entry each, nobody dead on the list, everyone where the world says they are.
  const ids = new Set<number>();
  for (const s of colony.survivors) {
    if (ids.has(s.id)) out.push(`survivor ${s.id} twice`);
    ids.add(s.id);
    if (s.status === 'dead') out.push(`dead survivor ${s.id} on the list`);
    if (!(s.hp > 0) && !state.flags.defeat) out.push(`survivor ${s.id} hp ${s.hp}`);
    if (s.morale < 0 || s.morale > 100) out.push(`survivor ${s.id} morale ${s.morale}`);
    if (s.location.kind === 'outpost') {
      const id = s.location.id;
      const o = state.world.outposts.find((x) => x.id === id);
      if (!o) out.push(`survivor ${s.id} at a lost outpost`);
      else if (!o.garrison.includes(s.id)) out.push(`survivor ${s.id} not in the garrison of ${o.id}`);
    }
    if (s.location.kind === 'expedition') {
      const id = s.location.id;
      if (!state.world.expeditions.some((x) => x.id === id && x.members.includes(s.id))) out.push(`survivor ${s.id} on a missing expedition`);
    }
    if ((s.status === 'away') !== (s.location.kind === 'expedition')) out.push(`survivor ${s.id} status ${s.status} at ${s.location.kind}`);
  }
  for (const c of colony.candidates) if (ids.has(c.id)) out.push(`candidate ${c.id} is also a survivor`);
  const posted = new Set<number>();
  for (const o of state.world.outposts) {
    for (const id of o.garrison) {
      if (posted.has(id)) out.push(`guard ${id} at two outposts`);
      posted.add(id);
    }
  }
  // Housing: beds are what the standing buildings give; the headquarters alone gives its own.
  const beds = bedsTotal(state);
  if (!state.flags.defeat && state.world.homeCell !== null && beds < 4) out.push(`beds ${beds}`);
  // Structures.
  for (const st of state.build.structures) {
    if (st.progress < 0 || st.progress > 1 + 1e-9) out.push(`structure ${st.id} progress ${st.progress}`);
    if (st.hp < 0) out.push(`structure ${st.id} hp ${st.hp}`);
  }
  // The world.
  const { cells } = state.world;
  if (state.world.hordeMeter < 0) out.push(`hordeMeter ${state.world.hordeMeter}`);
  if (deep) {
    for (let i = 0; i < cells.Z.length; i++) {
      const z = cells.Z[i]!;
      if (z === -1) continue;
      if (!(z >= 0) || !(cells.S[i]! >= 0) || !(cells.H[i]! >= 0) || !(cells.loot[i]! >= 0)) {
        out.push(`cell ${i}: Z ${z} S ${cells.S[i]} H ${cells.H[i]} loot ${cells.loot[i]}`);
        if (out.length > 8) break;
      }
    }
    scanNumbers(state, 'state', out);
  }
  return out;
}
