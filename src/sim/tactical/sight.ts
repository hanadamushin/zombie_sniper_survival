// How open an operation area is to someone on foot (07b): the share of pairs of standing
// viewpoints a given distance apart that can see each other. Used by the tests and
// tools/sight-stats.ts to keep "the far view belongs to the high ground" measurable.

import { rand, seedRng } from '../../core/rng.ts';
import { TACTICAL } from '../../data/tactical.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { heightAt, isWalkable, sightBlocked, type Vec3 } from './collision.ts';

export function openSightShare(
  map: TacticalMap, dist: number, pairs: number, seed: number,
  blocked: (map: TacticalMap, a: Readonly<Vec3>, b: Readonly<Vec3>) => boolean = sightBlocked,
): number {
  const eye = TACTICAL.player.eyeHeight.stand;
  const rng = seedRng(seed);
  const ok = (x: number, z: number): boolean => x > 8 && z > 8 && x < map.size - 8 && z < map.size - 8 && isWalkable(map, Math.floor(x / map.tile), Math.floor(z / map.tile));
  let open = 0;
  let done = 0;
  for (let guard = 0; done < pairs && guard < pairs * 50; guard++) {
    const ax = 8 + rand(rng) * (map.size - 16);
    const az = 8 + rand(rng) * (map.size - 16);
    const angle = rand(rng) * Math.PI * 2;
    const bx = ax + Math.cos(angle) * dist;
    const bz = az + Math.sin(angle) * dist;
    if (!ok(ax, az) || !ok(bx, bz)) continue;
    done++;
    if (!blocked(map, [ax, heightAt(map, ax, az) + eye, az], [bx, heightAt(map, bx, bz) + eye, bz])) open++;
  }
  return open / Math.max(1, done);
}
