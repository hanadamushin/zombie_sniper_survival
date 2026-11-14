import type { UiActions, UiSnapshot } from '../store.ts';
import { Hud } from './Hud.tsx';
import { CommandLayer, MenuOverlay, TacticalLayer, WorldLayer } from './modes.tsx';
import { TitleScreen } from './TitleScreen.tsx';

export function App({ snap, actions }: { snap: UiSnapshot; actions: UiActions }) {
  const state = snap.state;
  if (!state) return <TitleScreen actions={actions} />;
  const props = { state, actions };
  return (
    <div class="game-ui" data-mode={state.mode}>
      <Hud state={state} fps={snap.fps} drawCalls={snap.drawCalls} actions={actions} />
      {state.mode === 'tactical' && <TacticalLayer {...props} />}
      {state.mode === 'command' && <CommandLayer {...props} />}
      {state.mode === 'world' && <WorldLayer {...props} />}
      {state.mode === 'menu' && <MenuOverlay {...props} />}
    </div>
  );
}
