// Survivor traits (docs/02_systems_spec.md §4.1): one per person, effects within +-10..30 %.
// Display names and descriptions are in ui/i18n/ja.ts under `trait.<id>` / `trait.<id>.desc`.

import type { JobId } from '../core/types.ts';

export interface TraitDef {
  id: string;
  /** Relative frequency. */
  weight: number;
  wageMul?: number;
  /** Output factor per job; `all` applies to every job. */
  job?: Partial<Record<JobId | 'all', number>>;
  /** Added to the return probability on expeditions. */
  returnBonus?: number;
  /** Morale change on an unpaid day, replacing the default. */
  unpaidMorale?: number;
  foodMul?: number;
  moralePerDay?: number;
  hoursBonus?: number;
}

export const TRAITS: readonly TraitDef[] = [
  { id: 'veteran', weight: 1, wageMul: 1.1, job: { defense: 1.25 }, returnBonus: 0.05 },
  { id: 'farmer', weight: 1.4, job: { farming: 1.25 } },
  { id: 'greedy', weight: 1, wageMul: 1.3, job: { all: 1.1 } },
  { id: 'loyal', weight: 1, unpaidMorale: -5 },
  { id: 'coward', weight: 1, job: { defense: 0.8 }, returnBonus: 0.1 },
  { id: 'engineer', weight: 0.9, job: { crafting: 1.2, construction: 1.1 } },
  { id: 'scholar', weight: 0.8, job: { research: 1.25, construction: 0.9 } },
  { id: 'nurse', weight: 0.8, job: { medical: 1.3 } },
  { id: 'glutton', weight: 0.9, foodMul: 1.3, job: { construction: 1.15 } },
  { id: 'frugal', weight: 1, wageMul: 0.8 },
  { id: 'cheerful', weight: 1, moralePerDay: 1 },
  { id: 'tireless', weight: 0.9, hoursBonus: 1.5 },
  { id: 'hiker', weight: 1, job: { scavenging: 1.2 } },
];

const byId = new Map(TRAITS.map((t) => [t.id, t]));
const NONE: TraitDef = { id: 'none', weight: 0 };
export function traitOf(id: string): TraitDef {
  return byId.get(id) ?? NONE;
}
