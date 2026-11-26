// A short playthrough of every bot inside `npm run check`: the invariants hold day by day, and a game
// saved and loaded half-way comes out exactly like one played in one go. The full matrix (150 days,
// several seeds, three difficulties) is `npm run balance`.
import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../../src/core/save.ts';
import { attach, play, type Game } from './bot.ts';
import { checkInvariants, newGame, POLICIES } from './harness.ts';
import { runJob } from './run.ts';

describe('balance bots', () => {
  for (const bot of ['solid', 'expand', 'idle', 'sniper']) {
    it(`${bot}: 14 days without breaking an invariant`, () => {
      const g = newGame(POLICIES[bot]!, { seed: 12, difficulty: 1 });
      const bad: string[] = [];
      play(g, 14 * 1440, (game: Game) => bad.push(...checkInvariants(game.state, true).map((b) => `day ${game.rows.length}: ${b}`)));
      expect(bad).toEqual([]);
      expect(g.rows.length).toBeGreaterThanOrEqual(g.m.defeat === null ? 14 : 1);
      expect(g.m.firstHire).not.toBeNull();
    });
  }

  it('a game saved, loaded and continued is the same game', () => {
    const straight = newGame(POLICIES.solid!, { seed: 3, difficulty: 1 });
    play(straight, 12 * 1440);
    let g = newGame(POLICIES.solid!, { seed: 3, difficulty: 1 });
    play(g, 5 * 1440 + 700);
    g = attach(deserialize(serialize(g.state)), g.grid, g.policy);
    play(g, 7 * 1440 - 700);
    expect(JSON.parse(serialize(g.state))).toEqual(JSON.parse(serialize(straight.state)));
  });

  it('the invariant check notices a negative stock, a NaN and a lost person', () => {
    const g = newGame(POLICIES.solid!, { seed: 12, difficulty: 1 });
    play(g, 3 * 1440);
    expect(checkInvariants(g.state)).toEqual([]);
    g.state.colony.stock.food = -1;
    g.state.world.hordeMeter = NaN;
    const s = g.state.colony.survivors[0]!;
    s.location = { kind: 'outpost', id: 999 };
    const bad = checkInvariants(g.state).join('; ');
    expect(bad).toContain('stock.food');
    expect(bad).toContain('lost outpost');
    expect(bad).toContain('hordeMeter');
  });

  it('the idle bot is overrun within thirty days on normal difficulty, the solid bot is not', () => {
    const idle = runJob({ suite: 't', name: 'idle', bot: 'idle', seed: 12, difficulty: 1, days: 32 }, null);
    expect(idle.m.defeat).not.toBeNull();
    expect(idle.m.defeat!).toBeLessThanOrEqual(30);
    const solid = runJob({ suite: 't', name: 'solid', bot: 'solid', seed: 12, difficulty: 1, days: 32 }, null);
    expect(solid.m.defeat).toBeNull();
    expect(solid.m.era[1]).not.toBeNull();
  });
});
