// What a search yields (spec §4.4): the one place that turns scavenging points into resources.
// The player searching a building (encounters.ts), expeditions (expeditions.ts) and the foragers
// at home (jobs.ts) all ask here, each adding its own randomness and loot factor on top.
// 07d: `LootKind` is the cell's land class (data/colony.ts LOOT_TABLE: expeditions, foragers, the
// door of a plain building) or a search point's loot table inside an enterable building
// ({ table, land }: data/colony.ts ROOM_LOOT — the room's use or a special shelf).

import type { Land, ResourceId } from '../../core/types.ts';
import { LOOT_TABLE, ROOM_LOOT, type LootTable } from '../../data/colony.ts';

export type LootKind = Land | { table: string; land: Land };
export type LootRes = Exclude<ResourceId, 'ears'>;

export function lootTableFor(kind: LootKind): LootTable {
  if (typeof kind === 'string') return LOOT_TABLE[kind];
  return ROOM_LOOT[kind.table] ?? LOOT_TABLE[kind.land];
}

/**
 * Expected yield of `points` scavenging points at loot = 1, one entry per resource the kind can give,
 * in table order (callers draw their random numbers in this order, so keep it stable).
 */
export function lootYield(kind: LootKind, points: number): [LootRes, number][] {
  const table = lootTableFor(kind);
  return (Object.keys(table) as LootRes[]).map((res) => [res, points * (table[res] ?? 0)]);
}
