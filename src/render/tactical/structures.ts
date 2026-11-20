// Everything that is built: walls, gates, moats, towers, wire, buildings, blueprints under
// construction, rubble, the outpost compound, and the placement cursor of the command layer.
//
// Low-poly boxes in two InstancedMeshes (solid + translucent), a line mesh for the cursor grid and
// one for the defenders' tracers: at most 4 draw calls. The instances are rebuilt only when the
// structures change (build.gridRev), when damage crosses a visible step, or when the cursor moves.
// Each material has its own silhouette and colour: stakes of a palisade, the wide mound of an
// earthwork, riveted steel sheets, pale concrete blocks with a cap.

import * as THREE from 'three';
import { commandView } from '../../core/view.ts';
import type { GameState, Structure } from '../../core/types.ts';
import { BUILD, BUILDINGS, footprint, type BuildingDef } from '../../data/buildings.ts';
import { BASE_BLUEPRINT } from '../../gen/buildings/defs/base/hall.ts';
import { RENDER } from '../../data/render.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { defOf, isRuin, maxHp, moatFilled, overlayOf, TILE, TILES, towerLadderDir, type Overlay } from '../../sim/build/structures.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import { cellOffset, neighbourMap } from './neighbours.ts';
import { heightAt } from '../../sim/tactical/collision.ts';
import { outpostAt, outpostPrefab } from '../../sim/world/outposts.ts';
import type { FrameInfo, RenderContext, SubRenderer } from '../index.ts';

const R = RENDER.structures;
type Look = keyof typeof R.look;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const color = new THREE.Color();

/** Stable number in [0, 1) per tile and salt (which stake is taller, which way a wall leans). */
function h01(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function createStructureRenderer(): SubRenderer {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const solid = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial(), R.max);
  const ghost = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: R.ghostOpacity, depthWrite: false }), R.ghostMax);
  for (const mesh of [solid, ghost]) {
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.setColorAt(0, color.set(0xffffff));
  }
  ghost.renderOrder = 3;
  // Cursor grid: (2g + 1) lines each way, repositioned around the cursor.
  const G = R.gridTiles;
  const gridPos = new Float32Array((2 * G + 2) * 2 * 2 * 3);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.BufferAttribute(gridPos, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: R.gridColor, transparent: true, opacity: R.gridOpacity, depthWrite: false }));
  grid.frustumCulled = false;
  grid.visible = false;
  // Tracers of the defenders' shots.
  const TR = 32;
  const tracerPos = new Float32Array(TR * 2 * 3);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ color: R.tracer, transparent: true, opacity: 0.8 }));
  tracers.frustumCulled = false;
  tracers.visible = false;
  const tracerT = new Float32Array(TR);
  let tracerNext = 0;

  let n = 0;
  let g = 0;
  let key = '';
  let cursorKey = '';
  /** Number of ghost instances that belong to the structures (the cursor's follow). */
  let ghostBase = 0;
  let sinceBuild = 1;
  /** Shift of everything drawn (07c: the home base seen from a neighbouring cell). */
  let ox = 0;
  let oz = 0;

  /** A box standing on y0: centre (x, z), size (sx, sy, sz), optional yaw and lean (radians about x / z). */
  const box = (x: number, y0: number, z: number, sx: number, sy: number, sz: number, hex: number, yaw = 0, leanX = 0, leanZ = 0, shade = 1): void => {
    if (n >= R.max) return;
    e.set(leanX, yaw, leanZ, 'YXZ');
    q.setFromEuler(e);
    // Lean about the foot, not the middle.
    p.set(0, sy / 2, 0).applyQuaternion(q).add(s.set(x + ox, y0, z + oz));
    m.compose(p, q, s.set(sx, sy, sz));
    solid.setMatrixAt(n, m);
    color.set(hex);
    if (shade !== 1) color.multiplyScalar(shade);
    solid.setColorAt(n, color);
    n++;
  };
  const ghostBox = (x: number, y0: number, z: number, sx: number, sy: number, sz: number, hex: number): void => {
    if (g >= R.ghostMax) return;
    m.compose(p.set(x + ox, y0 + sy / 2, z + oz), q.identity(), s.set(sx, sy, sz));
    ghost.setMatrixAt(g, m);
    ghost.setColorAt(g, color.set(hex));
    g++;
  };

  /** Visible damage step of a structure: 0 sound, 1..3 worse. */
  const wearOf = (state: GameState, st: Structure, def: BuildingDef): number => {
    if (def.hp <= 0) return 0;
    const r = st.hp / maxHp(state, def);
    return r > 0.75 ? 0 : r > 0.5 ? 1 : r > 0.25 ? 2 : 3;
  };

  // --- one structure kind at a time ---------------------------------------------------------

  const drawWall = (ov: Overlay, st: Structure, def: BuildingDef, y: number, wear: number, gate: boolean): void => {
    const L = R.look[def.look as Look];
    const t = st.ty * TILES + st.tx;
    const l = ov.links[t]!;
    const cx = (st.tx + 0.5) * TILE, cz = (st.ty + 0.5) * TILE;
    const any = (l & 15) !== 0;
    const ew = (l & 16) !== 0;
    const arms: [number, number, number][] = []; // [dx, dz, length]: half-tile arms from the centre
    if ((l & 1) !== 0 || (!any && ew)) arms.push([-1, 0, TILE / 2]);
    if ((l & 2) !== 0 || (!any && ew)) arms.push([1, 0, TILE / 2]);
    if ((l & 4) !== 0 || (!any && !ew)) arms.push([0, -1, TILE / 2]);
    if ((l & 8) !== 0 || (!any && !ew)) arms.push([0, 1, TILE / 2]);
    const shade = 1 - wear * 0.12;
    const lean = wear * 0.07 * (h01(st.tx, st.ty) < 0.5 ? -1 : 1);
    const H = def.height;
    const th = def.thick ?? 0.5;
    if (gate) {
      // Two posts, a lintel and barred leaves: people slip through, bullets too.
      const along = ew ? 1 : 0;
      const ox = along ? TILE / 2 - 0.25 : 0, oz = along ? 0 : TILE / 2 - 0.25;
      box(cx - ox, y, cz - oz, 0.5, H + 0.3, 0.5, L.dark, 0, 0, 0, shade);
      box(cx + ox, y, cz + oz, 0.5, H + 0.3, 0.5, L.dark, 0, 0, 0, shade);
      box(cx, y + H, cz, along ? TILE : 0.5, 0.35, along ? 0.5 : TILE, L.dark, 0, 0, 0, shade);
      const bars = wear >= 3 ? 3 : wear >= 2 ? 5 : 7;
      for (let i = 0; i < bars; i++) {
        const u = -1.4 + (2.8 * (i + 0.5)) / 7 + (wear > 0 ? (h01(st.id, i) - 0.5) * 0.1 * wear : 0);
        box(cx + (along ? u : 0), y, cz + (along ? 0 : u), 0.14, H - 0.15, 0.14, L.body, 0, along ? lean : 0, along ? 0 : lean, shade);
      }
      for (const yy of [0.5, H * 0.6]) box(cx, y + yy, cz, along ? TILE - 1 : 0.1, 0.14, along ? 0.1 : TILE - 1, L.light, 0, 0, 0, shade);
      return;
    }
    switch (def.look) {
      case 'wood': {
        // A palisade: stakes of uneven height; a battered one loses stakes and leans.
        for (const [dx, dz, len] of arms) {
          for (let i = 0; i < 2; i++) {
            const salt = st.tx * 7 + st.ty * 13 + (dx + 2) * 3 + (dz + 2) * 5 + i;
            if (wear >= 2 && h01(salt, 9) < (wear - 1) * 0.3) continue;
            const u = (i + 0.5) * (len / 2);
            const hh = H * (0.9 + 0.16 * h01(salt, 1));
            box(cx + dx * u, y, cz + dz * u, dx ? len / 2 - 0.06 : th, hh, dz ? len / 2 - 0.06 : th, i === 0 ? L.body : L.light, 0, dz ? 0 : lean, dx ? 0 : lean, shade);
          }
          const u = len / 2;
          box(cx + dx * u, y + H * 0.55, cz + dz * u, dx ? len : th + 0.12, 0.16, dz ? len : th + 0.12, L.dark, 0, 0, 0, shade);
        }
        return;
      }
      case 'earth': {
        // A mound: wide at the foot, narrow on top; rain and claws wear it down.
        const hh = H * (1 - wear * 0.14);
        for (const [dx, dz, len] of arms) {
          const u = len / 2;
          box(cx + dx * u, y, cz + dz * u, dx ? len : th, hh * 0.6, dz ? len : th, L.body, 0, 0, 0, shade);
          box(cx + dx * u, y + hh * 0.6, cz + dz * u, dx ? len : th * 0.55, hh * 0.4, dz ? len : th * 0.55, L.light, 0, 0, 0, shade);
        }
        box(cx, y, cz, th, hh * 0.6, th, L.body, 0, 0, 0, shade);
        return;
      }
      case 'steel': {
        // Sheets on posts, a rust band along the foot; dented sheets hang askew.
        for (const [dx, dz, len] of arms) {
          const u = len / 2;
          box(cx + dx * u, y + 0.5, cz + dz * u, dx ? len : th * 0.5, H - 0.5, dz ? len : th * 0.5, L.body, 0, dz ? 0 : lean * 1.3, dx ? 0 : lean * 1.3, shade);
          box(cx + dx * u, y, cz + dz * u, dx ? len : th * 0.6, 0.5, dz ? len : th * 0.6, L.light, 0, 0, 0, shade);
        }
        box(cx, y, cz, th + 0.1, H + 0.15, th + 0.1, L.dark, 0, 0, 0, shade);
        return;
      }
      default: {
        // Concrete: thick pale blocks with a darker cap; cracks show as dark seams.
        for (const [dx, dz, len] of arms) {
          const u = len / 2;
          box(cx + dx * u, y, cz + dz * u, dx ? len : th, H - 0.3, dz ? len : th, L.body, 0, 0, 0, shade);
          box(cx + dx * u, y + H - 0.3, cz + dz * u, dx ? len : th + 0.2, 0.3, dz ? len : th + 0.2, L.dark, 0, 0, 0, shade);
          if (wear > 0) box(cx + dx * u * (0.6 + 0.6 * h01(st.id, 2)), y, cz + dz * u * (0.6 + 0.6 * h01(st.id, 2)), dx ? 0.12 * wear : th + 0.04, H * (0.3 + 0.2 * wear), dz ? 0.12 * wear : th + 0.04, 0x3a3834);
        }
        box(cx, y, cz, th, H - 0.3, th, L.body, 0, 0, 0, shade);
        return;
      }
    }
  };

  const drawMoat = (ov: Overlay, state: GameState, st: Structure, def: BuildingDef, y: number): void => {
    const L = R.look[def.look as Look];
    const cx = (st.tx + 0.5) * TILE, cz = (st.ty + 0.5) * TILE;
    // The ground cannot be dug into, so the pit is painted dark with a darker core and raised rims of spoil.
    box(cx, y + 0.02, cz, TILE, 0.03, TILE, L.body);
    box(cx, y + 0.05, cz, TILE - 1.1, 0.02, TILE - 1.1, L.dark);
    const moatAt = (x: number, yy: number): boolean => {
      if (x < 0 || yy < 0 || x >= TILES || yy >= TILES) return false;
      const i = ov.occ[yy * TILES + x]!;
      const o = i > 0 ? state.build.structures[i - 1] : undefined;
      return !!o && o.progress >= 1 && (defOf(o).kind === 'moat' || defOf(o).kind === 'bridge');
    };
    if (!moatAt(st.tx - 1, st.ty)) box(cx - TILE / 2 + 0.2, y, cz, 0.4, 0.22, TILE, L.light);
    if (!moatAt(st.tx + 1, st.ty)) box(cx + TILE / 2 - 0.2, y, cz, 0.4, 0.22, TILE, L.light);
    if (!moatAt(st.tx, st.ty - 1)) box(cx, y, cz - TILE / 2 + 0.2, TILE, 0.22, 0.4, L.light);
    if (!moatAt(st.tx, st.ty + 1)) box(cx, y, cz + TILE / 2 - 0.2, TILE, 0.22, 0.4, L.light);
    // Bodies pile up; a full ditch is a ramp of them.
    const bodies = Math.min(BUILD.moatFill, Math.floor(st.corpsesInMoat ?? 0));
    for (let i = 0; i < bodies; i++) {
      const a = h01(st.id, i) * 6.28;
      box(cx + (h01(st.id, i + 20) - 0.5) * 2.4, y + 0.06 + (i >= 4 ? 0.22 : 0), cz + (h01(st.id, i + 40) - 0.5) * 2.4, 0.45, 0.22, 1.6, R.body, a, 0, 0, 0.8 + 0.3 * h01(st.id, i + 60));
    }
    if (moatFilled(st)) box(cx, y + 0.3, cz, TILE - 0.6, 0.12, TILE - 0.6, R.body, 0, 0, 0, 0.7);
  };

  const drawTower = (st: Structure, def: BuildingDef, y: number, wear: number): void => {
    const L = R.look.wood;
    const x0 = st.tx * TILE, z0 = st.ty * TILE;
    const cx = x0 + TILE / 2, cz = z0 + TILE / 2;
    const top = def.height;
    const shade = 1 - wear * 0.12;
    const lean = wear * 0.03;
    for (const [lx, lz] of [[0.15, 0.15], [TILE - 0.15, 0.15], [0.15, TILE - 0.15], [TILE - 0.15, TILE - 0.15]] as const) box(x0 + lx, y, z0 + lz, 0.3, top - 0.3, 0.3, L.dark, 0, lean, lean, shade);
    box(cx, y + top - 0.3, cz, TILE, 0.3, TILE, L.body, 0, 0, 0, shade);
    // Cross braces and a waist-high rail on the three sides without the ladder.
    box(cx, y + top * 0.45, z0 + 0.15, TILE, 0.14, 0.14, L.light, 0, 0, 0.5, shade);
    box(x0 + 0.15, y + top * 0.45, cz, 0.14, 0.14, TILE, L.light, 0, 0.5, 0, shade);
    const [dx, dz] = towerLadderDir(st.rot);
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (sx === dx && sz === dz) continue;
      box(cx + sx * (TILE / 2 - 0.06), y + top + 0.9, cz + sz * (TILE / 2 - 0.06), sx ? 0.1 : TILE, 0.1, sz ? 0.1 : TILE, L.light, 0, 0, 0, shade);
      for (const u of [-1.9, 1.9]) box(cx + sx * (TILE / 2 - 0.06) + (sx ? 0 : u), y + top, cz + sz * (TILE / 2 - 0.06) + (sz ? 0 : u), 0.1, 0.95, 0.1, L.light, 0, 0, 0, shade);
    }
    // Roof on four thin posts.
    for (const [lx, lz] of [[0.2, 0.2], [TILE - 0.2, 0.2], [0.2, TILE - 0.2], [TILE - 0.2, TILE - 0.2]] as const) box(x0 + lx, y + top, z0 + lz, 0.12, 2.1, 0.12, L.dark);
    box(cx, y + top + 2.1, cz, TILE + 0.5, 0.18, TILE + 0.5, L.dark, 0, 0, 0, shade);
    // Ladder.
    const lx = cx + dx * (TILE / 2 + 0.12), lz = cz + dz * (TILE / 2 + 0.12);
    for (const u of [-0.3, 0.3]) box(lx + (dx ? 0 : u), y, lz + (dz ? 0 : u), 0.07, top + 0.9, 0.07, L.light);
    for (let i = 1; i <= 9; i++) box(lx, y + (i * top) / 9.5, lz, dx ? 0.06 : 0.6, 0.05, dz ? 0.06 : 0.6, L.light);
  };

  const drawWire = (st: Structure, y: number, wear: number): void => {
    const L = R.look.wire;
    const cx = (st.tx + 0.5) * TILE, cz = (st.ty + 0.5) * TILE;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [0, 0]] as const) box(cx + dx, y, cz + dz, 0.12, 1.1, 0.12, L.dark);
    const strands = wear >= 2 ? 1 : 2;
    for (let i = 0; i < strands; i++) {
      const yy = y + 0.45 + i * 0.45;
      box(cx, yy, cz, 4.4, 0.05, 0.05, L.light, 0.785);
      box(cx, yy, cz, 4.4, 0.05, 0.05, L.light, -0.785);
      box(cx, yy, cz - 1.5, 3.1, 0.05, 0.05, L.body);
      box(cx, yy, cz + 1.5, 3.1, 0.05, 0.05, L.body);
      box(cx - 1.5, yy, cz, 0.05, 0.05, 3.1, L.body);
      box(cx + 1.5, yy, cz, 0.05, 0.05, 3.1, L.body);
    }
  };

  const drawBuilding = (st: Structure, def: BuildingDef, y: number, wear: number, raised: boolean): void => {
    const L = R.look[def.look as Look];
    const [w, d] = footprint(def, st.rot);
    const x0 = st.tx * TILE, z0 = st.ty * TILE;
    const sx = w * TILE, sz = d * TILE;
    const cx = x0 + sx / 2, cz = z0 + sz / 2;
    const shade = 1 - wear * 0.1;
    const H = def.height;
    if (def.kind === 'field') {
      box(cx, y - 0.02, cz, sx - 0.4, 0.08, sz - 0.4, L.body);
      const rows = Math.floor((sz - 1) / 2.2);
      for (let i = 0; i < rows; i++) box(cx, y + 0.06, z0 + 1.3 + i * 2.2, sx - 1.4, 0.28, 0.5, L.light);
      for (const [px, pz] of [[x0 + 0.2, z0 + 0.2], [x0 + sx - 0.2, z0 + 0.2], [x0 + 0.2, z0 + sz - 0.2], [x0 + sx - 0.2, z0 + sz - 0.2]] as const) box(px, y, pz, 0.12, 0.8, 0.12, R.look.wood.dark);
      return;
    }
    if (def.kind === 'bridge') {
      // Planks across the ditch; hauled up on end while the alarm is on.
      box(cx, y + 0.02, cz, TILE, 0.03, TILE, R.look.pit.body);
      if (raised) box(cx, y, cz - TILE / 2 + 0.2, TILE - 0.6, TILE - 0.4, 0.18, L.body, 0, 0, 0, shade);
      else box(cx, y + 0.1, cz, TILE - 0.6, 0.14, TILE, L.body, 0, 0, 0, shade);
      for (const u of [-1.6, 1.6]) box(cx + u, y, cz - TILE / 2 + 0.2, 0.2, 1.6, 0.2, L.dark);
      return;
    }
    const inset = 0.3;
    const bw = sx - inset * 2, bd = sz - inset * 2;
    // Door on the side the structure faces (rot 0 = south).
    const [fx, fz] = towerLadderDir(st.rot);
    const door = (h: number, wd: number): void => box(cx + fx * (bw / 2), y, cz + fz * (bd / 2), fx ? 0.12 : wd, h, fz ? 0.12 : wd, L.dark);
    switch (def.id) {
      case 'tent': {
        box(cx, y, cz, bw, 1.1, bd, L.body, 0, 0, 0, shade);
        box(cx, y + 1.1, cz, bw * 0.62, 0.55, bd, L.body, 0, 0, 0, shade * 0.92);
        box(cx, y + 1.65, cz, bw * 0.22, 0.35, bd + 0.2, L.dark);
        door(1.3, 0.9);
        return;
      }
      case 'hq': {
        box(cx, y, cz, bw, H - 1, bd, L.body, 0, 0, 0, shade);
        box(cx, y + H - 1, cz, bw + 0.8, 0.4, bd + 0.8, L.dark, 0, 0, 0, shade);
        box(cx, y + H - 0.6, cz, bw * 0.6, 0.6, bd + 0.4, L.dark, 0, 0, 0, shade);
        door(2.3, 1.8);
        for (const u of [-3.4, 3.4]) box(cx + u, y + 1.3, cz + bd / 2, 1.3, 1, 0.1, 0xd8c98a);
        // Flag and the fire where people eat.
        box(cx + bw / 2 - 0.4, y, cz + bd / 2 + 1.2, 0.14, 7, 0.14, R.look.wood.light);
        box(cx + bw / 2 + 0.4, y + 5.9, cz + bd / 2 + 1.2, 1.5, 0.9, 0.06, R.flag);
        box(cx - 6, y, cz + 13, 1.2, 0.25, 1.2, R.stone);
        box(cx - 6, y + 0.25, cz + 13, 0.5, 0.45, 0.5, R.fire);
        if (wear >= 2) box(cx - bw / 4, y, cz + bd / 2, 0.3, H - 1.4, 0.14, 0x2a2622);
        return;
      }
      case 'radio': {
        box(cx, y, cz, 2.2, 2.2, 2.2, L.dark);
        box(cx, y + 2.2, cz, 0.35, H - 2.2, 0.35, L.body);
        for (const hh of [0.45, 0.7, 0.92]) box(cx, y + H * hh, cz, 1.6 * (1.2 - hh), 0.1, 0.1, L.light);
        return;
      }
      case 'monument': {
        box(cx, y, cz, 2.6, 0.6, 2.6, L.dark);
        box(cx, y + 0.6, cz, 1.6, 1, 1.6, L.body);
        box(cx, y + 1.6, cz, 0.8, H - 1.6, 0.8, L.light);
        return;
      }
      case 'generator': {
        box(cx, y, cz, 2.6, 1.3, 1.8, L.body);
        box(cx + 0.8, y + 1.3, cz, 0.3, 0.9, 0.3, L.dark);
        box(cx - 0.5, y + 1.3, cz, 1.2, 0.25, 1.2, L.light);
        return;
      }
      case 'turret': {
        box(cx, y, cz, 1.6, 1.3, 1.6, L.dark);
        box(cx, y + 1.3, cz, 1, 0.6, 1, L.body);
        box(cx, y + 1.5, cz + 0.9, 0.16, 0.16, 1.4, L.dark);
        return;
      }
      default: {
        box(cx, y, cz, bw, H, bd, L.body, 0, 0, 0, shade);
        // Roof: a darker slab, pitched for the small wooden and brick houses.
        if (def.look === 'wood' || def.look === 'brick') {
          const along = bw >= bd;
          box(cx, y + H, cz, along ? bw + 0.6 : bw * 0.72, 0.5, along ? bd * 0.72 : bd + 0.6, L.dark, 0, 0, 0, shade);
          box(cx, y + H + 0.5, cz, along ? bw + 0.6 : bw * 0.36, 0.45, along ? bd * 0.36 : bd + 0.6, L.dark, 0, 0, 0, shade * 0.9);
        } else box(cx, y + H, cz, bw + 0.3, 0.25, bd + 0.3, L.dark, 0, 0, 0, shade);
        door(Math.min(2.2, H - 0.4), 1.3);
        // Something on the front wall that tells the buildings apart.
        const sign = (hex: number, sw: number, sh: number, up: number): void => box(cx + fx * (bw / 2 + 0.02) + (fx ? 0 : 1.9), y + up, cz + fz * (bd / 2 + 0.02) + (fz ? 0 : 1.9), fx ? 0.08 : sw, sh, fz ? 0.08 : sw, hex);
        if (def.id === 'clinic' || def.id === 'hospital') {
          sign(0xc03030, 0.9, 0.3, 1.9);
          sign(0xc03030, 0.3, 0.9, 1.6);
        } else if (def.id === 'workshop') {
          box(cx - bw / 4, y + H + 0.9, cz, 0.5, 1.2, 0.5, R.stone);
        } else if (def.id === 'storehouse') {
          for (let i = 0; i < 3; i++) box(cx - bw / 2 - 0.7, y + (i === 2 ? 0.8 : 0), cz - 0.6 + (i % 2) * 1.2, 1, 0.8, 1, R.crate, i * 0.3);
        } else if (def.id === 'lab') sign(0x3a6ad0, 1.2, 0.5, 2.1);
        else if (def.id === 'canteen' || def.id === 'tavern') sign(0xe6cf6a, 1.2, 0.5, 2.1);
        else if (def.id === 'barracks') sign(0x2f4f9a, 1.2, 0.5, 2.1);
        else if (def.id === 'capitol') {
          for (const u of [-5, -2.5, 2.5, 5]) box(cx + (fx ? fx * (bw / 2 + 0.6) : u), y, cz + (fz ? fz * (bd / 2 + 0.6) : u), 0.6, H, 0.6, L.light);
          box(cx, y + H + 0.25, cz, bw * 0.4, 2.2, bd * 0.4, L.light);
        } else if (def.id === 'greenhouse') {
          for (let i = 1; i < 4; i++) box(x0 + (sx * i) / 4, y, cz, 0.08, H + 0.05, bd + 0.06, L.dark);
        } else if (def.id === 'ranch') {
          for (const u of [-1, 1]) box(cx + u * (bw / 2 + 1.2), y + 0.7, cz, 0.1, 0.1, bd, R.look.wood.light);
        }
        if (wear >= 2) box(cx + bw / 4, y, cz + (fz >= 0 ? bd / 2 : -bd / 2), 0.3, H * 0.8, 0.14, 0x2a2622);
        return;
      }
    }
  };

  const drawBlueprint = (st: Structure, def: BuildingDef, y: number): void => {
    const [w, d] = footprint(def, st.rot);
    const sx = w * TILE, sz = d * TILE;
    const cx = st.tx * TILE + sx / 2, cz = st.ty * TILE + sz / 2;
    const H = Math.max(0.4, def.kind === 'moat' ? 0.15 : def.height);
    const thin = def.kind === 'wall' || def.kind === 'gate';
    const bx = thin ? Math.max(1.2, def.thick ?? 0.5) : sx - 0.4;
    ghostBox(cx, y, cz, thin ? TILE - 0.3 : bx, H, thin ? TILE - 0.3 : sz - 0.4, R.ghost);
    if (st.progress <= 0) return;
    // What has been raised so far, inside scaffolding poles.
    const L = R.look[def.look as Look];
    box(cx, y, cz, thin ? TILE - 0.5 : sx - 0.8, H * st.progress, thin ? bx - 0.2 : sz - 0.8, L.body, 0, 0, 0, 0.9);
    if (def.kind === 'moat') return;
    const px = sx / 2 - 0.15, pz = sz / 2 - 0.15;
    for (const [ax, az] of [[-px, -pz], [px, -pz], [-px, pz], [px, pz]] as const) box(cx + ax, y, cz + az, 0.1, H + 0.6, 0.1, R.look.wood.light);
    box(cx, y + H * 0.5, cz - pz, sx - 0.3, 0.08, 0.08, R.look.wood.light);
    box(cx, y + H * 0.5, cz + pz, sx - 0.3, 0.08, 0.08, R.look.wood.light);
  };

  const drawRubble = (st: Structure, def: BuildingDef, y: number): void => {
    const [w, d] = footprint(def, st.rot);
    const count = Math.min(10, 3 * w * d);
    const L = R.look[def.look as Look];
    for (let i = 0; i < count; i++) {
      const x = (st.tx + h01(st.id, i) * w) * TILE, z = (st.ty + h01(st.id, i + 30) * d) * TILE;
      box(x, y, z, 0.5 + h01(st.id, i + 7) * 1.2, 0.15 + h01(st.id, i + 9) * 0.4, 0.4 + h01(st.id, i + 11) * 1.4, i % 2 ? R.rubble : L.dark, h01(st.id, i + 3) * 3, 0.2 * h01(st.id, i + 5));
    }
  };

  const rebuild = (state: GameState, here: TacticalMap, home: { map: TacticalMap; off: [number, number] } | null): void => {
    n = 0;
    g = 0;
    ox = 0;
    oz = 0;
    const map = home ? home.map : here;
    if (home) {
      ox = home.off[0];
      oz = home.off[1];
      const ov = overlayOf(state, map.walk);
      const raised = state.flags.colonyAlarm === true;
      for (const st of state.build.structures) {
        const def = defOf(st);
        const [w, d] = footprint(def, st.rot);
        const y = heightAt(map, (st.tx + w / 2) * TILE, (st.ty + d / 2) * TILE);
        if (isRuin(st)) drawRubble(st, def, y);
        else if (st.progress < 1) drawBlueprint(st, def, y);
        else {
          const wear = wearOf(state, st, def);
          switch (def.kind) {
            case 'wall': drawWall(ov, st, def, y, wear, false); break;
            case 'gate': drawWall(ov, st, def, y, wear, true); break;
            case 'moat': drawMoat(ov, state, st, def, y); break;
            case 'tower': drawTower(st, def, y, wear); break;
            case 'wire': drawWire(st, y, wear); break;
            // 07d: enterable buildings are drawn from their blueprints (enterables.ts).
            default: if (!BASE_BLUEPRINT[def.id]) drawBuilding(st, def, y, wear, raised);
          }
        }
        if (commandView.highlight === st.id) ghostBox((st.tx + w / 2) * TILE, y, (st.ty + d / 2) * TILE, w * TILE + 0.3, Math.max(1, def.height) + 0.4, d * TILE + 0.3, R.bad);
      }
      ox = 0;
      oz = 0;
    }
    if (!here.params.isHome) {
      const o = state.tactical ? outpostAt(state, state.tactical.cell) : undefined;
      const prefab = o ? outpostPrefab(here, o.tier) : null;
      if (prefab) {
        const y0 = heightAt(here, prefab.site[0], prefab.site[1]);
        for (const b of prefab.boxes) {
          const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
          const y = heightAt(here, cx, cz);
          const hex = b.look === 'cloth' ? R.look.cloth.body : b.look === 'crate' ? R.crate : b.look === 'flag' ? R.flag : b.look === 'steel' ? R.look.steel.body : R.look.wood.body;
          if (b.look === 'flag') box(cx, y0 + 5, cz, b.x1 - b.x0, b.h, b.z1 - b.z0, hex);
          else box(cx, y, cz, b.x1 - b.x0, b.h, b.z1 - b.z0, hex);
          if (b.look === 'cloth') box(cx, y + b.h, cz, (b.x1 - b.x0) * 0.5, 0.5, b.z1 - b.z0 + 0.2, R.look.cloth.dark);
        }
      }
    }
    solid.count = n;
    solid.instanceMatrix.needsUpdate = true;
    if (solid.instanceColor) solid.instanceColor.needsUpdate = true;
    ghostBase = g;
  };

  /** Everything that changes what is drawn, as one string. */
  const keyOf = (state: GameState, map: TacticalMap, home: { map: TacticalMap; off: [number, number] } | null): string => {
    const o = !map.params.isHome && state.tactical ? outpostAt(state, state.tactical.cell) : undefined;
    const outpost = `o:${map.params.mapSeed}:${o ? `${o.id}:${o.tier}` : ''}`;
    if (!map.params.isHome && !home) return outpost;
    let wear = 0;
    let progress = 0;
    for (const st of state.build.structures) {
      const def = defOf(st);
      if (st.progress < 1) progress += Math.floor(st.progress * 8);
      else if (def.hp > 0) wear = (wear * 4 + wearOf(state, st, def)) % 1000003;
      wear = (wear + Math.floor(st.corpsesInMoat ?? 0)) % 1000003;
    }
    return `h:${map.params.mapSeed}:${state.build.gridRev}:${wear}:${progress}:${state.flags.colonyAlarm === true ? 1 : 0}:${commandView.highlight ?? ''}:${home ? `${home.off.join(',')}:${outpost}` : ''}`;
  };

  const drawCursor = (state: GameState, map: TacticalMap): void => {
    g = ghostBase;
    const pv = state.mode === 'command' && map.params.isHome ? commandView.preview : null;
    if (pv) {
      const def = BUILDINGS[pv.def];
      for (const tile of pv.tiles) {
        const [w, d] = def ? footprint(def, pv.rot) : [1, 1];
        const cx = (tile.tx + w / 2) * TILE, cz = (tile.ty + d / 2) * TILE;
        ghostBox(cx, heightAt(map, cx, cz), cz, w * TILE - 0.2, Math.max(0.5, def?.kind === 'moat' ? 0.3 : (def?.height ?? 1)), d * TILE - 0.2, tile.ok ? R.ok : R.bad);
      }
    }
    ghost.count = g;
    ghost.instanceMatrix.needsUpdate = true;
    if (ghost.instanceColor) ghost.instanceColor.needsUpdate = true;
    // Grid around the cursor.
    const c = state.mode === 'command' && map.params.isHome && commandView.grid ? commandView.cursor : null;
    grid.visible = c !== null;
    if (c) {
      const tx = Math.floor(c[0] / TILE), tz = Math.floor(c[1] / TILE);
      const y = heightAt(map, c[0], c[1]) + 0.12;
      let i = 0;
      for (let k = -G; k <= G + 1; k++) {
        if (i + 12 > gridPos.length) break;
        gridPos.set([(tx + k) * TILE, y, (tz - G) * TILE, (tx + k) * TILE, y, (tz + G + 1) * TILE], i);
        gridPos.set([(tx - G) * TILE, y, (tz + k) * TILE, (tx + G + 1) * TILE, y, (tz + k) * TILE], i + 6);
        i += 12;
      }
      gridGeo.attributes.position!.needsUpdate = true;
    }
  };

  return {
    id: 'structures',
    init(ctx: RenderContext) {
      ctx.scene.add(solid, ghost, grid, tracers);
      ctx.events.on('defenderFired', (ev) => {
        const i = tracerNext++ % TR;
        tracerPos.set([ev.pos[0], ev.pos[1], ev.pos[2], ev.target[0], ev.target[1] + (ev.hit ? 0 : 1.2), ev.target[2]], i * 6);
        tracerT[i] = R.tracerSeconds;
      });
    },
    reset() {
      key = '';
      cursorKey = '';
      tracerT.fill(0);
    },
    update(state: GameState, frame: FrameInfo) {
      const map = mapOf(state);
      if (!map || state.flags.range) {
        solid.count = 0;
        ghost.count = 0;
        grid.visible = false;
        tracers.visible = false;
        key = '';
        return;
      }
      sinceBuild += frame.realDt;
      // 07c: standing in a cell next to the base, the base is still in view.
      let home: { map: TacticalMap; off: [number, number] } | null = null;
      const homeCell = state.world.homeCell;
      if (!map.params.isHome && homeCell !== null && map.params.world) {
        const off = cellOffset(state, homeCell, map.size);
        const homeMap = off ? neighbourMap(state, homeCell) : null;
        if (off && homeMap) home = { map: homeMap, off };
      }
      const next = keyOf(state, map, home);
      // Damage during a fight changes the key often: rebuild at most a few times a second.
      if (next !== key && (sinceBuild > 0.2 || key === '' || next.split(':')[2] !== key.split(':')[2])) {
        key = next;
        sinceBuild = 0;
        rebuild(state, map, map.params.isHome ? { map, off: [0, 0] } : home);
        cursorKey = '';
      }
      const pv = commandView.preview;
      const ck = `${state.mode}:${pv ? `${pv.def}:${pv.rot}:${pv.tiles.map((t) => `${t.tx},${t.ty},${t.ok ? 1 : 0}`).join(';')}` : ''}:${commandView.grid ? commandView.cursor?.map((v) => Math.floor(v / TILE)).join(',') : ''}`;
      if (ck !== cursorKey) {
        cursorKey = ck;
        drawCursor(state, map);
      }
      // Tracers fade out.
      let live = false;
      for (let i = 0; i < TR; i++) {
        if (tracerT[i]! <= 0) continue;
        tracerT[i] = tracerT[i]! - frame.realDt;
        if (tracerT[i]! <= 0) tracerPos.fill(0, i * 6, i * 6 + 6);
        else live = true;
      }
      tracers.visible = live;
      if (live || tracers.visible) tracerGeo.attributes.position!.needsUpdate = true;
    },
    dispose() {
      for (const o of [solid, ghost]) {
        o.removeFromParent();
        (o.material as THREE.Material).dispose();
      }
      geometry.dispose();
      for (const o of [grid, tracers]) {
        o.removeFromParent();
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    },
  };
}
