// GameEvent: sim -> render / ui / audio, and sim -> sim (other systems, one tick later).
// Events are buffered during a tick and delivered to subscribers when the tick ends
// (docs/04_architecture.md §6). Payloads may gain fields; add new event types at the bottom.

import type { CellId, EntityId, Mode, Speed, ZombieKind } from './types.ts';

type Vec3 = [number, number, number];
export type HitPart = 'head' | 'torso' | 'legs';
export type HitSurface = 'terrain' | 'tree' | 'building' | 'stair' | 'rock' | 'prop';

export type GameEvent =
  // --- time (01) ---
  | { type: 'hourStarted'; day: number; hour: number }
  | { type: 'dayStarted'; day: number }
  | { type: 'speedChanged'; speed: Speed }
  | { type: 'modeChanged'; mode: Mode; prev: Mode }
  | { type: 'commandRejected'; command: string; reason: string }
  // --- tactical (03/04) ---
  | { type: 'shotFired'; pos: Vec3; dir: Vec3; weapon: string; scoped?: boolean }
  /** 04 added: surface (what was hit when no zombie), dir (flight direction), range (m flown), killed. */
  | { type: 'bulletHit'; zombie: EntityId | null; part: HitPart | null; pos: Vec3; surface?: HitSurface; dir?: Vec3; range?: number; killed?: boolean }
  /** `by`: the player, a defender's id, or a structure's id (barbed wire, moat). */
  | { type: 'zombieKilled'; id: EntityId; kind: ZombieKind; by: EntityId | 'player'; headshot: boolean; pos: Vec3; knife?: boolean }
  | { type: 'earsCollected'; amount: number }
  | { type: 'playerHurt'; amount: number; hp: number; cause?: 'bite' | 'fall' | 'infection' }
  | { type: 'playerDied'; cause?: 'bite' | 'fall' | 'infection' }
  // --- tactical, added by 04 ---
  | { type: 'dryFire' }
  | { type: 'reloadStarted'; seconds: number }
  | { type: 'reloadDone'; mag: number }
  | { type: 'knifeSwing'; hit: EntityId | null; killed: boolean }
  | { type: 'playerInfected'; untilDay: number; untilMinute: number }
  /** Provisional: the player is back on their feet after dying (05 replaces the rules). */
  | { type: 'playerRevived' }
  | { type: 'zombieAlerted'; id: EntityId; chase: boolean }
  // --- build / defense (06) ---
  | { type: 'structureDamaged'; id: EntityId; hp: number }
  | { type: 'structureDestroyed'; id: EntityId; def: string }
  | { type: 'structureBuilt'; id: EntityId; def: string }
  | { type: 'moatBridged'; id: EntityId }
  | { type: 'hordeWarning'; arrivesDay: number; arrivesMinute: number; size: number; dir: number }
  | { type: 'hordeArrived'; size: number; dir: number }
  // --- build / defense, added by 06 ---
  | { type: 'blueprintPlaced'; id: EntityId; def: string }
  | { type: 'structureRemoved'; id: EntityId; def: string }
  | { type: 'raidStarted'; kind: 'night' | 'horde'; size: number; dir: number; away: boolean }
  | { type: 'raidEnded'; kind: 'night' | 'horde'; killed: number; repelled: boolean; away: boolean }
  | { type: 'defenderFired'; id: EntityId; pos: Vec3; target: Vec3; hit: boolean }
  | { type: 'survivorHurt'; id: EntityId; hp: number }
  | { type: 'outpostUpgraded'; id: EntityId; tier: number }
  | { type: 'outpostSupplied'; id: EntityId; ammo: number }
  // --- colony (05) ---
  | { type: 'survivorHired'; id: EntityId }
  | { type: 'survivorDied'; id: EntityId; cause: string }
  | { type: 'survivorLeft'; id: EntityId; reason: string }
  | { type: 'expeditionReturned'; id: EntityId; survivors: EntityId[]; lost: EntityId[] }
  | { type: 'wagesPaid'; total: number; unpaid: number }
  // --- colony, added by 05 ---
  | { type: 'candidateFound'; id: EntityId; cell: CellId; by: 'player' | 'expedition' | 'radio' }
  | { type: 'spotSearched'; spot: number; items: string }
  | { type: 'expeditionSent'; id: EntityId; target: CellId; members: EntityId[] }
  | { type: 'earsDeposited'; amount: number }
  | { type: 'resupplied'; ammo: number }
  | { type: 'foodBought'; amount: number; cost: number; source: string }
  | { type: 'colonyLog'; kind: string; text: string }
  // --- research / progression (07) ---
  | { type: 'techCompleted'; id: string }
  | { type: 'eraAdvanced'; era: 0 | 1 | 2 | 3 }
  | { type: 'victory'; tech?: string }
  | { type: 'defeat'; reason: string }
  // --- world (02/06) ---
  | { type: 'outpostFounded'; id: EntityId; cell: CellId }
  | { type: 'outpostLost'; id: EntityId; cell: CellId }
  // --- world: travel and infection (02) ---
  | { type: 'travelStarted'; from: CellId; to: CellId; minutes: number }
  | { type: 'cellEntered'; cell: CellId; from: CellId }
  | { type: 'travelArrived'; cell: CellId }
  /** Placeholder: rolled when entering a cell on the road; no effect yet (later sessions). */
  | { type: 'travelEncounter'; cell: CellId; danger: number }
  | { type: 'infectionStepped'; day: number; homeInflow: number };

export type GameEventType = GameEvent['type'];
export type EventOf<K extends GameEventType> = Extract<GameEvent, { type: K }>;

type Listener<K extends GameEventType> = (event: EventOf<K>) => void;
type AnyListener = (event: GameEvent) => void;

/** Buffered, typed event bus. `emit` only queues; `flush` delivers in emission order. */
export class EventBus {
  private buffer: GameEvent[] = [];
  private listeners = new Map<GameEventType, Set<AnyListener>>();
  private anyListeners = new Set<AnyListener>();

  emit(event: GameEvent): void {
    this.buffer.push(event);
  }

  /** Subscribe to one event type. Returns an unsubscribe function. */
  on<K extends GameEventType>(type: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(listener as AnyListener);
    return () => set.delete(listener as AnyListener);
  }

  /** Subscribe to every event. Returns an unsubscribe function. */
  onAny(listener: AnyListener): () => void {
    this.anyListeners.add(listener);
    return () => this.anyListeners.delete(listener);
  }

  /** Deliver all buffered events and return them. Events emitted by listeners go to the next flush. */
  flush(): GameEvent[] {
    if (this.buffer.length === 0) return [];
    const batch = this.buffer;
    this.buffer = [];
    for (const event of batch) {
      const set = this.listeners.get(event.type);
      if (set) for (const l of set) this.deliver(l, event);
      for (const l of this.anyListeners) this.deliver(l, event);
    }
    return batch;
  }

  private deliver(listener: AnyListener, event: GameEvent): void {
    try {
      listener(event);
    } catch (err) {
      // A broken subscriber (render/ui/audio) must not corrupt the simulation step.
      console.error(`[events] listener for "${event.type}" threw`, err);
    }
  }
}
