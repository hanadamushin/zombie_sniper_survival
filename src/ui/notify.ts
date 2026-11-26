// Notifications (08): toasts driven by sim events, a history of this session's notices, and the
// short banners (crossing into another cell, a new era, a raid). Most colony matters already
// write a log entry (colony.log, saved); those become toasts here. A few things that have no log
// entry (infection, rejected orders, the kill confirmation) are added from their events.
// Zombie kills are never toasted one by one — there can be a hundred in view.

import type { EventBus, GameEvent } from '../core/events.ts';
import type { GameState, LogEntry, StaticGrid } from '../core/types.ts';
import { cellTactical } from '../sim/world/derive.ts';
import { logText, tk } from './command/format.ts';
import { cellName } from './world/info.ts';
import { t, type TextKey } from './i18n/ja.ts';

export type NoticeLevel = 'info' | 'good' | 'warn' | 'danger';

export interface Notice {
  id: number;
  level: NoticeLevel;
  text: string;
  /** performance.now() when it arrived. */
  at: number;
  /** Game clock at the time (for the history). */
  day: number;
  minute: number;
  /** Raid: bearing it comes from (radians, 0 = north, clockwise). */
  dir?: number;
  /** How many of the same arrived together. */
  count: number;
}

export interface Banner {
  kind: 'cell' | 'era' | 'raid';
  title: string;
  sub: string;
  at: number;
  danger?: number;
}

/** The player's own kill, shown under the reticle for a moment. */
export interface KillMark {
  at: number;
  headshot: boolean;
  range: number;
  knife: boolean;
}

const LEVEL_OF: Record<string, NoticeLevel> = {
  'log.died': 'danger', 'log.hqLost': 'danger', 'log.defeat': 'danger', 'log.playerDown': 'danger', 'log.structureLost': 'danger',
  'log.outpostLost': 'danger', 'log.expDead': 'danger', 'log.deserted': 'danger', 'log.hordeWarning': 'danger', 'log.nightRaid': 'danger',
  'log.hordeArrived': 'danger', 'log.raidAway': 'warn',
  'log.noFood': 'warn', 'log.unpaid': 'warn', 'log.noMaterials': 'warn', 'log.noMedicine': 'warn', 'log.homeless': 'warn',
  'log.candidateLeft': 'warn', 'log.expBitten': 'warn', 'log.expHurt': 'warn', 'log.expLost': 'warn',
  'log.resupplyEmpty': 'warn', 'log.resupplyFull': 'warn', 'log.resupplyNowhere': 'warn',
  'log.stashLocked': 'warn', 'log.stashEmpty': 'warn', 'log.stashStoresFull': 'warn',
  'log.stashVault': 'good', 'log.eliteMet': 'good', 'log.expStash': 'good', 'log.clueOkinawa': 'good', 'log.clueHashima': 'good', 'log.stashTaken': 'good',
  'log.hired': 'good', 'log.built': 'good', 'log.techDone': 'good', 'log.eraAdvanced': 'good', 'log.raidRepelled': 'good',
  'log.outpostFounded': 'good', 'log.outpostGrew': 'good', 'log.outpostUpgraded': 'good', 'log.victory': 'good', 'log.cured': 'good',
  'log.playerCured': 'good', 'log.met': 'good', 'log.expBack': 'good', 'log.expHaul': 'good', 'log.expRescue': 'good', 'log.radioVisitor': 'good',
};
/** Seconds a toast stays up, by level. */
const LIFE: Record<NoticeLevel, number> = { info: 4.5, good: 5, warn: 6.5, danger: 9 };
/** Commands whose refusal the player should hear about (others come from dragging and would be noise). */
const SAY_NO = new Set(['hire', 'assignJob', 'startResearch', 'sendExpedition', 'foundOutpost', 'upgradeOutpost', 'travel', 'buyFood', 'buySupply', 'dismiss', 'assignGarrison']);

export interface Notifier {
  /** Toasts still on screen, oldest first. */
  live(now?: number): Notice[];
  /** This session's notices, newest first. */
  history(): readonly Notice[];
  banner(now?: number): Banner | null;
  kill(now?: number): KillMark | null;
  /** Forget everything (new game, load). */
  reset(): void;
  /** Bumped whenever something new arrives. */
  readonly rev: number;
}

export function createNotifier(events: EventBus, getState: () => GameState | null, getGrid: () => StaticGrid | null, onChange: () => void): Notifier {
  let seq = 0;
  let rev = 0;
  const all: Notice[] = [];
  let banner: Banner | null = null;
  let kill: KillMark | null = null;

  const push = (level: NoticeLevel, text: string, dir?: number): void => {
    const s = getState();
    const now = performance.now();
    // The same line again within a few seconds: count it instead of stacking it.
    const last = all[0];
    if (last && last.text === text && now - last.at < 4000) {
      last.count++;
      last.at = now;
    } else {
      all.unshift({ id: ++seq, level, text, at: now, day: s?.time.day ?? 0, minute: s?.time.minute ?? 0, dir, count: 1 });
      if (all.length > 80) all.length = 80;
    }
    rev++;
    onChange();
  };

  const fromLog = (e: Extract<GameEvent, { type: 'colonyLog' }>): void => {
    const s = getState();
    if (!s) return;
    const log = s.colony.log;
    let entry: LogEntry | undefined;
    for (let i = log.length - 1; i >= 0 && i >= log.length - 12; i--) {
      if (log[i]!.text === e.text) {
        entry = log[i];
        break;
      }
    }
    if (!entry) return;
    push(LEVEL_OF[e.text] ?? (e.kind === 'death' ? 'danger' : 'info'), logText(entry, getGrid()));
  };

  events.onAny((e) => {
    const s = getState();
    if (!s) return;
    switch (e.type) {
      case 'colonyLog':
        fromLog(e);
        break;
      case 'playerInfected':
        push('danger', t('note.infected'));
        break;
      case 'raidStarted':
        // The colony log announces it too (that becomes the toast); here only the banner.
        if (!e.away) {
          banner = { kind: 'raid', title: t(e.kind === 'horde' ? 'banner.horde' : 'banner.night'), sub: t('banner.raidFrom', { dir: tk(`dir.${bearing(e.dir)}`) }), at: performance.now() };
          rev++;
          onChange();
        }
        break;
      case 'commandRejected':
        if (SAY_NO.has(e.command)) {
          const key = `reject.${e.reason}`;
          const text = tk(key);
          if (text !== key) push('warn', t('note.rejected', { why: text }));
        }
        break;
      case 'cellEntered': {
        const grid = getGrid();
        if (!grid || s.flags.range) break;
        const danger = cellTactical(s, grid, e.cell)?.danger ?? 0;
        banner = { kind: 'cell', title: cellName(grid, e.cell), sub: t(`land.${grid.cells[e.cell]!.land}` as TextKey), at: performance.now(), danger };
        rev++;
        onChange();
        break;
      }
      case 'eraAdvanced':
        banner = { kind: 'era', title: t('banner.era', { era: tk(`tech.era.${e.era}`) }), sub: tk(`banner.era.${e.era}`), at: performance.now() };
        rev++;
        onChange();
        break;
      case 'zombieKilled':
        if (e.by === 'player') {
          const p = s.player.pos;
          kill = { at: performance.now(), headshot: e.headshot, range: Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]), knife: e.knife === true };
        }
        break;
      default:
        break;
    }
  });

  return {
    live(now = performance.now()) {
      const out: Notice[] = [];
      for (const n of all) {
        if (now - n.at > LIFE[n.level] * 1000) break; // newest first: everything after is older
        out.push(n);
        if (out.length >= 4) break;
      }
      return out.reverse();
    },
    history: () => all,
    banner(now = performance.now()) {
      if (!banner) return null;
      return now - banner.at < (banner.kind === 'era' ? 5000 : 3600) ? banner : null;
    },
    kill(now = performance.now()) {
      return kill && now - kill.at < 1400 ? kill : null;
    },
    reset() {
      all.length = 0;
      banner = null;
      kill = null;
      rev++;
    },
    get rev() {
      return rev;
    },
  };
}

const BEARINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
function bearing(dir: number): string {
  const turns = ((dir / (Math.PI * 2)) % 1 + 1) % 1;
  return BEARINGS[Math.round(turns * 8) % 8]!;
}
