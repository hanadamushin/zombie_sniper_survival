// Simulation entry point. Headless: no Three.js, no DOM, no wall clock, no Math.random.
//
//   const sim = createSim();
//   sim.dispatch({ type: 'setSpeed', speed: 3 });   // ui / input
//   sim.events.on('dayStarted', ...);               // render / ui / audio / autosave
//   sim.tick(state, FIXED_STEP, inputFrame);        // main loop or a headless bot
//
// Order inside one tick (docs/04_architecture.md §4) — do not reorder:
//   1. apply queued commands
//   2. advance time (emits hourStarted / dayStarted)
//   3. tactical.step      every step
//   4. build.step         every step
//   5. *.minute           on game-minute boundaries (colony)
//   6. *.hour             on game-hour boundaries   (research, expeditions, horde checks)
//   7. *.day              on game-day boundaries    (world/infection, wages)
//   8. flush events to subscribers
// Within phases 3–7 systems run in the order of the SYSTEMS array below.
//
// To add behaviour: implement the hooks you need in sim/<domain>/index.ts. To add a command or
// event: extend the unions in core/commands.ts / core/events.ts and add a handler to the
// owning system's `commands` map.

import { CommandQueue, type Command, type CommandType } from '../core/commands.ts';
import { EventBus, type GameEvent } from '../core/events.ts';
import type { GameState, InputFrame, StaticGrid } from '../core/types.ts';
import { buildSystem } from './build/index.ts';
import { colonySystem } from './colony/index.ts';
import { researchSystem } from './research/index.ts';
import type { CommandHandlers, SimContext, System } from './system.ts';
import { tacticalSystem } from './tactical/index.ts';
import { advanceTime, timeCommands } from './time.ts';
import { worldSystem } from './world/index.ts';

/** Time comes first only for its command handlers; its clock advance is phase 2 above. */
const timeSystem: System = { id: 'time', commands: timeCommands };

export const SYSTEMS: readonly System[] = [timeSystem, tacticalSystem, buildSystem, colonySystem, researchSystem, worldSystem];

export interface SimOptions {
  grid?: StaticGrid | null;
  /** Where warnings go (default: console.warn). */
  warn?: (message: string) => void;
  /** Override the system list (tests). */
  systems?: readonly System[];
}

export interface Sim {
  readonly events: EventBus;
  /** Queue a command; applied at the start of the next tick (or applyCommands call). */
  dispatch(cmd: Command): void;
  /** One fixed step. Always advances by dt regardless of state.time.speed (the loop owns speed). */
  tick(state: GameState, dt: number, input: InputFrame): void;
  /**
   * Apply queued commands and flush their events WITHOUT advancing time. The main loop calls this
   * every frame so that commands still work while paused (speed 0 / menu).
   */
  applyCommands(state: GameState): void;
  setGrid(grid: StaticGrid | null): void;
}

type AnyHandler = (state: GameState, cmd: Command, ctx: SimContext) => void;

const NO_INPUT: InputFrame = Object.freeze({
  moveX: 0, moveZ: 0, lookDX: 0, lookDY: 0, fire: false, scope: false, holdBreath: false, sprint: false,
  reload: false, stance: null, zoomDelta: 0, zeroDelta: 0, knife: false, interact: false,
});

export function createSim(options: SimOptions = {}): Sim {
  const systems = options.systems ?? SYSTEMS;
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const events = new EventBus();
  const queue = new CommandQueue();
  let grid = options.grid ?? null;
  let prevEvents: readonly GameEvent[] = [];
  const warned = new Set<CommandType>();

  // Build the command routing table; one owner per command type.
  const handlers = new Map<CommandType, AnyHandler>();
  for (const sys of systems) {
    const map: CommandHandlers = sys.commands ?? {};
    for (const key of Object.keys(map) as CommandType[]) {
      const fn = map[key];
      if (!fn) continue;
      if (handlers.has(key)) throw new Error(`Command "${key}" has two handlers (second: ${sys.id})`);
      handlers.set(key, fn as AnyHandler);
    }
  }

  const makeCtx = (dt: number, input: InputFrame): SimContext => ({
    dt,
    input,
    emit: (e) => events.emit(e),
    prevEvents,
    grid,
    warn,
  });

  const applyQueued = (state: GameState, ctx: SimContext): void => {
    for (const cmd of queue.drain()) {
      const handler = handlers.get(cmd.type);
      if (handler) {
        handler(state, cmd, ctx);
      } else if (!warned.has(cmd.type)) {
        warned.add(cmd.type);
        warn(`[sim] command "${cmd.type}" has no handler yet (ignored)`);
      }
    }
  };

  return {
    events,
    dispatch: (cmd) => queue.push(cmd),
    setGrid: (g) => {
      grid = g;
    },

    applyCommands(state) {
      if (queue.length === 0) return;
      applyQueued(state, makeCtx(0, NO_INPUT));
      const flushed = events.flush();
      // Systems see these on the next tick, together with the previous tick's events they have not seen yet.
      prevEvents = prevEvents.length ? [...prevEvents, ...flushed] : flushed;
    },

    tick(state, dt, input) {
      const ctx = makeCtx(dt, input);
      applyQueued(state, ctx); // 1
      const b = advanceTime(state, ctx); // 2
      for (const s of systems) s.step?.(state, ctx); // 3, 4
      if (b.minute) for (const s of systems) s.minute?.(state, ctx); // 5
      if (b.hour) for (const s of systems) s.hour?.(state, ctx); // 6
      if (b.day) for (const s of systems) s.day?.(state, ctx); // 7
      prevEvents = events.flush(); // 8
    },
  };
}

