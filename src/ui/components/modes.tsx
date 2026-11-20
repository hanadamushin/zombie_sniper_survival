// One frame per mode:
//   TacticalLayer — the first-person HUD (Tactical.tsx)
//   CommandLayer  — the overhead view: tab bar, docked panel, build cursor (command/)
//   WorldLayer    — strategic map (world/)
//   MenuOverlay   — pause menu, saves, settings, help (Menu.tsx)
// and the results: defeat and the declaration of the nation.

import { useEffect, useState } from 'preact/hooks';
import { AUTO_SLOT, type SaveMeta } from '../../core/save.ts';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { t } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { WorldMap } from '../world/WorldMap.tsx';
import { BuildGround, NO_TOOL, type BuildTool } from '../command/build.tsx';
import { CommandPanel } from '../command/CommandPanel.tsx';
import { endingStats } from '../../sim/research/victory.ts';
import { tk } from '../command/format.ts';
import { Banner, Toasts } from './common.tsx';
import { saveSummary } from './TitleScreen.tsx';

export { TacticalLayer } from './Tactical.tsx';
export { MenuOverlay } from './Menu.tsx';

interface ModeProps {
  state: GameState;
  actions: UiActions;
  /** Static map (null until loaded). */
  grid: StaticGrid | null;
}

/** Shown while the operation area of the current cell is being generated. */
export function AreaLoading() {
  return (
    <div class="mode-layer loading" data-testid="area-loading">
      <div class="panel">{t('tactical.loading')}</div>
    </div>
  );
}

export function CommandLayer(props: ModeProps) {
  // The build tool is shared by the palette in the panel and the sheet over the 3D view (06).
  const [tool, setTool] = useState<BuildTool>(NO_TOOL);
  return (
    <div class="mode-layer command" data-testid="mode-command">
      <BuildGround state={props.state} actions={props.actions} tool={tool} setTool={setTool} />
      <CommandPanel {...props} tool={tool} setTool={setTool} />
      <Toasts />
      <Banner />
    </div>
  );
}

/**
 * The game is lost (the player died with nobody left, or the headquarters fell). The autosave is
 * not overwritten after a defeat (main.ts), so the game can be picked up from the last morning.
 */
export function DefeatOverlay({ state, actions }: ModeProps) {
  const [auto, setAuto] = useState<SaveMeta | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    actions.listSaves().then((list) => alive && setAuto(list.find((m) => m.slot === AUTO_SLOT) ?? null), () => alive && setAuto(null));
    return () => {
      alive = false;
    };
  }, [actions]);
  return (
    <div class="mode-layer menu defeat" data-testid="defeat">
      <div class="panel menu-panel result-panel">
        <h2>{t('hud.defeat')}</h2>
        <p data-testid="defeat-lead">{t(state.build.structures.some((b) => b.def === 'hq' && b.ruinUntil !== undefined) ? 'hud.defeatHq' : 'hud.defeatLead')}</p>
        <p class="status">{t('hud.defeatDays', { day: state.time.day })}</p>
        <StatList state={state} defeat />
        {auto ? (
          <button class="primary" data-testid="defeat-retry" onClick={() => void actions.loadSlot(AUTO_SLOT).then((ok) => setFailed(!ok))}>
            {t('defeat.retry')}
            <small> — {saveSummary(auto)}</small>
          </button>
        ) : auto === null ? (
          <p class="note">{t('defeat.noRetry')}</p>
        ) : null}
        {failed && <p class="error">{t('title.loadFailed')}</p>}
        <button data-testid="defeat-title" onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
      </div>
    </div>
  );
}

/** The record of a game: shown on the ending and on the defeat screen. */
function StatList({ state, defeat }: { state: GameState; defeat?: boolean }) {
  const s = endingStats(state);
  return (
    <ul class="stat-list" data-testid="end-stats">
      <li>{defeat ? t('defeat.stats.days', { n: s.days }) : t('ending.days', { n: s.days, day: s.day })}</li>
      <li>{t('ending.kills', { n: s.kills })}</li>
      <li>{t('ending.headshots', { pct: Math.round(s.headshotRate * 100), shots: s.shots })}</li>
      <li>{t('ending.survivors', { n: s.survivors })}</li>
      <li>{t('ending.lost', { n: s.lost })}</li>
      <li>{t('ending.outposts', { n: s.outposts })}</li>
      <li>{t('ending.techs', { n: s.techs })}</li>
    </ul>
  );
}

/** The nation has been declared (07). The goal technology names the ending; the game goes on afterwards. */
export function EndingOverlay({ state, actions }: ModeProps) {
  const v = state.research.victory!;
  return (
    <div class="mode-layer menu ending" data-testid="ending" data-tech={v.tech}>
      <div class="panel menu-panel result-panel">
        <h2>{t('ending.title')}</h2>
        <p class="status">{tk(`tech.${v.tech}`)}</p>
        <p data-testid="ending-text">{tk(`ending.${v.tech}`)}</p>
        <h3>{t('ending.stats')}</h3>
        <StatList state={state} />
        <button class="primary" data-testid="ending-continue" onClick={() => actions.dispatch({ type: 'dismissEnding' })}>{t('ending.continue')}</button>
        <button onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
      </div>
    </div>
  );
}

export function WorldLayer({ state, actions, grid }: ModeProps) {
  return (
    <>
      <WorldMap state={state} grid={grid} actions={actions} />
      <Toasts />
    </>
  );
}
