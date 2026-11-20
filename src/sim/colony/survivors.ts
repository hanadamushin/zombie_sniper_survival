// Survivors: generation (spec §4.1), candidates, hiring and dismissal.

import { chance, randInt, stream, type RngState } from '../../core/rng.ts';
import { allocId, type CellId, type GameState, type Land, type Survivor } from '../../core/types.ts';
import { COLONY } from '../../data/colony.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { FAMILY_NAMES, GIVEN_NAMES } from '../../data/names.ts';
import { TRAITS, traitOf } from '../../data/traits.ts';
import { RESEARCH } from '../../data/techs.ts';
import { getMod } from '../research/modifiers.ts';
import { logEntry, moveEars, type ColonyCtx } from './stock.ts';

const S = COLONY.survivor;

const clampStat = (v: number): number => Math.min(10, Math.max(1, v));

function rollStat(rng: RngState): number {
  let v = -S.statOffset;
  for (let i = 0; i < S.statDice; i++) v += randInt(rng, 1, S.statSides);
  return clampStat(v);
}

function rollTrait(rng: RngState): string {
  const total = TRAITS.reduce((s, t) => s + t.weight, 0);
  let r = (randInt(rng, 0, 1e6) / 1e6) * total;
  for (const t of TRAITS) {
    r -= t.weight;
    if (r <= 0) return t.id;
  }
  return TRAITS[TRAITS.length - 1]!.id;
}

export function statSum(s: Pick<Survivor, 'ath' | 'kno' | 'spd' | 'sta'>): number {
  return s.ath + s.kno + s.spd + s.sta;
}

/** Daily wage in ears (spec §4.1): a multiple of wageStep, at least wageMin. Paid in whole ears as it adds up (economy.ts payWages). */
export function wageOf(sum: number, trait: string): number {
  const raw = (S.wageBase + S.wagePerPoint * (sum - S.wageSumRef)) * (traitOf(trait).wageMul ?? 1);
  const steps = Math.round(raw / S.wageStep);
  return Math.max(S.wageMin, Math.round(steps * S.wageStep * 100) / 100);
}

/** Signing fee in whole ears (spec §4.1). */
export function signingFee(s: Survivor, state?: GameState): number {
  const fee = Math.max(1, Math.round(s.wage * S.feeDays));
  return state ? Math.max(1, Math.round(getMod(state, 'hire.fee', fee))) : fee; // recruiting (C2)
}

/** People the colony can hold: a few dozen until there is an administration (C5); beds still decide who sleeps well. */
export function populationCap(state: GameState): number {
  return getMod(state, 'colony.popCap', RESEARCH.popCap);
}

/** A new person from a cell of the given land class. Not yet part of any list. */
export function generateSurvivor(state: GameState, land: Land, rng: RngState): Survivor {
  const bias = S.landBias[land];
  const ath = clampStat(rollStat(rng) + (bias.ath ?? 0));
  const kno = clampStat(rollStat(rng) + (bias.kno ?? 0));
  const spd = rollStat(rng);
  const sta = rollStat(rng);
  const trait = rollTrait(rng);
  const name = `${FAMILY_NAMES[randInt(rng, 0, FAMILY_NAMES.length - 1)]} ${GIVEN_NAMES[randInt(rng, 0, GIVEN_NAMES.length - 1)]}`;
  return {
    id: allocId(state),
    name,
    ath, kno, spd, sta,
    wage: wageOf(ath + kno + spd + sta, trait),
    trait,
    job: 'idle',
    morale: S.morale,
    hp: S.hp,
    status: 'ok',
    weapon: S.defaultWeapon,
    location: { kind: 'home' },
    pos: [0, 0],
    task: null,
    unpaidDays: 0,
    lowMoraleDays: 0,
    meals: 0,
    missed: 0,
    infectedUntil: null,
  };
}

export const isAlive = (s: Survivor): boolean => s.status !== 'dead';
export const isHome = (s: Survivor): boolean => s.status !== 'dead' && s.location.kind === 'home';
/** At home and able to work. */
export const isFit = (s: Survivor): boolean => s.status === 'ok' && s.location.kind === 'home';

export function survivorById(state: GameState, id: number): Survivor | undefined {
  return state.colony.survivors.find((s) => s.id === id);
}

/** Take `want` people out of hiding in a cell (never more than are there). */
export function takeHidden(state: GameState, cell: CellId, want: number): number {
  const H = state.world.cells.H;
  const n = Math.max(0, Math.min(Math.floor(want), Math.floor(H[cell] ?? 0)));
  if (n > 0) H[cell] = (H[cell] ?? 0) - n;
  return n;
}
/** Someone goes back into hiding (dismissed, deserted, tired of waiting). */
export function returnHidden(state: GameState, cell: CellId | null | undefined): void {
  const H = state.world.cells.H;
  if (cell === null || cell === undefined || H[cell] === undefined || H[cell]! < 0) return;
  H[cell] = H[cell]! + 1;
}

/**
 * People found in `cell` become candidates. The cell's H drops by the number found; the number is
 * capped by H and by the room on the list.
 */
export function addCandidates(c: ColonyCtx, cell: CellId, want: number, by: 'player' | 'expedition' | 'radio'): Survivor[] {
  const { state, grid } = c;
  const E = COLONY.encounter;
  const room = Math.max(0, E.maxCandidates - state.colony.candidates.length);
  const n = takeHidden(state, cell, Math.min(want, room));
  const land = grid?.cells[cell]?.land ?? 'rural';
  const rng = stream(state, 'colony.people');
  const found: Survivor[] = [];
  for (let i = 0; i < n; i++) {
    const s = generateSurvivor(state, land, rng);
    s.fromCell = cell;
    s.waitsUntilDay = c.day + E.waitDays;
    state.colony.candidates.push(s);
    found.push(s);
    c.emit({ type: 'candidateFound', id: s.id, cell, by });
  }
  return found;
}

/** Candidates who waited too long go back into hiding where they were found. */
export function expireCandidates(c: ColonyCtx): void {
  const colony = c.state.colony;
  const gone = colony.candidates.filter((s) => (s.waitsUntilDay ?? Infinity) <= c.day);
  if (gone.length === 0) return;
  colony.candidates = colony.candidates.filter((s) => !gone.includes(s));
  for (const s of gone) {
    returnHidden(c.state, s.fromCell);
    logEntry(c, 'people', 'log.candidateLeft', { name: s.name });
  }
}

/** Where a newcomer appears: the edge of the camp, to walk in from there. */
export function arrivalPos(state: GameState): [number, number] {
  const n = state.colony.survivors.length;
  const c = TACTICAL.size / 2;
  return [c + COLONY.camp.gate[0] + (n % 5) * 1.2, c + COLONY.camp.gate[1] + Math.floor(n / 5) * 1.2];
}

export function hire(c: ColonyCtx, candidateId: number): string | null {
  const colony = c.state.colony;
  const s = colony.candidates.find((x) => x.id === candidateId);
  if (!s) return 'unknownCandidate';
  if (colony.survivors.length >= populationCap(c.state)) return 'popCap';
  const fee = signingFee(s, c.state);
  // The player pays out of pocket when the stores cannot.
  const pocket = c.state.player.inv.ears ?? 0;
  if (colony.stock.ears + pocket < fee) return 'noEars';
  if (colony.stock.ears < fee) {
    const need = fee - colony.stock.ears;
    c.state.player.inv.ears = pocket - need;
    moveEars(c, 'income', need);
  }
  moveEars(c, 'other', fee);
  colony.candidates = colony.candidates.filter((x) => x !== s);
  delete s.fromCell;
  delete s.waitsUntilDay;
  s.pos = arrivalPos(c.state);
  s.task = null;
  colony.survivors.push(s);
  logEntry(c, 'people', 'log.hired', { name: s.name, fee, wage: s.wage, trait: s.trait });
  c.emit({ type: 'survivorHired', id: s.id });
  return null;
}

export function dismiss(c: ColonyCtx, id: number): string | null {
  const colony = c.state.colony;
  const s = colony.survivors.find((x) => x.id === id);
  if (!s) return 'unknownSurvivor';
  if (s.location.kind !== 'home') return 'away';
  colony.survivors = colony.survivors.filter((x) => x !== s);
  returnHidden(c.state, c.state.world.homeCell);
  logEntry(c, 'people', 'log.dismissed', { name: s.name });
  c.emit({ type: 'survivorLeft', id: s.id, reason: 'dismissed' });
  return null;
}

/** People per hideout: one, sometimes two. */
export function hideoutGroup(state: GameState): number {
  return chance(stream(state, 'colony.hideout'), COLONY.encounter.pairChance) ? 2 : 1;
}
