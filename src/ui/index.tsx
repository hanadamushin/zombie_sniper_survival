// Preact root. `sync` is called by the main loop at ~10 Hz (and immediately on screen changes);
// GameState is mutated in place by the sim, so components simply re-read it on each sync.
// `frame` runs every animation frame for the few gauges that must move smoothly (live.ts).

import { render } from 'preact';
import type { EventBus } from '../core/events.ts';
import type { GameState, StaticGrid } from '../core/types.ts';
import { App } from './components/App.tsx';
import type { IntroData, UiActions, UiSnapshot } from './store.ts';
import { t } from './i18n/ja.ts';
import { liveFrame } from './live.ts';
import { createNotifier, type Notifier } from './notify.ts';
import { watchGuide } from './guide.ts';
import type { UiServices } from './components/common.tsx';
import './styles.css';

export interface Ui {
  sync(state: GameState | null, perf?: { fps: number; drawCalls: number }): void;
  /** Every animation frame: smooth gauges. */
  frame(state: GameState, realDt: number): void;
  setGrid(grid: StaticGrid | null): void;
  /** Show (or hide, with null) the opening: timelapse and start selection. */
  setIntro(intro: IntroData | null): void;
  /** A different game is now running (new, loaded, or back from the range): forget its notices. */
  reset(): void;
  readonly notifier: Notifier;
}

export interface UiDeps {
  events: EventBus;
  /** Button clicks make a small sound. */
  click?(): void;
}

export function createUi(root: HTMLElement, actions: UiActions, deps: UiDeps): Ui {
  const snap: UiSnapshot = { grid: null, intro: null, state: null, rev: 0, fps: 0, drawCalls: 0 };
  // The display name lives in one place (ja.ts 'app.title'); the browser tab follows it.
  document.title = t('app.title');
  let painting = false;
  const notifier = createNotifier(deps.events, () => snap.state, () => snap.grid, () => {
    if (!painting) queueMicrotask(paint);
  });
  const services: UiServices = { notifier };
  function paint(): void {
    painting = true;
    try {
      render(<App snap={{ ...snap }} actions={actions} services={services} />, root);
    } finally {
      painting = false;
    }
  }
  if (deps.click) {
    const click = deps.click;
    root.addEventListener('click', (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('button')) click();
    });
  }
  paint();
  return {
    notifier,
    sync(state, perf) {
      snap.state = state;
      snap.rev++;
      if (perf) {
        snap.fps = perf.fps;
        snap.drawCalls = perf.drawCalls;
      }
      if (state) watchGuide(state, actions.dispatch, state);
      paint();
    },
    frame(state, realDt) {
      liveFrame(state, realDt);
    },
    setGrid(grid) {
      snap.grid = grid;
      paint();
    },
    setIntro(intro) {
      snap.intro = intro;
      paint();
    },
    reset() {
      notifier.reset();
    },
  };
}
