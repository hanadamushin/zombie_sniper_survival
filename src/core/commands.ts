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
  // --- research (07) ---
  | { type: 'startResearch'; id: string }
  | { type: 'setAllocation'; allocation: Record<TechCategory, number> }
  // --- world / tactical (02/03/04) ---
  | { type: 'travel'; to: CellId }
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
