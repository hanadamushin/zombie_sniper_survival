// Floor plans and a side elevation of every enterable building type (07d), for checking a new type by eye:
//   node tools/building-preview.ts [outDir] [seed] [idPrefix]      (npm run buildings:preview)
// writes <id>.png: one plan per storey (and the roof when it can be reached) side by side, then
// the front elevation. A storey laid out exactly like the one below it (the repeated floors of a
// tall building, 07d-2c) is left out, so a 30-storey tower stays a readable image. 20 px = 1 m, front (the entrance side, z = d) at the bottom of each plan.
// Plan legend: grey = walls / solid at body height, light blue = glass (stops people only),
// brown = stairs, olive = furniture, pale fill = rooms (red tint = locked), green line = door way
// (white dots its waypoints), orange line = stairs way, yellow dot = search point.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILDING_DEFS, generateBlueprint, localColliders, triangleCount, type BuildingBlueprint } from '../src/gen/buildings/index.ts';
import { encodePng } from './lib/png.ts';

type Rgb = [number, number, number];
const MAX_PX = 20;

/** Levels with something on them: the storeys, and floors above them (07d-2e: control and hotel towers rise past `storeys`). */
function levelsOf(bp: BuildingBlueprint): number[] {
  return [...new Set([...bp.storeys.map((_, l) => l), ...bp.rooms.map((r) => r.level)])].sort((a, b) => a - b);
}

/** Floor height of a level. */
function yOf(bp: BuildingBlueprint, l: number): number {
  return bp.storeys[l]?.y ?? bp.rooms.find((r) => r.level === l)?.y ?? 0;
}

/** Storeys to draw: the first, the last and every one laid out differently from the storey below. */
function shown(bp: BuildingBlueprint): number[] {
  const sig = (l: number): string => [
    ...bp.rooms.filter((r) => r.level === l).map((r) => `${r.x0.toFixed(2)},${r.z0.toFixed(2)},${r.x1.toFixed(2)},${r.z1.toFixed(2)},${r.use},${r.locked ? 1 : 0}`),
    ...bp.openings.filter((o) => o.level === l).map((o) => `${o.kind}${o.state}${o.x.toFixed(2)},${o.z.toFixed(2)}`),
    bp.search.filter((s) => s.room >= 0 && bp.rooms[s.room]!.level === l).length,
  ].join(';');
  const ls = levelsOf(bp);
  return ls.filter((l, i) => i === 0 || i === ls.length - 1 || sig(l) !== sig(ls[i - 1]!));
}

/** 07d-2e: pixels per metre (fewer for the sites hundreds of metres across). */
function scaleOf(bp: BuildingBlueprint): number {
  return Math.max(2, Math.min(MAX_PX, Math.floor(6000 / (Math.max(bp.w, bp.d) + 2))));
}

/** 07d-2e: the part of the footprint a plan shows: all of it for the ground storey and small buildings, else round the level's rooms. */
function viewOf(bp: BuildingBlueprint, l: number): [number, number, number, number] {
  const rooms = bp.rooms.filter((r) => r.level === l);
  if (l === 0 || Math.max(bp.w, bp.d) <= 150 || rooms.length === 0) return [0, 0, bp.w, bp.d];
  const pad = 4;
  return [
    Math.max(0, Math.min(...rooms.map((r) => r.x0)) - pad), Math.max(0, Math.min(...rooms.map((r) => r.z0)) - pad),
    Math.min(bp.w, Math.max(...rooms.map((r) => r.x1)) + pad), Math.min(bp.d, Math.max(...rooms.map((r) => r.z1)) + pad),
  ];
}

function render(bp: BuildingBlueprint): { png: Buffer; w: number; h: number } {
  const draw = shown(bp);
  const PX = scaleOf(bp);
  const views = draw.map((l) => viewOf(bp, l));
  const pws = views.map((v) => Math.ceil((v[2] - v[0] + 2) * PX));
  const offs = pws.map((_, i) => pws.slice(0, i).reduce((a, b) => a + b, 0));
  const ph = Math.max(...views.map((v) => Math.ceil((v[3] - v[1] + 2) * PX)));
  const eh = Math.ceil((bp.height + 4) * PX);
  const W = Math.max(offs[offs.length - 1]! + pws[pws.length - 1]!, Math.ceil((bp.w + 2) * PX));
  const H = ph + eh;
  const rgb = new Uint8Array(W * H * 3).fill(250);
  const put = (x: number, y: number, c: Rgb, a = 1): void => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const i = (py * W + px) * 3;
    for (let k = 0; k < 3; k++) rgb[i + k] = rgb[i + k]! * (1 - a) + c[k]! * a;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: Rgb, a = 1): void => {
    for (let y = Math.max(0, Math.floor(Math.min(y0, y1))); y < Math.min(H, Math.max(y0, y1)); y++) for (let x = Math.max(0, Math.floor(Math.min(x0, x1))); x < Math.min(W, Math.max(x0, x1)); x++) put(x, y, c, a);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: Rgb): void => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
      put(x0 + ((x1 - x0) * i) / n + 1, y0 + ((y1 - y0) * i) / n, c);
    }
  };
  const cols = localColliders(bp);
  draw.forEach((l, slot) => {
    const v = views[slot]!;
    // Plan l: x right, z down, with a 1 m margin.
    const ox = offs[slot]! + PX - v[0] * PX;
    const oz = PX - v[1] * PX;
    const P = (x: number, z: number): [number, number] => [ox + x * PX, oz + z * PX];
    rect(offs[slot]! + 2, 2, offs[slot]! + pws[slot]! - 2, ph - 2, [236, 236, 232]);
    for (const r of bp.rooms.filter((q) => q.level === l)) {
      const [a, b] = P(r.x0, r.z0);
      const [c, d] = P(r.x1, r.z1);
      rect(a, b, c, d, r.locked ? [240, 200, 200] : [250, 246, 226]);
    }
    const y = yOf(bp, l);
    for (const c of cols) {
      if (c.y1 <= y + 0.5 || c.y0 >= y + 1.7) continue;
      const [a, b] = P(c.x0, c.z0);
      const [cc, d] = P(c.x1, c.z1);
      const col: Rgb = c.pane ? [120, 180, 230] : c.kind === 'stair' ? [150, 100, 60] : c.kind === 'prop' ? [130, 140, 70] : [70, 70, 74];
      rect(a, b, Math.max(cc, a + 1), Math.max(d, b + 1), col);
    }
    // Stairs going up from this floor (treads below body height too).
    for (const c of cols) if (c.kind === 'stair' && c.y1 > y && c.y1 <= y + 0.5) {
      const [a, b] = P(c.x0, c.z0);
      const [cc, d] = P(c.x1, c.z1);
      rect(a, b, cc, d, [190, 140, 90], 0.6);
    }
    for (const lk of bp.links) {
      const pts = lk.pts.filter((p) => Math.abs(p[1] - y) < 1.5 || lk.kind === 'stairs');
      const onThis = lk.pts.some((p) => Math.abs(p[1] - y) < 0.3);
      if (!onThis) continue;
      const c: Rgb = lk.kind === 'stairs' || lk.kind === 'ladder' ? [230, 130, 30] : [40, 160, 60];
      for (let i = 0; i + 1 < pts.length; i++) {
        const [a, b] = P(pts[i]![0], pts[i]![2]);
        const [cc, d] = P(pts[i + 1]![0], pts[i + 1]![2]);
        line(a, b, cc, d, c);
      }
      for (const p of pts) {
        const [a, b] = P(p[0], p[2]);
        rect(a - 2, b - 2, a + 2, b + 2, [255, 255, 255]);
      }
    }
    for (const s of bp.search.filter((q) => Math.abs(q.pos[1] - y) < 0.3)) {
      const [a, b] = P(s.pos[0], s.pos[2]);
      rect(a - 4, b - 4, a + 4, b + 4, [230, 200, 20]);
    }
  });
  // Front elevation: x right, y up, looking at the front (z = d) from outside.
  const ey = ph + eh - PX * 2;
  for (const p of [...bp.parts].sort((a, b) => a.z1 - b.z1)) {
    if (p.hidden) continue;
    const c: Rgb = p.mat === 'glass' ? [120, 170, 210] : p.layer === 'shell' ? [150 + (p.z1 / bp.d) * 60, 150 + (p.z1 / bp.d) * 60, 145 + (p.z1 / bp.d) * 60] : [200, 190, 170];
    if (p.layer !== 'shell') continue;
    rect(PX + p.x0 * PX, ey - p.y1 * PX, PX + p.x1 * PX, ey - Math.max(-0.5, p.y0) * PX, c);
  }
  rect(0, ey, W, ey + 2, [60, 120, 60]);
  return { png: encodePng(W, H, rgb), w: W, h: H };
}

const out = process.argv[2] ?? 'tmp/buildings';
const seed = Number(process.argv[3] ?? 1);
const only = process.argv[4] ?? '';
mkdirSync(out, { recursive: true });
for (const def of BUILDING_DEFS.filter((d) => d.id.startsWith(only))) {
  const w = (def.size.w[0] + def.size.w[1]) / 2;
  const d = (def.size.d[0] + def.size.d[1]) / 2;
  const bp = generateBlueprint(def, w, d, seed);
  const { png } = render(bp);
  writeFileSync(join(out, `${def.id}.png`), png);
  const t = triangleCount(bp);
  console.log(`${def.id}: ${w.toFixed(1)} × ${d.toFixed(1)} m, ${levelsOf(bp).length} levels (${shown(bp).length} drawn), ${bp.rooms.length} rooms, ${bp.search.length} search points, triangles outside ${t.shell} / inside ${t.interior.join(' ')}`);
}
