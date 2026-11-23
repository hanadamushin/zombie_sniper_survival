// L3b: 川越 時の鐘と蔵造りの町並み (Kawagoe: the Bell of Time and the street of clay-walled storehouse
// shops, 一番街). The 蔵造り shops: two storeys of thick black-plastered walls, heavy tiled roofs with
// a tall box ridge (箱棟) and big ridge-end tiles (鬼瓦), the upper floor's small windows behind thick
// double doors (観音開き), the shop fronts under a lean-to eave. A lane off the street leads to the
// 時の鐘 (rebuilt 1894): a wooden bell tower of three storeys, about 16 m, dark, a small roof over
// each storey and the bell in the open top.
//
// The street is the real width; its length shrunk (four shops a side). The front (local z = d) is the
// street's south end; the lane and the bell tower are to its east.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 64;
const D = 96;
/** The street: x from SX0 to SX1. */
const SX0 = 20;
const SX1 = 29;

export const LANDMARK_KAWAGOE = landmarkDef({
  variant: 'kawagoe',
  size: { w: [W, W], d: [D, D] },
  eaves: 7.5,
  top: 16.2,
  kind: 'house',
  build,
});

/**
 * A storehouse shop facing the street, its front wall at x = fx (the street towards `dir`), from z0
 * to z1, `deep` m back from the street. `wall` black plaster (a few are white or grey).
 */
function kura(L: Lm, fx: number, dir: 1 | -1, z0: number, z1: number, deep: number, wall: PaintName): void {
  const [x0, x1] = dir > 0 ? [fx - deep, fx] : [fx, fx + deep];
  const eaves = 7.2;
  L.box(x0, 0, z0, x1, eaves, z1, 'paint', { paint: wall });
  // The heavy tiled roof (ridge along the street), the box ridge, the ridge-end tiles.
  L.shape('gable', x0 - 0.9, eaves, z0 - 0.5, x1 + 0.9, eaves + 3.4, z1 + 0.5, 'paint', { paint: 'charcoal', axis: 'z' });
  const rx = (x0 + x1) / 2;
  L.box(rx - 0.55, eaves + 3.1, z0 - 0.2, rx + 0.55, eaves + 4.3, z1 + 0.2, 'paint', { paint: 'black' });
  for (const z of [z0 - 0.3, z1 + 0.3]) L.box(rx - 0.9, eaves + 3.4, z - 0.35, rx + 0.9, eaves + 5.4, z + 0.35, 'paint', { paint: 'charcoal', solid: false });
  // The upper floor's thick double doors (black, open a little: a dark slit) and their frames.
  const n = Math.max(2, Math.round((z1 - z0) / 4.5));
  const face = dir > 0 ? x1 : x0;
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * (i + 0.5)) / n;
    L.box(face - 0.35, 4.4, z - 0.95, face + 0.35, 6.2, z + 0.95, 'paint', { paint: 'black', solid: false });
    L.box(face + dir * 0.36 - 0.03, 4.7, z - 0.12, face + dir * 0.36 + 0.03, 5.9, z + 0.12, 'paint', { paint: 'windowDark', solid: false });
  }
  // The lean-to eave over the shop front, the shop front's wooden shutters behind it.
  const ex = dir > 0 ? x1 : x0 - 2;
  L.shape('wedge', ex, 3.2, z0 - 0.2, ex + 2, 3.9, z1 + 0.2, 'paint', { paint: 'charcoal', slope: dir > 0 ? 'x-' : 'x+', solid: false });
  L.box(face - 0.06, 0, z0 + 0.6, face + 0.06, 3, z1 - 0.6, 'woodDark', { solid: false });
}

/** The Bell of Time at (x, z): a stone base, three wooden storeys with their small roofs, the open belfry. */
function bellTower(L: Lm, x: number, z: number): void {
  L.box(x - 3.4, 0, z - 3.4, x + 3.4, 1.4, z + 3.4, 'paint', { paint: 'stone' });
  let y = 1.4;
  const wood: PaintName = 'brown';
  for (const [hw, h, over] of [[2.4, 4.2, 1.1], [2.1, 3.6, 1], [1.8, 3.2, 0]] as const) {
    if (over > 0) {
      L.box(x - hw, y, z - hw, x + hw, y + h, z + hw, 'paint', { paint: wood });
      for (const s of [-1, 1]) L.box(x - hw * 0.5, y + 1, z + s * hw - 0.04, x + hw * 0.5, y + h - 1, z + s * hw + 0.04, 'paint', { paint: 'black', solid: false });
      L.shape('hip', x - hw - over, y + h - 0.2, z - hw - over, x + hw + over, y + h + 0.9, z + hw + over, 'paint', { paint: 'charcoal', axis: 'x' });
    } else {
      // The belfry: four posts, the bell between them, the roof.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(x + sx * hw - 0.2, y, z + sz * hw - 0.2, x + sx * hw + 0.2, y + h, z + sz * hw + 0.2, 'paint', { paint: wood });
      L.box(x - hw, y, z - hw, x + hw, y + 0.9, z + hw, 'paint', { paint: wood });
      L.column(x, z, 0.75, y + 0.9, y + 2.6, 'paint', { paint: 'bronze', taper: 0.75, solid: false });
      L.shape('hip', x - hw - 1.3, y + h, z - hw - 1.3, x + hw + 1.3, y + h + 2.1, z + hw + 1.3, 'paint', { paint: 'charcoal', axis: 'x' });
      L.box(x - 0.2, y + h + 2.1, z - 0.2, x + 0.2, y + h + 2.6, z + 0.2, 'paint', { paint: 'bronze', solid: false });
    }
    y += h + (over > 0 ? 0.5 : 0);
  }
}

function build(L: Lm): void {
  L.ground('paved', [[SX0, 0], [SX1, 0], [SX1, D], [SX0, D]]);
  L.ground('paved', [[SX1, 44], [W, 44], [W, 50], [SX1, 50]]);
  // The shops: west of the street and east of it (the lane between the east ones).
  const walls: PaintName[] = ['black', 'black', 'charcoal', 'black', 'offWhite', 'black', 'black', 'black'];
  const west = [[4, 18], [20, 36], [38, 56], [58, 76], [78, 92]] as const;
  west.forEach(([z0, z1], i) => kura(L, SX0 - 0.5, 1, z0, z1, 15, walls[i]!));
  const east = [[4, 20], [22, 42], [52, 72], [74, 92]] as const;
  east.forEach(([z0, z1], i) => kura(L, SX1 + 0.5, -1, z0, z1, 15, walls[(i + 3) % walls.length]!));
  bellTower(L, 54, 38);

  // 90 days on: a burnt car in the street, sandbags across it, a relief tent in the lane, a fallen sign.
  L.car(24.5, 66, 'z', { burnt: true });
  L.sandbags(SX0 + 0.5, 30, SX1 - 0.5, 30);
  L.tent(56, 56, 'x', 6);
  L.crates(46, 54, 3);
  L.fallenSign(24.5, 86, 'z');
  L.scorch(SX0 - 0.55, 0.3, 60, SX0 - 0.45, 5, 66);
}
