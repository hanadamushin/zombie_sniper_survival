// Scavenging expeditions (spec §4.4): send a party to a cell, wait, roll who comes back, bring home
// loot, ears and sometimes people. Nothing of it is drawn — the result is told in the log.

import { chance, randInt, randRange, stream } from '../../core/rng.ts';
import { addMinutes, hasReached } from '../../core/time.ts';
import { allocId, type CellId, type Expedition, type GameState, type ResourceId, type StaticGrid, type Survivor } from '../../core/types.ts';
import { COLONY, expeditionWeapon, type ExpeditionWeapon } from '../../data/colony.ts';
import { lootYield } from './loot.ts';
import { RESEARCH } from '../../data/techs.ts';
import { traitOf } from '../../data/traits.ts';
import { techUnlocked } from '../build/structures.ts';
import { getMod } from '../research/modifiers.ts';
import { dangerOf, removeZombies } from '../world/derive.ts';
import { cellDistance, cellsWithin } from '../world/grid.ts';
import { findRoute } from '../world/travel.ts';
import { expeditionHaul, stashTargets } from '../world/stash.ts';
import { jobMul, outputPerHour } from './jobs.ts';
import { killSurvivor } from './morale.ts';
import { itemsParam, logEntry, moveEars, moveStock, type ColonyCtx } from './stock.ts';
import { addCandidates, isFit } from './survivors.ts';

const X = COLONY.expedition;

/** Chance that one member comes back unharmed (spec §4.4). */
export function returnChance(s: Pick<Survivor, 'ath' | 'spd' | 'trait'>, weapon: ExpeditionWeapon, partySize: number, danger: number, bonus = 0): number {
  const p = X.base + X.perAth * s.ath + X.perSpd * s.spd + weapon.bonus + bonus + X.perMember * (partySize - 1) - X.dangerWeight * danger + (traitOf(s.trait).returnBonus ?? 0);
  return Math.min(X.max, Math.max(X.min, p));
}

export function weaponAvailable(state: GameState, w: ExpeditionWeapon): boolean {
  return techUnlocked(state, w.tech);
}

/** How far a party may go (cells): field rations (A6a) and a tier-2 outpost extend it. */
export function expeditionRadius(state: GameState): number {
  return getMod(state, 'expedition.radius', X.radius) + (state.world.outposts.some((o) => o.tier >= 2) ? RESEARCH.outpostReach : 0);
}
/** Danger of a target as the party meets it (scouts, C6b, take the edge off) and what technology adds to the return chance. */
export function expeditionDanger(state: GameState, cell: CellId): number {
  return Math.min(1, Math.max(0, getMod(state, 'expedition.danger', dangerOf(state.world.cells.Z[cell] ?? 0))));
}
export function expeditionBonus(state: GameState): number {
  return getMod(state, 'expedition.bonus', 0);
}
/** Rounds a party draws from the stores. */
export function expeditionAmmo(state: GameState, weapon: ExpeditionWeapon, members: number): number {
  return Math.ceil(getMod(state, 'ammo.issue', weapon.ammo) * members);
}

export interface ExpeditionTarget {
  cell: CellId;
  /** Minutes one way, and for the whole trip including the search. */
  travelMinutes: number;
  totalMinutes: number;
  danger: number;
}

/** Cells a party can be sent to: within the radius of the home cell and reachable over land. */
export function expeditionTargets(state: GameState, grid: StaticGrid): ExpeditionTarget[] {
  const home = state.world.homeCell;
  if (home === null) return [];
  const out: ExpeditionTarget[] = [];
  const timeMul = getMod(state, 'expedition.time', 1);
  // O1: a hidden stash whose cell is known is a target whatever the distance (the way to carry it home).
  const cells = cellsWithin(grid, home, expeditionRadius(state));
  for (const c of stashTargets(state)) if (!cells.includes(c)) cells.push(c);
  for (const cell of cells) {
    if (cell === home) continue;
    const route = findRoute(grid, home, cell);
    if (!route) continue;
    out.push({ cell, travelMinutes: route.minutes, totalMinutes: Math.round((2 * route.minutes + X.searchHours * 60) * timeMul), danger: expeditionDanger(state, cell) });
  }
  return out.sort((a, b) => a.travelMinutes - b.travelMinutes || a.cell - b.cell);
}

/** Handle `sendExpedition`. Returns a rejection reason or null. */
export function sendExpedition(c: ColonyCtx, memberIds: number[], target: CellId, weaponId: string): string | null {
  const { state, grid } = c;
  const home = state.world.homeCell;
  if (!grid || home === null) return 'noMap';
  const ids = [...new Set(memberIds)];
  if (ids.length < X.minMembers || ids.length > X.maxMembers) return 'partySize';
  const members = ids.map((id) => state.colony.survivors.find((s) => s.id === id));
  if (members.some((s) => !s || !isFit(s))) return 'memberUnavailable';
  const weapon = expeditionWeapon(weaponId);
  if (!weapon || !weaponAvailable(state, weapon)) return 'weapon';
  if (!grid.cells[target] || target === home || (cellDistance(grid, home, target) > expeditionRadius(state) && !stashTargets(state).includes(target))) return 'tooFar';
  const route = findRoute(grid, home, target);
  if (!route) return 'noRoute';
  const ammo = expeditionAmmo(state, weapon, ids.length);
  if (state.colony.stock.ammo < ammo) return 'noAmmo';
  if (ammo > 0) moveStock(c, 'ammo', -ammo);

  const back = addMinutes({ day: c.day, minute: c.minute }, Math.round((2 * route.minutes + X.searchHours * 60) * getMod(state, 'expedition.time', 1)));
  const exp: Expedition = {
    id: allocId(state), members: ids, target, from: home, weapon: weapon.id,
    departDay: c.day, departMinute: c.minute, returnDay: back.day, returnMinute: back.minute, resolved: false,
  };
  state.world.expeditions.push(exp);
  for (const s of members as Survivor[]) {
    s.status = 'away';
    s.location = { kind: 'expedition', id: exp.id };
    s.weapon = weapon.id;
    s.task = null;
  }
  logEntry(c, 'expedition', 'log.expSent', { names: (members as Survivor[]).map((s) => s.name).join('、'), n: ids.length, cell: target, weapon: weapon.id });
  c.emit({ type: 'expeditionSent', id: exp.id, target, members: ids });
  return null;
}

/** Resolve every party whose return time has come. */
export function expeditionsMinute(c: ColonyCtx): void {
  const world = c.state.world;
  if (world.expeditions.length === 0) return;
  const now = { day: c.day, minute: c.minute };
  for (const exp of world.expeditions) {
    if (!exp.resolved && hasReached(now, { day: exp.returnDay, minute: exp.returnMinute })) resolve(c, exp);
  }
  world.expeditions = world.expeditions.filter((e) => !e.resolved);
}

function resolve(c: ColonyCtx, exp: Expedition): void {
  const { state, grid } = c;
  exp.resolved = true;
  const rng = stream(state, 'colony.expedition');
  const cells = state.world.cells;
  const party = exp.members.map((id) => state.colony.survivors.find((s) => s.id === id)).filter((s): s is Survivor => !!s);
  const weapon = expeditionWeapon(exp.weapon) ?? expeditionWeapon('unarmed')!;
  const danger = expeditionDanger(state, exp.target);
  const bonus = expeditionBonus(state);
  const land = grid?.cells[exp.target]?.land ?? 'rural';

  const fine: Survivor[] = [];
  const hurt: Survivor[] = [];
  const dead: Survivor[] = [];
  for (const s of party) {
    if (chance(rng, returnChance(s, weapon, party.length, danger, bonus))) fine.push(s);
    else if (chance(rng, X.deathShare)) dead.push(s);
    else hurt.push(s);
  }

  // What they carry home: scavenging output over the search hours, scaled by what the cell still holds.
  const loot = Math.max(0, cells.loot[exp.target] ?? 0);
  const pointsOf = (s: Survivor): number => outputPerHour({ ...s, status: 'ok' }, 'scavenging') * jobMul(state, 'scavenging') * X.searchHours;
  let points = 0;
  let best: Survivor | null = null;
  for (const s of fine) {
    points += pointsOf(s);
    if (!best || pointsOf(s) > pointsOf(best)) best = s;
  }
  for (const s of hurt) points += pointsOf(s) * X.injuredCarry;
  const haul: Partial<Record<ResourceId, number>> = {};
  let top: ResourceId | null = null;
  for (const [res, expected] of lootYield(land, points)) {
    const amount = Math.round(expected * loot * randRange(rng, 0.8, 1.2) * 10) / 10;
    if (amount <= 0) continue;
    haul[res] = amount;
    moveStock(c, res, amount);
    if (top === null || amount > (haul[top] ?? 0)) top = res;
  }
  cells.loot[exp.target] = Math.max(0, loot - points * X.lootPerPoint);

  // Zombies put down on the way, and their ears.
  const kills = removeZombies(state, exp.target, Math.round(party.length * weapon.kills * (0.4 + danger)));
  const ears = Math.floor(kills * X.earsPerKill * ((fine.length + hurt.length) / Math.max(1, party.length)));
  if (ears > 0) {
    moveEars(c, 'income', ears);
    haul.ears = ears;
  }
  if ((cells.intel[exp.target] ?? 0) < 2) cells.intel[exp.target] = 2;
  // O1: from a hidden stash, as much as the people who came back can carry and the stores can hold.
  const fromStash = expeditionHaul(c, exp.target, fine.length + hurt.length);

  // The story, one line per thing that happened.
  const back = fine.length + hurt.length;
  logEntry(c, 'expedition', back > 0 ? 'log.expBack' : 'log.expLost', { cell: exp.target, land, n: party.length, back });
  if (back > 0 && Object.keys(haul).length > 0) logEntry(c, 'expedition', 'log.expHaul', { items: itemsParam(haul) });
  else if (back > 0) logEntry(c, 'expedition', 'log.expEmpty', {});
  if (best && top) logEntry(c, 'expedition', 'log.expFind', { name: best.name, items: itemsParam({ [top]: haul[top] }) });
  if (Object.keys(fromStash).length > 0) logEntry(c, 'expedition', 'log.expStash', { items: itemsParam(fromStash) });
  if (kills > 0) logEntry(c, 'expedition', 'log.expKills', { n: kills, weapon: weapon.id });

  for (const s of [...fine, ...hurt]) {
    s.location = { kind: 'home' };
    s.status = 'ok';
    s.task = null;
  }
  for (const s of hurt) {
    s.hp = Math.min(s.hp, randInt(rng, X.injuredHp[0], X.injuredHp[1]));
    if (chance(rng, getMod(state, 'infection.chance', X.infectedShare))) {
      s.status = 'infected';
      const until = addMinutes({ day: c.day, minute: c.minute }, getMod(state, 'infection.hours', COLONY.health.infectionHours) * 60);
      s.infectedUntil = { day: until.day, minute: until.minute };
      logEntry(c, 'expedition', 'log.expBitten', { name: s.name });
    } else {
      s.status = 'injured';
      logEntry(c, 'expedition', 'log.expHurt', { name: s.name });
    }
  }
  for (const s of dead) {
    logEntry(c, 'expedition', 'log.expDead', { name: s.name });
    killSurvivor(c, s, 'expedition');
  }

  // People found hiding out there follow the party home.
  if (back > 0 && (cells.H[exp.target] ?? 0) > 0 && chance(rng, X.rescueChance + X.rescuePerMember * (party.length - 1))) {
    const found = addCandidates(c, exp.target, randInt(rng, X.rescueGroup[0], X.rescueGroup[1]), 'expedition');
    if (found.length > 0) logEntry(c, 'expedition', 'log.expRescue', { names: found.map((s) => s.name).join('、'), n: found.length });
  }
  c.emit({ type: 'expeditionReturned', id: exp.id, survivors: [...fine, ...hurt].map((s) => s.id), lost: dead.map((s) => s.id) });
}
