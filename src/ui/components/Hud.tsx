// Minimal debug HUD for M0: date, clock, speed, mode, FPS. Session 08 restyles it.

import type { GameState, Mode, Speed } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { formatClock, t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';

const MODES: readonly Mode[] = ['tactical', 'command', 'world'];

export function Hud({ state, fps, drawCalls, actions }: { state: GameState; fps: number; drawCalls: number; actions: UiActions }) {
  const { day, minute, speed } = state.time;
  const setSpeed = (s: Speed) => (s === 0 ? actions.togglePause() : actions.dispatch({ type: 'setSpeed', speed: s }));

  return (
    <div class="hud-top">
      <div class="hud-group">
        <span data-testid="hud-day">{t('hud.day', { day })}</span>
        <span class="clock" data-testid="hud-clock">{formatClock(minute)}</span>
      </div>

      <div class="hud-group" role="group">
        {BALANCE.time.speeds.map((s) => (
          <button
            key={s}
            class={s === speed ? 'chip active' : 'chip'}
            title={s === 0 ? t('hud.speed.pause') : t('hud.speed.set', { n: s })}
            onClick={() => setSpeed(s)}
          >
            {s === 0 ? '⏸' : `x${s}`}
          </button>
        ))}
        <span class="speed" data-testid="hud-speed">{speed === 0 ? t('hud.paused') : `x${speed}`}</span>
      </div>

      <div class="hud-group" role="group" aria-label={t('mode.label')}>
        {MODES.map((m) => (
          <button
            key={m}
            class={m === state.mode ? 'chip active' : 'chip'}
            onClick={() => m !== state.mode && actions.dispatch({ type: 'setMode', mode: m })}
          >
            {t(`mode.${m}` as TextKey)}
          </button>
        ))}
        <button class="chip" onClick={() => actions.toggleMode('menu')}>☰</button>
        <span class="sr-only" data-testid="hud-mode" data-mode={state.mode}>{t(`mode.${state.mode}` as TextKey)}</span>
      </div>

      <div class="hud-group debug">
        <span data-testid="hud-fps">{t('hud.fps', { fps: Math.round(fps) })}</span>
        <span>{t('hud.draws', { n: drawCalls })}</span>
      </div>
    </div>
  );
}
