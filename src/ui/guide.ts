// First steps (08): one-line hints that follow what the player is doing, and the short list of
// "what to do next" up to the declaration of the nation. Nothing is forced and nothing pauses the
// game: a hint shows while its step is the next one undone, and disappears once it is done (or
// dismissed with ×). Read hints are remembered in `state.flags['seen.tut.<id>']` (command
// `markSeen`), so a loaded game does not repeat them.

import type { Command } from '../core/commands.ts';
import type { GameState, StaticGrid } from '../core/types.ts';
import { RESEARCH } from '../data/techs.ts';
import { ZOMBIES } from '../data/zombies.ts';
import { isUnlocked } from '../sim/build/structures.ts';
import { playerAtHome } from '../sim/colony/morale.ts';
import { mapOf } from '../sim/tactical/area.ts';
import { cluesRead } from '../sim/world/stash.ts';
import { sightBlocked } from '../sim/tactical/collision.ts';
import { headingDeg } from '../sim/tactical/player.ts';
import { victoryProgress } from '../sim/research/victory.ts';
import { zeroDistance } from '../sim/tactical/weapon.ts';
import { t, type TextKey } from './i18n/ja.ts';

export type StepId = 'move' | 'scope' | 'shoot' | 'ears' | 'meet' | 'hire' | 'job' | 'fence' | 'research' | 'map' | 'expedition' | 'outpost';
/** Hints that are not part of the sequence: shown once, when the situation comes up. */
export type TipId = 'ammo' | 'tower' | 'hq' | 'moat' | 'cross' | 'night' | 'okinawa' | 'hashima';

export interface Hint {
  id: StepId | TipId;
  /** Sequence hint (numbered) or a one-off tip. */
  tip: boolean;
  text: string;
  /** Where the hint makes sense: the tactical view, the command layer, or both. */
  where: 'tactical' | 'command' | 'any';
}

const STEPS: readonly StepId[] = ['move', 'scope', 'shoot', 'ears', 'meet', 'hire', 'job', 'fence', 'research', 'map', 'expedition', 'outpost'];

/** Marks sent but not yet applied (commands land at the start of the next frame). */
const pendingMarks = new Set<string>();
const seen = (s: GameState, id: string): boolean => s.flags[`seen.tut.${id}`] === true || pendingMarks.has(id);
const hasStructure = (s: GameState, pred: (def: string) => boolean): boolean => s.build.structures.some((b) => pred(b.def));
const people = (s: GameState): number => s.colony.survivors.length + s.colony.memorial.length;

/** Is the step done — by the game's own record, or because the player dismissed it. */
export function stepDone(s: GameState, id: StepId): boolean {
  if (seen(s, id)) return true;
  const st = s.player.stats;
  switch (id) {
    case 'move':
    case 'scope':
    case 'map':
      return false; // marked by the watcher below when it happens
    case 'shoot': return st.kills > 0;
    case 'ears': return st.earsCollected > 0;
    case 'meet': return s.colony.candidates.length > 0 || people(s) > 0;
    case 'hire': return people(s) > 0;
    case 'job': return s.colony.survivors.some((x) => x.job !== 'idle');
    case 'fence': return hasStructure(s, (d) => d !== 'hq' && d !== 'farm');
    case 'research': return s.research.done.length > 0 || Object.keys(s.research.active).length > 0;
    case 'expedition': return s.world.expeditions.length > 0;
    case 'outpost': return s.world.outposts.length > 0;
  }
}

/** The first step not yet done (null when the sequence is over). */
export function nextStep(s: GameState): StepId | null {
  return STEPS.find((id) => !stepDone(s, id)) ?? null;
}

// --- the nearest zombie in plain view, for the first shot (checked twice a second) ---
let spotted: { dist: number; dir: string } | null = null;
let spottedAt = -1;
function nearestVisible(s: GameState): { dist: number; dir: string } | null {
  const now = performance.now();
  if (now - spottedAt < 500) return spotted;
  spottedAt = now;
  spotted = null;
  const map = mapOf(s);
  if (!map || !s.tactical) return null;
  const p = s.player;
  const eye: [number, number, number] = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  // Nearest first, and only the first few sight tests: up to 600 zombies may be about.
  const near: { d: number; i: number }[] = [];
  const zs = s.tactical.zombies;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i]!;
    if (z.state === 'down' || z.dummy) continue;
    const d = Math.hypot(z.pos[0] - p.pos[0], z.pos[2] - p.pos[2]);
    if (d >= 30 && d <= 450) near.push({ d, i });
  }
  near.sort((a, b) => a.d - b.d);
  let best = Infinity;
  let bestDir = '';
  for (const { d, i } of near.slice(0, 24)) {
    const z = zs[i]!;
    const head: [number, number, number] = [z.pos[0], z.pos[1] + ZOMBIES[z.kind].height - 0.1, z.pos[2]];
    if (sightBlocked(map, eye, head)) continue;
    best = d;
    bestDir = compassName(headingDeg(Math.atan2(-(z.pos[0] - p.pos[0]), -(z.pos[2] - p.pos[2]))));
    break;
  }
  if (Number.isFinite(best)) spotted = { dist: best, dir: bestDir };
  return spotted;
}
function compassName(deg: number): string {
  const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  return t(`compass.${pts[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!}` as TextKey);
}

function stepHint(s: GameState, id: StepId): Hint | null {
  const at = (where: Hint['where'], key: TextKey, params?: Record<string, string | number>): Hint => ({ id, tip: false, text: t(key, params), where });
  switch (id) {
    case 'move': return at('tactical', 'tut.move');
    case 'scope': return at('tactical', 'tut.scope');
    case 'shoot': {
      const z = nearestVisible(s);
      return at('tactical', z ? 'tut.shoot' : 'tut.shootLook', { dir: z?.dir ?? '', m: z ? Math.round(z.dist / 10) * 10 : 0, zero: zeroDistance(s) });
    }
    case 'ears': return at('tactical', 'tut.ears');
    case 'meet': return at('tactical', 'tut.meet');
    case 'hire': return at('any', 'tut.hire');
    case 'job': return at('any', 'tut.job');
    case 'fence': return playerAtHome(s) ? at('any', 'tut.fence') : null;
    case 'research': return at('any', 'tut.research');
    case 'map': return at('any', 'tut.map');
    case 'expedition': return s.colony.survivors.length >= 2 ? at('any', 'tut.expedition') : null;
    case 'outpost': return at('any', 'tut.outpost');
  }
}

/** One-off tips: the situation that calls for them. */
function tipFor(s: GameState): Hint | null {
  const tip = (id: TipId, key: TextKey, where: Hint['where'] = 'any'): Hint => ({ id, tip: true, text: t(key), where });
  const ammo = s.player.inv.ammo ?? 0;
  // O1: the first clue of a hidden stash says how to get there.
  if (!seen(s, 'okinawa') && cluesRead(s, 'okinawa') > 0) return tip('okinawa', 'tut.tip.okinawa');
  if (!seen(s, 'hashima') && cluesRead(s, 'hashima') > 0) return tip('hashima', 'tut.tip.hashima');
  if (!seen(s, 'ammo') && ammo + s.player.weapon.mag <= 40 && stepDone(s, 'shoot')) return tip('ammo', 'tut.tip.ammo', 'tactical');
  if (!seen(s, 'hq') && s.build.raid) return tip('hq', 'tut.tip.hq');
  if (!seen(s, 'tower') && (isUnlocked('tower', s) || hasStructure(s, (d) => d === 'tower')) && people(s) > 0) return tip('tower', 'tut.tip.tower');
  if (!seen(s, 'moat') && isUnlocked('moat', s)) return tip('moat', 'tut.tip.moat');
  const hour = s.time.minute / 60;
  if (!seen(s, 'night') && hour >= 17.5 && hour < 20 && playerAtHome(s) && stepDone(s, 'hire')) return tip('night', 'tut.tip.night');
  return null;
}

/**
 * The hint to show now, or null. Tips (situations) come before the sequence; the sequence shows
 * its next undone step when that step makes sense where the player is.
 */
export function currentHint(s: GameState): Hint | null {
  if (s.flags.range || s.flags.defeat || s.world.travel) return null;
  const tip = tipFor(s);
  if (tip) return tip;
  const id = nextStep(s);
  return id ? stepHint(s, id) : null;
}

// --- the watcher: marks the steps the game has no record of, and retires tips that were read ---
let origin: { x: number; z: number; game: unknown } | null = null;
const tipShown = new Map<string, number>();
/** Seconds a tip stays up before it counts as read. */
const TIP_SECONDS = 22;

export function watchGuide(s: GameState, dispatch: (c: Command) => void, game: unknown): void {
  for (const id of pendingMarks) if (s.flags[`seen.tut.${id}`] === true) pendingMarks.delete(id);
  const mark = (id: string): void => {
    if (!seen(s, id)) {
      pendingMarks.add(id);
      dispatch({ type: 'markSeen', key: `tut.${id}` });
    }
  };
  const p = s.player;
  if (s.mode === 'tactical' && !s.world.travel && mapOf(s)) {
    // A jump (area built, revival, crossing into another cell) is not walking: start over from there.
    const d = origin && origin.game === game ? Math.hypot(p.pos[0] - origin.x, p.pos[2] - origin.z) : Infinity;
    if (d > 60) origin = { x: p.pos[0], z: p.pos[2], game };
    else if (d > 6) mark('move');
    if ((p.aim.scopeT > 0.9 && p.aim.holding) || (p.stats.shots > 0 && seen(s, 'move'))) mark('scope');
  }
  if (s.mode === 'world') mark('map');
  const tip = tipFor(s);
  if (tip) {
    const first = tipShown.get(tip.id) ?? performance.now();
    tipShown.set(tip.id, first);
    if (performance.now() - first > TIP_SECONDS * 1000) mark(tip.id);
  }
}

export function dismissHint(id: string, dispatch: (c: Command) => void): void {
  pendingMarks.add(id);
  dispatch({ type: 'markSeen', key: `tut.${id}` });
}

/** Up to three things to do next, plus the road to the declaration. */
export function objectives(s: GameState, grid: StaticGrid | null): { items: { id: string; text: string }[]; nation: string } {
  const items: { id: string; text: string }[] = [];
  for (const id of STEPS) {
    if (items.length >= 3) break;
    if (!stepDone(s, id)) items.push({ id, text: t(`obj.${id}` as TextKey) });
  }
  // After the first steps: the standing goals of a growing colony.
  if (items.length < 3) {
    const v = victoryProgress(s, grid);
    const V = RESEARCH.victory;
    if (!v.met.era) items.push({ id: 'era', text: t('obj.era', { era: t(`tech.era.${Math.min(3, s.research.era + 1)}` as TextKey) }) });
    if (items.length < 3 && !v.met.population) items.push({ id: 'pop', text: t('obj.population', { n: v.population, need: V.population }) });
    if (items.length < 3 && !v.met.outposts) items.push({ id: 'outposts', text: t('obj.outposts', { n: v.outposts, need: V.outposts }) });
    if (items.length < 3 && !v.met.regions) items.push({ id: 'regions', text: t('obj.regions', { n: v.regions, need: V.regions }) });
    if (items.length < 3 && !v.met.goal) items.push({ id: 'goal', text: t('obj.goal') });
    if (items.length < 3 && !v.met.capitol) items.push({ id: 'capitol', text: t('obj.capitol') });
  }
  const v = victoryProgress(s, grid);
  const V = RESEARCH.victory;
  const nation = s.research.victory
    ? t('obj.nationDone')
    : t('obj.nation', { era: t(`tech.era.${s.research.era}` as TextKey), pop: v.population, popNeed: V.population, out: v.outposts, outNeed: V.outposts });
  return { items, nation };
}
