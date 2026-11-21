// 小空港 (07d-2e): a short runway along the back of the site (both ends on it), a taxiway, a small
// apron with a turboprop or two and the service vehicles, one two-storey terminal (check-in, baggage
// claim, the gate lounge, a shop and a café; upstairs the lounge and the restaurant; the roof deck
// one can climb onto), and the car park in front. No control tower: a windsock by the apron.

import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { apronClutter, landside, runway, taxiway, terminal, windsock } from './airport_parts.ts';
import { pave, plane } from './common.ts';

export const TRANSPORT_AIRPORT_S: BuildingDef = {
  id: 'transport.airport_s',
  category: 'transport',
  variant: 'airport_s',
  kind: 'warehouse',
  size: { w: [450, 560], d: [130, 150] },
  storeys: 2,
  storeyHeight: 4.5,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 4.2,
  lootable: true,
  generate(rng, params) {
    return twoPass(TRANSPORT_AIRPORT_S, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = k.rand();
  runway(k, 6, w - 6, 18, 30, true);
  taxiway(k, 40, w - 40, 42, 12);
  const tz0 = d - 42;
  const tw = 50 + (w - 450) * 0.08;
  const tx0 = w * k.range(0.4, 0.55) - tw / 2;
  // The apron (from the taxiway to the terminal) and a link to the taxiway.
  pave(k, tx0 - 40, 48, tx0 + tw + 40, tz0);
  terminal(k, f, { rect: [tx0, tz0, tx0 + tw, d - 20], centre: 16, tint });
  landside(k, tx0 - 30, tx0 + tw + 30, d - 20, d);
  const n = 1 + (k.rand() < 0.6 ? 1 : 0);
  for (let i = 0; i < n; i++) plane(k, tx0 + 8 + i * 30, (48 + tz0) / 2 - 2, 25, 'z+', k.rand(), { props: true });
  apronClutter(k, tx0 + tw - 14, tz0 - 8);
  windsock(k, tx0 + tw + 34, 52);
}
