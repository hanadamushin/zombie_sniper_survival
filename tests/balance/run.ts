// `npm run balance` — play the scenario matrix headlessly and write the results.
//
//   node tests/balance/run.ts [suite ...] [--days 150] [--seeds 1,2,3,5,7,12] [--out tmp/balance]
//
// Suites (default: all of them):
//   bots       4 bots x seeds x 3 difficulties                         (the targets of prompt 09 B)
//   ammo       careful / average / sloppy shots with the solid policy  (do the rounds last?)
//   branches   the solid bot with each exclusive branch the other way   (days to the declaration)
//   land       the solid bot from a quiet, a busy and a suburban start  (income and damage)
// Per game a CSV with one row per day goes to <out>/<suite>/<name>.csv; the summary of every game
// to <out>/summary.json and, as tables, to <out>/summary.md. Games run in parallel worker processes.
// Exit code 1 when an invariant was broken or a saved-and-loaded game came out differently.

import { fork } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deserialize, serialize } from '../../src/core/save.ts';
import { cellDistance, cellsWithin } from '../../src/sim/world/grid.ts';
import { attach, BRANCH_A, play, SKILLS, type BranchId, type Game, type Milestones, type Policy, type Skill } from './bot.ts';
import { checkInvariants, newGame, POLICIES, startCandidates } from './harness.ts';

export interface Job {
  suite: string;
  name: string;
  bot: string;
  seed: number;
  difficulty: 0 | 1 | 2;
  days: number;
  start?: number;
  /** 'suburb': the nearest suburban cell to start candidate 0. */
  land?: 'suburb';
  skill?: keyof typeof SKILLS;
  flip?: BranchId;
  /** Save, load and continue on this day, and compare with the game played in one go. */
  reloadDay?: number;
}

export interface Result {
  job: Job;
  m: Milestones;
  end: Record<string, number | string>;
  /** Totals over the game. */
  rifleEars: number;
  income: number;
  kills: number;
  shots: number;
  peakPop: number;
  /** Ear income of days 1-10, 11-20, 21-30 (the rifle's share in brackets is rifleEars). */
  income10: number[];
  startZ: number;
  startLand: string;
  invariants: string[];
  reloadSame: boolean | null;
  ms: number;
  saveBytes: number;
  saveMs: number;
}

function policyOf(job: Job): Policy {
  let p: Policy = POLICIES[job.bot]!;
  if (job.skill) p = { ...p, skill: SKILLS[job.skill] as Skill };
  if (job.flip) p = { ...p, branch: { ...BRANCH_A, [job.flip]: 'b' } };
  return p;
}

function begin(job: Job): Game {
  const policy = policyOf(job);
  if (job.land === 'suburb') {
    const { state, grid, candidates } = startCandidates(job.seed, job.difficulty);
    const from = candidates[0]!.cell;
    // The suburban cell nearest to the quiet candidate (ties: the lower id), whatever its danger.
    const cell = cellsWithin(grid, from, 8).filter((c) => grid.cells[c]!.land === 'suburb' && (state.world.cells.Z[c] ?? 0) > 0).sort((a, b) => cellDistance(grid, from, a) - cellDistance(grid, from, b) || a - b)[0];
    return newGame(policy, { seed: job.seed, difficulty: job.difficulty, cell: cell ?? from });
  }
  return newGame(policy, { seed: job.seed, difficulty: job.difficulty, start: job.start ?? 0 });
}

export function runJob(job: Job, outDir: string | null): Result {
  const t0 = performance.now();
  const invariants: string[] = [];
  let g = begin(job);
  const startZ = Math.round(g.state.world.cells.Z[g.state.world.homeCell!] ?? 0);
  const startLand = g.grid.cells[g.state.world.homeCell!]!.land;
  const onDay = (game: Game): void => {
    const bad = checkInvariants(game.state, game.rows.length % 10 === 0);
    if (bad.length > 0 && invariants.length < 5) invariants.push(`day ${game.rows.length}: ${bad[0]}`);
  };
  let reloadSame: boolean | null = null;
  if (job.reloadDay !== undefined) {
    // The same game twice: once in one go, once through a save on `reloadDay`.
    const straight = begin(job);
    play(straight, job.days * 1440);
    play(g, job.reloadDay * 1440, onDay);
    const loaded = attach(deserialize(serialize(g.state)), g.grid, g.policy);
    loaded.rows = g.rows;
    loaded.m = g.m;
    loaded.today = g.today;
    g = loaded;
    play(g, (job.days - job.reloadDay) * 1440, onDay);
    reloadSame = serialize(g.state) === serialize(straight.state);
  } else play(g, job.days * 1440, onDay);
  const s0 = performance.now();
  const json = serialize(g.state);
  const saveMs = performance.now() - s0;
  const sum = (key: string, from = 0, to = Infinity): number => g.rows.reduce((s, r) => s + (Number(r.day) > from && Number(r.day) <= to ? Number(r[key]) : 0), 0);
  if (outDir) {
    const file = join(outDir, job.suite, `${job.name}.csv`);
    mkdirSync(dirname(file), { recursive: true });
    const cols = Object.keys(g.rows[0] ?? { day: 0 });
    writeFileSync(file, [cols.join(','), ...g.rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n') + '\n');
  }
  return {
    job, m: g.m, end: g.rows[g.rows.length - 1] ?? {},
    rifleEars: sum('rifleEars'), income: sum('income'), kills: sum('kills'), shots: sum('shots'),
    peakPop: Math.max(0, ...g.rows.map((r) => Number(r.pop))),
    income10: [sum('income', 0, 10), sum('income', 10, 20), sum('income', 20, 30), sum('income', 30, 40)],
    startZ, startLand, invariants, reloadSame, ms: Math.round(performance.now() - t0), saveBytes: json.length, saveMs: Math.round(saveMs * 10) / 10,
  };
}

// ---------------------------------------------------------------------------------------------

const DIFF = ['低', '標準', '高'];

function jobsFor(suites: string[], seeds: number[], days: number): Job[] {
  const jobs: Job[] = [];
  const want = (s: string): boolean => suites.length === 0 || suites.includes(s);
  if (want('bots')) {
    for (const bot of ['solid', 'expand', 'idle', 'sniper']) {
      for (const seed of seeds) {
        for (const difficulty of [0, 1, 2] as const) {
          jobs.push({ suite: 'bots', name: `${bot}_s${seed}_d${difficulty}`, bot, seed, difficulty, days, reloadDay: bot === 'solid' && difficulty === 1 && seed === seeds[0] ? 40 : undefined });
        }
      }
    }
  }
  if (want('ammo')) {
    for (const skill of ['careful', 'average', 'sloppy'] as const) for (const seed of seeds) jobs.push({ suite: 'ammo', name: `${skill}_s${seed}`, bot: 'solid', skill, seed, difficulty: 1, days: Math.min(days, 30) });
  }
  if (want('branches')) {
    for (const flip of [undefined, 'F4', 'F7', 'W5', 'W6', 'A4', 'A6', 'S5', 'C4', 'C6'] as const) {
      for (const seed of seeds.slice(0, 3)) jobs.push({ suite: 'branches', name: `${flip ?? 'base'}_s${seed}`, bot: 'solid', flip, seed, difficulty: 1, days: Math.max(days, 180) });
    }
  }
  if (want('land')) {
    for (const seed of seeds) {
      jobs.push({ suite: 'land', name: `quiet_s${seed}`, bot: 'solid', seed, difficulty: 1, days: Math.min(days, 40), start: 0 });
      jobs.push({ suite: 'land', name: `busy_s${seed}`, bot: 'solid', seed, difficulty: 1, days: Math.min(days, 40), start: 2 });
      jobs.push({ suite: 'land', name: `suburb_s${seed}`, bot: 'solid', seed, difficulty: 1, days: Math.min(days, 40), land: 'suburb' });
    }
  }
  return jobs;
}

const median = (xs: number[]): number | null => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)]! : null;
};
const fmt = (x: number | null): string => (x === null ? '—' : String(Math.round(x * 10) / 10));
const nn = (xs: (number | null)[]): number[] => xs.filter((x): x is number => x !== null);

function summarise(results: Result[], days: number): string {
  const out: string[] = [];
  const by = <K extends string>(rs: Result[], key: (r: Result) => K): Map<K, Result[]> => {
    const m = new Map<K, Result[]>();
    for (const r of rs) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  const bots = results.filter((r) => r.job.suite === 'bots');
  if (bots.length) {
    out.push(`### ボット × 難易度（${days} 日、シードごとの中央値。「到達」は到達した回数 / 回数）`, '',
      '| ボット | 難易度 | 最初の雇用 | 司令部が初めて叩かれた日 | 最初の被害（壁・人） | 定住期 | 再建期 | 復興期 | 建国 | 建国到達 | 崩壊 | 崩壊日 | 最大人口 | 死者 | 離反 | 壁の損失 | 弾切れの日数 | プレイヤー死亡 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [key, rs] of by(bots, (r) => `${r.job.bot}|${r.job.difficulty}`)) {
      const [bot, d] = key.split('|');
      const med = (f: (r: Result) => number | null): string => fmt(median(nn(rs.map(f))));
      out.push(`| ${bot} | ${DIFF[Number(d)]} | ${med((r) => r.m.firstHire)} | ${med((r) => r.m.firstHqHit)} | ${med((r) => r.m.firstLoss)} | ${med((r) => r.m.era[1]!)} | ${med((r) => r.m.era[2]!)} | ${med((r) => r.m.era[3]!)} | ${med((r) => r.m.victory)} | ${rs.filter((r) => r.m.victory !== null).length}/${rs.length} | ${rs.filter((r) => r.m.defeat !== null).length}/${rs.length} | ${med((r) => r.m.defeat)} | ${med((r) => r.peakPop)} | ${med((r) => r.m.dead)} | ${med((r) => r.m.deserted)} | ${med((r) => r.m.wallsLost)} | ${med((r) => r.m.dryDays)} | ${med((r) => r.m.playerDeaths)} |`);
    }
    out.push('', '#### 耳の収支（標準難易度、10 日ごとの収入の中央値。括弧は期間末の備蓄）', '', '| ボット | 1〜10 日 | 11〜20 日 | 21〜30 日 | 31〜40 日 | 150 日目の備蓄（耳 / 弾 / 食料） |', '|---|---|---|---|---|---|');
    for (const [bot, rs] of by(bots.filter((r) => r.job.difficulty === 1), (r) => r.job.bot)) {
      out.push(`| ${bot} | ${[0, 1, 2, 3].map((i) => fmt(median(rs.map((r) => r.income10[i]!)))).join(' | ')} | ${fmt(median(rs.map((r) => Number(r.end.ears))))} / ${fmt(median(rs.map((r) => Number(r.end.ammo))))} / ${fmt(median(rs.map((r) => Number(r.end.food))))} |`);
    }
    out.push('');
  }
  const ammo = results.filter((r) => r.job.suite === 'ammo');
  if (ammo.length) {
    out.push('### 弾薬（堅実型の方針、標準、30 日。腕前だけを変える）', '', '| 腕前 | 命中 / 頭 | 最初に弾が尽きた日（中央値） | 5 日目までに尽きた割合 | 30 日のうち弾切れの日数 | 1 体あたりの弾 | 崩壊 |', '|---|---|---|---|---|---|---|');
    for (const [skill, rs] of by(ammo, (r) => r.job.skill!)) {
      const k = SKILLS[skill as keyof typeof SKILLS];
      out.push(`| ${skill} | ${k.hit} / ${k.head} | ${fmt(median(nn(rs.map((r) => r.m.firstDry))))} | ${rs.filter((r) => r.m.firstDry !== null && r.m.firstDry <= 5).length}/${rs.length} | ${fmt(median(rs.map((r) => r.m.dryDays)))} | ${fmt(median(rs.map((r) => r.shots / Math.max(1, r.kills))))} | ${rs.filter((r) => r.m.defeat !== null).length}/${rs.length} |`);
    }
    out.push('');
  }
  const branches = results.filter((r) => r.job.suite === 'branches');
  if (branches.length) {
    const base = median(nn(branches.filter((r) => !r.job.flip).map((r) => r.m.victory)));
    out.push('### 排他分岐（堅実型・標準。基準は全部 a 側、1 つだけ b 側に替える）', '', '| 分岐 | 建国の日（中央値） | 基準との差 | 到達 | 復興期 | 死者 | 壁の損失 |', '|---|---|---|---|---|---|---|');
    for (const [flip, rs] of by(branches, (r) => r.job.flip ?? '基準（すべて a）')) {
      const v = median(nn(rs.map((r) => r.m.victory)));
      out.push(`| ${flip}${rs[0]!.job.flip ? 'b' : ''} | ${fmt(v)} | ${v !== null && base ? `${v >= base ? '+' : ''}${Math.round(((v - base) / base) * 100)}%` : '—'} | ${rs.filter((r) => r.m.victory !== null).length}/${rs.length} | ${fmt(median(nn(rs.map((r) => r.m.era[3]!))))} | ${fmt(median(rs.map((r) => r.m.dead)))} | ${fmt(median(rs.map((r) => r.m.wallsLost)))} |`);
    }
    out.push('');
  }
  const land = results.filter((r) => r.job.suite === 'land');
  if (land.length) {
    out.push('### 本拠の場所（堅実型・標準、40 日）', '', '| 場所 | 開始時の Z（中央値） | 30 日の耳の収入 | 襲来の流入（40 日の合計） | 大群の回数 | 壁の損失 | 死者 | 崩壊 | 10 日もった |', '|---|---|---|---|---|---|---|---|---|');
    for (const [kind, rs] of by(land, (r) => r.job.name.split('_')[0]!)) {
      out.push(`| ${kind} | ${fmt(median(rs.map((r) => r.startZ)))} | ${fmt(median(rs.map((r) => r.income10[0]! + r.income10[1]! + r.income10[2]!)))} | ${fmt(median(rs.map((r) => r.m.inflow)))} | ${fmt(median(rs.map((r) => r.m.hordes)))} | ${fmt(median(rs.map((r) => r.m.wallsLost)))} | ${fmt(median(rs.map((r) => r.m.dead)))} | ${rs.filter((r) => r.m.defeat !== null).length}/${rs.length} | ${rs.filter((r) => r.m.defeat === null || r.m.defeat >= 10).length}/${rs.length} |`);
    }
    out.push('');
  }
  const bad = results.filter((r) => r.invariants.length > 0);
  const reload = results.filter((r) => r.reloadSame !== null);
  out.push('### 不変条件', '', `- ${results.length} ゲーム、毎日検査（資源が負・容量超過にならない、人の所在の整合、10 日ごとに状態全体の NaN / undefined 走査）: 違反 ${bad.length} ゲーム`,
    ...bad.slice(0, 10).map((r) => `  - ${r.job.suite}/${r.job.name}: ${r.invariants[0]}`),
    `- 保存 → 読込で続けても同じ結果: ${reload.filter((r) => r.reloadSame).length}/${reload.length}`,
    `- セーブ（${days} 日目、世界セル込み）: ${fmt(median(results.map((r) => r.saveBytes / 1024)))} KB（最大 ${fmt(Math.max(...results.map((r) => r.saveBytes / 1024)))} KB）、直列化 ${fmt(median(results.map((r) => r.saveMs)))} ms`, '');
  return out.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (name: string, def: string): string => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args.splice(i, 2)[1]! : def;
  };
  const days = Number(opt('days', '150'));
  // --summarise: print the tables of the last run again without playing.
  if (args.includes('--summarise')) {
    console.log(summarise(JSON.parse(readFileSync(join(opt('out', 'tmp/balance'), 'summary.json'), 'utf8')) as Result[], days));
    return;
  }
  const seeds = opt('seeds', '1,2,3,5,7,12').split(',').map(Number);
  const outDir = opt('out', 'tmp/balance');
  const jobs = jobsFor(args, seeds, days);
  const results: Result[] = [];
  const t0 = performance.now();
  const workers = Math.max(1, Math.min(cpus().length, jobs.length));
  let next = 0;
  await Promise.all(Array.from({ length: workers }, () => new Promise<void>((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--worker', outDir]);
    const feed = (): void => {
      if (next >= jobs.length) {
        child.kill();
        resolve();
      } else child.send(jobs[next++]!);
    };
    child.on('message', (r: Result) => {
      results.push(r);
      process.stderr.write(`\r${results.length}/${jobs.length} `);
      feed();
    });
    child.on('error', reject);
    feed();
  })));
  results.sort((a, b) => jobs.findIndex((j) => j.name === a.job.name && j.suite === a.job.suite) - jobs.findIndex((j) => j.name === b.job.name && j.suite === b.job.suite));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(results, null, 1));
  const md = summarise(results, days);
  writeFileSync(join(outDir, 'summary.md'), md);
  console.log(`\n${md}\n${jobs.length} games in ${Math.round((performance.now() - t0) / 1000)} s -> ${outDir}`);
  if (results.some((r) => r.invariants.length > 0 || r.reloadSame === false)) process.exitCode = 1;
}

if (process.argv[2] === '--worker') {
  const outDir = process.argv[3]!;
  process.on('message', (job: Job) => process.send!(runJob(job, outDir)));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
