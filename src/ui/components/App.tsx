import type { UiActions, UiSnapshot } from '../store.ts';
import { Intro } from '../world/Intro.tsx';
import { Hud } from './Hud.tsx';
import { areaPending } from '../../sim/tactical/area.ts';
import { AreaLoading, CommandLayer, DefeatOverlay, EndingOverlay, MenuOverlay, TacticalLayer, WorldLayer } from './modes.tsx';
import { TitleScreen } from './TitleScreen.tsx';
import { Services, type UiServices } from './common.tsx';

export function App({ snap, actions, services }: { snap: UiSnapshot; actions: UiActions; services: UiServices }) {
  const state = snap.state;
  if (!state) {
    if (snap.intro && snap.grid) return <Intro intro={snap.intro} grid={snap.grid} actions={actions} />;
    return <TitleScreen actions={actions} />;
  }
  const props = { state, actions, grid: snap.grid };
  const scoped = state.mode === 'tactical' && state.player.aim.scopeT > 0.5;
  return (
    <Services.Provider value={services}>
      <div class="game-ui" data-mode={state.mode} data-scoped={scoped}>
        {state.mode === 'tactical' && <TacticalLayer {...props} />}
        {state.mode === 'command' && <CommandLayer {...props} />}
        {state.mode === 'world' && <WorldLayer {...props} />}
        <Hud state={state} fps={snap.fps} drawCalls={snap.drawCalls} actions={actions} />
        {state.mode === 'menu' && <MenuOverlay {...props} />}
        {state.flags.defeat && state.mode !== 'menu' && <DefeatOverlay {...props} />}
        {state.research.victory && !state.flags.endingSeen && !state.flags.defeat && state.mode !== 'menu' && <EndingOverlay {...props} />}
        {state.mode !== 'world' && areaPending(state, snap.grid) && <AreaLoading />}
      </div>
    </Services.Provider>
  );
}
