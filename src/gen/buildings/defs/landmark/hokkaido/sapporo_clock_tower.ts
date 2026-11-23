// L1: 札幌市時計台 (Sapporo Clock Tower, the drill hall of the Sapporo Agricultural College, 1878; the
// clock 1881). A two-storey wooden building in white clapboard under a red gable roof, 19.8 m to the
// top of the clock tower that rises from the roof over the front gable: four clock faces, a small
// belfry and its red pyramid roof. A two-storey porch with a balcony on the front gable. The front
// (local z = d) faces the street (北一条通).

import { landmarkDef, type Lm } from '../common.ts';

const W = 16;
const D = 32;

export const LANDMARK_SAPPORO_CLOCK_TOWER = landmarkDef({
  variant: 'sapporo_clock_tower',
  size: { w: [W, W], d: [D, D] },
  eaves: 8,
  top: 19.8,
  roof: 'gable',
  kind: 'house',
  build,
});

function build(L: Lm): void {
  const white = { paint: 'white' as const };
  const red = { paint: 'roofRed' as const };
  const [x0, x1, z0, z1] = [1, 15, 2, 26];
  const eaves = 8;
  L.box(x0 - 0.15, 0, z0 - 0.15, x1 + 0.15, 0.7, z1 + 0.15, 'paint', { paint: 'gray' }); // stone footing
  L.box(x0, 0.7, z0, x1, eaves, z1, 'paint', white);
  // Clapboard: a darker line under each storey's sill, the corner boards.
  for (const y of [1.2, 4.6]) {
    L.box(x0 - 0.05, y, z0 - 0.05, x1 + 0.05, y + 0.12, z1 + 0.05, 'paint', { paint: 'offWhite', solid: false });
  }
  L.box(x0 - 0.3, eaves - 0.35, z0 - 0.3, x1 + 0.3, eaves, z1 + 0.3, 'paint', white); // the cornice
  // The red gable roof (ridge along the depth) and its gable ends' white boards.
  L.shape('gable', x0 - 0.6, eaves, z0 - 0.6, x1 + 0.6, 12.6, z1 + 0.6, 'paint', { ...red, axis: 'z' });
  L.shape('gable', x0 + 0.1, eaves, z1 - 0.05, x1 - 0.1, 12.4, z1 + 0.05, 'paint', { ...white, axis: 'z', solid: false });
  // Tall sash windows: two storeys, both long sides and the front; green shutters beside some.
  for (const [face, at, out, u0, u1, n] of [['z', x0, -1, z0 + 1, z1 - 1, 8], ['z', x1, 1, z0 + 1, z1 - 1, 8], ['x', z1, 1, x0 + 1.5, x1 - 1.5, 3], ['x', z0, -1, x0 + 1.5, x1 - 1.5, 3]] as const) {
    L.windows(face, at, out, u0, u1, n, 1.6, 3.8, 0.95, { broken: 0.3 });
    L.windows(face, at, out, u0, u1, n, 5.0, 7.2, 0.95, { broken: 0.25 });
  }
  // The porch on the front gable: posts, the balcony on it, its rail; the shut double door.
  const pz = z1 + 1.6;
  for (const x of [5.2, 7.2, 8.8, 10.8]) L.box(x - 0.15, 0.7, z1, x + 0.15, 4.2, pz, 'paint', white);
  L.box(4.8, 4.2, z1, 11.2, 4.5, pz, 'paint', white);
  L.box(4.8, 4.5, pz - 0.1, 11.2, 5.5, pz, 'paint', white);
  L.box(4.8, 4.5, z1, 4.9, 5.5, pz, 'paint', white);
  L.box(11.1, 4.5, z1, 11.2, 5.5, pz, 'paint', white);
  L.box(7.2, 0.7, z1, 8.8, 3.3, z1 + 0.1, 'paint', { paint: 'brown' });
  L.box(4.8, 0, z1, 11.2, 0.7, pz + 0.8, 'paint', { paint: 'gray' }); // steps

  // The clock tower over the front gable: its shaft through the roof, four clock faces, the belfry.
  const cx = W / 2;
  const cz = z1 - 3;
  const h = 2.4;
  L.box(cx - h, eaves, cz - h, cx + h, 15.4, cz + h, 'paint', white);
  L.box(cx - h - 0.2, 15.4, cz - h - 0.2, cx + h + 0.2, 15.7, cz + h + 0.2, 'paint', white);
  const face = (nx: number, nz: number): void => {
    const fx = cx + nx * h;
    const fz = cz + nz * h;
    const y = 12.9;
    // Black rim, white dial, two hands (at about ten past ten).
    if (nx !== 0) {
      L.box(fx - 0.05 * nx - 0.1, y - 1.15, fz - 1.15, fx + 0.05 * nx + 0.1, y + 1.15, fz + 1.15, 'paint', { paint: 'black', solid: false });
      L.box(fx + 0.12 * nx - 0.05, y - 0.95, fz - 0.95, fx + 0.12 * nx + 0.05, y + 0.95, fz + 0.95, 'paint', { paint: 'white', solid: false });
      L.box(fx + 0.2 * nx - 0.03, y, fz - 0.07, fx + 0.2 * nx + 0.03, y + 0.75, fz + 0.07, 'paint', { paint: 'black', solid: false });
      L.box(fx + 0.2 * nx - 0.03, y - 0.07, fz - 0.55, fx + 0.2 * nx + 0.03, y + 0.07, fz, 'paint', { paint: 'black', solid: false });
    } else {
      L.box(fx - 1.15, y - 1.15, fz - 0.05 * nz - 0.1, fx + 1.15, y + 1.15, fz + 0.05 * nz + 0.1, 'paint', { paint: 'black', solid: false });
      L.box(fx - 0.95, y - 0.95, fz + 0.12 * nz - 0.05, fx + 0.95, y + 0.95, fz + 0.12 * nz + 0.05, 'paint', { paint: 'white', solid: false });
      L.box(fx - 0.07, y, fz + 0.2 * nz - 0.03, fx + 0.07, y + 0.75, fz + 0.2 * nz + 0.03, 'paint', { paint: 'black', solid: false });
      L.box(fx, y - 0.07, fz + 0.2 * nz - 0.03, fx + 0.55, y + 0.07, fz + 0.2 * nz + 0.03, 'paint', { paint: 'black', solid: false });
    }
  };
  face(0, 1);
  face(0, -1);
  face(1, 0);
  face(-1, 0);
  // The belfry: four corner posts and its rail, the red pyramid roof, the finial.
  const b = 1.6;
  for (const [x, z] of [[cx - b, cz - b], [cx + b - 0.3, cz - b], [cx - b, cz + b - 0.3], [cx + b - 0.3, cz + b - 0.3]] as const) L.box(x, 15.7, z, x + 0.3, 17.6, z + 0.3, 'paint', white);
  L.box(cx - b, 15.7, cz - b, cx + b, 16.5, cz + b, 'paint', { paint: 'white', solid: false });
  L.box(cx - b + 0.4, 16.5, cz - b + 0.4, cx + b - 0.4, 17.4, cz + b - 0.4, 'paint', { paint: 'charcoal', solid: false }); // the bell in the dark
  L.shape('hip', cx - b - 0.3, 17.6, cz - b - 0.3, cx + b + 0.3, 19.3, cz + b + 0.3, 'paint', red);
  L.column(cx, cz, 0.12, 19.3, 19.8, 'paint', { paint: 'black' });

  // 90 days on: a fallen information board and an abandoned car in front.
  L.fallenSign(13.3, 29.5, 'x');
  L.car(3.2, 30.2, 'x');
  L.scorch(x1, 1, 18, x1 + 0.06, 5.5, 23);
}
