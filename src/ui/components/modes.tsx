// One frame per mode. These are the mount points for later sessions:
//   TacticalLayer — crosshair, ammo, stance, scope overlay hooks (04 / 08)
//   CommandLayer  — survivors, build menu, research, ledger, log panels (05 / 06 / 07)
//   WorldLayer    — strategic map canvas (02)
//   MenuOverlay   — pause menu, save slots, settings (08)

import { useState } from 'preact/hooks';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { t } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { WorldMap } from '../world/WorldMap.tsx';
import { slotLabel } from './TitleScreen.tsx';

interface ModeProps {
  state: GameState;
  actions: UiActions;
  /** Static map (null until loaded). */
  grid: StaticGrid | null;
}

export function TacticalLayer(_props: ModeProps) {
  return (
    <div class="mode-layer tactical" data-testid="mode-tactical">
      <div class="crosshair" />
      <p class="hint">{t('tactical.clickToAim')}</p>
    </div>
  );
}

export function CommandLayer(_props: ModeProps) {
  return (
    <div class="mode-layer command" data-testid="mode-command">
      <div class="panel placeholder">{t('command.placeholder')}</div>
    </div>
  );
}

export function WorldLayer({ state, actions, grid }: ModeProps) {
  return <WorldMap state={state} grid={grid} actions={actions} />;
}

export function MenuOverlay({ actions }: ModeProps) {
  const [message, setMessage] = useState('');
  const save = (slot: string) => {
    void actions.saveSlot(slot).then((ok) => setMessage(t(ok ? 'menu.saved' : 'menu.saveFailed')));
  };
  const slots = Array.from({ length: BALANCE.save.manualSlots }, (_, i) => `slot${i + 1}`);

  return (
    <div class="mode-layer menu" data-testid="mode-menu">
      <div class="panel menu-panel">
        <h2>{t('menu.title')}</h2>
        <button class="primary" data-testid="menu-resume" onClick={() => actions.toggleMode('menu')}>
          {t('menu.resume')}
        </button>
        <div class="row">
          <span class="label">{t('menu.save')}</span>
          {slots.map((slot) => (
            <button key={slot} class="chip" data-testid={`save-${slot}`} onClick={() => save(slot)}>
              {slotLabel(slot)}
            </button>
          ))}
        </div>
        <p class="status" data-testid="menu-status">{message}</p>
        <button data-testid="menu-title" onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
        <p class="help">{t('help.keys')}</p>
      </div>
    </div>
  );
}
