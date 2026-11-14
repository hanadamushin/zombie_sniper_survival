// The plug-in contract for simulation systems. One system per domain directory
// (sim/<domain>/index.ts), registered in sim/index.ts in the fixed order of
// docs/04_architecture.md §4.

import type { Command, CommandOf, CommandType } from '../core/commands.ts';
import type { GameEvent } from '../core/events.ts';
import type { GameState, InputFrame, StaticGrid } from '../core/types.ts';

export interface SimContext {
  /** Step length in seconds of tactical time (1 s here = 1 game minute on the clock; see BALANCE.time). 0 inside applyCommands. */
  readonly dt: number;
  /** Player controls for this step. */
  readonly input: InputFrame;
  /** Queue an event; delivered to render/ui/audio when this tick ends. */
  emit(event: GameEvent): void;
  /**
   * Events emitted during the PREVIOUS tick. This is how a system reacts to another system
   * ("handle it on the next tick"). Not saved: never rely on it for anything that must survive
   * a save/load — put such facts in GameState.
   */
  readonly prevEvents: readonly GameEvent[];
  /** Static map data (null until session 02 loads public/data/grid.json). */
  readonly grid: StaticGrid | null;
  warn(message: string): void;
}

export type CommandHandler<K extends CommandType> = (state: GameState, cmd: CommandOf<K>, ctx: SimContext) => void;
export type CommandHandlers = { [K in CommandType]?: CommandHandler<K> };

export interface System {
  readonly id: string;
  /** Handlers for the commands this system owns. Each command type has exactly one owner. */
  readonly commands?: CommandHandlers;
  /** Every fixed step (60 Hz of game time at x1). */
  step?(state: GameState, ctx: SimContext): void;
  /** When a game minute starts (state.time already shows the new minute). */
  minute?(state: GameState, ctx: SimContext): void;
  /** When a game hour starts. */
  hour?(state: GameState, ctx: SimContext): void;
  /** When a game day starts (00:00). */
  day?(state: GameState, ctx: SimContext): void;
}

export type { Command };
