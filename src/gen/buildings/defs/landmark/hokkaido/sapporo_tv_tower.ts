// R1: さっぽろテレビ塔 (Sapporo TV Tower, 1957) at the east end of Ōdōri Park. A steel lattice tower
// (147 m with the antenna; the observation deck at about 90 m): four legs from the corners of the
// lot lean in to the shaft under the deck, braced every few storeys; the big digital clock on the
// front; the antenna mast over the roof. The deck's roof is a firing position (obs_tower.ts).

import type { Kit } from '../../../kit.ts';
import type { BuildingDef } from '../../../types.ts';
import { twoPass, type Fit } from '../../office/common.ts';
import { obsTower } from './obs_tower.ts';

export const LANDMARK_SAPPORO_TV_TOWER: BuildingDef = {
  id: 'landmark.sapporo_tv_tower',
  category: 'landmark',
  variant: 'sapporo_tv_tower',
  kind: 'office',
  size: { w: [18, 20], d: [18, 20] },
  storeys: 20,
  storeyHeight: 4.5,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 52,
  lootable: true,
  generate(rng, params) {
    return twoPass(LANDMARK_SAPPORO_TV_TOWER, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = 0.55 + k.rand() * 0.1;
  const t = obsTower(k, f, { shaft: 10, mat: 'steel', tint, deckTint: 0.4 });
  const [sx0, sz0, sx1, sz1] = t.shaft;
  const top = k.levelY(k.storeys - 1) - 1.4;
  const leg = { layer: 'shell' as const, tint, solid: false };
  const a = 0.9;
  const segs = 8;
  // The four legs: from the lot's corners to the shaft's corners under the deck.
  const corners: [number, number, number, number][] = [[0, 0, sx0, sz0], [w - a, 0, sx1 - a, sz0], [0, d - a, sx0, sz1 - a], [w - a, d - a, sx1 - a, sz1 - a]];
  const at = (c: [number, number, number, number], u: number): [number, number] => [c[0] + (c[2] - c[0]) * u, c[1] + (c[3] - c[1]) * u];
  for (const c of corners) {
    for (let i = 0; i < segs; i++) {
      const [x, z] = at(c, (i + 0.5) / segs);
      k.box(-1, x, (top * i) / segs, z, x + a, (top * (i + 1)) / segs, z + a, 'steel', leg);
    }
  }
  // Bracing rings (the lattice's horizontal members) between the legs.
  for (const i of [2, 4, 6]) {
    const u = i / segs;
    const y = (top * i) / segs;
    const [x0, z0] = at(corners[0]!, u);
    const [x1, z1] = at(corners[3]!, u);
    k.box(-1, x0, y - 0.3, z0, x1 + a, y, z0 + 0.3, 'steel', leg);
    k.box(-1, x0, y - 0.3, z1 + a - 0.3, x1 + a, y, z1 + a, 'steel', leg);
    k.box(-1, x0, y - 0.3, z0, x0 + 0.3, y, z1 + a, 'steel', leg);
    k.box(-1, x1 + a - 0.3, y - 0.3, z0, x1 + a, y, z1 + a, 'steel', leg);
  }
  // The digital clock on the front of the shaft (about 60 m up the real tower).
  const yc = top * 0.62;
  k.box(-1, sx0 + 0.8, yc, sz1, sx1 - 0.8, yc + 4.5, sz1 + 0.3, 'sign', { layer: 'shell', tint: 0.1, solid: false });
  k.box(-1, sx0 + 1.4, yc + 1.2, sz1 + 0.3, sx1 - 1.4, yc + 3.3, sz1 + 0.4, 'sign', { layer: 'shell', tint: 0.9, solid: false });
  // The antenna mast on the stair house: three tapering lattice sections.
  const [cx0, cz0, cx1, cz1] = t.core;
  const mx = (cx0 + cx1) / 2;
  const mz = (cz0 + cz1) / 2;
  const mast = { layer: 'shell' as const, tint: 0.9 };
  let y = t.house;
  for (const [half, h] of [[1.0, 18], [0.6, 16], [0.25, 15]] as const) {
    k.box(-1, mx - half, y, mz - half, mx + half, y + h, mz + half, 'steel', mast);
    y += h;
  }
}
