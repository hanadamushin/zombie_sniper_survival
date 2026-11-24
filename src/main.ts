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
import { loadRealIndex, pumpRealLoads, realLoadTimes } from './realData.ts';
import { enterableStats, worldBuildMs, worldPending } from './render/tactical/index.ts';
import { enterableStageOf, enterableUpgradeMaxMs } from './render/tactical/enterables.ts';
import { indoorPath } from './sim/tactical/indoor.ts';
import { TACTICAL } from './data/tactical.ts';
import { detailOf } from './gen/buildings/index.ts';
import { createSim } from './sim/index.ts';
import { areaOf, areaPending, clearParked, ensureArea, mapOf } from './sim/tactical/area.ts';
import { addZombie } from './sim/tactical/zombies.ts';
import { landmarkYardOf } from './sim/tactical/yard.ts';
import type { InputFrame, JobId, ResourceId, ZombieKind } from './core/types.ts';
import { arrivalPos, generateSurvivor } from './sim/colony/survivors.ts';
import { supportAt } from './sim/tactical/collision.ts';
import { initWorld } from './sim/world/scenario.ts';
import { beginAt, findStartCandidates } from './sim/world/start.ts';
import { commandView } from './core/view.ts';
import { buildNow } from './sim/build/blueprints.ts';
import { createUi } from './ui/index.tsx';
import { loadGrid, loadScenario } from './worldData.ts';
import { createAudio } from './audio/index.ts';
import { onSettings, settings } from './settings.ts';

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
// 08: synthesised sound; starts on the first key press or click.
const audio = createAudio({ events: sim.events, getState: () => state, getGrid: () => grid });

// ---------------------------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------------------------

function start(next: GameState): void {
  if (next !== suspended) clearParked(); // areas walked out of belong to the game that is ending
  state = next;
  stepper.reset();
  renderer.reset(next);
  ui.reset();
  ui.sync(state);
}

/** Static map; loaded on first use and handed to the sim and the UI. */
let grid: StaticGrid | null = null;
async function ensureGrid(): Promise<StaticGrid> {
  if (!grid) {
    grid = await loadGrid();
    await loadRealIndex(grid); // R0: which cells have real-map areas
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
function openRange(yard: boolean | 2 | 3 | 4 = false, region = 0): void {
  if (state && !state.flags.range) {
    void saveSlot(AUTO_SLOT);
    suspended = state;
  }
  const next = createInitialState(1, 1);
  next.flags.range = true;
  if (yard === 4) next.flags.landmarks = region; // L6: the landmark yard of LANDMARK_REGIONS[region]
  if (yard) next.flags.yard = yard; // 07d-2e: 2 = the big yard (stations of the big cities, airports); 07d-2f: 3 = the big Self-Defense Force sites
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
  // 08: a lost game never overwrites the autosave, so the defeat screen can offer to pick up from it.
  if (state.flags.defeat && slot === AUTO_SLOT) return false;
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
  openRange: () => openRange(),
  leaveRange,
  toggleMode: input.toggleMode,
  togglePause: input.togglePause,
  audioTest: () => audio.test(),
  audioState: () => audio.status().state,
}, { events: sim.events, click: () => audio.ui('click') });

// 08: settings that the renderer applies (the input layer and the audio read theirs directly).
const applyQuality = (): void => {
  if (new URLSearchParams(location.search).get('res') === 'fixed') return; // tests and screenshots
  if (settings.autoResolution) renderer.setAutoResolution(true);
  else renderer.setFixedScale(settings.renderScale);
};
applyQuality();
onSettings(applyQuality);
// Mode changes sound like turning a page; the menu like opening one.
sim.events.on('modeChanged', (e) => audio.ui(e.mode === 'menu' ? 'open' : e.prev === 'menu' ? 'close' : 'click'));

/** 08: a very short stop of the world when the player's round takes a head (never a slow motion). */
let hitstop = 0;
sim.events.on('zombieKilled', (e) => {
  if (e.by !== 'player' || !e.headshot || e.knife || !state) return;
  const p = state.player.pos;
  const range = Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]);
  hitstop = Math.max(hitstop, range >= BALANCE.feel.hitstopFarRange ? BALANCE.feel.hitstopFar : BALANCE.feel.hitstop);
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
  if (!s) {
    audio.frame(null, realDt);
    return; // title screen: nothing to simulate or draw
  }

  const inputFrame = debugInput ? { ...input.poll(), ...debugInput } : input.poll();
  sim.applyCommands(s); // commands must work while paused too
  // Hit stop (08): the world holds still for a few hundredths of a second; drawing goes on.
  const simDt = hitstop > 0 ? 0 : realDt;
  hitstop = Math.max(0, hitstop - realDt);
  const alpha = stepper.advance(simDt, effectiveSpeed(s), (first) => {
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
  pumpRealLoads(); // R0: real-map areas the sim has asked for
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
  ui.frame(s, realDt);
  audio.frame(s, realDt);

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
  if (params.get('yard') === '1') openRange(true);
  if (params.get('yard') === '2') openRange(2);
  if (params.get('yard') === '3') openRange(3);
  // L1: the landmark yard. L6: one per region (`?landmarks=chugoku`); `1` is the first (hokkaido).
  const lm = params.get('landmarks');
  if (lm) openRange(4, Math.max(0, landmarkYardOf(lm)));
}

// Debug / e2e handle (read-only use; mutate through dispatch). `debug` bypasses the rules on
// purpose: it exists for screenshots and perf checks, never call it from game code.
interface DebugApi {
  /** Jump to the first cell of a land class (optionally the n-th), as if arriving by road. */
  gotoLand(land: string, nth?: number): number | null;
  /** R0: go to a cell (by id, or the cell holding lat / lon); returns the cell or null for the sea. */
  gotoCell(cell: number): number | null;
  gotoLatLon(lat: number, lon: number): number | null;
  /** R0: real-map data of the current map (null: random layout), its facilities and the last area load times (ms). */
  realInfo(): { cell: number; real: boolean; pois: { kind: number; name: string; x: number; z: number }[]; loadMs: number[] } | null;
  /** Put the player at (x, z) on the ground (or at height y) and look along yaw / pitch (radians). */
  teleport(x: number, z: number, yaw?: number, pitch?: number, y?: number): void;
  setClock(hour: number): void;
  /** Last frame's draw calls / triangles, cumulative main-thread ms and frame count, how long the last world build took, and neighbour parts still to build (07c). */
  renderInfo(): { calls: number; triangles: number; cpuMs: number; frames: number; buildMs: number; pending: number };
  /** Hold these controls from now on (one-shot fields apply once); null releases them. */
  setInput(input: Partial<InputFrame> | null): void;
  /** Open the firing range (flat map, targets at 100..600 m). `noSway` holds the rifle perfectly still. */
  openRange(noSway?: boolean): void;
  /** 07d: open the building yard (every enterable building type on flat ground; flags.range + flags.yard). 07d-2e: `big` opens the yard of the types too big for it (flags.yard = 2); 07d-2f: 3 the yard of the big Self-Defense Force sites. L1: 4 the landmark yard (`?landmarks=1`). L6: of the region `region` (hokkaido … kyushu; `?landmarks=<region>`). */
  openYard(big?: boolean | 3 | 4, region?: string): void;
  /** 07d: the enterable buildings of the current map: placement, world rooms and nav links (generated on demand). */
  enterables(): { i: number; def: string; x0: number; z0: number; x1: number; z1: number; base: number; rot: number }[];
  enterable(i: number): ReturnType<typeof detailOf> | null;
  /** 07d: buildings drawn at each stage (far, mid, near) on all maps, those waiting, and the slowest stage change so far (ms). */
  enterableStages(reset?: boolean): { far: number; mid: number; near: number; pending: number; maxMs: number };
  /** 07d: the stage (0 far, 1 outside, 2 inside) the current map's i-th enterable building is drawn at. */
  enterableStage(i: number): number;
  /** 07d: waypoints (feet) from the player to (x, y, z) through the buildings on the way, or null. */
  pathTo(x: number, y: number, z: number): [number, number, number][] | null;
  /** 07d: put one zombie at (x, z); `chase` sets it after the player. Returns its id. */
  placeZombie(x: number, z: number, kind?: ZombieKind, chase?: boolean): number;
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
  /** 08: average ms of one UI paint (the 10 Hz sync), over n paints. */
  uiPaintMs(n?: number): number;
  /** 08: whether the AudioContext is running (it starts on the first key press or click). */
  audioRunning(): boolean;
  /** 08: AudioContext state and the output peak right now. */
  audioStatus(): { state: string; peak: number };
  /** 08: play the settings screen's test sound (a shot and the bolt). */
  audioTest(): void;
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
    gotoCell(cell) {
      if (!state || !grid || !grid.cells[cell]) return null;
      state.world.travel = null;
      state.player.cell = cell;
      state.tactical = null;
      return cell;
    },
    gotoLatLon(lat, lon) {
      if (!grid) return null;
      const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
      const cell = Math.floor(((latTop - lat) * kmPerLat) / grid.cellKm) * grid.gridW + Math.floor(((lon - lon0) * kmPerLon) / grid.cellKm);
      return window.__game!.debug.gotoCell(cell);
    },
    realInfo() {
      const map = state ? mapOf(state) : null;
      if (!state || !map) return null;
      return { cell: state.player.cell, real: Boolean(map.params.real), pois: (map.pois ?? []).map((p) => ({ kind: p.kind, name: p.name, x: p.x, z: p.z })), loadMs: [...realLoadTimes] };
    },
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
      state.player.aim.airPeak = null; // L1: a jump of the debug camera is not a fall
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
    openYard(big = false, region = 'hokkaido') {
      openRange(big === 4 ? 4 : big === 3 ? 3 : big ? 2 : true, Math.max(0, landmarkYardOf(region)));
    },
    enterables() {
      const map = state ? mapOf(state) : null;
      return (map?.placements ?? []).map((p, i) => ({ i, def: p.def, x0: p.x0, z0: p.z0, x1: p.x1, z1: p.z1, base: p.base, rot: p.rot }));
    },
    enterable(i) {
      const map = state ? mapOf(state) : null;
      const p = map?.placements[i];
      return p ? detailOf(p) : null;
    },
    enterableStage(i) {
      const map = state ? mapOf(state) : null;
      return map ? enterableStageOf(map, i) : -1;
    },
    pathTo(x, y, z) {
      const map = state ? mapOf(state) : null;
      return state && map ? indoorPath(map, state.player.pos, [x, y, z], TACTICAL.player.radius) : null;
    },
    placeZombie(x, z, kind = 'walker', chase = false) {
      const area = state ? areaOf(state) : null;
      if (!state || !area) return -1;
      const zb = addZombie(state, area, kind, x, z, 0);
      if (!zb) return -1;
      if (chase) {
        zb.state = 'chase';
        zb.target = 'player';
        zb.goal = [state.player.pos[0], state.player.pos[2]];
      }
      return zb.id;
    },
    enterableStages(reset = false) {
      return { ...enterableStats(), maxMs: enterableUpgradeMaxMs(reset) };
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
    audioRunning: () => audio.running(),
    audioStatus: () => audio.status(),
    audioTest: () => audio.test(),
    uiPaintMs(n = 20) {
      if (!state) return 0;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) ui.sync(state);
      return (performance.now() - t0) / n;
    },
    give(res, amount) {
      if (state) state.colony.stock[res] += amount;
    },
    renderInfo: () => ({ calls: renderer.ctx.renderer.info.render.calls, triangles: renderer.ctx.renderer.info.render.triangles, cpuMs, frames, buildMs: worldBuildMs(), pending: worldPending() }),
  },
};
