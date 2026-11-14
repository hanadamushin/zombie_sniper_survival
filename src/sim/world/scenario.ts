// Bundled infection scenarios (public/data/infection_<n>.bin): binary codec and loading into a
// fresh GameState. Written by tools/run-infection.ts, read by the app at "new game".
//
// Layout (little endian):
//   u32 magic 'ZINF' | u16 version | u16 scenario | u32 seed | u16 days | u16 sourceCount | u32 n
//   u16 sources[sourceCount] (hub ids, padded to a multiple of 4 bytes)
//   u32 S[n] | u32 Z[n] | u32 H[n] | u32 loot[n] (loot * 1e5)        <- full state after `days`
//   u8  snapshots[(days + 1) * n]                                    <- log-quantised Z per day
// n = number of land cells; all arrays follow StaticGrid.landIds order.

import type { GameState, StaticGrid } from '../../core/types.ts';

const MAGIC = 0x464e495a; // 'ZINF'
const VERSION = 1;
const LOOT_SCALE = 1e5;
/** Quantisation steps per decade: byte = 1 + round(log10(Z) * Q_PER_DECADE), 0 = no zombies. */
const Q_PER_DECADE = 36;

export interface ScenarioData {
  scenario: number;
  seed: number;
  days: number;
  /** Hub ids where the outbreak started. */
  sources: number[];
  S: Uint32Array;
  Z: Uint32Array;
  H: Uint32Array;
  /** loot * 1e5 */
  loot: Uint32Array;
  /** (days + 1) rows of n bytes. */
  snapshots: Uint8Array;
}

export function quantizeZ(z: number): number {
  if (z <= 0) return 0;
  return Math.min(255, 1 + Math.round(Math.log10(z) * Q_PER_DECADE));
}
export function dequantizeZ(q: number): number {
  return q <= 0 ? 0 : Math.round(10 ** ((q - 1) / Q_PER_DECADE));
}

export function encodeScenario(d: ScenarioData): Uint8Array {
  const n = d.S.length;
  const srcBytes = Math.ceil((d.sources.length * 2) / 4) * 4;
  const header = 20;
  const bytes = new Uint8Array(header + srcBytes + n * 16 + d.snapshots.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, d.scenario, true);
  view.setUint32(8, d.seed, true);
  view.setUint16(12, d.days, true);
  view.setUint16(14, d.sources.length, true);
  view.setUint32(16, n, true);
  d.sources.forEach((s, i) => view.setUint16(header + i * 2, s, true));
  let off = header + srcBytes;
  for (const arr of [d.S, d.Z, d.H, d.loot]) {
    for (let i = 0; i < n; i++) view.setUint32(off + i * 4, arr[i]!, true);
    off += n * 4;
  }
  bytes.set(d.snapshots, off);
  return bytes;
}

export function decodeScenario(buffer: ArrayBuffer): ScenarioData {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== MAGIC) throw new Error('Not an infection scenario file');
  if (view.getUint16(4, true) !== VERSION) throw new Error('Unsupported infection scenario version');
  const days = view.getUint16(12, true);
  const sourceCount = view.getUint16(14, true);
  const n = view.getUint32(16, true);
  const sources: number[] = [];
  for (let i = 0; i < sourceCount; i++) sources.push(view.getUint16(20 + i * 2, true));
  let off = 20 + Math.ceil((sourceCount * 2) / 4) * 4;
  const read = (): Uint32Array => {
    const out = new Uint32Array(n);
    for (let i = 0; i < n; i++) out[i] = view.getUint32(off + i * 4, true);
    off += n * 4;
    return out;
  };
  const S = read();
  const Z = read();
  const H = read();
  const loot = read();
  const snapshots = new Uint8Array(buffer, off, (days + 1) * n);
  return { scenario: view.getUint16(6, true), seed: view.getUint32(8, true), days, sources, S, Z, H, loot, snapshots };
}

/** Fill a new game's world from a bundled scenario (state after the last precomputed day). */
export function initWorld(state: GameState, grid: StaticGrid, data: ScenarioData): void {
  if (data.S.length !== grid.landIds.length) throw new Error('Scenario does not match the grid');
  const size = grid.gridW * grid.gridH;
  const world = state.world;
  world.scenario = data.scenario;
  world.gridW = grid.gridW;
  world.gridH = grid.gridH;
  world.cells = {
    S: new Array<number>(size).fill(0),
    Z: new Array<number>(size).fill(-1),
    H: new Array<number>(size).fill(0),
    loot: new Array<number>(size).fill(0),
    visited: new Array<boolean>(size).fill(false),
    intel: new Array<number>(size).fill(0),
  };
  grid.landIds.forEach((id, i) => {
    world.cells.S[id] = data.S[i]!;
    world.cells.Z[id] = data.Z[i]!;
    world.cells.H[id] = data.H[i]!;
    world.cells.loot[id] = data.loot[i]! / LOOT_SCALE;
  });
}
