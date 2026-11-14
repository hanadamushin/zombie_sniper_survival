// Read-only helpers that turn cells into text for the strategic map (names, blurred numbers, times).

import type { CellId, GameState, StaticGrid } from '../../core/types.ts';
import { cellDistance } from '../../sim/world/grid.ts';
import { t, type TextKey } from '../i18n/ja.ts';

const placeIndex = new WeakMap<StaticGrid, Map<CellId, string>>();

function places(grid: StaticGrid): Map<CellId, string> {
  let map = placeIndex.get(grid);
  if (!map) {
    map = new Map(grid.places.map((p) => [p.cell, p.name]));
    placeIndex.set(grid, map);
  }
  return map;
}

/** "長野県 松本" or "長野県 松本付近" (nearest named place within 3 cells), else just the prefecture. */
export function cellName(grid: StaticGrid, cell: CellId): string {
  const info = grid.cells[cell];
  if (!info) return '';
  const pref = grid.prefNames[info.pref] ?? '';
  const map = places(grid);
  const exact = map.get(cell);
  if (exact) return `${pref} ${exact}`;
  let best: string | null = null;
  let bestD = 4;
  const w = grid.gridW;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const id = cell + dy * w + dx;
      const name = map.get(id);
      if (!name || !grid.cells[id]) continue;
      const d = cellDistance(grid, cell, id) + (Math.abs(dx) + Math.abs(dy)) * 0.01;
      if (d < bestD) {
        bestD = d;
        best = name;
      }
    }
  }
  return best ? `${pref} ${t('world.near', { name: best })}` : pref;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

/** Round to `digits` significant digits (default one): 3,412 -> 3,000. */
export function roughly(n: number, digits = 1): number {
  if (n < 10) return Math.round(n);
  const mag = 10 ** (Math.floor(Math.log10(n)) - digits + 1);
  return Math.round(n / mag) * mag;
}

export function zBand(z: number): TextKey {
  if (z < 200) return 'world.band.none';
  if (z < 3000) return 'world.band.low';
  if (z < 50_000) return 'world.band.mid';
  return 'world.band.high';
}
/** Representative value of a band, used to colour unknown cells coarsely. */
export function zBandValue(z: number): number {
  if (z < 200) return 0;
  if (z < 3000) return 800;
  if (z < 50_000) return 12_000;
  return 300_000;
}

/** A count as the player knows it at the given intel level. */
export function knownCount(value: number, intel: number, unit: 'world.bodies' | 'world.people'): string {
  if (intel >= 2) return t(unit, { n: fmt(value) });
  if (intel === 1) return t('world.approx', { n: t(unit, { n: fmt(roughly(value)) }) });
  return t('world.unknown');
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  if (h >= 24) return t('world.days', { d: Math.floor(h / 24), h: h % 24 });
  if (h === 0) return t('world.minutes', { m });
  return m % 60 === 0 ? t('world.hours', { h }) : t('world.hoursMinutes', { h, m: m % 60 });
}

export function intelOf(state: GameState, cell: CellId): number {
  return state.world.cells.intel[cell] ?? 0;
}
