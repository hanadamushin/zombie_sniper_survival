// Bootstrap + fixed-step game loop (docs/04_architecture.md §4).
//
// Wiring only: sim (pure logic) <- commands - input / ui
//              sim - events -> render / ui / audio / autosave
// Session lifecycle (new game / load / save / quit) lives here because it replaces the
// GameState object that everything else reads.

import { ALL_TECH_IDS, grantTech, researchHour } from './sim/research/index.ts';
import { debugFulfilVictory } from './sim/research/victory.ts';
import { createStepper } from './core/loop.ts';
import { AUTO_SLOT, createDefaultSaveStore, listSaves, loadGame, saveGame, type SlotId } from './core/save.ts';
import { effectiveSpeed } from './core/time.ts';
import { stream } from './core/rng.ts';
import { continuationFrame, createInitialState, emptyInputFrame, type CellId, type Difficulty, type GameState, type StaticGrid } from './core/types.ts';
import { BALANCE } from './data/balance.ts';
import { createInput } from './input/index.ts';
import { createRenderer } from './render/index.ts';
import { setRenderGrid } from './render/tactical/neighbours.ts';
import { worldBuildMs } from './render/tactical/index.ts';
import { createSim } from './sim/index.ts';
import { areaOf, areaPending, clearParked, ensureArea, mapOf } from './sim/tactical/area.ts';
import { addZombie } from './sim/tactical/zombies.ts';
import type { InputFrame, JobId, ResourceId, ZombieKind } from './core/types.ts';
import { arrivalPos, generateSurvivor } from './sim/colony/survivors.ts';
import { supportAt } from './sim/tactical/collision.ts';
import { initWorld } from './sim/world/scenario.ts';
import { beginAt, findStartCandidates } from './sim/world/start.ts';
import { commandView } from './core/view.ts';
import { buildNow } from './sim/build/blueprints.ts';
import { createUi } from './ui/index.tsx';
import { loadGrid, loadScenario } from './worldData.ts';

const FIXED = BALANCE.time.fixedStep;

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const sim = createSim();
const store = createDefaultSaveStore();
const renderer = createRenderer(canvas, sim.events);
const stepper = createStepper({ fixedStep: FIXED, ...BALANCE.loop });

/** The running game, or null on the title screen. */
let state: GameState | null = null;

const input = createInput({ canvas, dispatch: sim.dispatch, getState: () => state, events: sim.events });

// ---------------------------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------------------------

function start(next: GameState): void {
  if (next !== suspended) clearParked(); // areas walked out of belong to the game that is ending
  state = next;
  stepper.reset();
  renderer.reset(next);
  ui.sync(state);
}

/** Static map; loaded on first use and handed to the sim and the UI. */
let grid: StaticGrid | null = null;
async function ensureGrid(): Promise<StaticGrid> {
  if (!grid) {
    grid = await loadGrid();
    sim.setGrid(grid);
    setRenderGrid(grid); // 07c: the renderer draws the neighbouring cells
    ui.setGrid(grid);
  }
  return grid;
}

/** A prepared new game that waits on the opening screen for its start location. */
let pending: GameState | null = null;

async function newGame(difficulty: Difficulty): Promise<boolean> {
  // Seed from the wall clock (or ?seed=123 for reproducible runs). Not part of the sim.
  const params = new URLSearchParams(location.search);
  const param = params.get('seed');
  const seed = (param !== null && Number.isFinite(Number(param)) ? Number(param) : Date.now()) >>> 0;
  const scenarioParam = Number(params.get('scenario') ?? NaN);
  const scenarioCount = BALANCE.infection.scenarioSeeds.length;
  const scenario = Number.isInteger(scenarioParam) && scenarioParam >= 0 && scenarioParam < scenarioCount ? scenarioParam : seed % scenarioCount;
  try {
    const g = await ensureGrid();
    const data = await loadScenario(scenario);
    const next = createInitialState(seed, difficulty);
    initWorld(next, g, data);
    const candidates = findStartCandidates(next.world.cells, g, stream(next, 'world.start'));
    pending = next;
    ui.setIntro({ scenario: data, candidates });
    return true;
  } catch (err) {
    console.warn('[data] failed to load the map', err);
    return false;
  }
}

function chooseStart(cell: CellId): void {
  if (!pending || !grid) return;
  const next = pending;
  pending = null;
  beginAt(next, grid, cell);
  ui.setIntro(null);
  start(next);
}

function cancelIntro(): void {
  pending = null;
  ui.setIntro(null);
}

/** The game that was running when the firing range was opened from its menu; "back to the game" resumes it. */
let suspended: GameState | null = null;

/**
 * Firing range (04; reachable from the title and the pause menu since 07b): no world, no saves.
 * `?range=1` opens it at boot. A running game is put aside (and autosaved), not ended.
 */
function openRange(): void {
  if (state && !state.flags.range) {
    void saveSlot(AUTO_SLOT);
    suspended = state;
  }
  const next = createInitialState(1, 1);
  next.flags.range = true;
  if (suspended) next.flags.rangeReturn = true;
  pending = null;
  ui.setIntro(null);
  start(next);
}

/** Leave the firing range: back to the suspended game if there is one, otherwise to the title. */
function leaveRange(): void {
  if (!state?.flags.range) return;
  const back = suspended;
  suspended = null;
  if (document.pointerLockElement) document.exitPointerLock();
  if (!back) {
    state = null;
    ui.sync(null);
    return;
  }
  // It was left in its menu; resume in the field.
  if (back.mode === 'menu') back.mode = 'tactical';
  start(back);
}

async function saveSlot(slot: SlotId): Promise<boolean> {
  if (!state || state.flags.range) return false;
  try {
    await saveGame(store, slot, state, Date.now());
    return true;
  } catch (err) {
    console.warn('[save] failed', err);
    return false;
  }
}

async function loadSlot(slot: SlotId): Promise<boolean> {
  try {
    const loaded = await loadGame(store, slot);
    if (!loaded) return false;
    const g = await ensureGrid();
    // Saves from before the world map existed (or for another grid) cannot be continued.
    if (loaded.world.gridW !== g.gridW || loaded.world.cells.Z.length !== g.gridW * g.gridH) return false;
    start(loaded);
    return true;
  } catch (err) {
    console.warn('[save] load failed', err);
    return false;
  }
}

function quitToTitle(): void {
  void saveSlot(AUTO_SLOT);
  suspended = null;
  if (document.pointerLockElement) document.exitPointerLock();
  state = null;
  ui.sync(null);
}

const ui = createUi(uiRoot, {
  dispatch: sim.dispatch,
  newGame,
  chooseStart,
  cancelIntro,
  loadSlot,
  saveSlot,
  listSaves: () => listSaves(store),
  quitToTitle,
  openRange,
  leaveRange,
  toggleMode: input.toggleMode,
  togglePause: input.togglePause,
});

// Autosave: every morning (spec §10), when the menu opens, and when the tab is hidden.
sim.events.on('hourStarted', (e) => {
  if (e.hour === BALANCE.save.autosaveHour) void saveSlot(AUTO_SLOT);
});
sim.events.on('modeChanged', (e) => {
  if (e.mode === 'menu') void saveSlot(AUTO_SLOT);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void saveSlot(AUTO_SLOT);
});
// Mode / speed changes should show up at once, not at the next 10 Hz sync.
sim.events.on('modeChanged', () => ui.sync(state));
sim.events.on('speedChanged', () => ui.sync(state));

// ---------------------------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------------------------

/** Debug / e2e: controls merged over the real input (headless browsers have no pointer lock). */
let debugInput: Partial<InputFrame> | null = null;
const ONE_SHOT = ['lookDX', 'lookDY', 'reload', 'stance', 'zoomDelta', 'zeroDelta', 'knife', 'interact'] as const;
let last = performance.now();
let uiTimer = 0;
let fps = 60;
/** Frames spent showing the loading screen for a pending operation area. */
let areaFrames = 0;

/** Main-thread time spent in sim + render submission, and the number of frames — debug / perf checks. */
let cpuMs = 0;
let frames = 0;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  runFrame(now);
  cpuMs += performance.now() - t0;
  frames++;
}

function runFrame(now: number): void {
  const realDt = Math.min((now - last) / 1000, 1);
  last = now;
  if (realDt > 0) fps += (1 / realDt - fps) * 0.05;

  const s = state;
  if (!s) return; // title screen: nothing to simulate or draw

  const inputFrame = debugInput ? { ...input.poll(), ...debugInput } : input.poll();
  sim.applyCommands(s); // commands must work while paused too
  const alpha = stepper.advance(realDt, effectiveSpeed(s), (first) => {
    if (areaPending(s, grid)) return; // wait for the loading frames below
    sim.tick(s, FIXED, first ? inputFrame : continuationFrame(inputFrame));
    if (first) {
      input.consume();
      if (debugInput) for (const k of ONE_SHOT) delete debugInput[k];
    }
  });
  if (state !== s) return; // a listener ended the session during the tick

  // Entering an operation area (new game, arrival, load): let the loading screen paint, then
  // generate the map. The sim would do the same inside its next tick, just without the notice.
  if (areaPending(s, grid)) {
    if (areaFrames === 0) ui.sync(s);
    if (++areaFrames > 2) {
      ensureArea(s, grid);
      areaFrames = 0;
      stepper.reset();
      ui.sync(s);
    }
  } else areaFrames = 0;

  renderer.draw(s, alpha, realDt);

  uiTimer += realDt;
  if (uiTimer >= 1 / BALANCE.loop.uiSyncHz) {
    uiTimer = 0;
    ui.sync(s, { fps, drawCalls: renderer.drawCalls() });
  }
}
requestAnimationFrame(frame);

{
  const params = new URLSearchParams(location.search);
  if (params.get('res') === 'fixed') renderer.setAutoResolution(false);
  if (params.get('range') === '1') openRange();
}

// Debug / e2e handle (read-only use; mutate through dispatch). `debug` bypasses the rules on
// purpose: it exists for screenshots and perf checks, never call it from game code.
interface DebugApi {
  /** Jump to the first cell of a land class (optionally the n-th), as if arriving by road. */
  gotoLand(land: string, nth?: number): number | null;
  /** Put the player at (x, z) on the ground (or at height y) and look along yaw / pitch (radians). */
  teleport(x: number, z: number, yaw?: number, pitch?: number, y?: number): void;
  setClock(hour: number): void;
  /** Last frame's draw calls / triangles, cumulative main-thread ms and frame count, and how long the last world build took. */
  renderInfo(): { calls: number; triangles: number; cpuMs: number; frames: number; buildMs: number };
  /** Hold these controls from now on (one-shot fields apply once); null releases them. */
  setInput(input: Partial<InputFrame> | null): void;
  /** Open the firing range (flat map, targets at 100..600 m). `noSway` holds the rifle perfectly still. */
  openRange(noSway?: boolean): void;
  /** Add n zombies in a ring of the given radius around the player (perf checks, screenshots). Returns how many were added. */
  spawnZombies(n: number, radius?: number, kind?: ZombieKind): number;
  /** Colony shortcuts (05): put n generated survivors on the roll with a job; add to the stores. Returns the ids. */
  addSurvivors(n: number, job?: JobId): number[];
  give(res: ResourceId, amount: number): void;
  /** Building shortcuts (06): put a finished structure down; schedule a horde of `size` from bearing `dir` (radians) arriving now. */
  build(def: string, tx: number, ty: number, rot?: number): number;
  horde(size: number, dir?: number): void;
  /** Research shortcuts (07): grant nodes with their prerequisites ('all' = one full route); add research points; set up everything for the declaration. */
  grantTech(ids: string[] | 'all'): string[];
  research(points: number): void;
  fulfilVictory(goal?: 'F9' | 'S9' | 'C9', capitol?: boolean): void;
  /** Overhead camera of the command layer (core/view.ts). */
  readonly view: typeof commandView;
  /** An empty input frame, for ticking the sim by hand. */
  readonly noInput: InputFrame;
}
declare global {
  interface Window {
    __game?: {
      readonly state: GameState | null;
      /** Generated operation area of the current cell (null on the road / before it is built). */
      readonly map: ReturnType<typeof mapOf>;
      dispatch: typeof sim.dispatch;
      sim: typeof sim;
      renderer: typeof renderer;
      debug: DebugApi;
    };
  }
}
window.__game = {
  get state() {
    return state;
  },
  get map() {
    return state ? mapOf(state) : null;
  },
  dispatch: sim.dispatch,
  sim,
  renderer,
  debug: {
    gotoLand(land, nth = 0) {
      if (!state || !grid) return null;
      const cells = grid.landIds.filter((id) => grid!.cells[id]!.land === land);
      const cell = cells[Math.min(cells.length - 1, nth)];
      if (cell === undefined) return null;
      state.world.travel = null;
      state.player.cell = cell;
      state.tactical = null;
      return cell;
    },
    teleport(x, z, yaw, pitch, y) {
      const map = state ? mapOf(state) : null;
      if (!state || !map) return;
      // Without y: stand on whatever is highest there (roof, stairs or ground).
      state.player.pos = [x, y ?? supportAt(map, x, z, Infinity), z];
      state.player.vel = [0, 0, 0];
      if (yaw !== undefined) state.player.yaw = yaw;
      if (pitch !== undefined) state.player.pitch = pitch;
    },
    setClock(hour) {
      if (!state) return;
      state.time.minute = Math.floor(hour * 60) % 1440;
      state.time.sub = 0;
    },
    setInput(next) {
      debugInput = next ? { ...debugInput, ...next } : null;
    },
    openRange(noSway = false) {
      openRange();
      if (state && noSway) state.flags.noSway = true;
    },
    spawnZombies(n, radius = 60, kind) {
      const area = state ? areaOf(state) : null;
      if (!state || !area) return 0;
      const kinds: ZombieKind[] = ['walker', 'walker', 'walker', 'runner', 'walker', 'brute', 'walker', 'crawler'];
      let added = 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = radius * (0.6 + 0.4 * ((i * 7919) % 13) / 13);
        const x = Math.min(1016, Math.max(8, state.player.pos[0] + Math.cos(a) * r));
        const z = Math.min(1016, Math.max(8, state.player.pos[2] + Math.sin(a) * r));
        if (addZombie(state, area, kind ?? kinds[i % kinds.length]!, x, z, a)) added++;
      }
      return added;
    },
    addSurvivors(n, job = 'idle') {
      if (!state || !grid) return [];
      const land = grid.cells[state.player.cell]?.land ?? 'rural';
      const ids: number[] = [];
      for (let i = 0; i < n; i++) {
        const s = generateSurvivor(state, land, stream(state, 'debug.people'));
        s.job = job;
        s.pos = arrivalPos(state);
        state.colony.survivors.push(s);
        ids.push(s.id);
      }
      return ids;
    },
    build(def, tx, ty, rot = 0) {
      return state ? buildNow(state, def, tx, ty, rot).id : -1;
    },
    horde(size, dir = 0) {
      if (!state || state.world.homeCell === null) return;
      state.world.cells.Z[state.world.homeCell] = Math.max(state.world.cells.Z[state.world.homeCell] ?? 0, size + 20);
      state.world.pendingHorde = { arrivesDay: state.time.day, arrivesMinute: state.time.minute, size, dir, warned: true };
    },
    grantTech(ids) {
      if (!state) return [];
      grantTech(state, ids === 'all' ? ALL_TECH_IDS : ids, (e) => sim.events.emit(e));
      return [...state.research.done];
    },
    research(points) {
      if (!state) return;
      state.colony.work.research += points;
      researchHour(state, (e) => sim.events.emit(e), grid);
    },
    fulfilVictory(goal = 'F9', capitol = true) {
      if (state && grid) debugFulfilVictory(state, grid, goal, capitol);
    },
    view: commandView,
    noInput: emptyInputFrame(),
    give(res, amount) {
      if (state) state.colony.stock[res] += amount;
    },
    renderInfo: () => ({ calls: renderer.ctx.renderer.info.render.calls, triangles: renderer.ctx.renderer.info.render.triangles, cpuMs, frames, buildMs: worldBuildMs() }),
  },
};
