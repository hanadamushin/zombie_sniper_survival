// L4: shapes shared by the chubu landmarks: the black-boarded tiers of Matsumoto, the gold ridge fish
// of Nagoya, the curved gables (唐破風), torii, stone lanterns, a thatched gasshō house, maples.
// Built from the common kit (../common.ts) and the tohoku / kanto shapes; nothing here is a landmark
// of its own.

import type { PaintName } from '../../../../../data/render.ts';
import type { Lm } from '../common.ts';

/**
 * A pair of gold ridge fish (金鯱) on a ridge along `axis` at height y, the fish `half` from (cx, cz),
 * each `h` tall: the head on the ridge, the body arching up into the tail that turns inwards.
 */
export function shachi(L: Lm, cx: number, cz: number, y: number, axis: 'x' | 'z', half: number, h: number, paint: PaintName = 'gold'): void {
  for (const s of [-1, 1]) {
    const [fx, fz] = axis === 'x' ? [cx + s * half, cz] : [cx, cz + s * half];
    const u = h * 0.22; // half thickness
    const l = h * 0.34; // half length
    const at = (du: number): [number, number] => (axis === 'x' ? [fx + s * du, fz] : [fx, fz + s * du]);
    // The head and the body (outer end), the arched back, the tail fins turned in towards the ridge's middle.
    const [hx, hz] = at(0);
    L.box(hx - (axis === 'x' ? l : u), y - 0.1, hz - (axis === 'x' ? u : l), hx + (axis === 'x' ? l : u), y + h * 0.45, hz + (axis === 'x' ? u : l), 'paint', { paint, solid: false });
    const [bx, bz] = at(-l * 0.4);
    L.box(bx - u * 0.9, y + h * 0.45, bz - u * 0.9, bx + u * 0.9, y + h * 0.75, bz + u * 0.9, 'paint', { paint, solid: false });
    const [tx, tz] = at(-l * 1.1);
    const tw = axis === 'x' ? [l * 0.5, u * 1.5] : [u * 1.5, l * 0.5];
    L.box(tx - tw[0]!, y + h * 0.75, tz - tw[1]!, tx + tw[0]!, y + h, tz + tw[1]!, 'paint', { paint, solid: false });
  }
}

/**
 * A curved gable (唐破風) on a roof slope, facing out of `side` of a wall at `at`: a low broad gable
 * with a narrower steep crown on it (the bell shape from afar), the gold-edged board under it.
 */
export function karahafu(L: Lm, side: 'z+' | 'z-' | 'x+' | 'x-', at: number, u: number, half: number, y0: number, y1: number, over: number, roof: PaintName, edge: PaintName = 'white'): void {
  const out = side.endsWith('+') ? 1 : -1;
  const a = at - out * 1.0;
  const b = at + out * (over + 0.2);
  const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
  const mid = y0 + (y1 - y0) * 0.45;
  if (side[0] === 'z') {
    L.box(u - half, y0 - 0.4, b - out * 0.15 - 0.06, u + half, y0, b - out * 0.15 + 0.06, 'paint', { paint: edge, solid: false });
    L.shape('gable', u - half, y0, lo, u + half, mid, hi, 'paint', { paint: roof, axis: 'z', solid: false });
    L.shape('gable', u - half * 0.55, mid - 0.15, lo, u + half * 0.55, y1, hi - out * 0.1, 'paint', { paint: roof, axis: 'z', solid: false });
  } else {
    L.box(b - out * 0.15 - 0.06, y0 - 0.4, u - half, b - out * 0.15 + 0.06, y0, u + half, 'paint', { paint: edge, solid: false });
    L.shape('gable', lo, y0, u - half, hi, mid, u + half, 'paint', { paint: roof, axis: 'x', solid: false });
    L.shape('gable', lo, mid - 0.15, u - half * 0.55, hi - out * 0.1, y1, u + half * 0.55, 'paint', { paint: roof, axis: 'x', solid: false });
  }
}

export interface BlackTierStyle {
  roof: PaintName;
  over: number;
  rise: number;
  wx: number;
  wz: number;
  /** Share of the wall's height that is white plaster at the top (the rest black lacquered boards). */
  white: number;
  broken?: number;
}

/**
 * One tier of a black keep (Matsumoto, 烏城): black lacquered boards (下見板) up the wall, a white
 * plaster band under the eaves, a row of windows across the boards, the roof skirt. Returns the eaves.
 */
export function blackTier(L: Lm, cx: number, cz: number, hx: number, hz: number, y0: number, h: number, s: BlackTierStyle): number {
  const y1 = y0 + h;
  const yw = y1 - h * s.white;
  L.box(cx - hx, y0, cz - hz, cx + hx, yw, cz + hz, 'paint', { paint: 'black' });
  L.box(cx - hx, yw, cz - hz, cx + hx, y1, cz + hz, 'paint', { paint: 'white' });
  const wy0 = y0 + h * 0.3;
  const wy1 = Math.min(yw - 0.2, y0 + h * 0.62);
  const o = { broken: s.broken ?? 0.2, paint: 'charcoal' as PaintName };
  if (s.wx > 0) {
    L.windows('x', cz + hz, 1, cx - hx + 0.8, cx + hx - 0.8, s.wx, wy0, wy1, 0.9, o);
    L.windows('x', cz - hz, -1, cx - hx + 0.8, cx + hx - 0.8, s.wx, wy0, wy1, 0.9, o);
  }
  if (s.wz > 0) {
    L.windows('z', cx + hx, 1, cz - hz + 0.8, cz + hz - 0.8, s.wz, wy0, wy1, 0.9, o);
    L.windows('z', cx - hx, -1, cz - hz + 0.8, cz + hz - 0.8, s.wz, wy0, wy1, 0.9, o);
  }
  if (s.rise <= 0) return y1;
  L.box(cx - hx - s.over, y1 - 0.25, cz - hz - s.over, cx + hx + s.over, y1, cz + hz + s.over, 'paint', { paint: 'white', solid: false });
  L.shape('hip', cx - hx - s.over, y1, cz - hz - s.over, cx + hx + s.over, y1 + s.rise, cz + hz + s.over, 'paint', { paint: s.roof, axis: hx >= hz ? 'x' : 'z' });
  return y1;
}

/**
 * A torii across a path along `along` (the path runs along it: the gate's beams run across): posts
 * `span` apart, `h` tall. 'myojin' has the upturned top lintel (笠木 with 島木) and a tie (貫) whose
 * ends pass the posts; 'shinmei' straight round lintels.
 */
export function torii(L: Lm, x: number, z: number, along: 'x' | 'z', span: number, h: number, paint: PaintName, kind: 'myojin' | 'shinmei' = 'myojin'): void {
  const r = span * 0.075 + 0.15;
  const across = (u0: number, u1: number, y0: number, y1: number, t: number): void => {
    if (along === 'z') L.box(x + u0, y0, z - t, x + u1, y1, z + t, 'paint', { paint });
    else L.box(x - t, y0, z + u0, x + t, y1, z + u1, 'paint', { paint });
  };
  const half = span / 2;
  for (const s of [-1, 1]) {
    const [px, pz] = along === 'z' ? [x + s * half, z] : [x, z + s * half];
    L.column(px, pz, r, 0, h * 0.93, 'paint', { paint, taper: kind === 'myojin' ? 0.88 : 1 });
    if (kind === 'myojin') L.column(px, pz, r * 1.25, 0, h * 0.08, 'paint', { paint: 'black' }); // the black foot rings (根巻)
  }
  const t = r * 0.9;
  if (kind === 'myojin') {
    across(-half - r * 1.4, half + r * 1.4, h * 0.72, h * 0.72 + r * 1.4, t * 0.7); // 貫
    across(-half - r * 2.4, half + r * 2.4, h * 0.88, h * 0.94, t); // 島木
    across(-half - r * 3.2, half + r * 3.2, h * 0.94, h, t * 1.15); // 笠木
    // The upturned ends of the 笠木.
    for (const s of [-1, 1]) {
      const u = s * (half + r * 3.2);
      across(Math.min(u, u - s * r * 1.6), Math.max(u, u - s * r * 1.6), h, h + r * 0.8, t * 1.15);
    }
    across(-r * 0.9, r * 0.9, h * 0.72 + r * 1.4, h * 0.88, t * 0.6); // 額束
  } else {
    across(-half - r * 1.2, half + r * 1.2, h * 0.74, h * 0.74 + r * 1.2, t * 0.7);
    across(-half - r * 2.6, half + r * 2.6, h - r * 1.6, h, t);
  }
}

/** A stone lantern (石灯籠): post, fire box, roof and its knob. */
export function lantern(L: Lm, x: number, z: number, h = 2.6, paint: PaintName = 'stone'): void {
  L.box(x - 0.45, 0, z - 0.45, x + 0.45, h * 0.12, z + 0.45, 'paint', { paint });
  L.column(x, z, 0.22, h * 0.12, h * 0.55, 'paint', { paint });
  L.box(x - 0.42, h * 0.55, z - 0.42, x + 0.42, h * 0.78, z + 0.42, 'paint', { paint, solid: false });
  L.shape('hip', x - 0.7, h * 0.78, z - 0.7, x + 0.7, h * 0.94, z + 0.7, 'paint', { paint, axis: 'x', solid: false });
  L.column(x, z, 0.14, h * 0.94, h, 'paint', { paint, solid: false });
}

/** A Japanese maple in late November (紅葉): a short trunk and a spreading red crown. */
export function maple(L: Lm, x: number, z: number, h: number, r: number): void {
  L.column(x, z, 0.25, 0, h * 0.5, 'paint', { paint: 'brown' });
  L.column(x, z, r, h * 0.38, h * 0.78, 'paint', { paint: 'momiji', taper: 1.15, solid: false });
  L.column(x, z, r * 1.1, h * 0.78, h, 'paint', { paint: 'momiji', taper: 0.45, solid: false });
}

/**
 * A gasshō house (合掌造り) of Shirakawa-gō: low walls under a steep thatched A-roof (about 60°) whose
 * ridge runs along z; the gable ends (z0 and z1) are boarded, with rows of small paper windows on each
 * of the roof's floors. (x0, z0)–(x1, z1) is the footprint of the walls; the roof overhangs by `over`.
 */
export function gassho(L: Lm, x0: number, z0: number, x1: number, z1: number, wall: number, ridge: number, over = 1.2, broken = 0.3): void {
  L.box(x0, 0, z0, x1, wall, z1, 'woodDark');
  const cx = (x0 + x1) / 2;
  // The thatch, and its ridge (a dark strip of the binding).
  L.shape('gable', x0 - over, wall, z0 - 0.8, x1 + over, ridge, z1 + 0.8, 'paint', { paint: 'thatch', axis: 'z' });
  L.box(cx - 0.5, ridge - 0.5, z0 - 0.8, cx + 0.5, ridge + 0.15, z1 + 0.8, 'paint', { paint: 'brown', solid: false });
  // The gable ends: the board triangle (stepped boxes on the thatch's end, which shows as a rim round
  // them), its windows.
  const span = x1 - x0;
  for (const [z, out] of [[z0 - 0.85, -1], [z1 + 0.85, 1]] as const) {
    const floors = Math.max(2, Math.round((ridge - wall) / 2.6));
    for (let f = 0; f < floors; f++) {
      const ya = wall + ((ridge - wall) * f) / floors;
      const yb = wall + ((ridge - wall) * (f + 0.78)) / floors;
      const halfW = (span / 2) * (1 - (f + 0.5) / floors) * 0.92;
      if (halfW < 0.8) continue;
      L.box(cx - halfW, ya, Math.min(z, z - out * 0.15), cx + halfW, yb, Math.max(z, z - out * 0.15), 'paint', { paint: 'brown', solid: false });
      const n = Math.max(1, Math.floor((halfW * 2) / 2.2));
      L.windows('x', z, out, cx - halfW + 0.5, cx + halfW - 0.5, n, ya + 0.4, yb - 0.3, 1.1, { paint: 'offWhite', broken });
    }
  }
  // Paper windows along the low walls.
  L.windows('z', x1, 1, z0 + 1, z1 - 1, Math.max(2, Math.floor((z1 - z0) / 3.2)), 0.9, wall - 0.4, 1.4, { paint: 'offWhite', broken });
  L.windows('z', x0, -1, z0 + 1, z1 - 1, Math.max(2, Math.floor((z1 - z0) / 3.2)), 0.9, wall - 0.4, 1.4, { paint: 'offWhite', broken });
}
