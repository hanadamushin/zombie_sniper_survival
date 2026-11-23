// L3a: 浅草寺 (Sensō-ji), Asakusa — the approach from the 雷門 (Kaminarimon) to the 五重塔 (five-storey
// pagoda). The Kaminarimon (11.7 m high, 11.4 m wide): a vermilion gate under a dark tiled roof,
// the great red paper lantern (3.9 m) hanging in its passage, the wind and thunder gods in the side
// bays behind grilles. Then the 仲見世 (Nakamise), two rows of low shops along the stone-paved
// approach; the 宝蔵門 (Hōzōmon, 22.7 m), a two-storey gate with its own lantern; west of it the
// five-storey pagoda (53.3 m with its bronze finial).
//
// The real approach is 250 m to the Hōzōmon; in the shrunk city the gates are 40 m apart, so the
// Nakamise is short (the buildings are real size). The main hall is left out (beyond the lot). The
// front (local z = d, the Kaminarimon) faces south.

import type { PaintName } from '../../../../../data/render.ts';
import { landmarkDef, type Lm } from '../common.ts';

const W = 56;
const D = 100;
/** The approach's middle (x). */
const PX = 34;
const RED: PaintName = 'red';
const TILE: PaintName = 'charcoal';

export const LANDMARK_SENSOJI = landmarkDef({
  variant: 'sensoji',
  size: { w: [W, W], d: [D, D] },
  eaves: 8,
  top: 53.3,
  kind: 'house',
  build,
});

/** A great paper lantern (提灯): red, black bands top and bottom (it does not stop bullets). */
function lantern(L: Lm, x: number, z: number, y0: number, h: number, r: number): void {
  L.column(x, z, r * 0.8, y0, y0 + h * 0.12, 'paint', { paint: 'black', taper: 1.25, solid: false });
  L.column(x, z, r, y0 + h * 0.12, y0 + h * 0.88, 'paint', { paint: RED, solid: false });
  L.column(x, z, r, y0 + h * 0.88, y0 + h, 'paint', { paint: 'black', taper: 0.8, solid: false });
  L.box(x - r * 0.5, y0 + h * 0.4, z + r - 0.05, x + r * 0.5, y0 + h * 0.6, z + r + 0.02, 'paint', { paint: 'black', solid: false });
}

/** A gate (門) across the approach: posts, side bays, the passage under the lantern, an 入母屋 roof. */
function gate(L: Lm, z0: number, z1: number, half: number, bay: number, h: number, roofRise: number, over: number): void {
  const [x0, x1] = [PX - half, PX + half];
  // Side bays (closed: the guardian statues behind vermilion grilles).
  for (const [a, b] of [[x0, x0 + bay], [x1 - bay, x1]] as const) {
    L.box(a, 0, z0, b, h - 1.2, z1, 'paint', { paint: RED });
    L.box(a + 0.6, 1.2, z1 - 0.02, b - 0.6, h - 2.4, z1 + 0.06, 'paint', { paint: 'black', solid: false });
  }
  // The passage's posts and the beams over it.
  for (const x of [x0 + bay, x1 - bay - 0.7]) for (const z of [z0, z1 - 0.7]) L.box(x, 0, z, x + 0.7, h, z + 0.7, 'paint', { paint: RED });
  L.box(x0, h - 1.2, z0, x1, h, z1, 'paint', { paint: RED });
  L.box(x0 - 0.4, h, z0 - 0.4, x1 + 0.4, h + 0.5, z1 + 0.4, 'paint', { paint: 'brown', solid: false });
  // The roof: a hip and the gable on it (入母屋), dark tiles.
  L.shape('hip', x0 - over, h + 0.4, z0 - over, x1 + over, h + roofRise * 0.6, z1 + over, 'paint', { paint: TILE, axis: 'x' });
  L.shape('gable', x0 + half * 0.3, h + roofRise * 0.4, z0 - over * 0.35, x1 - half * 0.3, h + roofRise, z1 + over * 0.35, 'paint', { paint: TILE, axis: 'x' });
}

function build(L: Lm): void {
  L.ground('paved', [[PX - 5, 0], [PX + 5, 0], [PX + 5, D], [PX - 5, D]]);
  L.ground('gravel', [[0, 0], [PX - 5, 0], [PX - 5, 44], [0, 44]]);

  // 雷門: the gate, the great lantern, the name board above it.
  gate(L, 91, 98, 5.7, 2.2, 7.2, 4.5, 1.9);
  lantern(L, PX, 94.5, 2.6, 3.9, 1.65);
  L.box(PX - 1.6, 5.6, 97.9, PX + 1.6, 6.8, 98.05, 'paint', { paint: 'black', solid: false });

  // 仲見世: two rows of shops (shutters down), tiled roofs, three blocks each side.
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [PX - 14, PX - 5.5] : [PX + 5.5, PX + 14];
    for (const [z0, z1] of [[46, 58], [60, 73], [75, 88]] as const) {
      L.box(x0, 0, z0, x1, 4.2, z1, 'paint', { paint: 'offWhite' });
      L.box(s < 0 ? x1 - 0.05 : x0 - 0.05, 0.2, z0 + 0.5, s < 0 ? x1 + 0.05 : x0 + 0.05, 3, z1 - 0.5, 'paint', { paint: 'silver', solid: false });
      L.shape('gable', x0 - 0.4, 4.2, z0 - 0.3, x1 + 0.4, 6, z1 + 0.3, 'paint', { paint: TILE, axis: 'z' });
      L.box(s < 0 ? x1 - 0.2 : x0 - 0.4, 3.4, z0, s < 0 ? x1 + 0.4 : x0 + 0.2, 3.9, z1, 'paint', { paint: RED, solid: false });
    }
  }

  // 宝蔵門: two storeys (the lower roof a skirt), its lantern.
  const [hz0, hz1] = [30, 39];
  const half = 10.5;
  for (const [a, b] of [[PX - half, PX - half + 6], [PX + half - 6, PX + half]] as const) L.box(a, 0, hz0, b, 8.5, hz1, 'paint', { paint: RED });
  for (const x of [PX - half + 6, PX + half - 6.8]) for (const z of [hz0, hz1 - 0.8]) L.box(x, 0, z, x + 0.8, 8.5, z + 0.8, 'paint', { paint: RED });
  L.box(PX - half, 7.3, hz0, PX + half, 8.5, hz1, 'paint', { paint: RED });
  L.shape('hip', PX - half - 2.2, 8.5, hz0 - 2.2, PX + half + 2.2, 10.8, hz1 + 2.2, 'paint', { paint: TILE, axis: 'x' });
  L.box(PX - half + 1, 10.2, hz0 + 1, PX + half - 1, 15.6, hz1 - 1, 'paint', { paint: RED });
  L.windows('x', hz1 - 1, 1, PX - half + 2, PX + half - 2, 5, 11.6, 14.4, 1.8, { paint: 'charcoal' });
  L.box(PX - half + 0.6, 15.6, hz0 + 0.6, PX + half - 0.6, 16.2, hz1 - 0.6, 'paint', { paint: 'brown', solid: false });
  L.shape('hip', PX - half - 1.8, 16, hz0 - 1.8, PX + half + 1.8, 19.6, hz1 + 1.8, 'paint', { paint: TILE, axis: 'x' });
  L.shape('gable', PX - half + 3, 18.4, hz0 - 0.6, PX + half - 3, 22.7, hz1 + 0.6, 'paint', { paint: TILE, axis: 'x' });
  lantern(L, PX, (hz0 + hz1) / 2, 2.4, 3.6, 1.5);

  // 五重塔: a stone platform, five storeys narrowing upwards, each under a broad dark roof, the finial (相輪).
  const [ox, oz] = [11, 20];
  L.box(ox - 7, 0, oz - 7, ox + 7, 1.6, oz + 7, 'paint', { paint: 'stone' });
  let y = 1.6;
  const tiers = [[5, 6.2], [4.55, 5.4], [4.15, 5.2], [3.75, 5], [3.4, 4.8]] as const;
  tiers.forEach(([hw, h], i) => {
    L.box(ox - hw, y, oz - hw, ox + hw, y + h, oz + hw, 'paint', { paint: RED });
    L.box(ox - hw * 0.45, y + 0.5, oz + hw - 0.02, ox + hw * 0.45, y + h - 0.8, oz + hw + 0.06, 'paint', { paint: 'black', solid: false });
    L.box(ox - hw - 0.1, y + h - 0.9, oz - hw - 0.1, ox + hw + 0.1, y + h, oz + hw + 0.1, 'paint', { paint: 'white', solid: false });
    const over = 3.3 - i * 0.12;
    const rise = i === 4 ? 2.6 : 2;
    L.box(ox - hw - over, y + h, oz - hw - over, ox + hw + over, y + h + 0.35, oz + hw + over, 'paint', { paint: TILE, solid: false });
    L.shape('hip', ox - hw - over, y + h + 0.35, oz - hw - over, ox + hw + over, y + h + 0.35 + rise, oz + hw + over, 'paint', { paint: TILE, axis: 'x' });
    y += h + (i === 4 ? 0.35 + rise : 1.6);
  });
  // The finial: the pole, nine rings, the water flame and the jewel (gold-bronze).
  L.column(ox, oz, 0.55, y - 0.4, 53, 'paint', { paint: 'bronze' });
  L.box(ox - 1.4, y - 0.4, oz - 1.4, ox + 1.4, y + 1, oz + 1.4, 'paint', { paint: 'bronze' });
  for (let i = 0; i < 9; i++) L.column(ox, oz, 1.25 - i * 0.04, y + 2.2 + i * 1.25, y + 2.6 + i * 1.25, 'paint', { paint: 'gold', solid: false });
  L.column(ox, oz, 1, 50.2, 52.4, 'paint', { paint: 'gold', taper: 0.5, solid: false });
  L.column(ox, oz, 0.4, 52.4, 53.3, 'paint', { paint: 'gold', taper: 0.2, solid: false });

  // The great incense burner (常香炉) before where the main hall stands.
  L.column(PX, 14, 2, 0, 1.4, 'paint', { paint: 'bronze' });
  L.column(PX, 14, 1.4, 1.4, 3, 'paint', { paint: 'bronze', taper: 0.6 });

  // 90 days on: shutters down, a line of sandbags across the approach, a relief tent by the Hōzōmon.
  L.sandbags(PX - 4.5, 44, PX + 4.5, 44);
  L.tent(48, 20, 'z', 7);
  L.crates(46, 30, 4);
  L.fallenSign(PX + 3, 86, 'z');
  L.scorch(PX + 5.45, 0.3, 61, PX + 5.55, 3.4, 67);
}
