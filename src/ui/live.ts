// Per-frame HUD updates (08). Gauges that move every frame (breath, ear collection, stamina,
// health, the hurt vignette) are not re-rendered by Preact at 10 Hz: a component registers a
// small function that writes straight into its element, and the main loop calls `liveFrame`
// once per animation frame.

import { useEffect, useRef } from 'preact/hooks';
import type { GameState } from '../core/types.ts';

type LiveFn = (state: GameState, realDt: number) => void;
const fns = new Set<{ current: LiveFn }>();

/** Run every registered updater. Called by the main loop after drawing. */
export function liveFrame(state: GameState, realDt: number): void {
  for (const f of fns) {
    try {
      f.current(state, realDt);
    } catch (err) {
      console.error('[ui] live update failed', err);
    }
  }
}

/** Register `fn` for as long as the component is mounted; the latest closure is always used. */
export function useLive(fn: LiveFn): void {
  const ref = useRef<LiveFn>(fn);
  ref.current = fn;
  useEffect(() => {
    const entry = ref;
    fns.add(entry);
    return () => void fns.delete(entry);
  }, []);
}

/** Set a CSS property only when it changes (style writes are not free at 60 Hz). */
export function setStyle(el: HTMLElement | null, prop: string, value: string): void {
  if (!el) return;
  if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
}
