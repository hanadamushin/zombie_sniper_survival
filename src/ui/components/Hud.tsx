// Top bar of every in-game screen (08): date and clock, speed, the three layers, problems,
// notices, the menu — and the raid alert when something is coming. Hidden while scoped.

import { useState } from 'preact/hooks';
import type { GameState, Mode, Speed } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { formatClock, t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { bearingName, roughSize } from '../../sim/build/raids.ts';
import { formatDuration } from '../world/info.ts';
import { settings } from '../../settings.ts';
import { NoticeHistory, WarningList } from './common.tsx';
import { warnings } from '../warnings.ts';

const MODES: readonly Mode[] = ['tactical', 'command', 'world'];

/** What is coming for the base, or has just been (06). */
function RaidAlert({ state }: { state: GameState }) {
  const raid = state.build.raid;
  const ph = state.world.pendingHorde;
  const now = state.time.day * 1440 + state.time.minute;
  if (raid) {
    const left = raid.toSpawn + (state.tactical?.zombies ?? []).reduce((n, z) => n + (z.raid && z.state !== 'down' ? 1 : 0), 0);
    return <div class="hud-group alert" data-testid="hud-raid" data-kind={raid.kind} data-left={left}>{t(`raid.active.${raid.kind}` as TextKey, { n: left })}</div>;
  }
  if (ph?.warned) {
    const minutes = Math.max(0, ph.arrivesDay * 1440 + ph.arrivesMinute - now);
    return (
      <div class="hud-group alert" data-testid="hud-horde">
        {t('raid.incoming', { dir: t(`dir.${bearingName(ph.dir)}` as TextKey), size: roughSize(ph.size), time: formatDuration(minutes) })}
      </div>
    );
  }
  const last = state.build.lastRaid;
  if (last && now - (last.day * 1440 + last.minute) < 180) {
    return (
      <div class="hud-group alert calm" data-testid="hud-raid-report" data-away={last.away}>
        {t('raid.report', { size: last.size, killed: last.killed, walls: last.wallsLost, dead: last.dead })}
        {last.away ? t('raid.reportAway') : ''}
      </div>
    );
  }
  return null;
}

export function Hud({ state, fps, drawCalls, actions }: { state: GameState; fps: number; drawCalls: number; actions: UiActions }) {
  const { day, minute, speed } = state.time;
  const [pop, setPop] = useState<'warn' | 'notes' | null>(null);
  const setSpeed = (s: Speed) => (s === 0 ? actions.togglePause() : actions.dispatch({ type: 'setSpeed', speed: s }));
  const hour = minute / 60;
  const problems = warnings(state);
  const worst = problems.some((w) => w.level === 'danger') ? 'danger' : 'warn';

  return (
    <>
      <div class="hud-top" data-testid="hud-top">
        <div class="hud-group date">
          <span data-testid="hud-day">{t('hud.day', { day })}</span>
          <span class="clock" data-testid="hud-clock" data-night={hour < 5 || hour >= 19}>{formatClock(minute)}</span>
        </div>

        <div class="hud-group speeds" role="group">
          {BALANCE.time.speeds.map((s) => (
            <button
              key={s}
              class={s === speed ? 'chip active' : 'chip'}
              title={s === 0 ? t('hud.speed.pause') : t('hud.speed.set', { n: s })}
              onClick={() => setSpeed(s)}
            >
              {s === 0 ? '❚❚' : `x${s}`}
            </button>
          ))}
          <span class="speed" data-testid="hud-speed">{speed === 0 ? t('hud.paused') : `x${speed}`}</span>
        </div>

        <div class="hud-group" role="group" aria-label={t('mode.label')}>
          {MODES.map((m) => (
            <button
              key={m}
              class={m === state.mode ? 'chip active' : 'chip'}
              data-testid={`mode-btn-${m}`}
              onClick={() => m !== state.mode && actions.dispatch({ type: 'setMode', mode: m })}
            >
              {t(`mode.${m}` as TextKey)}
            </button>
          ))}
          <span class="sr-only" data-testid="hud-mode" data-mode={state.mode}>{t(`mode.${state.mode}` as TextKey)}</span>
        </div>

        <RaidAlert state={state} />

        <div class="hud-group right">
          {settings.showPerf && (
            <span class="hud-group debug">
              <span data-testid="hud-fps">{t('hud.fps', { fps: Math.round(fps) })}</span> <span>{t('hud.draws', { n: drawCalls })}</span>
            </span>
          )}
          {!state.flags.range && (
            <button class={`icon-btn${pop === 'warn' ? ' active' : ''}`} data-testid="hud-problems" data-count={problems.length} data-level={worst} title={t('warn.title')} onClick={() => setPop(pop === 'warn' ? null : 'warn')}>
              {t('warn.title')}
            </button>
          )}
          <button class="icon-btn" data-testid="hud-notices" title={t('note.history')} onClick={() => setPop(pop === 'notes' ? null : 'notes')}>{t('hud.notices')}</button>
          <button class="icon-btn" data-testid="hud-menu" title={t('mode.menu')} onClick={() => actions.toggleMode('menu')}>☰</button>
        </div>
      </div>
      {pop === 'warn' && (
        <div class="panel pop" data-testid="pop-warnings">
          <h3>{t('warn.title')}</h3>
          <WarningList list={problems} onOpen={() => { setPop(null); if (state.mode !== 'command') actions.dispatch({ type: 'setMode', mode: 'command' }); }} />
        </div>
      )}
      {pop === 'notes' && (
        <div class="panel pop" data-testid="pop-notices">
          <h3>{t('note.history')}</h3>
          <NoticeHistory />
        </div>
      )}
    </>
  );
}
