// Player settings (08): look sensitivity, scope button behaviour, field of view, volume, quality.
// Presentation only — not part of GameState, never read by the sim, kept in localStorage per browser.
// The input layer, the renderer, the audio engine and the UI read `settings` and subscribe to
// changes with `onSettings`.

import { RENDER } from './data/render.ts';

export interface Settings {
  /** Multiplier on mouse movement (1 = TACTICAL.player.lookSensitivity). */
  mouseSens: number;
  /** Multiplier on arrow-key aiming (1 = INPUT.keyLook). */
  keyLookSpeed: number;
  /** Right mouse button: hold to look through the scope, or click to toggle it. */
  scopeMode: 'hold' | 'toggle';
  /** Vertical field of view without the scope (degrees). The scope's magnifications do not change. */
  fov: number;
  volume: { master: number; sfx: number; ambience: number; ui: number };
  /** Share of the full view distance the fog allows (1 = 800 m). */
  viewDistance: number;
  /** Automatic resolution (04's safety net for slow GPUs); when off, `renderScale` is used. */
  autoResolution: boolean;
  renderScale: number;
  /** One-line hints for the first steps (08). */
  hints: boolean;
  /** fps / draw calls in the top bar. */
  showPerf: boolean;
}

export const SETTINGS_LIMITS = {
  mouseSens: { min: 0.25, max: 3, step: 0.05 },
  keyLookSpeed: { min: 0.25, max: 3, step: 0.05 },
  fov: { min: 55, max: 90, step: 1 },
  viewDistance: { min: 0.5, max: 1, step: 0.05 },
  renderScale: { min: 0.5, max: 1, step: 0.125 },
} as const;

export function defaultSettings(): Settings {
  return {
    mouseSens: 1,
    keyLookSpeed: 1,
    scopeMode: 'hold',
    fov: RENDER.camera.fov,
    volume: { master: 0.8, sfx: 1, ambience: 0.7, ui: 0.6 },
    viewDistance: 1,
    autoResolution: true,
    renderScale: 1,
    hints: true,
    showPerf: false,
  };
}

const KEY = 'zss.settings.v1';

function clamp(v: unknown, lo: number, hi: number, dflt: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
}

/** Merge stored values over the defaults, dropping anything malformed. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Settings> & { volume?: Partial<Settings['volume']> };
  const L = SETTINGS_LIMITS;
  const vol: Partial<Settings['volume']> = r.volume ?? {};
  return {
    mouseSens: clamp(r.mouseSens, L.mouseSens.min, L.mouseSens.max, d.mouseSens),
    keyLookSpeed: clamp(r.keyLookSpeed, L.keyLookSpeed.min, L.keyLookSpeed.max, d.keyLookSpeed),
    scopeMode: r.scopeMode === 'toggle' ? 'toggle' : 'hold',
    fov: clamp(r.fov, L.fov.min, L.fov.max, d.fov),
    volume: {
      master: clamp(vol.master, 0, 1, d.volume.master),
      sfx: clamp(vol.sfx, 0, 1, d.volume.sfx),
      ambience: clamp(vol.ambience, 0, 1, d.volume.ambience),
      ui: clamp(vol.ui, 0, 1, d.volume.ui),
    },
    viewDistance: clamp(r.viewDistance, L.viewDistance.min, L.viewDistance.max, d.viewDistance),
    autoResolution: typeof r.autoResolution === 'boolean' ? r.autoResolution : d.autoResolution,
    renderScale: clamp(r.renderScale, L.renderScale.min, L.renderScale.max, d.renderScale),
    hints: typeof r.hints === 'boolean' ? r.hints : d.hints,
    showPerf: typeof r.showPerf === 'boolean' ? r.showPerf : d.showPerf,
  };
}

function load(): Settings {
  try {
    const text = globalThis.localStorage?.getItem(KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return defaultSettings();
  }
}

/** The live settings object. Replace through `updateSettings` so that subscribers hear about it. */
export const settings: Settings = load();

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();

export function onSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function updateSettings(patch: Partial<Omit<Settings, 'volume'>> & { volume?: Partial<Settings['volume']> }): void {
  const next = sanitizeSettings({ ...settings, ...patch, volume: { ...settings.volume, ...(patch.volume ?? {}) } });
  Object.assign(settings, next);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode: the settings last for this visit */
  }
  for (const fn of listeners) fn(settings);
}

export function resetSettings(): void {
  updateSettings(defaultSettings());
}
