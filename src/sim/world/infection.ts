// Infection simulation (docs/02_systems_spec.md §2.2). One call = one day.
//
// The same pure function runs at build time (tools/run-infection.ts, days 0..90) and in the game
// (sim/world/index.ts, once per dayStarted). People and zombies are whole numbers: fractional flows
// are rounded stochastically with the given RNG, so a cell without zombies stays clean until one
// actually walks in, and the national head count is conserved exactly.

import type { RngState } from '../../core/rng.ts';
import { rand } from '../../core/rng.ts';
import type { CellId, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { LANDS } from './grid.ts';

/** The mutable per-cell arrays (indexed by CellId; sea cells hold Z = -1 and are never touched). */
export interface InfectionCells {
  S: number[];
  Z: number[];
  H: number[];
  loot: number[];
}

export interface InfectionExtras {
  /** Extra prey weight of cells (home base, outposts), already in "S-equivalents". */
  attraction?: { cell: CellId; weight: number }[];
  /** Cells whose zombie inflow should be reported (home base). */
  watch?: CellId[];
}

export interface InfectionStats {
  attacked: number;
  turned: number;
  hidden: number;
  /** People who died (not counting zombies destroyed). */
  died: number;
  /** Zombies destroyed by resistance. */
  killed: number;
  /** Zombies that changed cell (migration + hub transfers). */
  moved: number;
  /** Zombies that walked into each watched cell, same order as extras.watch. */
  inflow: number[];
}

interface Topology {
  n: number; // land cell count
  ids: Int32Array; // land index -> cell id
  land: Uint8Array; // land index -> LANDS index
  pop0: Float64Array;
  /** 8 neighbours per land cell as cell ids (-1 = sea / outside). */
  nb: Int32Array;
  /** Hub links as pairs of cell ids (both directions listed). */
  hubFrom: Int32Array;
  hubTo: Int32Array;
  // scratch (sized gridW * gridH)
  dS: Float64Array;
  dZ: Float64Array;
  attract: Float64Array;
  isMountain: Uint8Array; // by cell id
  popById: Float64Array; // by cell id
}

const MOUNTAIN = LANDS.indexOf('mountain');
const topoCache = new WeakMap<StaticGrid, Topology>();

function topology(grid: StaticGrid): Topology {
  let t = topoCache.get(grid);
  if (t) return t;
  const { gridW: w, gridH: h, landIds } = grid;
  const n = landIds.length;
  const nb = new Int32Array(n * 8).fill(-1);
  const land = new Uint8Array(n);
  const pop0 = new Float64Array(n);
  const isMountain = new Uint8Array(w * h);
  const popById = new Float64Array(w * h);
  for (let k = 0; k < n; k++) {
    const id = landIds[k]!;
    const cell = grid.cells[id]!;
    land[k] = LANDS.indexOf(cell.land);
    pop0[k] = cell.pop0;
    popById[id] = cell.pop0;
    if (land[k] === MOUNTAIN) isMountain[id] = 1;
    let j = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cell.gx + dx;
        const y = cell.gy + dy;
        if (x >= 0 && y >= 0 && x < w && y < h && grid.cells[y * w + x]) nb[k * 8 + j] = y * w + x;
        j++;
      }
    }
  }
  const from: number[] = [];
  const to: number[] = [];
  for (const hub of grid.hubs) {
    for (const other of hub.links) {
      from.push(hub.cell);
      to.push(grid.hubs[other]!.cell);
    }
  }
  t = {
    n, ids: Int32Array.from(landIds), land, pop0, nb,
    hubFrom: Int32Array.from(from), hubTo: Int32Array.from(to),
    dS: new Float64Array(w * h), dZ: new Float64Array(w * h), attract: new Float64Array(w * h),
    isMountain, popById,
  };
  topoCache.set(grid, t);
  return t;
}

/** Round to an integer so that the expected value is x. */
function sround(x: number, rng: RngState): number {
  const f = Math.floor(x);
  const frac = x - f;
  return frac > 0 && rand(rng) < frac ? f + 1 : f;
}

const P = BALANCE.infection;
const byLand = (table: Record<(typeof LANDS)[number], number>): number[] => LANDS.map((l) => table[l]);
const LAND_BETA = byLand(P.landBeta);
const RESIST_EARLY = byLand(P.resistEarly);
const RESIST_LATE = byLand(P.resistLate);
const HIDE_ATTACK = byLand(P.hideOnAttack);
const HIDE_COLLAPSE = byLand(P.hideOnCollapse);

/** Empty world: everyone alive, nothing looted. Sea cells get Z = -1. */
export function createInfectionCells(grid: StaticGrid): InfectionCells {
  const size = grid.gridW * grid.gridH;
  const cells: InfectionCells = {
    S: new Array<number>(size).fill(0),
    Z: new Array<number>(size).fill(-1),
    H: new Array<number>(size).fill(0),
    loot: new Array<number>(size).fill(0),
  };
  for (const id of grid.landIds) {
    cells.S[id] = grid.cells[id]!.pop0;
    cells.Z[id] = 0;
    cells.loot[id] = 1;
  }
  return cells;
}

/** The international gateways where the outbreak starts in a scenario (hub ids), chosen by seed. */
export function pickSources(grid: StaticGrid, rng: RngState): number[] {
  const pool = grid.hubs.filter((hub) => hub.intl !== null).map((hub) => hub.id);
  const out: number[] = [];
  while (out.length < P.sourceCount && pool.length > 0) out.push(pool.splice(Math.floor(rand(rng) * pool.length), 1)[0]!);
  return out.sort((a, b) => a - b);
}

/** Day 0: put the first zombies at the source hubs. */
export function seedOutbreak(cells: InfectionCells, grid: StaticGrid, sources: number[]): void {
  for (const hubId of sources) {
    const cell = grid.hubs[hubId]!.cell;
    const z = Math.min(P.sourceZ, cells.S[cell]!);
    cells.S[cell]! -= z;
    cells.Z[cell]! += z;
  }
}

/**
 * Advance the infection by one day, in place. `day` is the day being simulated (the first call
 * after seeding uses day 1). Order of the phases follows the spec.
 */
export function stepInfection(cells: InfectionCells, grid: StaticGrid, day: number, extras: InfectionExtras | null, rng: RngState): InfectionStats {
  const t = topology(grid);
  const { S, Z, H, loot } = cells;
  const { n, ids, land, nb, dS, dZ, attract, isMountain, popById } = t;
  const stats: InfectionStats = { attacked: 0, turned: 0, hidden: 0, died: 0, killed: 0, moved: 0, inflow: [] };
  const resist = day < P.resistCollapseDay ? RESIST_EARLY : RESIST_LATE;

  // 1 + 2: infection and resistance
  for (let k = 0; k < n; k++) {
    const id = ids[k]!;
    let s = S[id]!;
    let z = Z[id]!;
    if (z <= 0 || s <= 0) continue;
    const l = land[k]!;
    const attacked = Math.min(s, sround((P.beta * LAND_BETA[l]! * s * z) / (s + z + 1), rng));
    if (attacked > 0) {
      const hidden = sround(attacked * HIDE_ATTACK[l]!, rng);
      const turned = sround((attacked - hidden) * P.turnRate, rng);
      s -= attacked;
      z += turned;
      H[id]! += hidden;
      stats.attacked += attacked;
      stats.hidden += hidden;
      stats.turned += turned;
      stats.died += attacked - hidden - turned;
    }
    const killed = Math.min(z, sround((P.rho * resist[l]! * s * z) / (s + z + 1), rng));
    z -= killed;
    stats.killed += killed;
    S[id] = s;
    Z[id] = z;
  }

  // 3: evacuation towards cells with fewer zombies per head
  if (day < P.evacEndDay) {
    for (let k = 0; k < n; k++) {
      const id = ids[k]!;
      const s = S[id]!;
      if (s <= 0) continue;
      const own = Z[id]! / (popById[id]! + 1);
      let safer = 0;
      let threatened = own > 0;
      for (let j = 0; j < 8; j++) {
        const o = nb[k * 8 + j]!;
        if (o < 0) continue;
        const r = Z[o]! / (popById[o]! + 1);
        if (r > 0) threatened = true;
        if (r < own) safer++;
      }
      if (!threatened || safer === 0) continue;
      const leaving = Math.min(s, sround(s * P.evacRate, rng));
      if (leaving <= 0) continue;
      const each = Math.floor(leaving / safer);
      let extra = leaving - each * safer;
      for (let j = 0; j < 8; j++) {
        const o = nb[k * 8 + j]!;
        if (o < 0 || Z[o]! / (popById[o]! + 1) >= own) continue;
        dS[o]! += each + (extra > 0 ? 1 : 0);
        if (extra > 0) extra--;
      }
      dS[id]! -= leaving;
    }
    for (let k = 0; k < n; k++) {
      const id = ids[k]!;
      if (dS[id] !== 0) {
        S[id]! += dS[id]!;
        dS[id] = 0;
      }
    }
  }

  // 4: long-distance spread between transport hubs
  if (day < P.hubEndDay) {
    for (let i = 0; i < t.hubFrom.length; i++) {
      const a = t.hubFrom[i]!;
      const z = Z[a]!;
      if (z <= 0) continue;
      const sent = Math.min(z + dZ[a]!, sround(z * P.hubRate, rng));
      if (sent <= 0) continue;
      dZ[a]! -= sent;
      dZ[t.hubTo[i]!]! += sent;
      stats.moved += sent;
    }
    for (let i = 0; i < t.hubFrom.length; i++) {
      for (const id of [t.hubFrom[i]!, t.hubTo[i]!]) {
        if (dZ[id] !== 0) {
          Z[id]! += dZ[id]!;
          dZ[id] = 0;
        }
      }
    }
  }

  // 5: zombie migration towards prey
  const extraCells = extras?.attraction ?? [];
  for (const a of extraCells) attract[a.cell]! += a.weight;
  const watch = extras?.watch ?? [];
  const inflow = watch.map(() => 0);
  const weight = (id: number): number => P.wS * S[id]! + P.wH * H[id]! + P.wBuilt * popById[id]! + attract[id]!;
  const w8 = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < n; k++) {
    const id = ids[k]!;
    const z = Z[id]!;
    if (z <= 0) continue;
    let wn = 0;
    let open = 0;
    for (let j = 0; j < 8; j++) {
      const o = nb[k * 8 + j]!;
      if (o < 0 || isMountain[o]) {
        w8[j] = -1;
        continue;
      }
      open++;
      const w = weight(o);
      w8[j] = w;
      wn += w;
    }
    if (open === 0) continue;
    const frac = wn > 0 ? (P.diffusionMax * wn) / (wn + P.selfHold * weight(id)) : P.idleDiffusion;
    const leaving = Math.min(z, sround(z * frac, rng));
    if (leaving <= 0) continue;
    let left = leaving;
    for (let j = 0; j < 8 && left > 0; j++) {
      if (w8[j]! < 0) continue;
      const share = wn > 0 ? w8[j]! / wn : 1 / open;
      const go = Math.min(left, sround(leaving * share, rng));
      if (go <= 0) continue;
      const o = nb[k * 8 + j]!;
      dZ[o]! += go;
      left -= go;
      const wi = watch.indexOf(o);
      if (wi >= 0) inflow[wi]! += go;
    }
    const gone = leaving - left;
    dZ[id]! -= gone;
    stats.moved += gone;
  }
  for (let k = 0; k < n; k++) {
    const id = ids[k]!;
    if (dZ[id] !== 0) {
      Z[id]! += dZ[id]!;
      dZ[id] = 0;
    }
  }
  for (const a of extraCells) attract[a.cell] = 0;
  stats.inflow = inflow;

  // 6: society collapses — the remaining living hide or perish. 7: loot is used up.
  const collapsing = day >= P.hideStartDay;
  for (let k = 0; k < n; k++) {
    const id = ids[k]!;
    const s = S[id]!;
    if (collapsing && s > 0) {
      const l = land[k]!;
      const gone = s <= 10 ? s : Math.min(s, sround(s * P.collapseRate, rng));
      const hidden = sround(gone * HIDE_COLLAPSE[l]!, rng);
      const turned = sround((gone - hidden) * P.collapseTurn, rng);
      S[id] = s - gone;
      H[id]! += hidden;
      Z[id]! += turned;
      stats.hidden += hidden;
      stats.turned += turned;
      stats.died += gone - hidden - turned;
    }
    const living = S[id]! + H[id]!;
    if (living > 0 && loot[id]! > 0) {
      const next = loot[id]! - (P.lootDecay * living) / (popById[id]! + 1);
      loot[id] = next > 0 ? Math.round(next * 1e5) / 1e5 : 0;
    }
  }
  return stats;
}

/** Run a whole scenario from day 0. `onDay` sees the state after each day (0 = just seeded). */
export function runScenario(
  grid: StaticGrid,
  rng: RngState,
  days: number,
  onDay?: (day: number, cells: InfectionCells, stats: InfectionStats | null) => void,
): { cells: InfectionCells; sources: number[] } {
  const cells = createInfectionCells(grid);
  const sources = pickSources(grid, rng);
  seedOutbreak(cells, grid, sources);
  onDay?.(0, cells, null);
  for (let day = 1; day <= days; day++) {
    const stats = stepInfection(cells, grid, day, null, rng);
    onDay?.(day, cells, stats);
  }
  return { cells, sources };
}
