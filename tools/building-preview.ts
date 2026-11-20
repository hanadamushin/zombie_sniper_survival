// Floor plans and a side elevation of every enterable building type (07d), for checking a new type by eye:
//   node tools/building-preview.ts [outDir] [seed]      (npm run buildings:preview)
// writes <id>.png: one plan per storey (and the roof when it can be reached) side by side, then
// the front elevation. 20 px = 1 m, front (the entrance side, z = d) at the bottom of each plan.
// Plan legend: grey = walls / solid at body height, light blue = glass (stops people only),
// brown = stairs, olive = furniture, pale fill = rooms (red tint = locked), green line = door way
// (white dots its waypoints), orange line = stairs way, yellow dot = search point.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILDING_DEFS, generateBlueprint, localColliders, triangleCount, type BuildingBlueprint } from '../src/gen/buildings/index.ts';
import { encodePng } from './lib/png.ts';

type Rgb = [number, number, number];
const PX = 20;

function render(bp: BuildingBlueprint): { png: Buffer; w: number; h: number } {
  const levels = bp.storeys.length;
  const pw = Math.ceil((bp.w + 2) * PX);
  const ph = Math.ceil((bp.d + 2) * PX);
  const eh = Math.ceil((bp.height + 4) * PX);
  const W = pw * levels;
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
    for (let y = Math.floor(Math.min(y0, y1)); y < Math.max(y0, y1); y++) for (let x = Math.floor(Math.min(x0, x1)); x < Math.max(x0, x1); x++) put(x, y, c, a);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: Rgb): void => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
      put(x0 + ((x1 - x0) * i) / n + 1, y0 + ((y1 - y0) * i) / n, c);
    }
  };
  const cols = localColliders(bp);
  bp.storeys.forEach((st, l) => {
    // Plan l: x right, z down, with a 1 m margin.
    const ox = l * pw + PX;
    const oz = PX;
    const P = (x: number, z: number): [number, number] => [ox + x * PX, oz + z * PX];
    rect(l * pw + 2, 2, (l + 1) * pw - 2, ph - 2, [236, 236, 232]);
    for (const r of bp.rooms.filter((q) => q.level === l)) {
      const [a, b] = P(r.x0, r.z0);
      const [c, d] = P(r.x1, r.z1);
      rect(a, b, c, d, r.locked ? [240, 200, 200] : [250, 246, 226]);
    }
    const y = st.y;
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
mkdirSync(out, { recursive: true });
for (const def of BUILDING_DEFS) {
  const w = (def.size.w[0] + def.size.w[1]) / 2;
  const d = (def.size.d[0] + def.size.d[1]) / 2;
  const bp = generateBlueprint(def, w, d, seed);
  const { png } = render(bp);
  writeFileSync(join(out, `${def.id}.png`), png);
  const t = triangleCount(bp);
  console.log(`${def.id}: ${w.toFixed(1)} × ${d.toFixed(1)} m, ${bp.storeys.length} levels, ${bp.rooms.length} rooms, ${bp.search.length} search points, triangles outside ${t.shell} / inside ${t.interior.join(' ')}`);
}
