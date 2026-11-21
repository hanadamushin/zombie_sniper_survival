// Top view of the real-map data of some cells (land use, relief shading, roads, rails, facilities):
//   node tools/real/area-preview.ts <region> <cell> [cell...] [--out tmp/realarea]
// Compare it with the GSI map of the same 10 km square (docs/realmap_guide.md §5).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { decodeRealArea, ELEV_N, LINE, LU, LU_N, POI } from '../../src/gen/real/format.ts';
import { encodePng } from '../lib/png.ts';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const out = oi >= 0 ? args[oi + 1]! : 'tmp/realarea';
const [region, ...rest] = args.filter((_, i) => oi < 0 || (i !== oi && i !== oi + 1));
mkdirSync(out, { recursive: true });
const PX = 1; // pixels per game metre / 2
const S = 512 * PX;
const LU_COLORS: Record<number, [number, number, number]> = {
  [LU.none]: [120, 120, 120], [LU.paddy]: [170, 200, 120], [LU.field]: [200, 190, 120], [LU.forest]: [50, 110, 60], [LU.waste]: [150, 150, 110],
  [LU.building]: [200, 120, 110], [LU.road]: [150, 150, 150], [LU.rail]: [110, 110, 130], [LU.other]: [210, 200, 170], [LU.water]: [70, 120, 200],
  [LU.beach]: [230, 220, 170], [LU.sea]: [30, 60, 120], [LU.golf]: [120, 220, 120],
};
for (const cell of rest.map(Number)) {
  const a = decodeRealArea(gunzipSync(readFileSync(`public/data/areas/${region}/${cell}.bin`)));
  const rgb = new Uint8Array(S * S * 3);
  const e = (i: number, j: number): number => {
    const v = a.elev[Math.min(ELEV_N - 1, j) * ELEV_N + Math.min(ELEV_N - 1, i)]!;
    return Number.isFinite(v) ? v : 0;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const lx = (x / S) * 1024;
    const lz = (y / S) * 1024;
    const c = a.landuse[Math.floor((lz / 1024) * LU_N) * LU_N + Math.floor((lx / 1024) * LU_N)]!;
    const i = Math.floor((lx / 1024) * (ELEV_N - 1));
    const j = Math.floor((lz / 1024) * (ELEV_N - 1));
    const shade = Math.max(0.55, Math.min(1.3, 1 + (e(i, j) - e(i + 1, j + 1)) / 40));
    const col = LU_COLORS[c] ?? [255, 0, 255];
    rgb.set(col.map((v) => Math.min(255, v * shade)), (y * S + x) * 3);
  }
  const dot = (x: number, z: number, col: [number, number, number], r: number): void => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const px = Math.round((x / 1024) * S) + dx;
      const py = Math.round((z / 1024) * S) + dy;
      if (px >= 0 && py >= 0 && px < S && py < S) rgb.set(col, (py * S + px) * 3);
    }
  };
  for (const l of a.lines) {
    const col: [number, number, number] = l.kind === LINE.motorway ? [40, 160, 60] : l.kind === LINE.national ? [230, 60, 60] : l.kind === LINE.prefectural ? [240, 180, 40] : l.kind >= LINE.rail ? [20, 20, 20] : [255, 255, 255];
    for (let k = 0; k + 1 < l.pts.length / 2; k++) {
      const [x0, z0, x1, z1] = [l.pts[k * 2]!, l.pts[k * 2 + 1]!, l.pts[k * 2 + 2]!, l.pts[k * 2 + 3]!];
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
      for (let t = 0; t <= n; t++) dot(x0 + ((x1 - x0) * t) / n, z0 + ((z1 - z0) * t) / n, (l.flags & 1) ? [120, 120, 120] : col, l.width >= 10 ? 1 : 0);
    }
  }
  for (const p of a.pois) dot(p.x, p.z, p.kind === POI.station ? [255, 255, 0] : p.kind >= POI.gsdf && p.kind <= POI.asdf ? [255, 0, 255] : [0, 255, 255], 3);
  writeFileSync(join(out, `${region}_${cell}.png`), encodePng(S, S, rgb));
  console.log(`${cell}: ${a.lines.length} lines, ${a.pois.length} points: ${a.pois.map((p) => p.name).slice(0, 30).join(' ')}`);
}
