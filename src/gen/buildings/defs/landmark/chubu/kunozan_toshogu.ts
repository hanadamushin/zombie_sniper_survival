// L4: 久能山東照宮 (Kunōzan Tōshō-gū, Shizuoka), on the top of Mount Kunō over Suruga Bay, at the head
// of its 1,159 stone steps: the first shrine to Tokugawa Ieyasu (1617). Its main hall (a national
// treasure, 権現造: worship hall and main hall joined by the stone room 石の間) is lacquered black and
// alive with gold, vermilion, green and blue carving under dark copper roofs, the worship hall's front
// porch under a curved gable; before it the vermilion two-storey tower gate (楼門) with its painted
// brackets, the vermilion lattice fence (透塀) round the halls, and the cedars of the hill.
//
// Real size for the halls and the gate; the steps are a last short flight. The founder's tomb behind
// the halls is not drawn. The front (local z = d) faces south, over the bay.

import { landmarkDef, type Lm } from '../common.ts';
import { cedar } from '../tohoku/parts.ts';
import { karahafu, lantern } from './parts.ts';

const W = 56;
const D = 80;
const AX = 28;
const TER = 1.6; // the halls' terrace

export const LANDMARK_KUNOZAN_TOSHOGU = landmarkDef({
  variant: 'kunozan_toshogu',
  size: { w: [W, W], d: [D, D] },
  eaves: 8,
  top: 30,
  kind: 'house',
  build,
});

/** A black-lacquered hall: gold posts, the coloured carving band, a dark copper hip-and-gable roof. */
function hall(L: Lm, x0: number, z0: number, x1: number, z1: number, y: number, wall: number, rise: number): void {
  L.box(x0, y, z0, x1, y + wall, z1, 'paint', { paint: 'black' });
  for (const [px, pz] of [[x0, z0], [x1 - 0.4, z0], [x0, z1 - 0.4], [x1 - 0.4, z1 - 0.4]] as const) L.box(px - 0.05, y, pz - 0.05, px + 0.45, y + wall, pz + 0.45, 'paint', { paint: 'gold' });
  L.windows('x', z1, 1, x0 + 1, x1 - 1, 3, y + 0.6, y + wall - 1.8, 1.6, { paint: 'gold' });
  // The carving band under the eaves: vermilion, green, gold.
  L.box(x0 - 0.15, y + wall - 1.6, z0 - 0.15, x1 + 0.15, y + wall - 1.05, z1 + 0.15, 'paint', { paint: 'red', solid: false });
  L.box(x0 - 0.3, y + wall - 1.05, z0 - 0.3, x1 + 0.3, y + wall - 0.5, z1 + 0.3, 'paint', { paint: 'copper', solid: false });
  L.box(x0 - 0.45, y + wall - 0.5, z0 - 0.45, x1 + 0.45, y + wall, z1 + 0.45, 'paint', { paint: 'gold', solid: false });
  const ax = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  L.shape('hip', x0 - 1.8, y + wall, z0 - 1.8, x1 + 1.8, y + wall + rise * 0.6, z1 + 1.8, 'paint', { paint: 'charcoal', axis: ax });
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const [gx, gz] = ax === 'x' ? [(x1 - x0) * 0.34, (z1 - z0) * 0.22] : [(x1 - x0) * 0.22, (z1 - z0) * 0.34];
  L.shape('gable', cx - gx, y + wall + rise * 0.45, cz - gz, cx + gx, y + wall + rise, cz + gz, 'paint', { paint: 'charcoal', axis: ax });
  for (const s of [-1, 1]) {
    if (ax === 'x') L.shape('gable', cx + s * gx - 0.05, y + wall + rise * 0.5, cz - gz * 0.8, cx + s * gx + 0.05, y + wall + rise - 0.2, cz + gz * 0.8, 'paint', { paint: 'gold', axis: 'z', solid: false });
    else L.shape('gable', cx - gx * 0.8, y + wall + rise * 0.5, cz + s * gz - 0.05, cx + gx * 0.8, y + wall + rise - 0.2, cz + s * gz + 0.05, 'paint', { paint: 'gold', axis: 'x', solid: false });
  }
}

function build(L: Lm): void {
  L.ground('gravel', [[0, 0], [W, 0], [W, D], [0, D]]);
  // The terrace of the halls (stone), its front steps.
  L.box(8, 0, 4, 48, TER, 42, 'paint', { paint: 'stone' });
  for (let k = 0; k < 3; k++) L.box(AX - 4, 0, 42 + k * 0.7, AX + 4, TER - (k + 1) * 0.45, 42.7 + k * 0.7, 'paint', { paint: 'stone' });
  // 権現造: the worship hall (front), the stone room, the main hall (back).
  hall(L, AX - 9, 24, AX + 9, 32, TER, 6.2, 5.6);
  karahafu(L, 'z+', 32, AX, 4, TER + 5.2, TER + 8.2, 2.2, 'charcoal', 'gold');
  for (const x of [AX - 3.6, AX + 3.2]) L.box(x, TER, 32, x + 0.45, TER + 5.4, 34.2, 'paint', { paint: 'gold' });
  hall(L, AX - 3, 18, AX + 3, 24, TER, 5, 3);
  hall(L, AX - 6.5, 8, AX + 6.5, 18, TER, 6.6, 5.8);
  // The vermilion lattice fence round the halls (the open front where the porch is).
  for (const [x0, z0, x1, z1] of [[10, 5, 46, 5.5], [10, 5.5, 10.5, 38], [45.5, 5.5, 46, 38], [10, 37.5, 22, 38], [34, 37.5, 46, 38]] as const) {
    L.box(x0, TER, z0, x1, TER + 2.6, z1, 'paint', { paint: 'red' });
    L.box(x0 - 0.1, TER + 1, z0 - 0.1, x1 + 0.1, TER + 2, z1 + 0.1, 'paint', { paint: 'copper', solid: false });
    L.shape('gable', x0 - 0.3, TER + 2.6, z0 - 0.3, x1 + 0.3, TER + 3.2, z1 + 0.3, 'paint', { paint: 'charcoal', axis: x1 - x0 > z1 - z0 ? 'x' : 'z', solid: false });
  }

  // The tower gate (楼門): vermilion, two storeys, painted brackets, a dark copper hip-and-gable roof.
  const [gz0, gz1] = [56, 62];
  L.box(AX - 6, 0, gz0, AX + 6, 0.6, gz1, 'paint', { paint: 'stone' });
  L.box(AX - 5.6, 0.6, gz0 + 0.5, AX - 2, 5.4, gz1 - 0.5, 'paint', { paint: 'red' });
  L.box(AX + 2, 0.6, gz0 + 0.5, AX + 5.6, 5.4, gz1 - 0.5, 'paint', { paint: 'red' });
  L.box(AX - 2, 0.6, gz0 + 2.9, AX + 2, 4.6, gz0 + 3.1, 'paint', { paint: 'black' }); // its shut doors
  L.box(AX - 5.6, 4.6, gz0 + 0.5, AX + 5.6, 5.4, gz1 - 0.5, 'paint', { paint: 'red' });
  L.box(AX - 6, 5.4, gz0, AX + 6, 6.2, gz1, 'paint', { paint: 'copper', solid: false });
  L.shape('hip', AX - 7.2, 6.2, gz0 - 1.4, AX + 7.2, 7.8, gz1 + 1.4, 'paint', { paint: 'charcoal', axis: 'x' });
  L.box(AX - 4.6, 7.2, gz0 + 0.8, AX + 4.6, 10.4, gz1 - 0.8, 'paint', { paint: 'red' });
  L.box(AX - 1.2, 8, gz1 - 0.84, AX + 1.2, 9.8, gz1 - 0.76, 'paint', { paint: 'gold', solid: false }); // the plaque
  L.box(AX - 5, 10.4, gz0 + 0.4, AX + 5, 11.2, gz1 - 0.4, 'paint', { paint: 'copper', solid: false });
  L.shape('hip', AX - 6.8, 11.2, gz0 - 1, AX + 6.8, 13, gz1 + 1, 'paint', { paint: 'charcoal', axis: 'x' });
  L.shape('gable', AX - 4, 12.4, gz0 + 0.8, AX + 4, 14.6, gz1 - 0.8, 'paint', { paint: 'charcoal', axis: 'x' });
  // The last flight of the stone steps up to the gate, lanterns beside them.
  for (let k = 0; k < 6; k++) L.box(AX - 3.5, 0, 64 + k * 2.4, AX + 3.5, 0.6 + (5 - k) * 0.35, 66.4 + k * 2.4, 'paint', { paint: 'stone' });
  for (const z of [46, 52, 66, 74]) for (const x of [AX - 7, AX + 7]) lantern(L, x, z, 2.4);

  // The cedars of the hill.
  for (const [x, z, h] of [[4, 8, 28], [4, 26, 30], [52, 10, 29], [52, 30, 27], [4, 48, 26], [52, 50, 28], [6, 72, 24], [50, 72, 25]] as const) cedar(L, x, z, h, 3);

  // 90 days on: crates and a fallen sign at the gate (the shrine itself untouched).
  L.crates(AX + 9, 48, 4);
  L.fallenSign(AX - 10, 52, 'z');
}
