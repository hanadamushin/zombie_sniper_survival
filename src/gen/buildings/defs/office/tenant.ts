// テナントビル (07d-2c): a four-storey block whose ground floor is a shop slot the full depth of the
// block. About half of them have the tenant convenience store of 07d-2b in it (shop.konbini_tenant,
// generated for the slot and put in with embedGround — its lobby's stair core stays locked); the
// rest have a shuttered shop nobody gets into. The upper floors are reached by the steel fire stair
// in the open strip on the right (a gate from the street, a landing and a door on every floor, and
// on up through the parapet onto the roof). Each upper floor: a corridor along the stair side and
// two tenants off it — offices, an English school, a hair salon, some locked.
//
//   +-----------------+----+
//   | back tenant  |c |stair    the stair strip is outside the block (open air, railings)
//   |              |o |    |
//   +--------------D r +-D-+    D: the landing door
//   | front tenant |r |land|
//   |              |  |    |
//   +==============+--+-[g]+    g: the gate; ground floor: the shop slot (konbini or shutter)

import { fork, rand, seedRng } from '../../../../core/rng.ts';
import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingBlueprint, BuildingDef, RoomUse } from '../../types.ts';
import { SHOP_KONBINI_TENANT } from '../shop/konbini_tenant.ts';
import { classroom, clinicRoom, embedGround, flightDepth, LANE, officeDesks, P, roofPlant, storeRoom, toppled, twoPass, type Fit } from './common.ts';

/** Width of the open stair strip on the right. */
const STRIP = 2.75;

export const OFFICE_TENANT: BuildingDef = {
  id: 'office.tenant',
  category: 'office',
  variant: 'tenant',
  kind: 'office',
  size: { w: [12.5, 14.75], d: [14, 19] },
  storeys: 4,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 2.6,
  lootable: true,
  generate(rng, params) {
    const konbini = rand(fork(rng, 'tenant-slot')) < 0.55;
    const ws = params.w - STRIP;
    const bp = twoPass(OFFICE_TENANT, rng, params, (k, f) => build(k, f, konbini));
    if (!konbini) return bp;
    return withKonbini(bp, ws, params.d, params.seed);
  },
};

/** The ground floor slot with the tenant convenience store in it. */
function withKonbini(bp: BuildingBlueprint, ws: number, d: number, seed: number): BuildingBlueprint {
  const sub = SHOP_KONBINI_TENANT.generate(seedRng(seed ^ 0x2c0ffee), { w: ws, d, seed: seed ^ 0x2c0ffee });
  return embedGround(bp, sub, 0, 0);
}

function build(k: Kit, f: Fit, konbini: boolean): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const ws = w - STRIP;
  const L = flightDepth(k.def.storeyHeight);
  const zs = 0.2 + L; // front of the stairwell (the flights climb towards the back)
  const zl = zs + 2.2; // front of the landings
  const xa = ws + 0.1 + LANE / 2; // first flight's lane
  const xc = ws - t - 1.4; // corridor | tenants (inside face of the corridor)
  const zm = d * 0.5;
  const zDoor = zs + 1.2;
  const top = k.storeys - 1;
  const opts = (exterior: boolean, y1: number) => ({ mat: 'concrete' as const, tint, exterior, layer: 'shell' as const, y1 });

  // ---- The shop slot (when it is not the konbini): a shuttered shop.
  if (!konbini) {
    k.wall(0, 0, d - t, ws, d, [k.door(ws / 2, 'shutter', Math.min(4.5, ws - 2.4)), k.door(ws - 0.9, 'locked')], opts(true, k.levelY(1)));
    k.wall(0, 0, 0, ws, t, [k.door(1.4, 'locked')], opts(true, k.levelY(1)));
    k.wall(0, 0, t, t, d - t, [], opts(true, k.levelY(1)));
    k.wall(0, ws - t, t, ws, d - t, [], opts(true, k.levelY(1)));
    k.floor(0, 'tileFloor', [t, t, ws - t, d - t]);
    k.room(0, t, t, ws - t, d - t, 'sales', { locked: true });
    // The shop's sign over the shutter.
    k.box(-1, 0.3, k.levelY(0) + 2.6, d, ws - 0.3, k.levelY(0) + 3.2, d + 0.12, 'sign', { layer: 'shell', tint: k.rand(), solid: false });
  }

  // ---- The stair strip: the gate, the foot of the stair, a landing and railings on every floor.
  k.floor(0, 'concrete', [ws, 0, w, d]);
  k.wall(0, ws, d - 0.2, w, d, [k.door(STRIP / 2)], { mat: 'concrete', tint, exterior: true, layer: 'shell', y1: k.levelY(0) + 1.0 });
  k.box(-1, w - 0.15, -0.3, zl, w, k.levelY(0) + 1.0, d - 0.2, 'concrete', { layer: 'shell', tint });
  const foot = k.room(0, ws + 0.1, zs, w - 0.15, d - 0.2, 'stairs');
  f.ensure(foot, 'crate', 'storage');
  for (let level = 0; level <= k.storeys; level++) {
    if (level < k.storeys) {
      k.stairs({ level, start: [xa, zs], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'steel', tint: 0.4 });
      // Seen from afar (the steps themselves are inside parts): a ramp per flight and the landing.
      const y0 = k.levelY(level);
      const half = k.def.storeyHeight / 2;
      const len = L - ARCH.stair.landing;
      const sh = { layer: 'shell' as const, solid: false, tint: 0.4 };
      k.part({ shape: 'wedge', x0: xa - LANE / 2, x1: xa + LANE / 2, z0: zs - len, z1: zs, y0, y1: y0 + half, slope: 'z-', mat: 'steel', ...sh });
      k.part({ shape: 'wedge', x0: xa + LANE / 2 + 0.15, x1: xa + 1.5 * LANE + 0.15, z0: zs - len, z1: zs, y0: y0 + half, y1: y0 + k.def.storeyHeight, slope: 'z+', mat: 'steel', ...sh });
      k.box(-1, xa - LANE / 2, y0 + half - 0.3, zs - L, xa + 1.5 * LANE + 0.15, y0 + half, zs - len, 'steel', sh);
    }
    if (level === 0) continue;
    const y = k.levelY(level);
    k.floor(level, 'steel', [ws, 0, w, zl], { thick: 0.15 });
    k.box(-1, w - 0.06, y, 0, w, y + 1.1, zl, 'steel', { layer: 'shell', tint: 0.4 });
    k.box(-1, ws, y, zl - 0.06, w - 0.06, y + 1.1, zl, 'steel', { layer: 'shell', tint: 0.4 });
    k.box(-1, ws, y, 0, w - 0.06, y + 1.1, 0.06, 'steel', { layer: 'shell', tint: 0.4 });
    k.room(level, ws + 0.1, zs, w - 0.1, zl - 0.06, 'stairs');
  }

  // ---- The upper floors.
  for (let level = 1; level < k.storeys; level++) {
    const yTop = level === top ? k.eaves : k.levelY(level + 1);
    k.wall(level, 0, d - t, ws, d, k.evenly(0.8, ws - 0.8, 3).map((x) => k.window(x, 1.8, { broken: k.rand() < 0.2 })), opts(true, yTop));
    k.wall(level, 0, 0, ws, t, [k.window(1.6, 1.2), k.window(ws - 2.2, 1.2)], opts(true, yTop));
    k.wall(level, 0, t, t, d - t, [k.window(zm / 2 - t, 1.4), k.window((zm + d) / 2 - t, 1.4)], opts(true, yTop));
    k.wall(level, ws - t, t, ws, d - t, [k.door(zDoor - t)], opts(false, yTop));
    k.floor(level, 'vinyl', [t, t, ws - t, d - t]);
    const hall = k.room(level, xc + P, t, ws - t, d - t, 'hall');
    const lockB = level > 1 && k.rand() < 0.35;
    const lockF = k.rand() < 0.3;
    const uses: RoomUse[] = [k.pick(['office', 'classroom', 'clinic', 'storage'] as const), k.pick(['office', 'classroom', 'office'] as const)];
    k.partition(level, xc, t, xc, d - t, [k.door((t + zm) / 2 - t, lockB ? 'locked' : 'open'), k.door((zm + d - t) / 2 - t, lockF ? 'locked' : 'open')]);
    k.partition(level, t, zm, xc - P, zm);
    const back = k.room(level, t, t, xc - P, zm - P, uses[0]!, { locked: lockB });
    const front = k.room(level, t, zm + P, xc - P, d - t, uses[1]!, { locked: lockF });
    for (const [room, use, locked, board] of [[back, uses[0]!, lockB, 'z-'], [front, uses[1]!, lockF, 'z+']] as const) {
      if (locked) continue;
      if (use === 'office') officeDesks(f, room);
      else if (use === 'classroom') classroom(f, room, board);
      else if (use === 'clinic') clinicRoom(f, room);
      else storeRoom(f, room);
      f.ensure(room, 'cabinet', use);
      if (f.chance(0.3)) toppled(f, room);
    }
    if (f.chance(0.4)) f.stain(hall);
  }

  // ---- The roof: the slab, the parapet (with the gate to the landing), the tank.
  const R = k.storeys;
  const e = k.eaves;
  const ph = ARCH.rail.parapet;
  k.floor(R, 'concrete', [t, t, ws - t, d - t]);
  k.box(-1, 0, e, d - t, ws, e + ph, d, 'concrete', { layer: 'shell', tint });
  k.box(-1, 0, e, 0, ws, e + ph, t, 'concrete', { layer: 'shell', tint });
  k.box(-1, 0, e, t, t, e + ph, d - t, 'concrete', { layer: 'shell', tint });
  k.wall(R, ws - t, t, ws, d - t, [k.door(zDoor - t)], { mat: 'concrete', tint, y0: e, y1: e + ph, layer: 'shell' });
  const roof = k.room(R, t, t, ws - t, d - t, 'roof');
  roofPlant(f, [roof], { units: 2 });
  f.ensure(roof, 'crate', 'roof');
  // The building's name on the front, over the slot.
  k.box(-1, 0.4, k.levelY(1) + 0.2, d, ws - 0.4, k.levelY(1) + 0.7, d + 0.08, 'sign', { layer: 'shell', tint: 0.95, solid: false });
}
