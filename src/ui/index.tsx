// Preact root. `sync` is called by the main loop at ~10 Hz (and immediately on screen changes);
// GameState is mutated in place by the sim, so components simply re-read it on each sync.

import { render } from 'preact';
import type { GameState, StaticGrid } from '../core/types.ts';
import { App } from './components/App.tsx';
import type { IntroData, UiActions, UiSnapshot } from './store.ts';
import { t } from './i18n/ja.ts';
import './styles.css';

export interface Ui {
  sync(state: GameState | null, perf?: { fps: number; drawCalls: number }): void;
  setGrid(grid: StaticGrid | null): void;
  /** Show (or hide, with null) the opening: timelapse and start selection. */
  setIntro(intro: IntroData | null): void;
}

export function createUi(root: HTMLElement, actions: UiActions): Ui {
  const snap: UiSnapshot = { grid: null, intro: null, state: null, rev: 0, fps: 0, drawCalls: 0 };
  // The display name lives in one place (ja.ts 'app.title'); the browser tab follows it.
  document.title = t('app.title');
  const paint = (): void => render(<App snap={{ ...snap }} actions={actions} />, root);
  paint();
  return {
    sync(state, perf) {
      snap.state = state;
      snap.rev++;
      if (perf) {
        snap.fps = perf.fps;
        snap.drawCalls = perf.drawCalls;
      }
      paint();
    },
    setGrid(grid) {
      snap.grid = grid;
      paint();
    },
    setIntro(intro) {
      snap.intro = intro;
      paint();
    },
  };
}
