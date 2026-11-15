import type { UiActions, UiSnapshot } from '../store.ts';
import { Intro } from '../world/Intro.tsx';
import { Hud } from './Hud.tsx';
import { areaPending } from '../../sim/tactical/area.ts';
import { AreaLoading, CommandLayer, DefeatOverlay, MenuOverlay, TacticalLayer, WorldLayer } from './modes.tsx';
import { TitleScreen } from './TitleScreen.tsx';

export function App({ snap, actions }: { snap: UiSnapshot; actions: UiActions }) {
  const state = snap.state;
  if (!state) {
    if (snap.intro && snap.grid) return <Intro intro={snap.intro} grid={snap.grid} actions={actions} />;
    return <TitleScreen actions={actions} />;
  }
  const props = { state, actions, grid: snap.grid };
  return (
    <div class="game-ui" data-mode={state.mode}>
      <Hud state={state} fps={snap.fps} drawCalls={snap.drawCalls} actions={actions} />
      {state.mode === 'tactical' && <TacticalLayer {...props} />}
      {state.mode === 'command' && <CommandLayer {...props} />}
      {state.mode === 'world' && <WorldLayer {...props} />}
      {state.mode === 'menu' && <MenuOverlay {...props} />}
      {state.flags.defeat && state.mode !== 'menu' && <DefeatOverlay {...props} />}
      {state.mode !== 'world' && areaPending(state, snap.grid) && <AreaLoading />}
    </div>
  );
}
