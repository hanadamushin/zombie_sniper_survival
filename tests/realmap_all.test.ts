// R9: the area files of all eight regions after the nationwide rebuild with the final shared code —
// every land cell has exactly one area file, in the folder of its region (no file left behind in the
// folder of another region), the land use is read everywhere (R3 / R4: an unread first-level mesh
// becomes beach on land), rail tunnels are tunnels (R1) and the total stays within 120 MB.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeRealArea, LINE, LINE_TUNNEL, LU } from '../src/gen/real/format.ts';
import { loadGrid } from '../tools/real/lib/game.ts';
import { REGIONS } from '../tools/real/lib/regions.ts';

const grid = loadGrid();
const DIR = new URL('../public/data/areas/', import.meta.url);
const have = REGIONS.every((r) => existsSync(new URL(`${r}/index.json`, DIR)));

// Reading and decoding all 4,108 area files takes 2-4 s alone; under the parallel suite it went past
// vitest's default 5 s now and then (the one unexplained failure in R9). Give it room.
describe.skipIf(!have)('real map: all regions (R9)', { timeout: 60_000 }, () => {
  it('has one area file per land cell, in its region folder', () => {
    let total = 0;
    for (const [r, region] of REGIONS.entries()) {
      const cells = grid.landIds.filter((id) => grid.cells[id]!.region === r).sort((a, b) => a - b);
      const files = readdirSync(new URL(`${region}/`, DIR)).filter((f) => f.endsWith('.bin')).map((f) => Number(f.slice(0, -4))).sort((a, b) => a - b);
      expect(files, region).toEqual(cells);
      const index = JSON.parse(readFileSync(new URL(`${region}/index.json`, DIR), 'utf8')) as { cells: Record<string, unknown> };
      expect(Object.keys(index.cells).map(Number).sort((a, b) => a - b), region).toEqual(cells);
      for (const c of files) total += statSync(new URL(`${region}/${c}.bin`, DIR)).size;
    }
    expect(total).toBeLessThan(120e6);
  });

  it('reads the land use of every cell and keeps rail tunnels underground', () => {
    for (const region of REGIONS) {
      let tunnels = 0;
      for (const f of readdirSync(new URL(`${region}/`, DIR)).filter((n) => n.endsWith('.bin'))) {
        const a = decodeRealArea(gunzipSync(readFileSync(new URL(`${region}/${f}`, DIR))));
        let land = 0;
        let bad = 0;
        for (const c of a.landuse) {
          if (c === LU.sea) continue;
          land++;
          if (c === LU.none || c === LU.beach) bad++;
        }
        if (land > 100) expect(bad / land, `${region} ${f}`).toBeLessThan(0.3);
        for (const l of a.lines) if ((l.kind === LINE.rail || l.kind === LINE.shinkansen) && l.flags & LINE_TUNNEL) tunnels++;
      }
      expect(tunnels, region).toBeGreaterThan(20);
    }
  });
});
