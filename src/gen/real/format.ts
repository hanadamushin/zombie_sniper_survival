// R0: the real-map data of one cell's operation area (public/data/areas/<region>/<cell>.bin),
// written by tools/real/region.ts and read by the game. Pure: no DOM, no Node.
//
// The area of a cell is the whole real 10 km square of the cell shrunk 1/10 horizontally (1024 m
// in the game): its north-west corner is the area's (0, 0), x east, z south, in game metres.
//
// File = gzip of the layout below (little-endian; "vu" = unsigned LEB128 varint, "vs" = zigzag varint):
//   'RA01' u32 cell  u16 version  u16 height multiplier (percent)
//   elevation   ELEV_N² samples, 0.5 m units, row by row from the north; sea = SEA_CODE.
//               Residual of the planar predictor (left + up - upper-left), as vs.
//   land use    LU_N² classes (LU) at the elevation lattice points, run-length: (vu class, vu run)…
//   durable     DUR_N² shares 0..15 of durable / tall building cover, run-length like land use
//   population  POP_N² vu persons per km² (1 km census meshes)
//   lines       vu count, then per line: u8 kind, u8 flags, u8 width (m), vu points, first point vs vs
//               (0.5 m units), then deltas vs vs
//   points      vu count, then per point: u8 kind, u8 grade, vs x, vs z (0.5 m), u8 name bytes, UTF-8

export const ELEV_N = 129;
export const LU_N = 129;
export const DUR_N = 64;
export const POP_N = 10;
export const SEA_CODE = -32768;
const VERSION = 1;

/** Land-use classes (KSJ L03-b 100 m mesh, plus water areas from the GSI map). */
export const LU = {
  none: 0,
  paddy: 1,
  field: 2,
  forest: 3,
  waste: 4,
  building: 5,
  road: 6,
  rail: 7,
  other: 8,
  water: 9,
  beach: 10,
  sea: 11,
  golf: 12,
} as const;
export type LuClass = (typeof LU)[keyof typeof LU];

/** Line kinds. Widths are real (the game draws roads at their true width). */
export const LINE = {
  motorway: 0,
  national: 1,
  prefectural: 2,
  wide: 3,
  local: 4,
  rail: 10,
  shinkansen: 11,
  river: 20,
} as const;
export type LineKind = (typeof LINE)[keyof typeof LINE];
export const LINE_TUNNEL = 1;
export const LINE_BRIDGE = 2;

/** Point kinds (facilities placed at their real, shrunk position). */
export const POI = {
  station: 1,
  cityHall: 2,
  townHall: 3,
  prefOffice: 4,
  hospital: 5,
  school: 6,
  university: 7,
  police: 8,
  fire: 9,
  gsdf: 10,
  msdf: 11,
  asdf: 12,
  airport: 13,
  port: 14,
  castle: 15,
  shrine: 16,
  temple: 17,
  post: 18,
  park: 19,
  tower: 20,
} as const;
export type PoiKind = (typeof POI)[keyof typeof POI];

export interface RealLine {
  kind: LineKind;
  flags: number;
  /** Real width (m). */
  width: number;
  /** x, z pairs (game metres, area-local). */
  pts: Float32Array;
}
export interface RealPoi {
  kind: PoiKind;
  /** Kind-dependent: station grade 0..4, school level, SDF size 1..3... */
  grade: number;
  x: number;
  z: number;
  name: string;
}
export interface RealArea {
  cell: number;
  /** Multiplier of the height compression (overrides of the region / cell), 1 by default. */
  heightMul?: number;
  /** ELEV_N² real elevations (m); NaN over the sea. Sample (i, j) is at (i, j) × 1024 / (ELEV_N - 1). */
  elev: Float32Array;
  /** LU_N² land-use classes at the same lattice points as the elevation (shared with the neighbours on the edges). */
  landuse: Uint8Array;
  /** DUR_N² share 0..15 of durable / tall buildings. */
  durable: Uint8Array;
  /** POP_N² persons per km² (the census 1 km meshes, shrunk: one per ~102 m of the area). */
  pop: Uint16Array;
  lines: RealLine[];
  pois: RealPoi[];
}

// ---------------------------------------------------------------------------------------------
// Byte writer / reader
// ---------------------------------------------------------------------------------------------

class Out {
  buf = new Uint8Array(1 << 16);
  n = 0;
  byte(v: number): void {
    if (this.n >= this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.n++] = v & 255;
  }
  u16(v: number): void {
    this.byte(v);
    this.byte(v >>> 8);
  }
  u32(v: number): void {
    this.u16(v & 0xffff);
    this.u16(v >>> 16);
  }
  vu(v: number): void {
    let x = Math.floor(v);
    while (x >= 128) {
      this.byte((x & 127) | 128);
      x = Math.floor(x / 128);
    }
    this.byte(x);
  }
  vs(v: number): void {
    this.vu(v < 0 ? -2 * v - 1 : 2 * v);
  }
  bytes(): Uint8Array {
    return this.buf.subarray(0, this.n);
  }
}

class In {
  p = 0;
  b: Uint8Array;
  constructor(b: Uint8Array) {
    this.b = b;
  }
  byte(): number {
    if (this.p >= this.b.length) throw new Error('real area: truncated');
    return this.b[this.p++]!;
  }
  u16(): number {
    return this.byte() | (this.byte() << 8);
  }
  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0;
  }
  vu(): number {
    let r = 0;
    let m = 1;
    for (;;) {
      const c = this.byte();
      r += (c & 127) * m;
      if (c < 128) return r;
      m *= 128;
    }
  }
  vs(): number {
    const u = this.vu();
    return u % 2 ? -(u + 1) / 2 : u / 2;
  }
}

function writeRuns(o: Out, a: Uint8Array): void {
  let i = 0;
  while (i < a.length) {
    const v = a[i]!;
    let j = i + 1;
    while (j < a.length && a[j] === v) j++;
    o.vu(v);
    o.vu(j - i);
    i = j;
  }
}
function readRuns(r: In, n: number): Uint8Array {
  const a = new Uint8Array(n);
  let i = 0;
  while (i < n) {
    const v = r.vu();
    const run = r.vu();
    a.fill(v, i, Math.min(n, i + run));
    i += run;
  }
  return a;
}

/** Quantised elevation (0.5 m units), the sea as SEA_CODE. */
export function quantElev(e: number): number {
  return Number.isFinite(e) ? Math.max(-32000, Math.min(32767, Math.round(e * 2))) : SEA_CODE;
}

/** Encode (uncompressed; the build gzips it). Elevations must already be quantised-exact (quantElev / 2). */
export function encodeRealArea(a: RealArea): Uint8Array {
  const o = new Out();
  for (const c of 'RA01') o.byte(c.charCodeAt(0));
  o.u32(a.cell);
  o.u16(VERSION);
  o.u16(Math.round((a.heightMul ?? 1) * 100));
  const q = new Int32Array(ELEV_N * ELEV_N);
  for (let i = 0; i < q.length; i++) q[i] = quantElev(a.elev[i]!);
  // Sea samples predict as 0 m so that the coast does not cost a jump of 32768.
  const val = (i: number): number => (q[i] === SEA_CODE ? 0 : q[i]!);
  for (let j = 0; j < ELEV_N; j++) {
    for (let i = 0; i < ELEV_N; i++) {
      const k = j * ELEV_N + i;
      if (q[k] === SEA_CODE) {
        o.vs(0);
        o.byte(1); // sea flag follows every zero residual... see below
        continue;
      }
      const l = i > 0 ? val(k - 1) : j > 0 ? val(k - ELEV_N) : 0;
      const u = j > 0 ? val(k - ELEV_N) : l;
      const ul = i > 0 && j > 0 ? val(k - ELEV_N - 1) : u;
      const pred = l + u - ul;
      const res = q[k]! - pred;
      o.vs(res);
      if (res === 0) o.byte(0);
    }
  }
  writeRuns(o, a.landuse);
  writeRuns(o, a.durable);
  for (let i = 0; i < POP_N * POP_N; i++) o.vu(a.pop[i]!);
  o.vu(a.lines.length);
  for (const line of a.lines) {
    o.byte(line.kind);
    o.byte(line.flags);
    o.byte(Math.min(255, Math.round(line.width)));
    const n = line.pts.length / 2;
    o.vu(n);
    let px = 0;
    let pz = 0;
    for (let k = 0; k < n; k++) {
      const x = Math.round(line.pts[k * 2]! * 2);
      const z = Math.round(line.pts[k * 2 + 1]! * 2);
      o.vs(x - px);
      o.vs(z - pz);
      px = x;
      pz = z;
    }
  }
  o.vu(a.pois.length);
  const enc = new TextEncoder();
  for (const p of a.pois) {
    o.byte(p.kind);
    o.byte(p.grade);
    o.vs(Math.round(p.x * 2));
    o.vs(Math.round(p.z * 2));
    const name = enc.encode(p.name).subarray(0, 255);
    o.byte(name.length);
    for (const c of name) o.byte(c);
  }
  return o.bytes().slice();
}

/** Decode an (already decompressed) area file. */
export function decodeRealArea(bytes: Uint8Array): RealArea {
  const r = new In(bytes);
  const magic = String.fromCharCode(r.byte(), r.byte(), r.byte(), r.byte());
  if (magic !== 'RA01') throw new Error('real area: bad magic');
  const cell = r.u32();
  const version = r.u16();
  const hm = r.u16();
  if (version !== VERSION) throw new Error(`real area: version ${version}`);
  const q = new Int32Array(ELEV_N * ELEV_N);
  const val = (i: number): number => (q[i] === SEA_CODE ? 0 : q[i]!);
  for (let j = 0; j < ELEV_N; j++) {
    for (let i = 0; i < ELEV_N; i++) {
      const k = j * ELEV_N + i;
      const res = r.vs();
      if (res === 0 && r.byte() === 1) {
        q[k] = SEA_CODE;
        continue;
      }
      const l = i > 0 ? val(k - 1) : j > 0 ? val(k - ELEV_N) : 0;
      const u = j > 0 ? val(k - ELEV_N) : l;
      const ul = i > 0 && j > 0 ? val(k - ELEV_N - 1) : u;
      q[k] = l + u - ul + res;
    }
  }
  const elev = new Float32Array(ELEV_N * ELEV_N);
  for (let i = 0; i < elev.length; i++) elev[i] = q[i] === SEA_CODE ? NaN : q[i]! / 2;
  const landuse = readRuns(r, LU_N * LU_N);
  const durable = readRuns(r, DUR_N * DUR_N);
  const pop = new Uint16Array(POP_N * POP_N);
  for (let i = 0; i < pop.length; i++) pop[i] = Math.min(65535, r.vu());
  const lines: RealLine[] = [];
  for (let n = r.vu(); n > 0; n--) {
    const kind = r.byte() as LineKind;
    const flags = r.byte();
    const width = r.byte();
    const k = r.vu();
    const pts = new Float32Array(k * 2);
    let x = 0;
    let z = 0;
    for (let i = 0; i < k; i++) {
      x += r.vs();
      z += r.vs();
      pts[i * 2] = x / 2;
      pts[i * 2 + 1] = z / 2;
    }
    lines.push({ kind, flags, width, pts });
  }
  const pois: RealPoi[] = [];
  const dec = new TextDecoder();
  for (let n = r.vu(); n > 0; n--) {
    const kind = r.byte() as PoiKind;
    const grade = r.byte();
    const x = r.vs() / 2;
    const z = r.vs() / 2;
    const len = r.byte();
    const name = dec.decode(bytes.subarray(r.p, r.p + len));
    r.p += len;
    pois.push({ kind, grade, x, z, name });
  }
  return { cell, heightMul: hm > 0 ? hm / 100 : 1, elev, landuse, durable, pop, lines, pois };
}
