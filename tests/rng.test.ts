import { describe, expect, it } from 'vitest';
import { fork, gauss, nextU32, pick, rand, randInt, seedRng, stream } from '../src/core/rng.ts';
import { createInitialState } from '../src/core/types.ts';

const take = (seed: number, n: number): number[] => {
  const r = seedRng(seed);
  return Array.from({ length: n }, () => nextU32(r));
};

describe('rng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(take(42, 50)).toEqual(take(42, 50));
    expect(take(42, 50)).not.toEqual(take(43, 50));
  });

  it('matches the pinned sequence (guards against accidental algorithm changes)', () => {
    expect(take(1, 4)).toMatchInlineSnapshot(`
      [
        2442144158,
        3238099751,
        3819917871,
        2104621829,
      ]
    `);
  });

  it('resumes exactly from a JSON round-trip of its state', () => {
    const a = seedRng(7);
    for (let i = 0; i < 100; i++) rand(a);
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(Array.from({ length: 20 }, () => rand(a))).toEqual(Array.from({ length: 20 }, () => rand(b)));
  });

  it('rand is in [0,1) and roughly uniform', () => {
    const r = seedRng(123);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const v = rand(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });

  it('randInt covers the inclusive range', () => {
    const r = seedRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(randInt(r, 3, 8));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('pick returns elements and rejects empty arrays', () => {
    const r = seedRng(9);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(items).toContain(pick(r, items));
    expect(() => pick(r, [])).toThrow();
  });

  it('gauss has the requested mean and deviation', () => {
    const r = seedRng(11);
    const n = 20000;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const v = gauss(r, 10, 2);
      sum += v;
      sq += (v - 10) ** 2;
    }
    expect(sum / n).toBeCloseTo(10, 1);
    expect(Math.sqrt(sq / n)).toBeCloseTo(2, 1);
  });

  it('fork is label-dependent, repeatable and does not advance the parent', () => {
    const parent = seedRng(77);
    const before = JSON.stringify(parent);
    const a1 = fork(parent, 'trees');
    const a2 = fork(parent, 'trees');
    const b = fork(parent, 'roads');
    expect(JSON.stringify(parent)).toBe(before);
    expect(a1).toEqual(a2);
    expect(nextU32(a1)).not.toBe(nextU32(b));
  });

  it('stream() persists per-label streams in the state, independent of each other', () => {
    const s1 = createInitialState(1, 1);
    const s2 = createInitialState(1, 1);
    const a = [rand(stream(s1, 'colony')), rand(stream(s1, 'colony'))];
    rand(stream(s2, 'tactical')); // unrelated draws must not shift 'colony'
    const b = [rand(stream(s2, 'colony')), rand(stream(s2, 'colony'))];
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(a[1]);
    expect(Object.keys(s2.rngStreams).sort()).toEqual(['colony', 'tactical']);
  });
});
