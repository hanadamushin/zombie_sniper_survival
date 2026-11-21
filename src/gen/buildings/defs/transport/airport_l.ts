// 大空港 (07d-2e): only part of its runway lies on the site (it runs off both ends), a wide taxiway,
// a long apron, two terminals with boarding bridges (搭乗橋) from their first floors and a big jet
// parked at most of them, the control tower between the terminals (cab about 37 m up), and the car
// parks in front.

import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { apronClutter, controlTower, jetway, landside, runway, taxiway, terminal } from './airport_parts.ts';
import { pave, plane } from './common.ts';

export const TRANSPORT_AIRPORT_L: BuildingDef = {
  id: 'transport.airport_l',
  category: 'transport',
  variant: 'airport_l',
  kind: 'warehouse',
  size: { w: [780, 850], d: [250, 280] },
  storeys: 2,
  storeyHeight: 4.5,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 38,
  lootable: true,
  // Two terminals (each within the usual budget), a tower and six airliners on one site.
  limits: { shell: 6000, interior: 6000 },
  generate(rng, params) {
    return twoPass(TRANSPORT_AIRPORT_L, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = k.rand();
  runway(k, 0, w, 30, 60, false);
  taxiway(k, 0, w, 85, 23);
  const tz0 = d - 52;
  const tw = 170 + (w - 780) * 0.2;
  const gap = 70;
  const x0 = (w - 2 * tw - gap) / 2;
  pave(k, x0 - 30, 97, x0 + 2 * tw + gap + 30, tz0);
  for (const [i, tx] of [x0, x0 + tw + gap].entries()) {
    const jets = [tx + tw * 0.2, tx + tw * 0.5, tx + tw * 0.8];
    terminal(k, f, { rect: [tx, tz0, tx + tw, d - 24], centre: 24, tint, jetways: jets, big: true });
    for (const jx of jets) {
      const len = 16;
      jetway(k, f, jx, tz0, len, tint);
      if (k.rand() < 0.75) {
        const pl = 54 + k.rand() * 14;
        const r = Math.max(1.2, pl * 0.055);
        plane(k, jx + r + 2.5, tz0 - len - 1 - pl / 2, pl, 'z+', k.rand(), { engines: k.rand() < 0.3 ? 4 : 2 });
      }
    }
    apronClutter(k, tx + 10 + i * 20, 104);
    landside(k, tx - 10, tx + tw + 10, d - 24, d);
  }
  controlTower(k, f, [x0 + tw + gap / 2 - 5, tz0 + 4, x0 + tw + gap / 2 + 5, tz0 + 14], 9, tint);
}
