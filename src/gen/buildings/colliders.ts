// Collision boxes derived from a blueprint's parts (07d): drawing and collision come from the same
// numbers. Boxes collide as themselves; sloped shapes (gable / hip / wedge) as a few stacked boxes
// inscribed in the slope (ARCH.roofSlices). Glass ('pane') stops people and zombies but not bullets
// or sight. Decoration ('none') does not collide.

import { ARCH } from '../../data/architecture.ts';
import { solidOf } from './materials.ts';
import type { BuildingBlueprint, Part } from './types.ts';

export interface LocalCollider {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  pane: boolean;
  kind: 'building' | 'stair' | 'prop';
}

function slices(p: Part, out: LocalCollider[], pane: boolean, w: number, d: number): void {
  const n = ARCH.roofSlices;
  const h = p.y1 - p.y0;
  const kind = p.role === 'stair' ? 'stair' : p.role === 'furniture' ? 'prop' : 'building';
  for (let k = 0; k < n; k++) {
    const ya = p.y0 + (h * k) / n;
    const yb = p.y0 + (h * (k + 1)) / n;
    const f = (k + 0.5) / n; // the slope's extent at the middle of the slice
    let { x0, x1, z0, z1 } = p;
    if (p.shape === 'wedge') {
      const s = p.slope ?? 'x+';
      if (s === 'x+') x0 = p.x0 + (p.x1 - p.x0) * f;
      else if (s === 'x-') x1 = p.x1 - (p.x1 - p.x0) * f;
      else if (s === 'z+') z0 = p.z0 + (p.z1 - p.z0) * f;
      else z1 = p.z1 - (p.z1 - p.z0) * f;
    } else {
      const alongX = (p.axis ?? 'x') === 'x';
      const cross = alongX ? p.z1 - p.z0 : p.x1 - p.x0;
      const shrink = (cross / 2) * f;
      if (alongX) {
        z0 += shrink;
        z1 -= shrink;
        if (p.shape === 'hip') {
          x0 += shrink;
          x1 -= shrink;
        }
      } else {
        x0 += shrink;
        x1 -= shrink;
        if (p.shape === 'hip') {
          z0 += shrink;
          z1 -= shrink;
        }
      }
    }
    // Roofs overhang the walls; their collision stays over the footprint (the envelope).
    x0 = Math.max(0, x0);
    z0 = Math.max(0, z0);
    x1 = Math.min(w, x1);
    z1 = Math.min(d, z1);
    if (x1 - x0 > 0.05 && z1 - z0 > 0.05) out.push({ x0, y0: ya, z0, x1, y1: yb, z1, pane, kind });
  }
}

/**
 * L1: a box turned by `yaw` collides as a row of axis-aligned squares along its long side, each as
 * wide as the box is thin (at most 48; a diagonal wall stands out by up to 0.4 of its thickness at
 * the corners). Turned roofs and wedges do not collide (add a hidden box where they must).
 */
function turned(p: Part, out: LocalCollider[], pane: boolean, w: number, d: number): void {
  if (p.shape !== 'box') return;
  const a = p.yaw!;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  const hx = (p.x1 - p.x0) / 2;
  const hz = (p.z1 - p.z0) / 2;
  const alongX = hx >= hz;
  const L = alongX ? hx : hz;
  const t = Math.max(0.05, alongX ? hz : hx);
  const [dx, dz] = alongX ? [Math.cos(a), -Math.sin(a)] : [Math.sin(a), Math.cos(a)];
  const n = Math.min(48, Math.max(1, Math.ceil(L / t)));
  const kind = p.role === 'stair' ? 'stair' : p.role === 'furniture' ? 'prop' : 'building';
  for (let k = 0; k < n; k++) {
    const u = -L + (2 * L * (k + 0.5)) / n;
    const x = cx + dx * u;
    const z = cz + dz * u;
    const x0 = Math.max(0, x - t);
    const z0 = Math.max(0, z - t);
    const x1 = Math.min(w, x + t);
    const z1 = Math.min(d, z + t);
    if (x1 - x0 > 0.05 && z1 - z0 > 0.05) out.push({ x0, y0: p.y0, z0, x1, y1: p.y1, z1, pane, kind });
  }
}

/**
 * L1: a 12-sided prism collides as the square inscribed in it (0.71 of its radius), in three slices
 * when it tapers (a cone: up to its middle third).
 */
function cylinder(p: Part, out: LocalCollider[], pane: boolean): void {
  const taper = p.taper ?? 1;
  const n = taper === 1 ? 1 : 3;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  const kind = p.role === 'stair' ? 'stair' : p.role === 'furniture' ? 'prop' : 'building';
  for (let k = 0; k < n; k++) {
    const s = 1 + (taper - 1) * ((k + 1) / n); // the slice's top size (the narrower end)
    const hx = ((p.x1 - p.x0) / 2) * Math.SQRT1_2 * Math.min(1, s);
    const hz = ((p.z1 - p.z0) / 2) * Math.SQRT1_2 * Math.min(1, s);
    if (hx < 0.05 || hz < 0.05) break;
    const h = p.y1 - p.y0;
    out.push({ x0: cx - hx, y0: p.y0 + (h * k) / n, z0: cz - hz, x1: cx + hx, y1: p.y0 + (h * (k + 1)) / n, z1: cz + hz, pane, kind });
  }
}

/** Collision boxes of a blueprint in its local frame. */
export function localColliders(bp: BuildingBlueprint): LocalCollider[] {
  const out: LocalCollider[] = [];
  for (const p of bp.parts) {
    const s = solidOf(p);
    if (s === 'none') continue;
    const pane = s === 'pane';
    if (p.yaw && p.shape !== 'cyl') turned(p, out, pane, bp.w, bp.d);
    else if (p.shape === 'cyl') cylinder(p, out, pane);
    else if (p.shape === 'box') {
      out.push({ x0: p.x0, y0: p.y0, z0: p.z0, x1: p.x1, y1: p.y1, z1: p.z1, pane, kind: p.role === 'stair' ? 'stair' : p.role === 'furniture' ? 'prop' : 'building' });
    } else slices(p, out, pane, bp.w, bp.d);
  }
  return out;
}

/** Triangles a part costs when drawn (render/tactical/enterables.ts uses one shared unit mesh per shape). */
export const SHAPE_TRIS: Record<Part['shape'], number> = { box: 12, gable: 8, hip: 8, wedge: 8, cyl: 44 };

/** Triangles of the outside (`shell`) and of each storey's inside, as drawn. */
export function triangleCount(bp: BuildingBlueprint): { shell: number; interior: number[]; total: number } {
  let shell = 0;
  const interior: number[] = bp.storeys.map(() => 0);
  let total = 0;
  for (const p of bp.parts) {
    if (p.hidden) continue;
    const t = SHAPE_TRIS[p.shape];
    total += t;
    if (p.layer === 'shell') shell += t;
    else {
      const l = Math.max(0, Math.min(interior.length - 1, p.level));
      interior[l] = (interior[l] ?? 0) + t;
    }
  }
  return { shell, interior, total };
}
