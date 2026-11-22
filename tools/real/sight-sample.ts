// Share of ground-level sight lines that stay open 200 m out (07b's measure, as tools/real/check.ts
// takes it), per land class over a fixed sample of real cells — for a before / after of a change:
//   node tools/real/sight-sample.ts [--root <checkout>] [--per 30]
// The sample: every n-th land cell of each class (the same cells for any checkout).
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const root = (arg('--root') ?? new URL('../..', import.meta.url).pathname).replace(/\/?$/, '/');
const per = Number(arg('--per') ?? 30);

const { mapFor } = await import(`${root}tools/real/check.ts`);
const { loadGrid, loadRealIndexes } = await import(`${root}tools/real/lib/game.ts`);
const { openSightShare } = await import(`${root}src/sim/tactical/sight.ts`);

const grid = loadGrid();
loadRealIndexes(grid);
for (const land of ['urban', 'suburb', 'rural', 'forest', 'mountain']) {
  const cells: number[] = grid.landIds.filter((id: number) => grid.cells[id]?.land === land && grid.cells[id]?.real?.area);
  const step = Math.max(1, Math.floor(cells.length / per));
  const shares: number[] = [];
  for (let k = 0; k < cells.length && shares.length < per; k += step) {
    const cell = cells[k]!;
    shares.push(openSightShare(mapFor(grid, cell), 200, 300, cell));
  }
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
  console.log(`${land.padEnd(9)} ${shares.length} cells: open ${(mean * 100).toFixed(1)}%  [${shares.map((s) => Math.round(s * 100)).join(' ')}]`);
}
