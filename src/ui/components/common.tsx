// Small pieces shared by the tactical view and the command layer (08): the one-line hint, the
// objectives card, toasts, banners, the problem list and numbers that show how they changed.

import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { formatClock, t, type TextKey } from '../i18n/ja.ts';
import { currentHint, dismissHint, objectives, type Hint } from '../guide.ts';
import type { Notifier } from '../notify.ts';
import type { UiActions } from '../store.ts';
import { warnings, type Warning } from '../warnings.ts';
import { settings } from '../../settings.ts';

/** The notifier and other app-wide helpers, provided by ui/index.tsx. */
export interface UiServices {
  notifier: Notifier | null;
}
export const Services = createContext<UiServices>({ notifier: null });
export const useServices = (): UiServices => useContext(Services);

/** A number that briefly shows "+2" / "−4" beside itself when it changes (changes close together add up). */
export function Delta({ value, format, testId }: { value: number; format?: (n: number) => string; testId?: string }) {
  const prev = useRef(value);
  const [shown, setShown] = useState<{ key: number; d: number; at: number } | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (Math.abs(d) < 0.05) return;
    const now = performance.now();
    setShown((old) => (old && now - old.at < 900 ? { key: old.key, d: old.d + d, at: now } : { key: (old?.key ?? 0) + 1, d, at: now }));
  }, [value]);
  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => setShown((s) => (s && performance.now() - s.at >= 1550 ? null : s)), 1600);
    return () => window.clearTimeout(id);
  }, [shown]);
  if (!shown) return null;
  const n = Math.round(shown.d * 10) / 10;
  const text = format ? format(Math.abs(n)) : String(Math.abs(n));
  return <span key={shown.key} class={`delta ${n >= 0 ? 'up' : 'down'}`} data-testid={testId}>{n >= 0 ? '+' : '−'}{text}</span>;
}

/** The one-line hint (tutorial). `where` filters hints meant for another layer. */
export function HintLine({ state, actions, where }: { state: GameState; actions: UiActions; where: 'tactical' | 'command' }) {
  if (!settings.hints) return null;
  const hint: Hint | null = currentHint(state);
  if (!hint || (hint.where !== 'any' && hint.where !== where)) return null;
  return (
    <div class="hint-line" data-testid="hint-line" data-hint={hint.id} data-tip={hint.tip}>
      <span class="tag">{hint.tip ? '!' : t('tut.label')}</span>
      <p>{hint.text}</p>
      <button class="chip" title={t('tut.dismiss')} aria-label={t('tut.dismiss')} onClick={() => dismissHint(hint.id, actions.dispatch)}>×</button>
    </div>
  );
}

/** "What to do next": up to three items and the road to the declaration. */
export function Objectives({ state, grid, inline }: { state: GameState; grid: StaticGrid | null; inline?: boolean }) {
  const [open, setOpen] = useState(() => readPref('objectives', true));
  if (state.flags.range) return null;
  const toggle = (v: boolean): void => {
    setOpen(v);
    writePref('objectives', v);
  };
  if (!open) {
    return <button class="chip objectives-toggle" data-testid="objectives-show" style={inline ? { position: 'static' } : undefined} onClick={() => toggle(true)}>{t('obj.show')}</button>;
  }
  const { items, nation } = objectives(state, grid);
  return (
    <div class="panel objectives" data-testid="objectives">
      <div class="head">
        <span class="stamp">{t('obj.title')}</span>
        <button class="chip" title={t('obj.hide')} aria-label={t('obj.hide')} onClick={() => toggle(false)}>−</button>
      </div>
      <ol>
        {items.map((i) => <li key={i.id} data-id={i.id}>{i.text}</li>)}
      </ol>
      <p class="nation" data-testid="objectives-nation">{nation}</p>
    </div>
  );
}

export function WarningList({ list, onOpen }: { list: Warning[]; onOpen?: (tab: NonNullable<Warning['tab']>) => void }) {
  if (list.length === 0) return <p class="empty">{t('warn.none')}</p>;
  return (
    <ul class="warn-list" data-testid="warnings">
      {list.map((w) => (
        <li key={w.id} data-id={w.id} data-level={w.level} class={`level-${w.level}`}>
          <span>{w.text}</span>
          {w.tab && onOpen && <button class="chip" onClick={() => onOpen(w.tab!)}>→</button>}
        </li>
      ))}
    </ul>
  );
}

/** Toasts from the notifier (newest last; only the newest carries the `hud-toast` test id). */
export function Toasts() {
  const { notifier } = useServices();
  if (!notifier) return null;
  const live = notifier.live();
  if (live.length === 0) return null;
  return (
    <div class="toasts" aria-live="polite">
      {live.map((n, i) => (
        <div key={n.id} class="toast" data-level={n.level} data-old={i < live.length - 1} data-testid={i === live.length - 1 ? 'hud-toast' : 'hud-toast-old'}>
          {n.text}
          {n.count > 1 && <span class="count">{t('note.more', { n: n.count })}</span>}
        </div>
      ))}
    </div>
  );
}

export function NoticeHistory() {
  const { notifier } = useServices();
  const list = notifier?.history() ?? [];
  if (list.length === 0) return <p class="empty">{t('note.empty')}</p>;
  return (
    <ul data-testid="notice-history">
      {list.slice(0, 40).map((n) => (
        <li key={n.id} class={`level-${n.level}`}>
          <time>{t('log.time', { day: n.day, clock: formatClock(n.minute) })}</time>
          <span>{n.text}{n.count > 1 ? ` ${t('note.more', { n: n.count })}` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

export function Banner() {
  const { notifier } = useServices();
  const b = notifier?.banner();
  if (!b) return null;
  return (
    <div class="banner" key={`${b.kind}${b.at}`} data-kind={b.kind} data-testid="banner">
      <div class="title">{b.title}</div>
      <div class="sub">
        {b.sub}
        {b.danger !== undefined && <> ・ <b>{t('banner.danger', { pct: Math.round(b.danger * 100) })}</b></>}
      </div>
    </div>
  );
}

/** Problems for the HUD's count chip. */
export function useWarnings(state: GameState): Warning[] {
  return warnings(state);
}

// --- tiny per-browser UI preferences (panel side, collapsed cards); not game state ---
export function readPref<T>(key: string, dflt: T): T {
  try {
    const v = globalThis.localStorage?.getItem(`zss.ui.${key}`);
    return v === null || v === undefined ? dflt : (JSON.parse(v) as T);
  } catch {
    return dflt;
  }
}
export function writePref(key: string, v: unknown): void {
  try {
    globalThis.localStorage?.setItem(`zss.ui.${key}`, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export const tKey = (k: string): TextKey => k as TextKey;
