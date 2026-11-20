// What a search yields (spec §4.4): the one place that turns scavenging points into resources.
// The player searching a building (encounters.ts), expeditions (expeditions.ts) and the foragers
// at home (jobs.ts) all ask here, each adding its own randomness and loot factor on top.
// 07d: `LootKind` becomes the kind of building searched (per-building tables); today it is the
// cell's land class and the table is data/colony.ts LOOT_TABLE.

import type { Land, ResourceId } from '../../core/types.ts';
import { LOOT_TABLE, type LootTable } from '../../data/colony.ts';

export type LootKind = Land;
export type LootRes = Exclude<ResourceId, 'ears'>;

export function lootTableFor(kind: LootKind): LootTable {
  return LOOT_TABLE[kind];
}

/**
 * Expected yield of `points` scavenging points at loot = 1, one entry per resource the kind can give,
 * in table order (callers draw their random numbers in this order, so keep it stable).
 */
export function lootYield(kind: LootKind, points: number): [LootRes, number][] {
  const table = lootTableFor(kind);
  return (Object.keys(table) as LootRes[]).map((res) => [res, points * (table[res] ?? 0)]);
}
