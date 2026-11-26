// O1: the hidden stashes of Okinawa (the Naha garrison) and Hashima, and the clues at the landmarks —
// the whole sim on the real areas: reading clues opens the map's rumour then the cell; the Naha
// garrison's depot is locked until the commander's safe (10,000 ears) is searched; B takes its
// rounds; the elites in the HQ's armory become candidates (all stats 10, the lowest wage) and are
// hired; Hashima is reached by boat (an hour) and holds the materials and the builders; an expedition
// carries a stash home; and all of it survives a save and a load.
import { describe, expect, it } from 'vitest';
import { emptyInputFrame, type GameState, type StaticGrid } from '../src/core/types.ts';
import { deserialize, serialize } from '../src/core/save.ts';
import { BALANCE } from '../src/data/balance.ts';
import type { TacticalMap } from '../src/gen/index.ts';
import { generateSurvivor, signingFee } from '../src/sim/colony/survivors.ts';
import { stream } from '../src/core/rng.ts';
import { ctxNow } from '../src/sim/colony/stock.ts';
import { sendExpedition } from '../src/sim/colony/expeditions.ts';
import { createSim, type Sim } from '../src/sim/index.ts';
import { supportAt } from '../src/sim/tactical/collision.ts';
import { placePlayer } from '../src/sim/tactical/player.ts';
import { beginAt } from '../src/sim/world/start.ts';
import { cluesFor, cluesOf, expeditionHaul, onIsland, stashKnown, stashLeft, stashSite, stashTargets } from '../src/sim/world/stash.ts';
import { currentHint } from '../src/ui/guide.ts';
import { ja } from '../src/ui/i18n/ja.ts';
import { LANDMARKS } from '../src/data/landmarks/index.ts';
import { realToArea } from '../src/gen/real/landmarks.ts';
import { generateTacticalMap } from '../src/gen/index.ts';
import { areaParams, mapOf } from '../src/sim/tactical/area.ts';
import { gameState, loadGrid, loadRealIndexes, provideAround } from '../tools/real/lib/game.ts';

const DT = BALANCE.time.fixedStep;
const HOME = 25912; // Kagoshima: the Okinawa ferry's port, and Nagasaki by land
const NAHA = BALANCE.okinawa.cell;
const HASHIMA = BALANCE.hashima.cell;

const grid: StaticGrid = loadGrid();
loadRealIndexes(grid);

function start(): { state: GameState; sim: Sim } {
  provideAround(grid, HOME);
  const state = gameState(grid, 12, null);
  beginAt(state, grid, HOME);
  const sim = createSim({ grid });
  sim.tick(state, DT, emptyInputFrame());
  return { state, sim };
}

/** Put the player into a cell's area (no zombies: the test is about the stash, not the fight). */
function goTo(state: GameState, sim: Sim, cell: number): TacticalMap {
  provideAround(grid, cell);
  state.world.cells.Z[cell] = 0;
  state.player.cell = cell;
  state.tactical = null;
  sim.tick(state, DT, emptyInputFrame());
  const map = mapOf(state);
  expect(map, `area of ${cell}`).not.toBeNull();
  state.tactical!.zombies.length = 0;
  return map!;
}

function standAt(state: GameState, map: TacticalMap, x: number, y: number, z: number): void {
  placePlayer(state.player, map, x, z, 0);
  state.player.pos[1] = supportAt(map, x, z, y + 0.05);
}

const press = (state: GameState, sim: Sim): void => sim.tick(state, DT, { ...emptyInputFrame(), interact: true });
const command = (state: GameState, sim: Sim, cmd: Parameters<Sim['dispatch']>[0]): void => {
  sim.dispatch(cmd);
  sim.tick(state, DT, emptyInputFrame());
};

describe('the clues at the landmarks (O1)', () => {
  it('stand by every landmark the table marks (10 cities or so for Okinawa, 3–4 Kyushu ones for Hashima), never a memorial', () => {
    expect(cluesFor('okinawa').length).toBeGreaterThanOrEqual(10);
    expect(cluesFor('hashima').length).toBeGreaterThanOrEqual(3);
    for (const s of LANDMARKS) if (s.memorial) expect(s.clues, s.id).toBeUndefined();
    const state = gameState(grid, 12, null);
    for (const id of ['okinawa', 'hashima'] as const) {
      for (const spot of cluesFor(id)) {
        const { cell } = realToArea(spot.lat, spot.lon);
        provideAround(grid, cell);
        const map = generateTacticalMap(areaParams(state, grid, cell)!);
        const board = cluesOf(map).find((b) => `landmark.${b.variant}` === spot.id && b.stash === id);
        expect(board, `${spot.id} → ${id}`).toBeDefined();
        const lot = map.placements.find((p) => p.def === spot.id)!;
        expect(Math.hypot(Math.max(lot.x0 - board!.pos[0], 0, board!.pos[0] - lot.x1), Math.max(lot.z0 - board!.pos[2], 0, board!.pos[2] - lot.z1))).toBeLessThan(8);
        expect((ja as Record<string, string>)[`clue.${board!.variant}.${id[0]}`], `text of ${spot.id}`).toBeTruthy();
      }
    }
  }, 120_000);

  it('one clue gives the rumour, two the stash\'s cell; the hint says how to cross', () => {
    const { state, sim } = start();
    expect(stashKnown(state, 'okinawa')).toBe('none');
    for (const [cell, n] of [[4800, 1], [HOME, 2]] as const) {
      const map = goTo(state, sim, cell);
      const board = cluesOf(map).find((b) => b.stash === 'okinawa')!;
      expect(board, `clue in ${cell}`).toBeDefined();
      standAt(state, map, board.pos[0], board.pos[1], board.pos[2]);
      press(state, sim);
      expect(state.flags[`seen.clue.${board.variant}.o`]).toBe(true);
      expect(state.colony.log.at(-1)!.text).toBe('log.clueOkinawa');
      expect(state.colony.log.at(-1)!.params!.n).toBe(n);
      if (n === 1) {
        expect(stashKnown(state, 'okinawa')).toBe('rumour');
        expect(stashTargets(state)).not.toContain(NAHA);
        expect(currentHint(state)?.id).toBe('okinawa');
      }
    }
    expect(stashKnown(state, 'okinawa')).toBe('exact');
    expect(stashTargets(state)).toContain(NAHA);
    // Read clues are kept in a save.
    const back = deserialize(serialize(state));
    expect(stashKnown(back, 'okinawa')).toBe('exact');
  });
});

describe('the Okinawa stash in the Naha garrison (O1)', () => {
  it('opens with the safe: 10,000 ears, B takes the rounds, the elites join; kept over a save', () => {
    const { state, sim } = start();
    const map = goTo(state, sim, NAHA);
    const site = stashSite(map)!;
    expect(site).not.toBeNull();
    expect(map.placements[site.host]!.def).toMatch(/^base\.jgsdf/);
    // The depot is locked until the safe has been searched.
    state.player.inv.ammo = 0;
    standAt(state, map, site.supply[0], site.supply[1], site.supply[2]);
    command(state, sim, { type: 'resupply' });
    expect(state.player.inv.ammo).toBe(0);
    expect(state.colony.log.at(-1)!.text).toBe('log.stashLocked');
    // The commander's safe: the vault's ears and the key.
    const safe = state.tactical!.lootSpots.find((s) => s.key && s.enter === site.host)!;
    expect(safe, 'the host safe is a search point').toBeDefined();
    standAt(state, map, safe.pos[0], safe.y!, safe.pos[1]);
    const ears = state.player.inv.ears ?? 0;
    press(state, sim);
    expect(state.player.inv.ears).toBe(ears + BALANCE.okinawa.vault);
    expect(state.world.stashes!.okinawa!.vault).toBe(true);
    expect(map.placements[site.host]!.open).toBe(true);
    // B at the depot: up to the carry limit; the rest stays.
    standAt(state, map, site.supply[0], site.supply[1], site.supply[2]);
    const carried = state.player.inv.ammo ?? 0; // (the safe holds a few rounds of its own)
    command(state, sim, { type: 'resupply' });
    expect(state.player.inv.ammo).toBe(BALANCE.player.maxAmmo);
    const took = BALANCE.player.maxAmmo - carried;
    expect(stashLeft(state, 'okinawa').ammo).toBe(100_000 - took);
    // The elites, hiding in the HQ's armory.
    const elites = state.tactical!.hideouts!.filter((h) => h.elite !== undefined);
    expect(elites.length).toBe(BALANCE.okinawa.elites.length);
    const h = elites[0]!;
    standAt(state, map, h.pos[0], h.y!, h.pos[1]);
    press(state, sim);
    const cand = state.colony.candidates.find((s) => s.name === BALANCE.okinawa.elites[0]!.name)!;
    expect(cand).toBeDefined();
    expect([cand.ath, cand.kno, cand.spd, cand.sta]).toEqual([10, 10, 10, 10]);
    expect(cand.trait).toBe('specops');
    expect(cand.wage).toBe(BALANCE.elite.wage);
    expect(signingFee(cand, state)).toBe(1);
    expect(cand.waitsUntilDay).toBeUndefined(); // they wait as long as it takes
    command(state, sim, { type: 'hire', candidate: cand.id });
    const hired = state.colony.survivors.find((s) => s.name === cand.name)!;
    expect(hired.location.kind).toBe('home');
    // A save and a load keep the rounds taken, the vault and who was met; a new visit does not give them again.
    const json = serialize(state);
    expect(json).toContain('"okinawa"');
    const back = deserialize(json);
    expect(back.world.stashes!.okinawa).toEqual({ taken: { ammo: took }, vault: true, met: [0] });
    expect(back.colony.survivors.some((s) => s.name === cand.name && s.trait === 'specops')).toBe(true);
    const sim2 = createSim({ grid });
    const map2 = goTo(back, sim2, NAHA);
    const again = back.tactical!.hideouts!.filter((x) => x.elite !== undefined);
    expect(again.map((x) => x.elite)).toEqual([1, 2, 3]);
    const safe2 = back.tactical!.lootSpots.find((s) => s.key && s.enter === site.host)!;
    standAt(back, map2, safe2.pos[0], safe2.y!, safe2.pos[1]);
    const before = back.player.inv.ears ?? 0;
    press(back, sim2);
    expect(back.player.inv.ears).toBe(before); // the vault is empty
    expect(map2.placements[site.host]!.open).toBe(true); // the key still opens the depot
    // Home: the ears are handed in (the ledger takes 10,000 as any income).
    back.player.cell = HOME;
    back.tactical = null;
    for (let i = 0; i < 70; i++) sim2.tick(back, 1, emptyInputFrame());
    expect(back.player.inv.ears ?? 0).toBe(0);
    expect(back.colony.stock.ears).toBeGreaterThanOrEqual(BALANCE.okinawa.vault - 10);
  });

  it('can be carried home by an expedition sent from anywhere once its cell is known', () => {
    const { state } = start();
    // Not known: no target.
    expect(stashTargets(state)).not.toContain(NAHA);
    state.flags['seen.clue.kyoto_tower.o'] = true;
    state.flags['seen.clue.saigo_statue.o'] = true;
    expect(stashTargets(state)).toContain(NAHA);
    const c = ctxNow(state, grid, () => {});
    const haul = expeditionHaul(c, NAHA, 3);
    const room = state.colony.capacity.ammo;
    expect(haul.ammo).toBe(Math.min(3 * BALANCE.okinawa.carryPerMember, room));
    expect(state.world.stashes!.okinawa!.taken.ammo).toBe(haul.ammo);
    // Sending one is allowed whatever the radius (here: across the Okinawa ferry).
    const rng = stream(state, 'test.people');
    for (let i = 0; i < 2; i++) state.colony.survivors.push(generateSurvivor(state, 'urban', rng));
    const ids = state.colony.survivors.slice(-2).map((x) => x.id);
    expect(sendExpedition(c, ids, NAHA, 'unarmed')).toBeNull();
    expect(state.world.expeditions.at(-1)!.target).toBe(NAHA);
  });
});

describe('Hashima (O1)', () => {
  it('is reached by boat (an hour), holds the materials and the builders, and the boat brings one back', () => {
    const { state, sim } = start();
    const map = goTo(state, sim, HASHIMA);
    const site = stashSite(map)!;
    expect(map.placements[site.host]!.def).toBe('landmark.hashima');
    const lot = map.placements[site.host]!;
    // The island is 1/3 to 1/2 of the real one (480 × 160 m).
    expect(Math.max(lot.x1 - lot.x0, lot.z1 - lot.z0)).toBeGreaterThanOrEqual(160);
    expect(site.dock).not.toBeNull();
    expect(site.shore).not.toBeNull();
    // The landing on the peninsula: far over the water from the island.
    expect(Math.hypot(site.shore![0] - site.dock![0], site.shore![2] - site.dock![2])).toBeGreaterThan(150);
    standAt(state, map, site.shore![0], site.shore![1], site.shore![2]);
    expect(onIsland(state)).toBe(false);
    const minute = state.time.day * 1440 + state.time.minute;
    press(state, sim);
    sim.tick(state, DT, emptyInputFrame());
    expect(onIsland(state)).toBe(true);
    expect(state.time.day * 1440 + state.time.minute - minute).toBeGreaterThanOrEqual(BALANCE.hashima.boatMinutes);
    const island = state.tactical!.zombies.filter((z) => z.pos[0] >= lot.x0 && z.pos[0] <= lot.x1 && z.pos[2] >= lot.z0 && z.pos[2] <= lot.z1);
    expect(island.length).toBeGreaterThan(0);
    expect(island.length).toBeLessThanOrEqual(BALANCE.hashima.zombies);
    state.tactical!.zombies.length = 0;
    // B in the store: as much as the stores at home have room for.
    standAt(state, map, site.supply[0], site.supply[1], site.supply[2]);
    command(state, sim, { type: 'resupply' });
    const wood = state.player.inv.wood ?? 0;
    expect(wood).toBeGreaterThan(0);
    expect(wood).toBeLessThanOrEqual(BALANCE.hashima.playerCarry.wood!);
    expect(stashLeft(state, 'hashima').wood).toBe(10_000 - wood);
    // The builders on the first floor of block 65.
    const elites = state.tactical!.hideouts!.filter((h) => h.elite !== undefined);
    expect(elites.length).toBe(BALANCE.hashima.elites.length);
    standAt(state, map, elites[2]!.pos[0], elites[2]!.y!, elites[2]!.pos[1]);
    press(state, sim);
    const cand = state.colony.candidates.find((s) => s.trait === 'artisan')!;
    expect(cand).toBeDefined();
    expect(cand.ath + cand.kno + cand.spd + cand.sta).toBe(40);
    // Back over the water.
    standAt(state, map, site.dock![0], site.dock![1], site.dock![2]);
    press(state, sim);
    sim.tick(state, DT, emptyInputFrame());
    expect(onIsland(state)).toBe(false);
    // Known now (taken from): an expedition may be sent; it brings what fits.
    expect(stashTargets(state)).toContain(HASHIMA);
    const back = deserialize(serialize(state));
    expect(back.world.stashes!.hashima!.taken.wood).toBe(wood);
    expect(back.world.stashes!.hashima!.met).toEqual([2]);
    const c = ctxNow(back, grid, () => {});
    const haul = expeditionHaul(c, HASHIMA, 2);
    expect(haul.metal).toBe(Math.min(2 * BALANCE.hashima.carryPerMember, back.colony.capacity.metal - (state.colony.stock.metal ?? 0)));
  });
});
