// Economy (spec §5): wages every morning, meals, the food market between the farmers and the
// community, the neutral village, and ammunition made by the crafters.

import { foodSaving, isBuilt } from '../build/structures.ts';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { COLONY, SUPPLY_IDS, type SupplyId } from '../../data/colony.ts';
import { hasFlag } from '../research/modifiers.ts';
import { getMod } from '../research/modifiers.ts';
import { cellsWithin } from '../world/grid.ts';
import { facilityFactor, mealPerDay } from './jobs.ts';
import { logEntry, moveEars, moveStock, type ColonyCtx } from './stock.ts';
import { isAlive, isHome, statSum } from './survivors.ts';

const E = COLONY.economy;

/** Food the people at home eat per day. */
export function foodNeedPerDay(state: GameState): number {
  let need = 0;
  for (const s of state.colony.survivors) if (isHome(s)) need += mealPerDay(s);
  return need;
}

/** Days the food in stock lasts (the target when nobody eats). */
export function foodDays(state: GameState): number {
  const need = foodNeedPerDay(state);
  return need > 0 ? state.colony.stock.food / need : E.targetFoodDays;
}

/** Price of one food in ears (spec §5). */
export function foodPriceFor(days: number, state?: GameState): number {
  // Trade (C4a) lowers the price, a market and food security (A8) cap its swings.
  const max = state ? Math.max(E.priceMin, getMod(state, 'food.priceMax', E.priceMax)) : E.priceMax;
  const price = E.foodBasePrice * Math.min(max, Math.max(E.priceMin, E.priceTop - E.pricePerDay * days));
  return state ? getMod(state, 'food.price', price) : price;
}

/** What a survivor is paid per day: the agreed wage as the colony's institutions bend it (trade, discipline, currency). */
export function wageDue(state: GameState, s: { wage: number }): number {
  return Math.round(getMod(state, 'wage', s.wage) * 100) / 100;
}

/** Every hour: new price, the community buys from its farmers, surplus produce rots. */
export function marketHour(c: ColonyCtx): void {
  const { state } = c;
  const colony = state.colony;
  colony.foodPrice = foodPriceFor(foodDays(state), state);
  const want = E.targetFoodDays * foodNeedPerDay(state) - colony.stock.food;
  const room = colony.capacity.food - colony.stock.food;
  const qty = Math.min(want, room, colony.market.food, colony.stock.ears / colony.foodPrice);
  if (qty > 1e-6) {
    const paid = moveEars(c, 'food', qty * colony.foodPrice);
    const bought = paid / colony.foodPrice;
    colony.market.food -= bought;
    moveStock(c, 'food', bought);
    c.emit({ type: 'foodBought', amount: bought, cost: paid, source: 'farmers' });
  }
  const farmersN = colony.survivors.filter((s) => s.job === 'farming' && isHome(s)).length;
  colony.market.food = Math.min(colony.market.food, E.marketBase + E.marketPerFarmer * farmersN);
  if (colony.policy.autoBuyFood && foodDays(state) < E.autoBuyBelowDays && foodNeedPerDay(state) > 0) {
    const short = foodNeedPerDay(state) * E.autoBuyBelowDays - colony.stock.food;
    buyFromVillage(c, Math.ceil(short), true);
  }
}

/** True when a farming village is within reach of the home cell. */
export function villageNear(state: GameState, grid: StaticGrid | null): boolean {
  const home = state.world.homeCell;
  if (!grid || home === null) return false;
  const cells = state.world.cells;
  for (const id of cellsWithin(grid, home, E.villageRadius)) {
    if (grid.cells[id]?.land !== 'rural') continue;
    if ((cells.H[id] ?? 0) + (cells.S[id] ?? 0) >= E.villageMinPeople) return true;
  }
  return false;
}

export function villagePrice(state?: GameState): number {
  const price = E.foodBasePrice * E.villageFactor;
  return state ? getMod(state, 'food.price', price) : price;
}

/** Buy food from the village (spec §5). Returns a rejection reason, or null when something was bought. */
export function buyFromVillage(c: ColonyCtx, amount: number, quiet = false): string | null {
  const colony = c.state.colony;
  if (!villageNear(c.state, c.grid)) return 'noVillage';
  const price = villagePrice(c.state);
  const left = E.villageDailyCap - colony.villageBought;
  const qty = Math.min(amount, left, colony.capacity.food - colony.stock.food, Math.floor((colony.stock.ears / price) * 10) / 10);
  if (left <= 0) return 'dailyCap';
  if (!(qty > 0)) return colony.stock.ears < price ? 'noEars' : 'noRoom';
  const paid = moveEars(c, 'food', qty * price);
  moveStock(c, 'food', qty);
  colony.villageBought += qty;
  if (!quiet || colony.villageBought === qty) logEntry(c, 'economy', 'log.villageFood', { n: Math.round(qty * 10) / 10, cost: Math.round(paid * 10) / 10 });
  c.emit({ type: 'foodBought', amount: qty, cost: paid, source: 'village' });
  return null;
}

/** 09b: is a market standing? (It widens what the pedlars bring and lowers their prices.) */
function marketStands(state: GameState): boolean {
  return state.build.structures.some((s) => s.def === 'market' && isBuilt(s));
}

/** 09b: ears per unit of a supply: cheaper with a market standing and with the trade technology (C4a). */
export function supplyPrice(state: GameState, res: SupplyId): number {
  const S = E.supply;
  return S.price[res] * (marketStands(state) ? S.marketPrice : 1) * (hasFlag(state, 'trade') ? S.tradePrice : 1);
}

/** 09b: ears that can be spent on supplies per day: the base, its market, and every manned outpost by its tier. */
export function supplyDailyEars(state: GameState): number {
  const S = E.supply;
  let cap = S.dailyEars + (marketStands(state) ? S.marketEars : 0);
  for (const o of state.world.outposts) if (o.garrison.length > 0) cap += S.outpostEars * o.tier;
  return cap;
}

/** 09b: do the pedlars come yet? (From the settlement era on: data economy.supply.fromEra.) */
export function supplyOpen(state: GameState): boolean {
  return state.world.homeCell !== null && (state.research.era >= E.supply.fromEra || state.flags.unlockAll === true);
}

/** 09b: units of a supply one press of the button buys (about `lotEars` ears' worth, what today's limit, the ears and the stores allow). */
export function supplyLot(state: GameState, res: SupplyId): number {
  const colony = state.colony;
  if (!supplyOpen(state)) return 0;
  const price = supplyPrice(state, res);
  const left = supplyDailyEars(state) - colony.supplyBought;
  const afford = Math.floor(Math.min(E.supply.lotEars, left, colony.stock.ears) / price + 1e-9);
  return Math.max(0, Math.min(afford, Math.floor(colony.capacity[res] - colony.stock[res])));
}

/** 09b: buy supplies for ears (spec §5). Returns a rejection reason, or null when something was bought. */
export function buySupply(c: ColonyCtx, resource: string, amount: number): string | null {
  const colony = c.state.colony;
  if (c.state.world.homeCell === null) return 'noHome';
  if (!supplyOpen(c.state)) return 'noPedlar';
  if (!(SUPPLY_IDS as readonly string[]).includes(resource)) return 'unknownResource';
  const res = resource as SupplyId;
  const price = supplyPrice(c.state, res);
  const left = supplyDailyEars(c.state) - colony.supplyBought;
  if (left < price) return 'dailyCap';
  const qty = Math.floor(Math.min(amount, left / price + 1e-9, colony.capacity[res] - colony.stock[res], colony.stock.ears / price + 1e-9));
  if (!(qty > 0)) return colony.stock.ears < price ? 'noEars' : 'noRoom';
  const paid = moveEars(c, 'other', qty * price);
  moveStock(c, res, qty);
  colony.supplyBought = Math.round((colony.supplyBought + paid) * 1000) / 1000;
  logEntry(c, 'economy', 'log.supplyBought', { items: `${res}:${qty}`, cost: Math.round(paid * 10) / 10 });
  return null;
}

/**
 * Morning wages (spec §5). Farmers live off their sales. When the ears run short, the most able
 * go unpaid first: the others are paid in ascending order of ability.
 * 07e: a wage is a fraction of an ear. Each morning it is added to what the person is owed and the
 * whole ears of that are paid; the fraction waits for the next day. A morning on which the stores
 * cannot pay the whole ears due is an unpaid day: that day's wage is forfeited (as before 07e) and
 * the earlier fraction stays owed.
 */
export function payWages(c: ColonyCtx): void {
  const colony = c.state.colony;
  const due = colony.survivors.filter((s) => isAlive(s) && s.job !== 'farming').sort((a, b) => statSum(a) - statSum(b) || a.id - b.id);
  let total = 0;
  const unpaid: string[] = [];
  for (const s of due) {
    const wage = wageDue(c.state, s);
    const owed = (s.wageOwed ?? 0) + wage;
    const pay = Math.floor(owed + 1e-9);
    if (colony.stock.ears >= pay) {
      total += moveEars(c, 'wages', pay);
      s.wageOwed = Math.max(0, Math.round((owed - pay) * 1000) / 1000);
      s.unpaidDays = 0;
    } else {
      s.unpaidDays += 1;
      unpaid.push(s.name);
    }
  }
  for (const s of colony.survivors) if (s.job === 'farming') s.unpaidDays = 0;
  if (unpaid.length > 0) logEntry(c, 'economy', 'log.unpaid', { n: unpaid.length, names: unpaid.slice(0, 3).join('、'), ears: Math.floor(colony.stock.ears) });
  if (due.length > 0) c.emit({ type: 'wagesPaid', total, unpaid: unpaid.length });
}

/** One of the three meals: farmers eat their own produce first, everyone else from the stores. */
export function serveMeal(c: ColonyCtx): void {
  const colony = c.state.colony;
  const saving = (1 - foodSaving(c.state)) * getMod(c.state, 'food.use', 1); // a canteen wastes less (06), rationing (C1)
  let missed = 0;
  for (const s of colony.survivors) {
    if (!isHome(s)) continue;
    const need = (mealPerDay(s) / 3) * saving;
    let got = 0;
    if (s.job === 'farming') {
      got = Math.min(need, colony.market.food);
      colony.market.food -= got;
    }
    if (got < need - 1e-9) {
      if (colony.stock.food >= need - got - 1e-9) got += moveStock(c, 'food', -(need - got));
      else {
        // Not a full meal for this one: what was taken from the produce goes back.
        if (s.job === 'farming') colony.market.food += got;
        got = 0;
      }
    }
    if (got >= need - 1e-6) s.meals += 1;
    else {
      s.missed += 1;
      missed++;
    }
  }
  if (missed > 0) logEntry(c, 'economy', 'log.noFood', { n: missed });
}

/** Crafting points become ammunition, one batch at a time, while the materials last. */
export function craftMinute(c: ColonyCtx): void {
  const colony = c.state.colony;
  const K = COLONY.craft;
  const cost = getMod(c.state, 'craft.cost', 1); // ammunition engineering (W6b)
  const metal = K.metal * cost;
  const parts = K.parts * cost;
  while (colony.work.craft >= K.work) {
    if (colony.stock.metal < metal || colony.stock.parts < parts) {
      // Idle hands: the crafters cannot bank more than one batch of work.
      if (colony.work.craft > K.work) {
        colony.work.craft = K.work;
        if (c.state.flags.craftIdleDay !== c.day) {
          c.state.flags.craftIdleDay = c.day;
          logEntry(c, 'economy', 'log.noMaterials', {});
        }
      }
      return;
    }
    colony.work.craft -= K.work;
    moveStock(c, 'metal', -metal);
    moveStock(c, 'parts', -parts);
    moveStock(c, 'ammo', K.ammo);
  }
}

/** Whether hand-made ammunition is the best the colony can do right now (UI hint). */
export function craftingByHand(state: GameState): boolean {
  return facilityFactor(state, 'crafting') < 1;
}
