// O1: where the hidden stashes stand in their areas (docs/02_systems_spec.md §3.12). Pure: the area
// generator (gen/index.ts: the host's safe and locked rooms are always search points) and the sim
// (sim/world/stash.ts: the supply point, the vault, the elites, the boat) agree through it.

import { STASH_IDS, type StashId } from '../core/types.ts';
import { BALANCE } from '../data/balance.ts';
import type { BuildingPlacement } from './buildings/types.ts';

/** The stash whose cell this is, or null. */
export function stashOfCell(cell: number | undefined): StashId | null {
  if (cell === undefined) return null;
  for (const id of STASH_IDS) if (BALANCE[id].cell === cell) return id;
  return null;
}

/** Index in `placements` of the stash's host building (the first type of BALANCE.<id>.host found), or -1. */
export function stashHost(id: StashId, placements: readonly BuildingPlacement[]): number {
  for (const prefix of BALANCE[id].host) {
    const i = placements.findIndex((p) => p.def.startsWith(prefix));
    if (i >= 0) return i;
  }
  return -1;
}
