// L1: what every landmark is made with (L1–L8). A landmark is seen only from outside (07d's blueprint
// with `exteriorOnly`): every part is the shell, nobody goes in, the doors stay shut. It is drawn out
// to the fog (never the far box), so its shape, proportions and colours must read from far away:
// prefer a few big parts to many small ones (ARCH.limits.landmark: 6,000 triangles, 8,000 for a big
// tower or castle with `limits`). docs/realmap_guide.md §7 has the tips.
//
//   const DEF = landmarkDef({ variant: 'clock_tower', size: { w: [18, 18], d: [30, 30] }, eaves: 9, top: 19, build(L) {
//     L.box(0, 0, 0, L.w, 9, L.d, 'paint', { paint: 'white' });       // a solid block
//     L.shape('gable', -0.4, 9, -0.4, L.w + 0.4, 14, L.d + 0.4, 'paint', { paint: 'roofRed', axis: 'z' });
//     L.column(9, 15, 2, 0, 19, 'paint', { paint: 'white' });           // a round column (12 sides)
//     L.ring(...) / L.windows(...) / L.ladder(...) / L.vantage(...) / L.ground('water', poly)
//     L.car(...) / L.tent(...) / L.sandbags(...) / L.crates(...) / L.fallenSign(...) / L.scorch(...)
//   } });
//
// Local frame as every blueprint: x across the front (0..w), z deep (0..d, the front at z = d), y up
// from the highest ground under the lot. Parts may hang 0.6 m over the lot; solid ones stay inside.
// `paint` picks a named colour (data/render.ts PAINT) of the material `paint`.

import { isMemorialLandmark } from '../../../../data/landmarks/index.ts';
import { PAINT, type PaintName } from '../../../../data/render.ts';
import type { BuildingKind } from '../../../types.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingBlueprint, BuildingDef, GroundFeature, MaterialId, Part, PartShape, RoofKind } from '../../types.ts';

const PAINTS = Object.keys(PAINT) as PaintName[];
/** The `tint` of a named colour of the material `paint`. */
export function paint(name: PaintName): number {
  return (PAINTS.indexOf(name) + 0.5) / PAINTS.length;
}

export interface PartOpts {
  /** Colour by name (material `paint`), or `tint` for the material's own palette. */
  paint?: PaintName;
  tint?: number;
  solid?: boolean;
  hidden?: boolean;
  /** Turn about the vertical through the part's centre (radians, Part.yaw). */
  yaw?: number;
  axis?: 'x' | 'z';
  slope?: 'x+' | 'x-' | 'z+' | 'z-';
}

export interface Lm {
  readonly k: Kit;
  readonly w: number;
  readonly d: number;
  rand(): number;
  range(lo: number, hi: number): number;
  /** A box (or another shape) of the shell. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: MaterialId, o?: PartOpts): Part;
  shape(shape: PartShape, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: MaterialId, o?: PartOpts): Part;
  /** A box between two plan points (a wall, a beam, a path), `thick` wide, turned to their direction. */
  bar(ax: number, az: number, bx: number, bz: number, y0: number, y1: number, thick: number, mat: MaterialId, o?: PartOpts): Part;
  /** A round column of radius r (12 sides, Part shape `cyl`); `taper` scales its top (0: a cone). */
  column(cx: number, cz: number, r: number, y0: number, y1: number, mat: MaterialId, o?: PartOpts & { taper?: number }): Part;
  /** A polygonal wall (a tube): `n` boxes `thick` thick round (cx, cz), radius r to the wall's middle. */
  ring(cx: number, cz: number, r: number, y0: number, y1: number, thick: number, n: number, mat: MaterialId, o?: PartOpts): void;
  /**
   * Window panes on a face: `n` evenly between u0 and u1 along the face (x for the front / back,
   * z for the sides), from y0 to y1, each `width` wide. The pane stands 0.06 m proud of the wall
   * face at `at` (x or z), towards `out` (+1 / -1). A share `broken` is black (glass gone).
   */
  windows(face: 'x' | 'z', at: number, out: 1 | -1, u0: number, u1: number, n: number, y0: number, y1: number, width: number, o?: { paint?: PaintName; broken?: number; frame?: PaintName }): void;
  /** An outside ladder: the climb zone (0.9 m square) at (x, z) from y0 to y1, the wall towards (nx, nz). */
  ladder(x: number, z: number, nx: number, nz: number, y0: number, y1: number): void;
  /** A firing position (feet) on the landmark. */
  vantage(x: number, y: number, z: number): void;
  /** Ground under the landmark (GroundFeature): a moat, a canal, a lawn, a paved square. */
  ground(kind: GroundFeature['kind'], poly: [number, number][], depth?: number, drop?: number): void;
  // ---- 90 days after the fall: one or two of these round a landmark ----
  /** An abandoned car (its long side along `along`). */
  car(x: number, z: number, along: 'x' | 'z', o?: { paint?: PaintName; burnt?: boolean }): void;
  /** A relief tent of the evacuation (white canvas, its ridge along `along`). */
  tent(x: number, z: number, along: 'x' | 'z', len?: number): void;
  /** A low wall of sandbags along a line. */
  sandbags(ax: number, az: number, bx: number, bz: number, h?: number): void;
  /** A heap of relief crates. */
  crates(x: number, z: number, n?: number): void;
  /** A fallen information board. */
  fallenSign(x: number, z: number, along: 'x' | 'z'): void;
  /** A scorch mark: a thin dark box on a wall or the ground. */
  scorch(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void;
  finish(): BuildingBlueprint;
}

export interface LandmarkSpec {
  variant: string;
  size: { w: readonly [number, number]; d: readonly [number, number] };
  /** Height of the main body (the envelope's eaves) and of the highest point (antenna, finial), m. */
  eaves: number;
  top: number;
  roof?: RoofKind;
  kind?: BuildingKind;
  /** Triangle limit above ARCH.limits.landmark (a big tower or castle: up to 8,000, say why in PROGRESS.md). */
  shell?: number;
  /**
   * L6: a place of remembrance (the Atomic Bomb Dome). Default: what the landmark table says
   * (`memorial`, src/data/landmarks/types.ts). The props of the fall, ladders and firing positions
   * throw (a mistake in the blueprint, caught by the catalog test); window panes are never broken.
   */
  memorial?: boolean;
  build(L: Lm): void;
}

/** A landmark building type (category `landmark`, id `landmark.<variant>`, exterior only). */
export function landmarkDef(spec: LandmarkSpec): BuildingDef {
  const def: BuildingDef = {
    id: `landmark.${spec.variant}`,
    category: 'landmark',
    variant: spec.variant,
    kind: spec.kind ?? 'office',
    size: spec.size,
    storeys: 1,
    storeyHeight: spec.eaves,
    plinth: 0,
    roof: spec.roof ?? 'flat',
    roofRise: Math.max(0, spec.top - spec.eaves),
    lootable: false,
    exteriorOnly: true,
    generate(rng, params) {
      const L = lm(createKit(def, params, rng), def.memorial === true);
      spec.build(L);
      return L.finish();
    },
  };
  if (spec.shell) def.limits = { shell: spec.shell, interior: 0 };
  if (spec.memorial ?? isMemorialLandmark(def.id)) def.memorial = true;
  return def;
}

function lm(k: Kit, memorial = false): Lm {
  /** L6: what a place of remembrance may not have. */
  const refuse = (what: string): void => {
    if (memorial) throw new Error(`${k.def.id}: a memorial landmark has no ${what} (docs/realmap_guide.md §7)`);
  };
  const ladders: BuildingBlueprint['ladders'] = [];
  const vantages: [number, number, number][] = [];
  const ground: GroundFeature[] = [];
  const shape = (s: PartShape, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: MaterialId, o: PartOpts = {}): Part => {
    const p = k.part({ shape: s, x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), mat: o.paint ? 'paint' : mat, layer: 'shell' });
    if (o.paint) p.tint = paint(o.paint);
    else if (o.tint !== undefined) p.tint = o.tint;
    if (o.solid !== undefined) p.solid = o.solid;
    if (o.hidden) p.hidden = true;
    if (o.yaw) p.yaw = o.yaw;
    if (o.axis) p.axis = o.axis;
    if (o.slope) p.slope = o.slope;
    return p;
  };
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: MaterialId, o?: PartOpts): Part => shape('box', x0, y0, z0, x1, y1, z1, mat, o);
  const bar = (ax: number, az: number, bx: number, bz: number, y0: number, y1: number, thick: number, mat: MaterialId, o: PartOpts = {}): Part => {
    const len = Math.hypot(bx - ax, bz - az);
    const cx = (ax + bx) / 2;
    const cz = (az + bz) / 2;
    // The box's local x along the line: yaw turns (1, 0) to (cos, -sin).
    const yaw = Math.atan2(-(bz - az), bx - ax);
    return box(cx - len / 2, y0, cz - thick / 2, cx + len / 2, y1, cz + thick / 2, mat, { ...o, yaw: Math.abs(yaw) < 1e-9 ? undefined : yaw });
  };
  const L: Lm = {
    k,
    w: k.w,
    d: k.d,
    rand: () => k.rand(),
    range: (lo, hi) => k.range(lo, hi),
    box,
    shape,
    bar,
    column(cx, cz, r, y0, y1, mat, o = {}) {
      const p = shape('cyl', cx - r, y0, cz - r, cx + r, y1, cz + r, mat, o);
      if (o.taper !== undefined && o.taper !== 1) p.taper = o.taper;
      return p;
    },
    ring(cx, cz, r, y0, y1, thick, n, mat, o = {}) {
      const side = 2 * (r + thick / 2) * Math.tan(Math.PI / n);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        // The segment's long side is tangent to the circle: along (-sin a, cos a).
        bar(x + Math.sin(a) * side / 2, z - Math.cos(a) * side / 2, x - Math.sin(a) * side / 2, z + Math.cos(a) * side / 2, y0, y1, thick, mat, o);
      }
    },
    windows(face, at, out, u0, u1, n, y0, y1, width, o = {}) {
      const t = 0.08;
      const c0 = out > 0 ? at : at - t;
      for (let i = 0; i < n; i++) {
        const u = u0 + ((u1 - u0) * (i + 0.5)) / n;
        const broken = !memorial && (o.broken ?? 0) > 0 && k.rand() < o.broken!;
        const col: PaintName = broken ? 'black' : o.paint ?? 'windowDark';
        if (face === 'x') box(u - width / 2, y0, c0, u + width / 2, y1, c0 + t, 'paint', { paint: col, solid: false });
        else box(c0, y0, u - width / 2, c0 + t, y1, u + width / 2, 'paint', { paint: col, solid: false });
      }
    },
    ladder(x, z, nx, nz, y0, y1) {
      refuse('ladder');
      const half = 0.45;
      ladders.push({ x0: x - half, z0: z - half, x1: x + half, z1: z + half, y0, y1: y1 + 0.02, nx, nz });
      // Two rails on the wall side and a rung every 1.5 m (from afar: a thin double line).
      const wx = x + nx * (half - 0.1);
      const wz = z + nz * (half - 0.1);
      const tx = -nz;
      const tz = nx;
      for (const s of [-0.25, 0.25]) box(wx + tx * s - 0.04, y0, wz + tz * s - 0.04, wx + tx * s + 0.04, y1 + 1, wz + tz * s + 0.04, 'steel', { solid: false });
      for (let y = y0 + 0.4; y < y1; y += 1.5) box(wx - Math.abs(tx) * 0.25 - 0.03, y, wz - Math.abs(tz) * 0.25 - 0.03, wx + Math.abs(tx) * 0.25 + 0.03, y + 0.05, wz + Math.abs(tz) * 0.25 + 0.03, 'steel', { solid: false });
    },
    vantage(x, y, z) {
      refuse('firing position');
      vantages.push([x, y, z]);
    },
    ground(kind, poly, depth, drop) {
      const g: GroundFeature = { kind, poly };
      if (depth !== undefined) g.depth = depth;
      if (drop !== undefined) g.drop = drop;
      ground.push(g);
    },
    car(x, z, along, o = {}) {
      refuse('abandoned car');
      const [hl, hw] = [2.2, 0.85];
      const [ex, ez] = along === 'x' ? [hl, hw] : [hw, hl];
      const body: PaintName = o.burnt ? 'charcoal' : o.paint ?? (['silver', 'white', 'navy', 'red', 'gray'] as const)[Math.floor(k.rand() * 5)]!;
      box(x - ex, 0.25, z - ez, x + ex, 0.95, z + ez, 'paint', { paint: body });
      const [cx, cz] = along === 'x' ? [ex * 0.55, ez * 0.92] : [ex * 0.92, ez * 0.55];
      box(x - cx, 0.95, z - cz, x + cx, 1.45, z + cz, 'paint', { paint: o.burnt ? 'black' : 'windowDark' });
    },
    tent(x, z, along, len = 6) {
      refuse('relief tent');
      const [ex, ez] = along === 'x' ? [len / 2, 2.2] : [2.2, len / 2];
      box(x - ex, 0, z - ez, x + ex, 1.4, z + ez, 'paint', { paint: 'offWhite' });
      shape('gable', x - ex, 1.4, z - ez, x + ex, 2.5, z + ez, 'paint', { paint: 'white', axis: along, solid: false });
    },
    sandbags(ax, az, bx, bz, h = 0.9) {
      refuse('sandbags');
      bar(ax, az, bx, bz, 0, h, 0.7, 'fabric', { tint: 0.95 });
    },
    crates(x, z, n = 3) {
      refuse('relief crates');
      for (let i = 0; i < n; i++) {
        const ox = (i % 2) * 1.3;
        const oy = Math.floor(i / 2) * 0.9;
        box(x + ox - 0.6, oy, z - 0.5, x + ox + 0.6, oy + 0.9, z + 0.5, 'olive', { tint: (i % 3) / 3 + 0.1 });
      }
    },
    fallenSign(x, z, along) {
      refuse('fallen sign');
      const [ex, ez] = along === 'x' ? [1.4, 0.9] : [0.9, 1.4];
      box(x - ex, 0, z - ez, x + ex, 0.12, z + ez, 'paint', { paint: 'navy', solid: false });
      box(x - 0.06, 0, z - 0.06, x + 0.06, 0.5, z + 0.06, 'steel', { solid: false });
    },
    scorch(x0, y0, z0, x1, y1, z1) {
      refuse('scorch mark');
      box(x0, y0, z0, x1, y1, z1, 'paint', { paint: 'black', solid: false });
    },
    finish() {
      const bp = k.finish();
      bp.ladders.push(...ladders);
      if (vantages.length) bp.vantages = vantages;
      if (ground.length) bp.ground = ground;
      return bp;
    },
  };
  return L;
}
