// Bootstrap + fixed-step game loop (docs/04_architecture.md §4).
//
// Wiring only: sim (pure logic) <- commands - input / ui
//              sim - events -> render / ui / audio / autosave
// Session lifecycle (new game / load / save / quit) lives here because it replaces the
// GameState object that everything else reads.

import { createStepper } from './core/loop.ts';
import { AUTO_SLOT, createDefaultSaveStore, listSaves, loadGame, saveGame, type SlotId } from './core/save.ts';
import { effectiveSpeed } from './core/time.ts';
import { continuationFrame, createInitialState, type Difficulty, type GameState } from './core/types.ts';
import { BALANCE } from './data/balance.ts';
import { createInput } from './input/index.ts';
import { createRenderer } from './render/index.ts';
import { createSim } from './sim/index.ts';
import { createUi } from './ui/index.tsx';

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
  state = next;
  stepper.reset();
  renderer.reset(next);
  ui.sync(state);
}

function newGame(difficulty: Difficulty): void {
  // Seed from the wall clock (or ?seed=123 for reproducible runs). Not part of the sim.
  const param = new URLSearchParams(location.search).get('seed');
  const seed = param !== null && Number.isFinite(Number(param)) ? Number(param) : Date.now();
  start(createInitialState(seed >>> 0, difficulty));
}

async function saveSlot(slot: SlotId): Promise<boolean> {
  if (!state) return false;
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
    start(loaded);
    return true;
  } catch (err) {
    console.warn('[save] load failed', err);
    return false;
  }
}

function quitToTitle(): void {
  void saveSlot(AUTO_SLOT);
  if (document.pointerLockElement) document.exitPointerLock();
  state = null;
  ui.sync(null);
}

const ui = createUi(uiRoot, {
  dispatch: sim.dispatch,
  newGame,
  loadSlot,
  saveSlot,
  listSaves: () => listSaves(store),
  quitToTitle,
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

let last = performance.now();
let uiTimer = 0;
let fps = 60;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const realDt = Math.min((now - last) / 1000, 1);
  last = now;
  if (realDt > 0) fps += (1 / realDt - fps) * 0.05;

  const s = state;
  if (!s) return; // title screen: nothing to simulate or draw

  const inputFrame = input.poll();
  sim.applyCommands(s); // commands must work while paused too
  const alpha = stepper.advance(realDt, effectiveSpeed(s), (first) => {
    sim.tick(s, FIXED, first ? inputFrame : continuationFrame(inputFrame));
    if (first) input.consume();
  });
  if (state !== s) return; // a listener ended the session during the tick

  renderer.draw(s, alpha, realDt);

  uiTimer += realDt;
  if (uiTimer >= 1 / BALANCE.loop.uiSyncHz) {
    uiTimer = 0;
    ui.sync(s, { fps, drawCalls: renderer.drawCalls() });
  }
}
requestAnimationFrame(frame);

// Debug / e2e handle (read-only use; mutate through dispatch).
declare global {
  interface Window {
    __game?: { readonly state: GameState | null; dispatch: typeof sim.dispatch; sim: typeof sim };
  }
}
window.__game = {
  get state() {
    return state;
  },
  dispatch: sim.dispatch,
  sim,
};
