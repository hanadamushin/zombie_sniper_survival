// Keyboard + mouse (Pointer Lock) -> InputFrame for the sim, and UI-level keys -> Commands.
// Touch controls are added by session 10 behind the same interface.
//
// Real-time controls are only sampled in the tactical mode; the pointer is locked only there.

import type { Command } from '../core/commands.ts';
import type { EventBus } from '../core/events.ts';
import { emptyInputFrame, type GameState, type InputFrame, type Mode, type Speed } from '../core/types.ts';
import { actionForCode, SPEED_KEYS, type Action } from './bindings.ts';

export interface InputDeps {
  canvas: HTMLCanvasElement;
  dispatch(cmd: Command): void;
  /** Current game state, or null on the title screen. */
  getState(): GameState | null;
  events: EventBus;
}

export interface Input {
  /** Current frame: held controls + one-shot deltas accumulated since the last consume(). */
  poll(): InputFrame;
  /** Clear the one-shot parts. Call after a sim step has received them. */
  consume(): void;
  /** Toggle helpers shared with on-screen buttons. */
  toggleMode(target: 'command' | 'world' | 'menu'): void;
  togglePause(): void;
  dispose(): void;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function createInput(deps: InputDeps): Input {
  const { canvas, dispatch, getState, events } = deps;
  const held = new Set<Action>();
  const frame = emptyInputFrame();
  let fireHeld = false;
  let scopeHeld = false;
  /** Speed to return to when un-pausing with Space. */
  let resumeSpeed: Speed = 1;
  /** Modes to return to when the world map / menu is closed. */
  let beforeWorld: Mode = 'tactical';
  let beforeMenu: Mode = 'tactical';

  const locked = (): boolean => document.pointerLockElement === canvas;
  const tactical = (): boolean => getState()?.mode === 'tactical';

  const requestLock = (): void => {
    if (locked()) return;
    try {
      // May reject (no user gesture, headless): the game stays usable, just without mouse look.
      void Promise.resolve(canvas.requestPointerLock()).catch(() => {});
    } catch {
      /* unsupported */
    }
  };

  const clearHeld = (): void => {
    held.clear();
    fireHeld = false;
    scopeHeld = false;
  };

  const toggleMode = (target: 'command' | 'world' | 'menu'): void => {
    const state = getState();
    if (!state) return;
    const mode = state.mode;
    let next: Mode;
    if (target === 'command') next = mode === 'command' ? 'tactical' : 'command';
    else if (mode === target) next = target === 'menu' ? beforeMenu : beforeWorld;
    else next = target;
    dispatch({ type: 'setMode', mode: next });
    // Request the lock inside the user gesture; the modeChanged handler alone may be too late.
    if (next === 'tactical') requestLock();
  };

  const togglePause = (): void => {
    const state = getState();
    if (!state) return;
    if (state.time.speed === 0) dispatch({ type: 'setSpeed', speed: resumeSpeed });
    else {
      resumeSpeed = state.time.speed;
      dispatch({ type: 'setSpeed', speed: 0 });
    }
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const state = getState();
    if (!state || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const action = actionForCode(e.code);
    if (!action) return;
    e.preventDefault(); // Tab focus change, Space scroll, ...
    if (e.repeat) return;
    held.add(action);

    switch (action) {
      case 'toggleCommand': toggleMode('command'); return;
      case 'toggleWorld': toggleMode('world'); return;
      case 'menu': toggleMode('menu'); return;
      case 'pause': togglePause(); return;
      case 'speed1':
      case 'speed2':
      case 'speed3': dispatch({ type: 'setSpeed', speed: SPEED_KEYS[action] }); return;
      default: break;
    }
    if (state.mode !== 'tactical') return;
    switch (action) {
      case 'reload': frame.reload = true; break;
      case 'knife': frame.knife = true; break;
      case 'interact': frame.interact = true; break;
      case 'crouch': frame.stance = state.player.stance === 'crouch' ? 'stand' : 'crouch'; break;
      case 'prone': frame.stance = state.player.stance === 'prone' ? 'stand' : 'prone'; break;
      case 'zeroUp': frame.zeroDelta += 1; break;
      case 'zeroDown': frame.zeroDelta -= 1; break;
      default: break;
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    const action = actionForCode(e.code);
    if (action) held.delete(action);
  };

  const onMouseDown = (e: MouseEvent): void => {
    if (!tactical()) return;
    if (!locked()) {
      requestLock(); // first click only captures the mouse
      return;
    }
    if (e.button === 0) fireHeld = true;
    if (e.button === 2) scopeHeld = true;
  };
  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) fireHeld = false;
    if (e.button === 2) scopeHeld = false;
  };
  const onMouseMove = (e: MouseEvent): void => {
    if (!locked() || !tactical()) return;
    frame.lookDX += e.movementX;
    frame.lookDY += e.movementY;
  };
  const onWheel = (e: WheelEvent): void => {
    if (!tactical()) return;
    e.preventDefault();
    frame.zoomDelta += e.deltaY < 0 ? 1 : e.deltaY > 0 ? -1 : 0;
  };
  const onContextMenu = (e: Event): void => e.preventDefault();

  const onLockChange = (): void => {
    if (locked()) return;
    clearHeld();
    // The browser released the pointer (Esc) while playing: open the menu.
    if (tactical()) dispatch({ type: 'setMode', mode: 'menu' });
  };
  const onBlur = (): void => clearHeld();

  const offMode = events.on('modeChanged', (e) => {
    if (e.mode === 'menu') beforeMenu = e.prev;
    if (e.mode === 'world' && e.prev !== 'menu') beforeWorld = e.prev;
    if (e.mode === 'tactical') requestLock();
    else {
      clearHeld();
      if (locked()) document.exitPointerLock();
    }
  });

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    poll() {
      const active = tactical();
      const has = (a: Action): boolean => active && held.has(a);
      frame.moveX = (has('right') ? 1 : 0) - (has('left') ? 1 : 0);
      frame.moveZ = (has('forward') ? 1 : 0) - (has('back') ? 1 : 0);
      frame.fire = active && fireHeld;
      frame.scope = active && scopeHeld;
      // Shift: hold breath while scoped, sprint otherwise.
      const shift = has('sprintOrBreath');
      frame.holdBreath = shift && frame.scope;
      frame.sprint = shift && !frame.scope;
      return frame;
    },
    consume() {
      frame.lookDX = 0;
      frame.lookDY = 0;
      frame.reload = false;
      frame.stance = null;
      frame.zoomDelta = 0;
      frame.zeroDelta = 0;
      frame.knife = false;
      frame.interact = false;
    },
    toggleMode,
    togglePause,
    dispose() {
      offMode();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
