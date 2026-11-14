// What the UI needs from the rest of the app. The UI only reads GameState and talks back through
// `actions` (which dispatch Commands or call the session functions in main.ts).

import type { Command } from '../core/commands.ts';
import type { SaveMeta, SlotId } from '../core/save.ts';
import type { Difficulty, GameState } from '../core/types.ts';

export interface UiActions {
  dispatch(cmd: Command): void;
  newGame(difficulty: Difficulty): void;
  /** Load a slot and start playing. Resolves false when the slot is missing or broken. */
  loadSlot(slot: SlotId): Promise<boolean>;
  saveSlot(slot: SlotId): Promise<boolean>;
  listSaves(): Promise<SaveMeta[]>;
  quitToTitle(): void;
  toggleMode(target: 'command' | 'world' | 'menu'): void;
  togglePause(): void;
}

export interface UiSnapshot {
  /** null => title screen. The object is mutated in place by the sim; re-render on `rev`. */
  state: GameState | null;
  /** Bumped by ui.sync() (10 Hz) and on screen changes. */
  rev: number;
  fps: number;
  drawCalls: number;
}
