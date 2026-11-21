// Pause menu (08): resume, save slots, the firing range, settings and the in-game help.

import { useEffect, useState } from 'preact/hooks';
import { AUTO_SLOT, type SaveMeta } from '../../core/save.ts';
import type { GameState, JobId, ZombieKind } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import { resetSettings, settings, SETTINGS_LIMITS, updateSettings, type Settings } from '../../settings.ts';
import { tk } from '../command/format.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { saveSummary, slotLabel } from './TitleScreen.tsx';
import { CreditsPanel } from './Credits.tsx';

/** Controls listed in the help (07b: includes the keyboard-only way to aim and shoot). */
export const HELP_KEYS: readonly TextKey[] = ['help.move', 'help.look', 'help.scope', 'help.fire', 'help.breath', 'help.zoom', 'help.zero', 'help.stance', 'help.reload', 'help.knife', 'help.interact', 'help.resupply', 'help.layers', 'help.layers2', 'help.time', 'help.menu'];

type MenuTab = 'game' | 'settings' | 'help' | 'credits';

export function MenuOverlay({ state, actions }: { state: GameState; actions: UiActions }) {
  const range = state.flags.range === true;
  const [tab, setTab] = useState<MenuTab>('game');
  return (
    <div class="mode-layer menu" data-testid="mode-menu">
      <div class="panel menu-panel">
        <h2>{t('menu.title')}<small class="note"> — {t('menu.paused')}</small></h2>
        <div class="menu-tabs" role="tablist">
          {(['game', 'settings', 'help', 'credits'] as const).map((x) => (
            <button key={x} class={x === tab ? 'active' : ''} data-testid={`menu-tab-${x}`} onClick={() => setTab(x)}>{t(`menu.tab.${x}` as TextKey)}</button>
          ))}
        </div>
        {tab === 'game' && <GameTab state={state} actions={actions} range={range} />}
        {tab === 'settings' && <SettingsPanel actions={actions} />}
        {tab === 'help' && <HelpPanel />}
        {tab === 'credits' && <CreditsPanel />}
      </div>
    </div>
  );
}

function GameTab({ actions, range, state }: { state: GameState; actions: UiActions; range: boolean }) {
  const [message, setMessage] = useState('');
  const [metas, setMetas] = useState<SaveMeta[]>([]);
  const refresh = (): void => void actions.listSaves().then(setMetas, () => setMetas([]));
  useEffect(refresh, [actions]);
  const save = (slot: string): void => {
    void actions.saveSlot(slot).then((ok) => {
      setMessage(t(ok ? 'menu.saved' : 'menu.saveFailed'));
      refresh();
    });
  };
  const slots = Array.from({ length: BALANCE.save.manualSlots }, (_, i) => `slot${i + 1}`);
  return (
    <>
      <button class="primary" data-testid="menu-resume" onClick={() => actions.toggleMode('menu')}>{t('menu.resume')}</button>
      {!range && !state.flags.defeat && (
        <>
          <h3>{t('menu.save')}</h3>
          <div class="slots">
            {slots.map((slot) => {
              const meta = metas.find((m) => m.slot === slot);
              return (
                <button key={slot} data-testid={`save-${slot}`} onClick={() => save(slot)}>
                  <b>{slotLabel(slot)}</b>
                  <small>{meta ? `${saveSummary(meta)}（${t('menu.overwrite')}）` : t('menu.empty')}</small>
                </button>
              );
            })}
          </div>
          {metas.some((m) => m.slot === AUTO_SLOT) && <p class="note">{slotLabel(AUTO_SLOT)}: {saveSummary(metas.find((m) => m.slot === AUTO_SLOT)!)}</p>}
        </>
      )}
      <p class="status" data-testid="menu-status">{message}</p>
      {/* Firing range (07b): from a game it is a detour — the game waits and is resumed afterwards. */}
      {!range && <button data-testid="menu-range" onClick={() => actions.openRange()}>{t('menu.range')}</button>}
      {range && state.flags.rangeReturn === true && <button data-testid="menu-leave-range" onClick={() => actions.leaveRange()}>{t('menu.leaveRange')}</button>}
      <button data-testid="menu-title" onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
      <h3>{t('help.title')}</h3>
      <ul class="help keys" data-testid="menu-help">
        {HELP_KEYS.map((k) => <li key={k}>{t(k)}</li>)}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

function Slider({ id, label, value, min, max, step, format, onInput }: { id: string; label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onInput(v: number): void }) {
  return (
    <>
      <label for={id}>{label}</label>
      <div class="ctl">
        <input id={id} data-testid={id} type="range" min={min} max={max} step={step} value={value} onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />
        <output>{format(value)}</output>
      </div>
    </>
  );
}
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const times = (v: number): string => `×${v.toFixed(2)}`;

/** Whether sound is playing, and a button that makes some (and wakes the audio up). */
function AudioCheck({ actions }: { actions?: UiActions }) {
  const [state, setState] = useState(() => actions?.audioState?.() ?? 'none');
  useEffect(() => {
    const id = window.setInterval(() => setState(actions?.audioState?.() ?? 'none'), 500);
    return () => window.clearInterval(id);
  }, [actions]);
  const key = state === 'running' ? 'set.audio.running' : state === 'none' ? 'set.audio.none' : 'set.audio.suspended';
  return (
    <>
      <label>{t('set.audio.state')}</label>
      <div class="ctl">
        <span class={state === 'running' ? 'level-good' : 'level-warn'} data-testid="set-audio-state" data-state={state}>{t(key)}</span>
        <button class="chip" data-testid="set-audio-test" onClick={() => { actions?.audioTest?.(); window.setTimeout(() => setState(actions?.audioState?.() ?? 'none'), 100); }}>{t('set.audio.test')}</button>
      </div>
    </>
  );
}

export function SettingsPanel({ actions }: { actions?: UiActions }) {
  const [, force] = useState(0);
  const set = (patch: Parameters<typeof updateSettings>[0]): void => {
    updateSettings(patch);
    force((n) => n + 1);
  };
  const s: Settings = settings;
  const L = SETTINGS_LIMITS;
  return (
    <div class="settings" data-testid="settings">
      <h3>{t('set.controls')}</h3>
      <Slider id="set-mouse" label={t('set.mouseSens')} value={s.mouseSens} {...L.mouseSens} format={times} onInput={(v) => set({ mouseSens: v })} />
      <Slider id="set-keylook" label={t('set.keyLook')} value={s.keyLookSpeed} {...L.keyLookSpeed} format={times} onInput={(v) => set({ keyLookSpeed: v })} />
      <label>{t('set.scopeMode')}</label>
      <div class="ctl" role="group">
        {(['hold', 'toggle'] as const).map((m) => (
          <button key={m} class={s.scopeMode === m ? 'chip active' : 'chip'} data-testid={`set-scope-${m}`} onClick={() => set({ scopeMode: m })}>{t(`set.scope.${m}` as TextKey)}</button>
        ))}
      </div>
      <Slider id="set-fov" label={t('set.fov')} value={s.fov} {...L.fov} format={(v) => `${Math.round(v)}°`} onInput={(v) => set({ fov: v })} />

      <h3>{t('set.audio')}</h3>
      <AudioCheck actions={actions} />
      {(['master', 'sfx', 'ambience', 'ui'] as const).map((k) => (
        <Slider key={k} id={`set-vol-${k}`} label={t(`set.vol.${k}` as TextKey)} value={s.volume[k]} min={0} max={1} step={0.05} format={pct} onInput={(v) => set({ volume: { [k]: v } })} />
      ))}

      <h3>{t('set.quality')}</h3>
      <Slider id="set-view" label={t('set.viewDistance')} value={s.viewDistance} {...L.viewDistance} format={(v) => `${Math.round(800 * v)}m`} onInput={(v) => set({ viewDistance: v })} />
      <label>{t('set.autoRes')}</label>
      <div class="ctl">
        <input type="checkbox" data-testid="set-autores" checked={s.autoResolution} onChange={(e) => set({ autoResolution: (e.target as HTMLInputElement).checked })} />
        <span class="note">{t('set.autoResNote')}</span>
      </div>
      {!s.autoResolution && <Slider id="set-scale" label={t('set.scale')} value={s.renderScale} {...L.renderScale} format={pct} onInput={(v) => set({ renderScale: v })} />}
      <label>{t('set.shadows')}</label>
      <span class="note">{t('set.shadowsNote')}</span>

      <h3>{t('set.display')}</h3>
      <label>{t('set.hints')}</label>
      <div class="ctl"><input type="checkbox" data-testid="set-hints" checked={s.hints} onChange={(e) => set({ hints: (e.target as HTMLInputElement).checked })} /></div>
      <label>{t('set.perf')}</label>
      <div class="ctl"><input type="checkbox" data-testid="set-perf" checked={s.showPerf} onChange={(e) => set({ showPerf: (e.target as HTMLInputElement).checked })} /></div>

      <h3>{t('set.keys')}</h3>
      <ul class="help keys" style={{ gridColumn: '1 / -1' }}>
        {HELP_KEYS.map((k) => <li key={k}>{t(k)}</li>)}
      </ul>
      <div style={{ gridColumn: '1 / -1' }}>
        <button data-testid="set-reset" onClick={() => { resetSettings(); force((n) => n + 1); }}>{t('set.reset')}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------------------------

type HelpTab = 'controls' | 'jobs' | 'zombies' | 'ballistics' | 'goal';
const JOB_ROWS: readonly JobId[] = ['farming', 'defense', 'scavenging', 'construction', 'research', 'crafting', 'medical'];
const KINDS: readonly ZombieKind[] = ['walker', 'runner', 'brute', 'crawler'];

export function HelpPanel() {
  const [tab, setTab] = useState<HelpTab>('controls');
  return (
    <div data-testid="help">
      <div class="row" role="tablist" style={{ marginBottom: '8px' }}>
        {(['controls', 'jobs', 'zombies', 'ballistics', 'goal'] as const).map((x) => (
          <button key={x} class={x === tab ? 'chip active' : 'chip'} data-testid={`help-tab-${x}`} onClick={() => setTab(x)}>{t(`help.tab.${x}` as TextKey)}</button>
        ))}
      </div>
      {tab === 'controls' && (
        <ul class="help keys">
          {HELP_KEYS.map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      )}
      {tab === 'jobs' && (
        <>
          <p class="help">{t('help.jobs.lead')}</p>
          <table class="help-table">
            <thead><tr><th>{t('help.jobs.col.job')}</th><th>{t('help.jobs.col.stat')}</th><th>{t('help.jobs.col.out')}</th></tr></thead>
            <tbody>
              {JOB_ROWS.map((j) => {
                const [stat, out] = tk(`help.jobs.${j}`).split('|');
                return <tr key={j}><td>{tk(`job.${j}`)}</td><td>{stat}</td><td>{out}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      )}
      {tab === 'zombies' && (
        <>
          <div class="bestiary">
            {KINDS.map((k) => (
              <div key={k}>
                <b>{tk(`zkind.${k}`)}</b>
                <span>{tk(`help.zombie.${k}`)}</span>
                <br />
                <span class="num">{t('help.zombie.stats', { hp: ZOMBIES[k].hp, speed: ZOMBIES[k].speed, wall: ZOMBIES[k].wallDps })}</span>
              </div>
            ))}
          </div>
          <p class="help">{t('help.zombie.night')}</p>
        </>
      )}
      {tab === 'ballistics' && (
        <ul class="help">
          {(['help.ball.1', 'help.ball.2', 'help.ball.3', 'help.ball.4', 'help.ball.5', 'help.ball.6'] as const).map((k) => <li key={k}>・{t(k)}</li>)}
        </ul>
      )}
      {tab === 'goal' && (
        <ul class="help">
          {(['help.goal.1', 'help.goal.2', 'help.goal.3', 'tut.tip.tower', 'tut.tip.hq', 'tut.tip.moat', 'tut.tip.ammo'] as const).map((k) => <li key={k}>・{t(k)}</li>)}
        </ul>
      )}
    </div>
  );
}
