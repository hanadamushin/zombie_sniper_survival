// Turns colony data into Japanese: log entries (the sim stores a text key and raw parameters),
// resource lists, people.

import type { GameState, LogEntry, ResourceId, StaticGrid, Survivor } from '../../core/types.ts';
import { toAbsMinutes } from '../../core/time.ts';
import { activityAt } from '../../sim/colony/jobs.ts';
import { ja, formatClock, t, type TextKey } from '../i18n/ja.ts';
import { cellName, formatDuration } from '../world/info.ts';

/** t() for keys built at run time; unknown keys come back as they are. */
export function tk(key: string, params?: Record<string, string | number>): string {
  return key in ja ? t(key as TextKey, params) : key;
}

export function num(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('ja-JP');
}

/** "food:3|metal:1.5" -> "食料 3、金属 1.5" */
export function itemsText(items: string): string {
  if (!items) return '';
  return items
    .split('|')
    .map((part) => {
      const [id, n] = part.split(':');
      return `${tk(`res.${id as ResourceId}`)} ${num(Number(n))}`;
    })
    .join('、');
}

const PREFIX: Record<string, string> = { land: 'land.', job: 'job.', trait: 'trait.', weapon: 'xweapon.', cause: 'cause.', reason: 'reason.' };

export function logText(entry: LogEntry, grid: StaticGrid | null): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(entry.params ?? {})) {
    if (k === 'items') params[k] = itemsText(String(v));
    else if (k === 'cell') params[k] = grid ? cellName(grid, Number(v)) : String(v);
    else if (k in PREFIX) params[k] = tk(PREFIX[k] + String(v));
    else params[k] = typeof v === 'number' ? num(v) : v;
  }
  return tk(entry.text, params);
}

export function logTime(entry: LogEntry): string {
  return t('log.time', { day: entry.day, clock: formatClock(entry.minute) });
}

/** What a survivor is doing right now, in words. */
export function statusText(state: GameState, s: Survivor): string {
  const now = toAbsMinutes(state.time);
  if (s.location.kind === 'expedition') {
    const id = s.location.id;
    const exp = state.world.expeditions.find((e) => e.id === id);
    return t('status.away', { time: exp ? formatDuration(exp.returnDay * 1440 + exp.returnMinute - now) : '?' });
  }
  if (s.status === 'infected' && s.infectedUntil) return t('status.infected', { time: formatDuration(toAbsMinutes(s.infectedUntil) - now) });
  if (s.status === 'injured') return t('status.injured', { hp: Math.round(s.hp) });
  const activity = tk(`activity.${activityAt(s, state.time.minute)}`);
  return s.unpaidDays > 0 ? `${activity}・${t('status.unpaid', { n: s.unpaidDays })}` : activity;
}
