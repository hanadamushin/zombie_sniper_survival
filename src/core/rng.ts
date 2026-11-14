// Seeded PRNG (xoshiro128**). All functions take a plain, JSON-serialisable RngState and
// mutate it in place, so the stream position is saved with the game.
//
//   rand(state.rng)                       main stream
//   rand(stream(state, 'colony.hire'))    persistent per-purpose stream (preferred in systems:
//                                         one system's rolls never shift another system's)
//   const r = fork(seedRng(mapSeed), 'trees')   throw-away derived stream for generators (gen/**)

export interface RngState {
  s: [number, number, number, number];
}

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function fromWords(next: () => number): RngState {
  const s: RngState['s'] = [next(), next(), next(), next()];
  if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 0x9e3779b9; // all-zero state is invalid
  return { s };
}

/** Create a stream from an integer seed. */
export function seedRng(seed: number): RngState {
  return fromWords(splitmix32(seed));
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Next raw 32-bit unsigned integer. */
export function nextU32(r: RngState): number {
  const s = r.s;
  const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = rotl(s[3], 11);
  return result;
}

/** Uniform float in [0, 1). */
export function rand(r: RngState): number {
  return nextU32(r) / 4294967296;
}

/** Uniform float in [lo, hi). */
export function randRange(r: RngState, lo: number, hi: number): number {
  return lo + (hi - lo) * rand(r);
}

/** Uniform integer in [lo, hi] (both inclusive). */
export function randInt(r: RngState, lo: number, hi: number): number {
  return lo + Math.floor(rand(r) * (hi - lo + 1));
}

/** True with probability p. */
export function chance(r: RngState, p: number): boolean {
  return rand(r) < p;
}

/** Uniformly pick one element. Throws on an empty array. */
export function pick<T>(r: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() from empty array');
  return items[Math.floor(rand(r) * items.length)] as T;
}

/** Normally distributed value (Box–Muller; consumes two uniforms). */
export function gauss(r: RngState, mean = 0, sd = 1): number {
  const u = 1 - rand(r); // (0, 1]
  const v = rand(r);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** FNV-1a hash of a label, used to derive streams. */
export function hashString(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Derive an independent stream from `parent` and a label WITHOUT advancing the parent.
 * Same parent position + same label => same stream; different labels => unrelated streams.
 */
export function fork(parent: RngState, label: string): RngState {
  const s = parent.s;
  let h = hashString(label);
  h = Math.imul(h ^ s[0], 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ rotl(s[1], 7), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ rotl(s[2], 13), 0x27d4eb2f) >>> 0;
  h = (h ^ rotl(s[3], 19)) >>> 0;
  return fromWords(splitmix32(h));
}

/**
 * Persistent named stream stored in the game state (created from the game seed on first use).
 * Structural parameter so this file does not depend on types.ts.
 */
export function stream(state: { seed: number; rngStreams: Record<string, RngState> }, label: string): RngState {
  let r = state.rngStreams[label];
  if (!r) {
    r = fork(seedRng(state.seed), label);
    state.rngStreams[label] = r;
  }
  return r;
}
