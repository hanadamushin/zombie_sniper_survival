// Command: ui / input -> sim. `sim.dispatch(cmd)` queues; commands are applied at the start of
// the next tick (docs/04_architecture.md §6). UI and render never mutate GameState directly.
// A system implements a command by listing a handler in its `commands` map (see sim/system.ts).

import type { CellId, EntityId, JobId, Mode, Speed, TechCategory } from './types.ts';

export type Command =
  // --- handled by sim/time.ts (01) ---
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'setMode'; mode: Mode }
  // --- colony (05) ---
  | { type: 'assignJob'; survivor: EntityId; job: JobId }
  | { type: 'hire'; candidate: EntityId }
  | { type: 'dismiss'; survivor: EntityId }
  | { type: 'buyFood'; amount: number; source: string }
  | { type: 'sendExpedition'; members: EntityId[]; target: CellId; weapon: string }
  | { type: 'setPolicy'; autoBuyFood: boolean }
  // --- build / defense (06) ---
  | { type: 'placeBlueprint'; def: string; tx: number; ty: number; rot: 0 | 1 | 2 | 3 }
  | { type: 'cancelStructure'; id: EntityId }
  | { type: 'foundOutpost'; cell: CellId }
  // --- added by 06 ---
  | { type: 'setStructurePriority'; id: EntityId; priority: 0 | 1 | 2 }
  | { type: 'upgradeOutpost'; id: EntityId }
  /** Post a survivor to an outpost (null: call them back to the base). */
  | { type: 'assignGarrison'; survivor: EntityId; outpost: EntityId | null }
  // --- research (07) ---
  | { type: 'startResearch'; id: string }
  | { type: 'setAllocation'; allocation: Record<TechCategory, number> }
  /** The ending screen has been read; the game goes on. */
  | { type: 'dismissEnding' }
  // --- world / tactical (02/03/04) ---
  /** `fast` (06): fast travel — both ends must be the base or an outpost. */
  | { type: 'travel'; to: CellId; fast?: boolean }
  | { type: 'resupply' };

export type CommandType = Command['type'];
export type CommandOf<K extends CommandType> = Extract<Command, { type: K }>;

/** FIFO queue. Lives outside GameState: pending commands are not saved. */
export class CommandQueue {
  private queue: Command[] = [];

  push(cmd: Command): void {
    this.queue.push(cmd);
  }

  get length(): number {
    return this.queue.length;
  }

  /** Remove and return everything queued so far. */
  drain(): Command[] {
    if (this.queue.length === 0) return [];
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
