// O1: the hidden stashes (docs/02_systems_spec.md §3.12) — the last SDF depot of Okinawa in the Naha
// garrison (100,000 rounds, 10,000 ears in the commander's safe, four elites in the HQ's armory) and
// the builders' hoard on Hashima (10,000 of every building material, three elites in the old flats,
// reached by boat). Same place and contents in every game; what has been taken is in
// `state.world.stashes`. The clues at the landmarks of the great cities (data/landmarks `clues`)
// tell of them: reading them is remembered in `state.flags['seen.clue.<variant>.<o|h>']` (the 08
// `markSeen` store) and opens the strategic map's rumour, then the stash's cell.
//
// Where things stand in an area comes from the host building's blueprint: its `marks` (Hashima's
// blueprint names its store, its hideout, its landing and where its dead stand), or — for a garrison
// without marks — its key rooms: the elites in the locked room nearest the safe, the supply in the
// one farthest from it (both open with the key of the safe, 07d-2f).

import { randInt, stream } from '../../core/rng.ts';
import { RESOURCE_IDS, STASH_IDS, type CellId, type GameState, type ResourceId, type StashId, type StashState, type StaticGrid, type Survivor } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { LANDMARKS, type LandmarkSpot } from '../../data/landmarks/index.ts';
import { blueprintOf, toWorld, type BuildingPlacement } from '../../gen/buildings/index.ts';
import { stashHost, stashOfCell } from '../../gen/stash.ts';
import { GROUND, type TacticalMap } from '../../gen/types.ts';
import { logEntry, moveStock, type ColonyCtx } from '../colony/stock.ts';
import { generateSurvivor } from '../colony/survivors.ts';
import { areaOf } from '../tactical/area.ts';
import { heightAt, isWalkable } from '../tactical/collision.ts';
import { addZombie } from '../tactical/zombies.ts';

type Res = Exclude<ResourceId, 'ears'>;
type V3 = [number, number, number];

export const stashDef = (id: StashId) => BALANCE[id];

// ---------------------------------------------------------------------------------------------
// What is left, what is known
// ---------------------------------------------------------------------------------------------

/** The saved record of a stash (made on first touch). */
export function stashState(state: GameState, id: StashId): StashState {
  const all = (state.world.stashes ??= {});
  return (all[id] ??= { taken: {} });
}

/** What the supply point of a stash still holds. */
export function stashLeft(state: GameState, id: StashId): Partial<Record<Res, number>> {
  const taken = state.world.stashes?.[id]?.taken ?? {};
  const out: Partial<Record<Res, number>> = {};
  for (const [res, n] of Object.entries(stashDef(id).stock) as [Res, number][]) out[res] = Math.max(0, n - (taken[res] ?? 0));
  return out;
}
export function stashTotalLeft(state: GameState, id: StashId): number {
  return Object.values(stashLeft(state, id)).reduce((a, b) => a + (b ?? 0), 0);
}

/** Flag of a read clue (08's `seen.` store; short: the variant and the stash's initial). */
export function clueKey(variant: string, id: StashId): string {
  return `seen.clue.${variant}.${id[0]}`;
}
/** The table's clue boards that point at a stash. */
export function cluesFor(id: StashId): LandmarkSpot[] {
  return LANDMARKS.filter((s) => s.clues?.includes(id));
}
export function cluesRead(state: GameState, id: StashId): number {
  let n = 0;
  for (const s of cluesFor(id)) if (state.flags[clueKey(s.id.slice('landmark.'.length), id)] === true) n++;
  return n;
}
/**
 * What the player knows of a stash: nothing, the rumour (one clue: "in Okinawa", "on Hashima"), or
 * its cell (BALANCE.clues.<id>Exact clues, or anything taken there already).
 */
export function stashKnown(state: GameState, id: StashId): 'none' | 'rumour' | 'exact' {
  const read = cluesRead(state, id);
  const s = state.world.stashes?.[id];
  const touched = s !== undefined && (Object.keys(s.taken).length > 0 || s.vault === true || (s.met?.length ?? 0) > 0);
  if (touched || read >= (id === 'okinawa' ? BALANCE.clues.okinawaExact : BALANCE.clues.hashimaExact)) return 'exact';
  return read > 0 ? 'rumour' : 'none';
}

// ---------------------------------------------------------------------------------------------
// Where it stands in its area
// ---------------------------------------------------------------------------------------------

export interface StashSite {
  id: StashId;
  /** Index of the host building in map.placements (applyKeys may swap the placement for an open copy). */
  host: number;
  /** The supply point (feet). */
  supply: V3;
  /** Where the elites hide (one each). */
  hides: V3[];
  /** Hashima: the island's landing and the mainland's (feet); null elsewhere. */
  dock: V3 | null;
  shore: V3 | null;
  /** Where the island's zombies are put when the player lands. */
  zombies: V3[];
}

const sites = new WeakMap<TacticalMap, StashSite | null>();

const worldPt = (p: BuildingPlacement, q: readonly [number, number, number]): V3 => {
  const [x, z] = toWorld(p, q[0], q[2]);
  return [x, p.base + q[1], z];
};

/** The stash of this map's cell and where its parts are, or null (not a stash cell, or no host built). */
export function stashSite(map: TacticalMap): StashSite | null {
  const known = sites.get(map);
  if (known !== undefined) return known;
  const id = stashOfCell(map.params.real?.cell);
  let site: StashSite | null = null;
  const host = id ? stashHost(id, map.placements) : -1;
  if (id && host >= 0) {
    const p = map.placements[host]!;
    const bp = blueprintOf(p);
    const marks = bp.marks ?? {};
    let supply: V3;
    let hides: V3[];
    if (marks.stash?.length) {
      supply = worldPt(p, marks.stash[0]!);
      hides = (marks.hide ?? marks.stash).map((q) => worldPt(p, q));
    } else {
      // A garrison: by its key rooms on the ground floor (the safe is upstairs).
      const safe = bp.search.find((s) => s.key) ?? bp.search[0];
      const keyRooms = bp.rooms.filter((r) => r.key && r.level === 0);
      const centre = (r: (typeof keyRooms)[number]): [number, number, number] => [(r.x0 + r.x1) / 2, r.y, (r.z0 + r.z1) / 2];
      if (keyRooms.length > 0 && safe) {
        const d = (r: (typeof keyRooms)[number]): number => Math.hypot((r.x0 + r.x1) / 2 - safe.pos[0], (r.z0 + r.z1) / 2 - safe.pos[2]);
        const byNear = [...keyRooms].sort((a, b) => d(a) - d(b) || a.id - b.id);
        const hideRoom = byNear[0]!;
        const store = byNear.length > 1 ? byNear[byNear.length - 1]! : hideRoom;
        supply = worldPt(p, centre(store));
        const [cx, cy, cz] = centre(hideRoom);
        const along = hideRoom.x1 - hideRoom.x0 >= hideRoom.z1 - hideRoom.z0;
        const span = Math.max(0.6, (along ? hideRoom.x1 - hideRoom.x0 : hideRoom.z1 - hideRoom.z0) - 1.2);
        const n = stashDef(id).elites.length;
        hides = Array.from({ length: n }, (_, i) => {
          const u = n > 1 ? (i / (n - 1) - 0.5) * span : 0;
          return worldPt(p, along ? [cx + u, cy, cz] : [cx, cy, cz + u]);
        });
      } else {
        const c: [number, number, number] = [p.w / 2, 0, p.d / 2];
        supply = worldPt(p, c);
        hides = stashDef(id).elites.map(() => worldPt(p, c));
      }
    }
    const local = marks.dock?.[0];
    const dock = local ? worldPt(p, local) : null;
    site = {
      id, host, supply, hides, dock,
      shore: dock && local ? shoreFor(map, p, dock, local) : null,
      zombies: (marks.zombies ?? []).map((q) => worldPt(p, q)),
    };
  }
  sites.set(map, site);
  return site;
}

/** The mainland's landing for an island's: out from the landing past the lot's front (local +z), the first dry ground. */
function shoreFor(map: TacticalMap, p: BuildingPlacement, dock: V3, local: readonly [number, number, number]): V3 | null {
  const [ax, az] = toWorld(p, local[0], local[2]);
  const [bx, bz] = toWorld(p, local[0], local[2] + 1);
  const dx = bx - ax;
  const dz = bz - az;
  const dry = (x: number, z: number): boolean => {
    const tx = Math.floor(x / map.tile);
    const tz = Math.floor(z / map.tile);
    if (tx < 2 || tz < 2 || tx >= map.tiles - 2 || tz >= map.tiles - 2) return false;
    if (x > p.x0 - 2 && x < p.x1 + 2 && z > p.z0 - 2 && z < p.z1 + 2) return false;
    return isWalkable(map, tx, tz) && map.ground[tz * map.tiles + tx] !== GROUND.water;
  };
  // Straight out first (the peninsula across the water), then a little either side.
  for (const a of [0, 0.08, -0.08, 0.16, -0.16, 0.3, -0.3]) {
    for (let r = 4; r < map.size; r += 2) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = dock[0] + (dx * c - dz * s) * r;
      const z = dock[2] + (dx * s + dz * c) * r;
      // Three metres onto the land (not on the water's edge), and land that goes on (not a rock in the sea).
      const ux = dx * c - dz * s;
      const uz = dx * s + dz * c;
      if (dry(x, z) && [3, 8, 16, 28].every((m) => dry(x + ux * m, z + uz * m))) {
        const fx = x + (dx * c - dz * s) * 3;
        const fz = z + (dx * s + dz * c) * 3;
        return [fx, heightAt(map, fx, fz), fz];
      }
    }
  }
  return null;
}

/** The current area's stash, if the player is in a stash cell and its map is made. */
function siteHere(state: GameState): { site: StashSite; map: TacticalMap } | null {
  const area = areaOf(state);
  if (!area || state.world.travel || state.flags.range || state.tactical?.cell !== state.player.cell) return null;
  const site = stashSite(area.map);
  return site ? { site, map: area.map } : null;
}

/** Can the supply point / the elites be reached: no key needed, or the safe has opened the host's locked rooms. */
export function stashOpen(map: TacticalMap, site: StashSite): boolean {
  return !stashDef(site.id).locked || map.placements[site.host]?.open === true;
}

const near = (state: GameState, q: V3, reach: number): boolean => {
  const p = state.player.pos;
  return Math.hypot(q[0] - p[0], q[2] - p[2]) <= reach && Math.abs(q[1] - p[1]) < 2;
};

/** The stash's supply point within reach of the player (B), or null. */
export function stashInReach(state: GameState): { site: StashSite; map: TacticalMap } | null {
  const h = siteHere(state);
  if (!h || state.player.aim.deadT > 0) return null;
  return near(state, h.site.supply, BALANCE.world.caches.reach) ? h : null;
}

/**
 * B at a stash: Okinawa's rounds up to the carry limit; Hashima's materials, a load at a time, as much
 * as the stores at home still have room for (what is carried in counts). Returns a rejection or null.
 */
export function takeFromStash(c: ColonyCtx): string | null {
  const { state } = c;
  const h = stashInReach(state);
  if (!h) return 'notHome';
  const { site, map } = h;
  if (!stashOpen(map, site)) return 'stashLocked';
  const left = stashLeft(state, site.id);
  const inv = state.player.inv;
  const st = stashState(state, site.id);
  const def = stashDef(site.id);
  if (site.id === 'okinawa') {
    const room = BALANCE.player.maxAmmo - (inv.ammo ?? 0);
    if (room <= 0) return 'full';
    const got = Math.floor(Math.min(room, left.ammo ?? 0));
    if (got <= 0) return 'noAmmo';
    st.taken.ammo = (st.taken.ammo ?? 0) + got;
    inv.ammo = (inv.ammo ?? 0) + got;
    c.emit({ type: 'resupplied', ammo: got });
    return null;
  }
  const carry = (def as typeof BALANCE.hashima).playerCarry;
  const items: Partial<Record<Res, number>> = {};
  let any = false;
  let empty = true;
  for (const [res, n] of Object.entries(carry) as [Res, number][]) {
    const have = left[res] ?? 0;
    if (have > 0) empty = false;
    const room = Math.max(0, state.colony.capacity[res] - state.colony.stock[res] - (inv[res] ?? 0));
    const got = Math.floor(Math.min(n, have, room));
    if (got <= 0) continue;
    st.taken[res] = (st.taken[res] ?? 0) + got;
    inv[res] = (inv[res] ?? 0) + got;
    items[res] = got;
    any = true;
  }
  if (empty) return 'noMaterials';
  if (!any) return 'storesFull';
  logEntry(c, 'search', 'log.stashTaken', { items: Object.entries(items).map(([r, n]) => `${r}:${n}`).join('|') });
  return null;
}

/** After a search: the host's safe holds the vault's ears (once a game). */
export function openVault(c: ColonyCtx, spot: { key?: boolean; enter?: number }): void {
  const h = siteHere(c.state);
  if (!h || !spot.key || spot.enter !== h.site.host) return;
  const def = stashDef(h.site.id);
  const st = stashState(c.state, h.site.id);
  if (st.vault || def.vault <= 0) return;
  st.vault = true;
  const inv = c.state.player.inv;
  inv.ears = (inv.ears ?? 0) + def.vault;
  logEntry(c, 'search', 'log.stashVault', { n: def.vault });
}

// ---------------------------------------------------------------------------------------------
// The elites
// ---------------------------------------------------------------------------------------------

/** Put the elites not yet met at their hiding places (once per visit, with the other hideouts). */
export function eliteHideouts(state: GameState): void {
  const t = state.tactical;
  const h = siteHere(state);
  if (!t || !h || !t.hideouts) return;
  const met = new Set(state.world.stashes?.[h.site.id]?.met ?? []);
  stashDef(h.site.id).elites.forEach((_, i) => {
    if (met.has(i) || t.hideouts!.some((o) => o.elite === i)) return;
    const q = h.site.hides[i] ?? h.site.hides[0]!;
    t.hideouts!.push({ spot: -1, pos: [q[0], q[2]], met: false, sure: true, elite: i, y: q[1] });
  });
}

/** May the player talk to this elite now (the locked rooms open)? */
export function eliteReachable(state: GameState): boolean {
  const h = siteHere(state);
  return h !== null && stashOpen(h.map, h.site);
}

/** One of the elites, as the candidate the player meets. */
export function makeElite(state: GameState, id: StashId, index: number): Survivor {
  const e = stashDef(id).elites[index]!;
  const s = generateSurvivor(state, 'urban', stream(state, 'colony.elite'));
  const top = BALANCE.elite.stat;
  s.name = e.name;
  s.ath = top;
  s.kno = top;
  s.spd = top;
  s.sta = top;
  s.trait = e.trait;
  s.wage = BALANCE.elite.wage;
  return s;
}

/** Talking to an elite: they join the candidates (they wait for as long as it takes) and never hide again. */
export function meetElite(c: ColonyCtx, index: number): Survivor | null {
  const h = siteHere(c.state);
  if (!h) return null;
  const st = stashState(c.state, h.site.id);
  if (st.met?.includes(index)) return null;
  (st.met ??= []).push(index);
  const s = makeElite(c.state, h.site.id, index);
  s.fromCell = c.state.player.cell;
  c.state.colony.candidates.push(s);
  c.emit({ type: 'candidateFound', id: s.id, cell: c.state.player.cell, by: 'player' });
  logEntry(c, 'people', 'log.eliteMet', { name: s.name, trait: s.trait });
  return s;
}

// ---------------------------------------------------------------------------------------------
// Hashima's boat
// ---------------------------------------------------------------------------------------------

/** The landing within reach of the player: 'island' (to go back) or 'shore' (to go over), or null. */
export function dockInReach(state: GameState): 'island' | 'shore' | null {
  const h = siteHere(state);
  if (!h || !h.site.dock || !h.site.shore || state.player.aim.deadT > 0) return null;
  const reach = BALANCE.hashima.dockReach;
  if (near(state, h.site.dock, reach)) return 'island';
  if (near(state, h.site.shore, reach)) return 'shore';
  return null;
}

/** Is the player on the island (inside the host's lot)? */
export function onIsland(state: GameState): boolean {
  const h = siteHere(state);
  if (!h || !h.site.dock) return false;
  const p = h.map.placements[h.site.host]!;
  const [x, , z] = state.player.pos;
  return x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;
}

/**
 * E at a landing: across the water (an hour passes). Landing on the island wakes its dead: up to
 * BALANCE.hashima.zombies stand about its alleys and roofs (those already there count).
 */
export function takeBoat(c: ColonyCtx): string | null {
  const { state } = c;
  const h = siteHere(state);
  const at = dockInReach(state);
  if (!h || !at || !h.site.dock || !h.site.shore) return 'noBoat';
  const to = at === 'shore' ? h.site.dock : h.site.shore;
  const p = state.player;
  p.pos = [to[0], to[1] + 0.05, to[2]];
  p.vel = [0, 0, 0];
  p.aim.airPeak = null;
  // Face back over the water to where the boat came from? No: face inland, away from the water.
  const from = at === 'shore' ? h.site.shore : h.site.dock;
  p.yaw = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
  const t = state.tactical!;
  // Whatever was after the player stays on the other side.
  for (const z of t.zombies) if (z.state === 'chase' || z.state === 'attack' || z.state === 'alert') {
    z.state = 'wander';
    z.target = null;
    z.t = 2;
  }
  t.bullets.length = 0;
  state.flags.skipMinutes = Number(state.flags.skipMinutes ?? 0) + BALANCE.hashima.boatMinutes;
  if (at === 'shore') wakeIsland(state, h.site, h.map);
  logEntry(c, 'travel', at === 'shore' ? 'log.boatOver' : 'log.boatBack', {});
  return null;
}

function wakeIsland(state: GameState, site: StashSite, map: TacticalMap): void {
  const area = areaOf(state);
  const t = state.tactical;
  if (!area || !t || site.zombies.length === 0) return;
  const p = map.placements[site.host]!;
  const onLot = t.zombies.filter((z) => z.state !== 'down' && z.pos[0] >= p.x0 && z.pos[0] <= p.x1 && z.pos[2] >= p.z0 && z.pos[2] <= p.z1).length;
  const want = BALANCE.hashima.zombies - onLot;
  if (want <= 0 || t.zombies.length >= BALANCE.zombie.max) return;
  const rng = stream(state, 'stash.island');
  const kinds = ['walker', 'walker', 'walker', 'runner', 'brute'] as const;
  for (let i = 0; i < want; i++) {
    const q = site.zombies[(i + randInt(rng, 0, site.zombies.length - 1)) % site.zombies.length]!;
    const z = addZombie(state, area, kinds[randInt(rng, 0, kinds.length - 1)]!, q[0] + (i % 3) * 0.7, q[2] + Math.floor(i / 3) * 0.7, randInt(rng, 0, 628) / 100);
    if (z) z.pos[1] = Math.max(z.pos[1], q[1]);
  }
}

// ---------------------------------------------------------------------------------------------
// The clues at the landmarks
// ---------------------------------------------------------------------------------------------

export interface ClueBoard {
  /** The landmark's variant (`landmark.<variant>`) and the stash it tells of. */
  variant: string;
  stash: StashId;
  /** Feet of the reader, and the way the board faces (yaw of a reader looking at it). */
  pos: V3;
  yaw: number;
}

const boards = new WeakMap<TacticalMap, ClueBoard[]>();
const SPOTS = new Map(LANDMARKS.filter((s) => s.clues?.length).map((s) => [s.id, s]));

/** The clue boards of a map: by the entrance of every landmark the table gives clues (one board per stash). */
export function cluesOf(map: TacticalMap): ClueBoard[] {
  const known = boards.get(map);
  if (known) return known;
  const out: ClueBoard[] = [];
  for (const p of map.placements) {
    const spot = SPOTS.get(p.def);
    if (!spot?.clues || spot.memorial) continue;
    const variant = p.def.slice('landmark.'.length);
    // Candidate places: before the front (z = d), then the sides, then the back (local), 2.5–6 m out.
    const tries: [number, number, number][] = [];
    for (const out of [2.5, 4.5, 6.5]) tries.push([p.w / 2, p.d + out, 0], [p.w / 2 - 4, p.d + out, 0], [p.w / 2 + 4, p.d + out, 0]);
    for (const out of [2.5, 5]) tries.push([-out, p.d / 2, 1], [p.w + out, p.d / 2, 1], [p.w / 2, -out, 2]);
    let k = 0;
    for (const id of spot.clues) {
      let placed: ClueBoard | null = null;
      for (let i = k; i < tries.length && !placed; i++) {
        const [lx, lz] = tries[i]!;
        const [x, z] = toWorld(p, lx, lz);
        const tx = Math.floor(x / map.tile);
        const tz = Math.floor(z / map.tile);
        if (tx < 1 || tz < 1 || tx >= map.tiles - 1 || tz >= map.tiles - 1) continue;
        if (!isWalkable(map, tx, tz) || map.ground[tz * map.tiles + tx] === GROUND.water) continue;
        // Facing the lot: the reader looks from the board's front towards the landmark.
        const [cx, cz] = toWorld(p, p.w / 2, p.d / 2);
        placed = { variant, stash: id, pos: [x, heightAt(map, x, z), z], yaw: Math.atan2(-(cx - x), -(cz - z)) };
        k = i + 1;
      }
      if (placed) out.push(placed);
    }
  }
  boards.set(map, out);
  return out;
}

export function clueIsRead(state: GameState, b: Pick<ClueBoard, 'variant' | 'stash'>): boolean {
  return state.flags[clueKey(b.variant, b.stash)] === true;
}

/** The clue board within reach of the player, or null. */
export function clueInReach(state: GameState): ClueBoard | null {
  const area = areaOf(state);
  if (!area || state.world.travel || state.flags.range || state.player.aim.deadT > 0) return null;
  let best: ClueBoard | null = null;
  let bd = Infinity;
  for (const b of cluesOf(area.map)) {
    const d = Math.hypot(b.pos[0] - state.player.pos[0], b.pos[2] - state.player.pos[2]);
    if (d <= BALANCE.clues.reach && Math.abs(b.pos[1] - state.player.pos[1]) < 2.5 && d < bd) {
      best = b;
      bd = d;
    }
  }
  return best;
}

/** E at a clue: it is read (once is enough; reading it again only shows it again). */
export function readClue(c: ColonyCtx, b: ClueBoard): void {
  const key = clueKey(b.variant, b.stash);
  if (c.state.flags[key] === true) return;
  c.state.flags[key] = true;
  logEntry(c, 'search', b.stash === 'okinawa' ? 'log.clueOkinawa' : 'log.clueHashima', { n: cluesRead(c.state, b.stash) });
}

// ---------------------------------------------------------------------------------------------
// Expeditions to a stash (the way to carry it home)
// ---------------------------------------------------------------------------------------------

/** The stash cells an expedition may be sent to whatever the radius: those whose cell is known. */
export function stashTargets(state: GameState): CellId[] {
  return STASH_IDS.filter((id) => stashKnown(state, id) === 'exact').map((id) => BALANCE[id].cell);
}

/**
 * A party back from a stash's cell carries home what `back` people can (BALANCE.<id>.carryPerMember
 * of each thing), never more than the stores have room for: the rest stays.
 */
export function expeditionHaul(c: ColonyCtx, cell: CellId, back: number): Partial<Record<Res, number>> {
  const id = stashOfCell(cell);
  const out: Partial<Record<Res, number>> = {};
  if (!id || back <= 0) return out;
  // A garrison's depot needs its key: a party brings tools to break in (the key is the player's way only).
  const left = stashLeft(c.state, id);
  const st = stashState(c.state, id);
  const per = stashDef(id).carryPerMember * back;
  for (const res of RESOURCE_IDS) {
    if (res === 'ears') continue;
    const have = left[res as Res] ?? 0;
    if (have <= 0) continue;
    const room = Math.max(0, c.state.colony.capacity[res] - c.state.colony.stock[res]);
    const n = Math.floor(Math.min(have, per, room));
    if (n <= 0) continue;
    moveStock(c, res as Res, n);
    st.taken[res] = (st.taken[res] ?? 0) + n;
    out[res as Res] = n;
  }
  return out;
}

/** Strategic map / HUD: the stash's supply point as a place with rounds (Okinawa), when its cell is known. */
export function stashSupply(state: GameState, grid: StaticGrid | null | undefined, mapOfCell?: (cell: CellId) => TacticalMap | null): { cell: CellId; ammo: number; pos: [number, number] }[] {
  const out: { cell: CellId; ammo: number; pos: [number, number] }[] = [];
  for (const id of STASH_IDS) {
    const ammo = stashLeft(state, id).ammo ?? 0;
    if (ammo <= 0 || stashKnown(state, id) !== 'exact' || (grid && !grid.cells[BALANCE[id].cell])) continue;
    const map = mapOfCell?.(BALANCE[id].cell) ?? null;
    const site = map ? stashSite(map) : null;
    out.push({ cell: BALANCE[id].cell, ammo: Math.floor(ammo), pos: site ? [site.supply[0], site.supply[2]] : [512, 512] });
  }
  return out;
}
