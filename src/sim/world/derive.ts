// Cell -> tactical parameters (docs/02_systems_spec.md §2.3). Pure functions for 03/04/05/06.

import type { CellId, GameState, Land, StaticGrid, ZombieKind } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { getMod } from '../research/modifiers.ts';

const W = BALANCE.world;

/** Zombies per km² of a cell holding `z` zombies. */
export function zombieDensity(z: number): number {
  return Math.max(0, z) / W.cellAreaKm2;
}

/** How many zombies may be active at once in the tactical map of a cell holding `z`. */
export function activeCap(z: number, a: { base: number; perLog: number; min: number; max: number } = W.active): number {
  if (z <= 0) return 0;
  const perHundredKm2 = (z / W.cellAreaKm2) * 100;
  return Math.round(Math.min(a.max, Math.max(a.min, a.base + a.perLog * Math.log10(1 + perHundredKm2))));
}

/** 0..1, used by expeditions and travel encounters. */
export function dangerOf(z: number): number {
  return Math.min(1, Math.max(0, Math.log10(1 + zombieDensity(z)) / W.dangerLogDiv));
}

export function isCleared(z: number): boolean {
  return z < W.clearedBelowZ;
}

/** Spawn probabilities per kind (sum to 1). */
export function kindMix(land: Land): Record<ZombieKind, number> {
  const boost = land === 'urban' ? W.urbanBoost : 1;
  const raw: Record<ZombieKind, number> = {
    walker: W.kindMix.walker,
    runner: W.kindMix.runner * boost,
    crawler: W.kindMix.crawler,
    brute: W.kindMix.brute * boost,
  };
  const total = raw.walker + raw.runner + raw.crawler + raw.brute;
  return { walker: raw.walker / total, runner: raw.runner / total, crawler: raw.crawler / total, brute: raw.brute / total };
}

/** Number of searchable buildings in the tactical map. */
export function lootSpotCount(land: Land, loot: number): number {
  return Math.round(W.lootSpots[land] * Math.max(0, Math.min(1, loot)));
}

export interface CellTactical {
  cell: CellId;
  land: Land;
  z: number;
  /** What the operation area is populated from: z × BALANCE.world.tacticalZScale (07b+). */
  localZ: number;
  active: number;
  danger: number;
  cleared: boolean;
  kinds: Record<ZombieKind, number>;
  lootSpots: number;
  respawnSeconds: number;
}

/** Everything the tactical layer needs to know about a cell, from the live world state. */
export function cellTactical(state: GameState, grid: StaticGrid, cell: CellId): CellTactical | null {
  const info = grid.cells[cell];
  if (!info) return null;
  const z = Math.max(0, state.world.cells.Z[cell] ?? 0);
  const localZ = z * W.tacticalZScale;
  return {
    cell,
    land: info.land,
    z,
    localZ,
    active: Math.min(W.active.max, Math.round(getMod(state, 'zombie.active', activeCap(localZ)))),
    danger: dangerOf(z),
    cleared: isCleared(z),
    kinds: kindMix(info.land),
    lootSpots: lootSpotCount(info.land, state.world.cells.loot[cell] ?? 0),
    respawnSeconds: W.respawnSeconds,
  };
}

/** Remove zombies from a cell (kills by the player, defenders, expeditions). Returns how many were removed. */
export function removeZombies(state: GameState, cell: CellId, count: number): number {
  const z = state.world.cells.Z[cell];
  if (z === undefined || z <= 0 || count <= 0) return 0;
  const removed = Math.min(z, Math.floor(count));
  state.world.cells.Z[cell] = z - removed;
  return removed;
}
