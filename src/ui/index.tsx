// Preact root. `sync` is called by the main loop at ~10 Hz (and immediately on screen changes);
// GameState is mutated in place by the sim, so components simply re-read it on each sync.

import { render } from 'preact';
import type { GameState } from '../core/types.ts';
import { App } from './components/App.tsx';
import type { UiActions, UiSnapshot } from './store.ts';
import './styles.css';

export interface Ui {
  sync(state: GameState | null, perf?: { fps: number; drawCalls: number }): void;
}

export function createUi(root: HTMLElement, actions: UiActions): Ui {
  const snap: UiSnapshot = { state: null, rev: 0, fps: 0, drawCalls: 0 };
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
  };
}
