// 中空港 (07d-2e): a runway along the back of the site, a parallel taxiway, an apron with two or three
// regional jets and the service vehicles, a two-storey terminal, the control tower beside it (the
// glazed cab on its top storey — a sniper's perch about 25 m up) and a hangar with a light aircraft
// behind its shutter. The car park in front.

import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { apronClutter, controlTower, hangar, landside, runway, taxiway, terminal, windsock } from './airport_parts.ts';
import { pave, plane } from './common.ts';

export const TRANSPORT_AIRPORT_M: BuildingDef = {
  id: 'transport.airport_m',
  category: 'transport',
  variant: 'airport_m',
  kind: 'warehouse',
  size: { w: [600, 700], d: [190, 220] },
  storeys: 2,
  storeyHeight: 4.5,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 25,
  lootable: true,
  generate(rng, params) {
    return twoPass(TRANSPORT_AIRPORT_M, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = k.rand();
  runway(k, 6, w - 6, 26, 45, true);
  taxiway(k, 30, w - 30, 70, 20);
  const tz0 = d - 50;
  const tw = 100 + (w - 600) * 0.15;
  const tx0 = w * k.range(0.35, 0.45) - tw / 2;
  pave(k, tx0 - 60, 80, tx0 + tw + 80, tz0);
  terminal(k, f, { rect: [tx0, tz0, tx0 + tw, d - 22], centre: 20, tint });
  landside(k, tx0 - 40, tx0 + tw + 40, d - 22, d);
  // The tower to the left of the terminal, the hangar to the right.
  controlTower(k, f, [tx0 - 28, tz0 + 2, tx0 - 19, tz0 + 11], 6, tint);
  hangar(k, f, [tx0 + tw + 30, 84, tx0 + tw + 90, 129], k.rand());
  const n = 2 + (k.rand() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) plane(k, tx0 + 18 + i * 36, tz0 - 22, 32, 'z+', k.rand());
  apronClutter(k, tx0 + 4, tz0 - 46);
  windsock(k, tx0 - 50, 84);
}
