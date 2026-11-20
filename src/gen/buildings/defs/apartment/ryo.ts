// 学生寮 (07d-2a). A three-storey concrete dormitory with an inner corridor, a stair at each end and
// a row of single rooms on both sides; on the ground floor the front holds the entrance lobby, the
// dining hall (食堂) and the big bath, upstairs a shared washroom. About half the rooms are locked.
//
//   ground floor                                       upper floors
//   +--+--+--+--+--+--+--+--+--+                       +--+--+--+--+--+--+--+--+--+
//   |↕ |rm|rm|rm|rm|rm|rm|rm|↕ |  back (z = 0)          |↕ |rm|rm|rm|rm|rm|rm|rm|↕ |
//   +  +D-+D-+D-+D-+D-+D-+D-+  +                       +  +D-+D-+D-+D-+D-+D-+D-+  +
//   |          corridor        |                       |          corridor        |
//   +----D-----+--D--+---D-----+                       +D-+D-+D-+D-+D-+D-+D-+D-+D-+
//   | 食堂      |lobby| 浴場     |                       |rm|rm|rm|rm|WC|rm|rm|rm|rm|
//   +----------+--D--+----------+  front               +--+--+--+--+--+--+--+--+--+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Hole, type Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, pitched, ring } from '../house/common.ts';

/** A single room x [x0, x1], door on the corridor side zIn, far wall at zFar. */
function single(k: Kit, level: number, x0: number, x1: number, zIn: number, zFar: number, locked: boolean): void {
  k.room(level, x0, Math.min(zIn, zFar), x1, Math.max(zIn, zFar), 'bedroom', { locked });
  if (locked) return;
  const s = Math.sign(zFar - zIn);
  const far = zFar;
  const z = (a: number, b: number): [number, number] => [Math.min(far - s * a, far - s * b), Math.max(far - s * a, far - s * b)];
  const [b0, b1] = z(0, 2.0);
  k.furniture(level, x0, b0, x0 + 0.9, b1, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
  const [d0, d1] = z(0, 0.55);
  k.furniture(level, x1 - 0.9, d0, x1, d1, 0.75, 'wood', { tint: 0.8, search: { kind: 'desk', face: s > 0 ? 'z-' : 'z+', table: 'bedroom' } });
  if (k.rand() < 0.3) k.stain(level, x0 + 0.9, Math.min(zIn, zFar) + 0.8, x1 - 0.2, Math.max(zIn, zFar) - 0.8, 'debris');
}

export const APARTMENT_RYO: BuildingDef = {
  id: 'apartment.ryo',
  category: 'apartment',
  variant: 'ryo',
  kind: 'apartment',
  size: { w: [20, 24], d: [12.5, 14] },
  storeys: 3,
  storeyHeight: 3.0,
  plinth: 0.3,
  roof: 'hip',
  roofRise: 2.6,
  lootable: true,
  generate(rng, params) {
    const k = createKit(APARTMENT_RYO, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const D = d - 1.5; // block | front yard
    const zc0 = t + 4.0; // back rooms | corridor (centre line)
    const zc1 = zc0 + 1.72; // corridor | front rooms
    const xL = t + 2.1 + P; // west stair core | rooms
    const xR = w - t - 2.1 - P; // rooms | east stair core
    const nB = Math.floor((xR - xL) / 2.7);
    const cellB = (xR - xL) / nB;
    const nF = Math.floor((w - 2 * t) / 2.7);
    const cellF = (w - 2 * t) / nF;
    const cx = w / 2;
    const tint = k.rand();
    const top = k.storeys - 1;
    const steel = { layer: 'shell' as const, tint: 0.4 };
    const pc = { mat: 'plaster' as const, tint: 0.2 };

    for (let level = 0; level < k.storeys; level++) {
      const ground = level === 0;
      const front: Hole[] = [];
      const back: Hole[] = [];
      const backDoors: Hole[] = [];
      const frontDoors: Hole[] = [];
      for (let i = 0; i < nB; i++) {
        const x0 = xL + i * cellB + P;
        const x1 = xL + (i + 1) * cellB - P;
        const locked = k.rand() < 0.5;
        single(k, level, x0, x1, zc0 - P, t, locked);
        backDoors.push(k.door((x0 + x1) / 2 - xL, locked ? 'locked' : 'open'));
        back.push(k.window((x0 + x1) / 2, 0.9));
        if (i > 0) k.partition(level, xL + i * cellB, t, xL + i * cellB, zc0, [], pc);
      }
      if (ground) {
        // Dining hall, lobby, bath.
        const l0 = cx - 1.6;
        const l1 = cx + 1.6;
        k.room(0, t, zc1 + P, l0 - P, D - t, 'canteen');
        k.room(0, l0 + P, zc1 + P, l1 - P, D - t, 'lobby');
        k.room(0, l1 + P, zc1 + P, w - t, D - t, 'bath');
        frontDoors.push(k.door((t + l0) / 2 - t, 'open', ARCH.door.wide), k.door(cx - t, 'open', ARCH.door.wide), k.door((l1 + w - t) / 2 - t));
        front.push(k.window((t + l0) / 2 - 1.6, 2.4, { sill: 0.8, broken: k.rand() < 0.3 }), k.window((t + l0) / 2 + 1.6, 2.4, { sill: 0.8 }), k.door(cx, 'open', ARCH.door.wide), k.window((l1 + w - t) / 2, 1.2, { sill: 1.6, head: 2.3 }));
        k.partition(0, l0, zc1, l0, D - t, [], pc);
        k.partition(0, l1, zc1, l1, D - t, [], pc);
        // 食堂: long tables, the serving counter along the back.
        for (let x = t + 1.0; x + 2.4 < l0 - 1.0; x += 3.0) k.furniture(0, x, zc1 + 2.2, x + 2.4, zc1 + 3.0, 0.72, 'wood', { tint: 0.6, search: x === t + 1.0 ? { kind: 'table', face: 'z+', table: 'canteen' } : undefined });
        k.furniture(0, t, D - t - 0.7, t + 2.6, D - t, 0.9, 'counter', { search: { kind: 'counter', face: 'z-', table: 'kitchen' } });
        k.furniture(0, t, zc1 + P, t + 0.7, zc1 + 1.3, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'grocery' } });
        // Bath: the big tub, the lockers.
        k.furniture(0, l1 + 1.0, D - t - 2.2, w - t, D - t, 0.6, 'tileFloor');
        k.furniture(0, l1 + P, zc1 + 1.4, l1 + 0.5, zc1 + 3.0, 1.6, 'steel', { tint: 0.4, search: { kind: 'locker', face: 'x+', table: 'bath' } });
        k.furniture(0, l1 - P - 0.4, zc1 + 1.4, l1 - P, zc1 + 2.6, 1.4, 'steel', { tint: 0.4, search: { kind: 'locker', face: 'x-', table: 'lobby' } }); // shoe lockers / mailboxes
        if (k.rand() < 0.7) k.stain(0, l0 + 0.6, D - t - 2.0, l1 - 0.8, D - t - 1.0);
      } else {
        const wc = Math.floor(nF / 2);
        for (let i = 0; i < nF; i++) {
          const x0 = t + i * cellF + (i > 0 ? P : 0);
          const x1 = t + (i + 1) * cellF - (i < nF - 1 ? P : 0);
          if (i === wc) {
            k.room(level, x0, zc1 + P, x1, D - t, 'toilet');
            frontDoors.push(k.door((x0 + x1) / 2 - t));
            front.push(k.window((x0 + x1) / 2, 0.6, { sill: 1.5 }));
            k.furniture(level, x0, D - t - 0.55, x1, D - t, 0.85, 'counter', { search: { kind: 'cabinet', face: 'z-', table: 'toilet' } });
          } else {
            const locked = k.rand() < 0.5;
            single(k, level, x0, x1, zc1 + P, D - t, locked);
            frontDoors.push(k.door((x0 + x1) / 2 - t, locked ? 'locked' : 'open'));
            front.push(k.window((x0 + x1) / 2, 0.9, { broken: k.rand() < 0.2 }));
          }
          if (i > 0) k.partition(level, t + i * cellF, zc1, t + i * cellF, D - t, [], pc);
        }
      }
      k.floor(level, ground ? 'tileFloor' : 'vinyl', [t, t, w - t, D - t]);
      ring(k, level, [0, 0, w, D], { mat: 'concrete', tint, front, back, left: [k.window(D - 1.5, 0.6, { sill: 1.2 })], right: [k.window(D - 1.5, 0.6, { sill: 1.2 })] });
      k.partition(level, xL, zc0, xR, zc0, backDoors, pc);
      k.partition(level, t, zc1, w - t, zc1, frontDoors, pc);
      k.partition(level, xL, t, xL, zc0, [], pc);
      k.partition(level, xR, t, xR, zc0, [], pc);
      k.room(level, t, zc0 + P, w - t, zc1 - P, 'hall');
      if (level < top) {
        k.stairs({ level, start: [t + 0.525, zc0], dir: 'z-', width: 0.9, kind: 'switchback', turn: 'right', mat: 'concrete', tint });
        k.stairs({ level, start: [xR + P + 0.525, zc0], dir: 'z-', width: 0.9, kind: 'switchback', turn: 'right', mat: 'concrete', tint });
      } else {
        for (const x of [t, xR + P]) k.box(level, x, k.levelY(level), zc0 - 0.06, x + 1.0, k.levelY(level) + ARCH.rail.height, zc0, 'steel', steel);
      }
    }

    pitched(k, [0, 0, w, D], { mat: 'slate', tint: k.rand(), hip: true, axis: 'x', thick: t });
    // Front yard: canopy over the entrance, bicycle racks along the front.
    k.part({ shape: 'box', x0: cx - 1.6, x1: cx + 1.6, z0: D, z1: D + 1.2, y0: k.levelY(1) - 0.5, y1: k.levelY(1) - 0.35, mat: 'concrete', tint, solid: false });
    for (let x = 0.6; x < cx - 2.4; x += 0.7) k.box(-1, x, 0, D + 0.2, x + 0.06, 1.0, d - 0.15, 'steel', { layer: 'shell', tint: k.rand(), role: 'furniture' });
    return k.finish();
  },
};
