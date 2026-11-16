// What the UI needs from the rest of the app. The UI only reads GameState and talks back through
// `actions` (which dispatch Commands or call the session functions in main.ts).

import type { Command } from '../core/commands.ts';
import type { SaveMeta, SlotId } from '../core/save.ts';
import type { CellId, Difficulty, GameState, StaticGrid } from '../core/types.ts';
import type { ScenarioData } from '../sim/world/scenario.ts';
import type { StartCandidate } from '../sim/world/start.ts';

export interface UiActions {
  dispatch(cmd: Command): void;
  /** Prepare a new world and show the opening. Resolves false when the map data cannot be loaded. */
  newGame(difficulty: Difficulty): Promise<boolean>;
  /** Start the prepared game on the chosen cell (opening screen). */
  chooseStart(cell: CellId): void;
  /** Leave the opening and go back to the title. */
  cancelIntro(): void;
  /** Load a slot and start playing. Resolves false when the slot is missing or broken. */
  loadSlot(slot: SlotId): Promise<boolean>;
  saveSlot(slot: SlotId): Promise<boolean>;
  listSaves(): Promise<SaveMeta[]>;
  quitToTitle(): void;
  /** Open the firing range (07b). A running game is put aside and comes back with leaveRange(). */
  openRange(): void;
  /** Leave the firing range: back to the game it was opened from, or to the title. */
  leaveRange(): void;
  toggleMode(target: 'command' | 'world' | 'menu'): void;
  togglePause(): void;
}

/** The opening shown between "new game" and the first tick. */
export interface IntroData {
  scenario: ScenarioData;
  candidates: StartCandidate[];
}

export interface UiSnapshot {
  /** Static map (null until loaded). */
  grid: StaticGrid | null;
  intro: IntroData | null;
  /** null => title screen. The object is mutated in place by the sim; re-render on `rev`. */
  state: GameState | null;
  /** Bumped by ui.sync() (10 Hz) and on screen changes. */
  rev: number;
  fps: number;
  drawCalls: number;
}
