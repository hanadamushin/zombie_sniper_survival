// 陸上自衛隊の野営基地の残骸 (07d-2f): ten field camps put up early in the outbreak and abandoned.
// Each is a whole site (tents, sandbag positions, vehicles) in one blueprint; the size and the layout
// differ by type, the details (which tents came down, what burnt, tints, where things stand) by seed.
// Ammunition, medicine and fuel are found here (the 'field' table and the special shelves) — plenty,
// but a cell's loot does not come back.
//
//   camp_squad      小隊の野営地: three squad tents, a machine-gun pit, a jeep, a fire
//   camp_checkpoint 検問所: a road through barriers and a sandbag chicane, the guard hut, pits both
//                   sides, the queue of cars that never got through
//   camp_hospital   野戦病院: two ward tents, triage, the pharmacy tent, the ambulance, a red cross
//   camp_heliport   ヘリの着陸地点: two pads (one helicopter waiting, one burnt out), ops and fuel tents
//   camp_supply     補給所: the big store tent, containers, crates under nets, drums and trucks
//   camp_signal     通信所: two lattice masts, the radio shelter, a generator, a tent and a pit
//   camp_watch      監視陣地: the watchtower in a ring of wire, two pits, a tent
//   camp_command    指揮所: the command tent (its safe holds the key), the comms tent, a locked
//                   weapons container, vehicles, a sandbag wall round it all
//   camp_motor      車両集積所: rows of trucks, armoured cars and a tank (many burnt), the repair
//                   tent, fuel
//   camp_battalion  大隊の宿営地: lines of tents, command, medical and supply tents, the
//                   watchtower, a helipad, pits at the gate

import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { car } from '../shop/common.ts';
import { windsock } from '../transport/airport_parts.ts';
import { pave, paint } from '../transport/common.ts';
import {
  apc, bags, barrier, command, container, cots, crates, drums, fallenTent, heli, helipadH, jeep, keyDoors, mastAntenna, medical, mtruck, net, OD, OD2,
  pit, scorch, supplies, tank, tent, TOWER, watchtower, wire, DARK,
} from './parts.ts';

const H = 3.0;

function camp(variant: string, size: BuildingDef['size'], roofRise: number, build: (k: Kit, f: Fit) => Rect[] | void): BuildingDef {
  const def: BuildingDef = {
    id: `military.${variant}`, category: 'military', variant, kind: 'shed', size, storeys: 1, storeyHeight: H, plinth: 0.15, roof: 'flat', roofRise, lootable: true,
    generate(rng, params) {
      let keys: Rect[] = [];
      const bp = twoPass(def, rng, params, (k, f) => {
        keys = build(k, f) ?? [];
      });
      return keys.length > 0 ? keyDoors(bp, keys.map((r) => [0, r])) : bp;
    },
  };
  return def;
}

/** Squad tent (5 × 8) with its door towards `door`, cots inside (or fallen when `down`). */
function squadTent(k: Kit, f: Fit, r: Rect, door: 'z+' | 'z-' | 'x+' | 'x-', down = false, windows = true): number {
  if (down) {
    fallenTent(k, r, k.rand() < 0.5 ? OD : OD2);
    return -1;
  }
  const id = tent(k, r, { use: 'barracks', doors: [door], tint: k.rand() < 0.5 ? OD : OD2, windows });
  cots(f, id);
  return id;
}

// ---------------------------------------------------------------------------------------------

export const MILITARY_CAMP_SQUAD = camp('camp_squad', { w: [30, 36], d: [24, 30] }, 2, (k, f) => {
  const { w, d } = k;
  const gap = (w - 6 - 3 * 5) / 2;
  const fallen = Math.floor(k.rand() * 4); // 3: none fell
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * (5 + gap);
    squadTent(k, f, [x, 2.5, x + 5, 10.5], 'z+', i === fallen);
  }
  const p = pit(k, [2, d - 7.5, 8, d - 2], 'z-', { gun: 'z+' });
  f.row(p, 'x+', 1.0, 0.6, 0.5, 'olive', { kind: 'crate', table: 'field', max: 1, tint: DARK });
  f.ensure(p, 'crate', 'field');
  jeep(k, w - 6, d - 5, 'x', { dir: -1, burnt: k.rand() < 0.4 });
  net(k, [w / 2 - 3, 13, w / 2 + 3, 17]);
  crates(k, [w / 2 - 2, 14, w / 2 + 1, 16]);
  scorch(k, w / 2 + 4, d - 6, 1.6);
  drums(k, w - 4, 13, 4);
  bags(k, 10, d - 2.2, 14, d - 1.6);
});

export const MILITARY_CAMP_CHECKPOINT = camp('camp_checkpoint', { w: [40, 48], d: [22, 28] }, 3, (k, f) => {
  const { w, d } = k;
  const zr = d / 2;
  pave(k, 0, zr - 3.5, w, zr + 3.5);
  paint(k, 0, zr - 0.08, w, zr + 0.08, 0, 'paper', 0.05);
  const down = k.rand() < 0.6;
  barrier(k, 6, 12, zr - 2, down);
  barrier(k, w - 6, w - 12, zr + 2, down);
  // The chicane: blocks of bags staggered across the road.
  bags(k, w / 2 - 6, zr - 3.5, w / 2 - 5, zr + 0.8, 1.0);
  bags(k, w / 2 + 5, zr - 0.8, w / 2 + 6, zr + 3.5, 1.0);
  // The guard hut on the north side of the road, its door to the road.
  const hut = container(k, [w / 2 - 2, 1.5, w / 2 + 2.4, zr - 5], 'x+', { use: 'command', mat: 'siding', tint: 0.4 });
  command(f, hut);
  // Positions: before the barrier and behind it on the other side.
  const a = pit(k, [2, d - 7, 8, d - 1.5], 'z-', { gun: 'x-' });
  f.ensure(a, 'crate', 'field');
  const b = pit(k, [w - 8, 1.5, w - 2, 7], 'z+', { gun: 'x+' });
  f.ensure(b, 'crate', 'field');
  // The guards' tent behind the hut.
  const t = tent(k, [3, 1.5, 11, zr - 5.5], { use: 'barracks', doors: ['x+'], tint: OD });
  cots(f, t, { max: 3 });
  wire(k, 12, zr - 4.2, w - 12, zr - 4.2);
  wire(k, 12, zr + 4.2, w - 12, zr + 4.2);
  // The queue that never got through.
  const n = 2 + Math.floor(k.rand() * 3);
  for (let i = 0; i < n; i++) car(k, w - 16 - i * 5.5, zr + 1.6, 'x');
  if (k.rand() < 0.6) {
    car(k, w / 2 + 1, zr - 1.6, 'x', 0.05);
    scorch(k, w / 2 + 1, zr - 1.6, 4, 'blood');
  }
  k.box(-1, w / 2 - 2, 0, zr + 4.5, w / 2 + 2, 2.2, zr + 4.6, 'sign', { layer: 'shell', tint: 0.95, solid: false });
});

export const MILITARY_CAMP_HOSPITAL = camp('camp_hospital', { w: [46, 56], d: [34, 42] }, 2.5, (k, f) => {
  const { w, d } = k;
  const lane = d / 2;
  // Two ward tents facing each other across the lane, triage at the front, the pharmacy beside it.
  const len = Math.min(18, (w - 16) / 2 + 4);
  const wa = tent(k, [3, 3, 3 + len, lane - 2.5], { use: 'ward', doors: ['z+'], wide: true, tint: OD2, h: 2.4 });
  medical(f, wa);
  const wb = tent(k, [w - 3 - len, 3, w - 3, lane - 2.5], { use: 'ward', doors: ['z+'], wide: true, tint: OD2, h: 2.4 });
  medical(f, wb);
  const tr = tent(k, [3, lane + 2.5, 13, d - 3], { use: 'clinic', doors: ['z-', 'z+'], wide: true, tint: OD });
  medical(f, tr);
  const ph = tent(k, [16, lane + 2.5, 22, d - 6], { use: 'storage', doors: ['z-'], tint: OD });
  supplies(f, ph, ['pharmacy', 'field', 'pharmacy'], 5);
  // The red cross on the ground, the ambulance, the generator.
  const cx = w - 12;
  const cz = lane + 9;
  paint(k, cx - 5, cz - 5, cx + 5, cz + 5, 0, 'paper', 0.03);
  paint(k, cx - 3.6, cz - 1, cx + 3.6, cz + 1, 0.6, 'sign', 0.04);
  paint(k, cx - 1, cz - 3.6, cx + 1, cz + 3.6, 0.6, 'sign', 0.04);
  mtruck(k, 27, d - 5, 'x', { dir: 1, open: true });
  k.box(-1, w - 6, 0, lane - 1.5, w - 4, 1.3, lane + 0.3, 'olive', { layer: 'shell', tint: DARK, role: 'furniture' });
  for (let i = 0; i < 3; i++) if (k.rand() < 0.6) k.box(-1, 25 + i * 2.2, 0, lane - 1.6, 25.6 + i * 2.2, 0.3, lane + 0.4, 'olive', { layer: 'shell', tint: DARK, solid: false });
  scorch(k, 30, lane, 2, 'blood');
});

export const MILITARY_CAMP_HELIPORT = camp('camp_heliport', { w: [56, 66], d: [46, 56] }, 5, (k, f) => {
  const { w, d } = k;
  const s = 18;
  const zp = 3 + s / 2;
  helipadH(k, 3 + s / 2, zp, s);
  helipadH(k, w - 3 - s / 2, zp, s);
  heli(k, 3 + s / 2, zp, 'x', { dir: 1, big: k.rand() < 0.5 });
  heli(k, w - 3 - s / 2, zp + 1, 'x', { dir: -1, crashed: true });
  scorch(k, w - 3 - s / 2, zp + 1, 9);
  windsock(k, w / 2, 3);
  // Ops tent and the fuel tent at the front, a pit by the entrance.
  const ops = tent(k, [4, d - 12, 12, d - 3], { use: 'command', doors: ['z+'], tint: OD });
  command(f, ops);
  const fuel = tent(k, [w / 2 - 4, d - 11, w / 2 + 4, d - 3], { use: 'storage', doors: ['z+'], tint: OD2 });
  supplies(f, fuel, ['fuel', 'field', 'fuel'], 5);
  drums(k, w / 2 + 6, d - 10, 9);
  const p = pit(k, [w - 9, d - 8, w - 2, d - 2], 'x-', { gun: 'z+' });
  f.ensure(p, 'crate', 'field');
  net(k, [w / 2 - 4, zp - 4, w / 2 + 4, zp + 4]);
  crates(k, [w / 2 - 3, zp - 2, w / 2 + 1, zp + 1]);
  jeep(k, 18, d - 6, 'x', { burnt: k.rand() < 0.3 });
});

export const MILITARY_CAMP_SUPPLY = camp('camp_supply', { w: [54, 64], d: [38, 46] }, 2.5, (k, f) => {
  const { w, d } = k;
  const store = tent(k, [3, 3, 25, 13], { use: 'storage', doors: ['z+'], wide: true, at: { 'z+': 5 }, tint: OD, h: 2.6, floor: 'concrete' });
  supplies(f, store, ['field', 'grocery', 'fuel', 'pharmacy', 'field', 'tools'], 9);
  const c1 = container(k, [29, 3, 31.5, 9.1], 'z+', { use: 'storage', tint: OD });
  supplies(f, c1, ['field'], 2);
  const c2 = container(k, [33, 3, 35.5, 9.1], 'z+', { use: 'storage', state: k.rand() < 0.5 ? 'open' : 'locked', tint: DARK });
  supplies(f, c2, ['grocery', 'field'], 2);
  // Crates under nets in two rows, drums, the forklift, trucks.
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * ((w - 14) / 3);
    net(k, [x, 17, x + 8, 23]);
    crates(k, [x + 1, 18.5, x + 6, 21.5], 1.4, i % 2 ? OD : DARK);
  }
  drums(k, w - 9, 4, 12);
  k.box(-1, w - 14, 0, 12, w - 12, 2.1, 15, 'sign', { layer: 'shell', tint: 0.8, role: 'furniture' });
  mtruck(k, 10, d - 5, 'x', { dir: 1 });
  mtruck(k, w - 12, d - 5, 'x', { dir: -1, burnt: k.rand() < 0.5 });
  if (k.rand() < 0.5) scorch(k, w - 12, d - 5, 6);
  const g = pit(k, [w / 2 - 3, d - 8, w / 2 + 3, d - 2], 'z-', { gun: 'z+' });
  f.ensure(g, 'crate', 'field');
});

export const MILITARY_CAMP_SIGNAL = camp('camp_signal', { w: [34, 40], d: [28, 34] }, 13, (k, f) => {
  const { w, d } = k;
  mastAntenna(k, 5, 5, 15);
  mastAntenna(k, w - 5, 6, 12 + k.rand() * 3);
  const sh = container(k, [w / 2 - 3, 3, w / 2 + 3, 5.5], 'x+', { use: 'command', tint: OD });
  command(f, sh);
  k.box(-1, w / 2 + 4, 0, 3, w / 2 + 6, 1.4, 4.4, 'olive', { layer: 'shell', tint: DARK, role: 'furniture' }); // generator
  const t = tent(k, [3, d - 11, 11, d - 3], { use: 'barracks', doors: ['x+'], tint: OD2, windows: true });
  cots(f, t, { max: 4 });
  const p = pit(k, [w - 9, d - 9, w - 2, d - 2], 'x-', { gun: 'z+' });
  f.ensure(p, 'crate', 'field');
  jeep(k, w / 2, d - 6, 'x');
  // Cable runs (drawn only).
  paint(k, 5, 5.5, w / 2 - 3, 5.7, 0, 'asphalt', 0.05);
  paint(k, w / 2 + 3, 5.5, w - 5, 5.7, 0, 'asphalt', 0.05);
  crates(k, [14, 12, 17, 14]);
});

export const MILITARY_CAMP_WATCH = camp('camp_watch', { w: [32, 38], d: [32, 38] }, 6, (k, f) => {
  const { w, d } = k;
  const tx = w / 2 - TOWER.w / 2;
  const tz = d / 2 - TOWER.d / 2 - 2;
  const top = watchtower(k, tx, tz, { tint: k.rand() });
  for (const r of top) f.ensure(r, 'crate', 'field');
  // Wire round the site (a gap at the front), pits at the front corners, a tent at the back.
  wire(k, 1.5, 1.5, w - 1.5, 1.5);
  wire(k, 1.5, 2.3, 1.5, d - 1.5);
  wire(k, w - 1.5, 2.3, w - 1.5, d - 1.5);
  wire(k, 1.5, d - 1.5, w / 2 - 4, d - 1.5);
  wire(k, w / 2 + 4, d - 1.5, w - 1.5, d - 1.5);
  const a = pit(k, [4, d - 9, 10, d - 3.5], 'x+', { gun: 'z+' });
  f.ensure(a, 'crate', 'field');
  const b = pit(k, [w - 10, d - 9, w - 4, d - 3.5], 'x-', { gun: 'z+' });
  f.ensure(b, 'crate', 'field');
  const t = tent(k, [4, 4, 12, 10], { use: 'barracks', doors: ['x+'], tint: OD });
  cots(f, t, { max: 3 });
  bags(k, w - 12, 5, w - 4, 5.6);
  crates(k, [w - 10, 7, w - 7, 9]);
});

export const MILITARY_CAMP_COMMAND = camp('camp_command', { w: [46, 54], d: [38, 46] }, 13, (k, f) => {
  const { w, d } = k;
  // A sandbag wall round the site, the gate in the front.
  bags(k, 1, 1, w - 1, 1.6, 1.3);
  bags(k, 1, 1.6, 1.6, d - 1, 1.3);
  bags(k, w - 1.6, 1.6, w - 1, d - 1, 1.3);
  bags(k, 1.6, d - 1.6, w / 2 - 4, d - 1, 1.3);
  bags(k, w / 2 + 4, d - 1.6, w - 1.6, d - 1, 1.3);
  const cmd = tent(k, [4, 4, 18, 12], { use: 'command', doors: ['z+'], tint: OD, h: 2.4 });
  command(f, cmd);
  // The safe in the command tent holds the key to the weapons container.
  const safe = { tint: 0.9, search: { kind: 'cabinet' as const, face: 'z+' as const, table: 'safe' as const } };
  if (!f.put(cmd, [4.3, 4.3, 5.1, 5.0], 1.1, 'steel', safe)) f.put(cmd, [16.8, 4.3, 17.6, 5.0], 1.1, 'steel', safe);
  const comms = tent(k, [21, 4, 28, 10], { use: 'command', doors: ['z+'], tint: OD2 });
  command(f, comms);
  const arms: Rect = [32, 3, 38.2, 5.5];
  const wc = container(k, arms, 'x-', { use: 'armory', state: 'locked', tint: DARK });
  supplies(f, wc, ['weapons', 'armory'], 3);
  mastAntenna(k, w - 5, 9, 14);
  const t = tent(k, [4, 17, 12, 25], { use: 'barracks', doors: ['x+'], tint: OD2 });
  cots(f, t, { max: 4 });
  const p = pit(k, [w / 2 + 5, d - 9, w / 2 + 11, d - 3], 'x-', { gun: 'z+' });
  f.ensure(p, 'crate', 'field');
  apc(k, 25, d - 9, 'x', { burnt: k.rand() < 0.3 });
  jeep(k, w - 9, 22, 'z', { burnt: k.rand() < 0.4 });
  jeep(k, w - 14, 22, 'z');
  net(k, [16, 16, 26, 24]);
  return [[arms[0] - 0.5, arms[1], arms[2], arms[3]]];
});

export const MILITARY_CAMP_MOTOR = camp('camp_motor', { w: [60, 72], d: [42, 50] }, 3, (k, f) => {
  const { w, d } = k;
  // Two rows of vehicles in the open (many burnt), the repair tent and fuel at the back.
  const kinds = [mtruck, mtruck, apc, jeep, tank, mtruck, apc, jeep];
  const n = Math.floor((w - 8) / 6.5);
  for (const [row, z] of [[0, d - 17], [1, d - 7]] as const) {
    for (let i = 0; i < n; i++) {
      if (k.rand() < 0.15) continue;
      const fn = kinds[Math.floor(k.rand() * kinds.length)]!;
      const burnt = k.rand() < 0.45;
      fn(k, 6 + i * 6.5, z, 'z', { dir: row === 0 ? 1 : -1, burnt });
      if (burnt && k.rand() < 0.5) scorch(k, 6 + i * 6.5, z, 5);
    }
  }
  const rep = tent(k, [3, 3, 21, 13], { use: 'garage', doors: ['z+'], wide: true, at: { 'z+': 9 }, tint: OD, h: 2.8, floor: 'concrete' });
  supplies(f, rep, ['tools', 'garage', 'tools'], 5);
  const fuel = tent(k, [25, 3, 33, 10], { use: 'storage', doors: ['z+'], tint: OD2 });
  supplies(f, fuel, ['fuel', 'fuel', 'field'], 4);
  drums(k, 36, 4, 12);
  const c = container(k, [w - 9, 3, w - 6.5, 9.1], 'z+', { use: 'storage', tint: OD });
  supplies(f, c, ['tools', 'field'], 2);
  jeep(k, 12, 18, 'x', { burnt: true });
});

export const MILITARY_CAMP_BATTALION = camp('camp_battalion', { w: [100, 120], d: [70, 90] }, 6, (k, f) => {
  const { w, d } = k;
  // The gate: a road in from the front to a parade ground in the middle.
  const gx = w / 2;
  pave(k, gx - 3, d - 16, gx + 3, d);
  barrier(k, gx - 3.5, gx + 3, d - 4, k.rand() < 0.5);
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? gx - 12 : gx + 6;
    const p = pit(k, [x0, d - 8, x0 + 6, d - 2], sx < 0 ? 'x+' : 'x-', { gun: 'z+' });
    f.ensure(p, 'crate', 'field');
  }
  wire(k, 2, d - 1.2, gx - 13, d - 1.2);
  wire(k, gx + 13, d - 1.2, w - 2, d - 1.2);
  // Lines of squad tents at the back (two rows), some fallen.
  const n = Math.min(8, Math.floor((w - 30) / 8));
  const step = (w - 34) / n;
  for (const zr of [3, 15]) {
    for (let i = 0; i < n; i++) {
      const x = 4 + i * step;
      squadTent(k, f, [x, zr, x + 5, zr + 8], zr === 3 ? 'z+' : 'z-', k.rand() < 0.2, false);
    }
  }
  // The command, medical and supply tents on the parade ground's sides.
  const cmd = tent(k, [4, 34, 18, 42], { use: 'command', doors: ['z+'], tint: OD, h: 2.4 });
  command(f, cmd);
  const med = tent(k, [22, 34, 38, 42], { use: 'ward', doors: ['z+'], wide: true, tint: OD2, h: 2.4 });
  medical(f, med);
  const sup = tent(k, [w - 26, 34, w - 6, 44], { use: 'storage', doors: ['x-'], wide: true, tint: OD, h: 2.6, floor: 'concrete' });
  supplies(f, sup, ['field', 'fuel', 'grocery', 'pharmacy'], 8);
  // The watchtower in the back right corner, a helipad, vehicles.
  const top = watchtower(k, w - 3 - TOWER.w - 0.6, 3.6, { tint: k.rand() });
  for (const r of top) f.ensure(r, 'crate', 'field');
  helipadH(k, w - 18, 14, 16);
  if (k.rand() < 0.5) heli(k, w - 18, 14, 'x', { crashed: k.rand() < 0.5 });
  for (let i = 0; i < 4; i++) mtruck(k, 10 + i * 7, d - 10, 'z', { dir: -1, burnt: k.rand() < 0.35 });
  apc(k, w - 14, d - 12, 'x', { burnt: k.rand() < 0.4 });
  drums(k, w - 28, 48, 6);
  scorch(k, gx + 8, 50, 6);
  for (let i = 0; i < 3; i++) if (k.rand() < 0.6) fallenTent(k, [44 + i * 9, 50, 49 + i * 9, 58], OD);
});

export const MILITARY_CAMPS: BuildingDef[] = [
  MILITARY_CAMP_SQUAD, MILITARY_CAMP_CHECKPOINT, MILITARY_CAMP_HOSPITAL, MILITARY_CAMP_HELIPORT, MILITARY_CAMP_SUPPLY,
  MILITARY_CAMP_SIGNAL, MILITARY_CAMP_WATCH, MILITARY_CAMP_COMMAND, MILITARY_CAMP_MOTOR, MILITARY_CAMP_BATTALION,
];
