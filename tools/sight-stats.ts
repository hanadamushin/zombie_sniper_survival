// Share of ground-level sight lines that stay open, per land class (07b):
//   node tools/sight-stats.ts [distance=200]
// Prints the mean over 12 maps (6 seeds x home / not home) and generation time. The same
// measurement is asserted in tests/sight.test.ts.

import type { Land } from '../src/core/types.ts';
import { generateTacticalMap } from '../src/gen/index.ts';
import { openSightShare } from '../src/sim/tactical/sight.ts';

const dist = Number(process.argv[2] ?? 200);
for (const land of ['urban', 'suburb', 'rural', 'forest', 'mountain'] as Land[]) {
  const shares: number[] = [];
  let ms = 0;
  let brush = 0;
  let trees = 0;
  for (const seed of [11, 22, 33, 44, 55, 66]) {
    for (const isHome of [false, true]) {
      const t0 = performance.now();
      const map = generateTacticalMap({ mapSeed: seed * 7919, land, isHome, lootSpots: 4 });
      ms += performance.now() - t0;
      brush += map.brush.length;
      trees += map.trees.n;
      shares.push(openSightShare(map, dist, 400, seed));
    }
  }
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
  console.log(`${land.padEnd(9)} open ${(mean * 100).toFixed(1)}%  [${shares.map((s) => Math.round(s * 100)).join(' ')}]  gen ${(ms / shares.length).toFixed(0)} ms  brush ${Math.round(brush / shares.length)}  trees ${Math.round(trees / shares.length)}`);
}
