// L7: 道後温泉本館 (Dōgo Onsen Honkan), Matsuyama, Ehime: the public bathhouse of 1894, an important
// cultural property. A three-storey timber building that steps in as it rises, each storey under its
// own grey tiled skirt roof (瓦), the top under a hip-and-gable roof (入母屋), crowned by the small
// drum tower 振鷺閣 (Shinrokaku) with its red glass windows (ギヤマン) and the white heron on its roof;
// in front, the entrance hall (玄関棟) under a big curved gable (唐破風); the lower east wing (又新殿・
// 霊の湯棟). Dark brown wood, white paper and plaster panels between the posts.
//
// Real size: about 20 m to the heron; the whole about 40 × 35 m (drawn a little smaller). The front
// (local z = d, the entrance) faces west.

import { landmarkDef, type Lm } from '../common.ts';
import { karahafu } from '../chubu/parts.ts';
import { pine } from '../tohoku/parts.ts';

const W = 44;
const D = 40;
/** The main hall (神の湯本館). */
const [X0, Z0, X1, Z1] = [8, 6, 34, 28];
const CX = (X0 + X1) / 2;
const CZ = (Z0 + Z1) / 2;

export const LANDMARK_DOGO_ONSEN_HONKAN = landmarkDef({
  variant: 'dogo_onsen_honkan',
  size: { w: [W, W], d: [D, D] },
  eaves: 11.2,
  top: 20.4,
  roof: 'hip',
  kind: 'house',
  build,
});

/** One storey of the hall: dark wood with a row of pale panels, its skirt roof (none for the top). */
function storey(L: Lm, x0: number, z0: number, x1: number, z1: number, y0: number, h: number, n: number, skirt: boolean): void {
  L.box(x0, y0, z0, x1, y0 + h, z1, 'woodDark');
  const [a, b] = [y0 + h * 0.22, y0 + h * 0.8];
  const nz = Math.max(2, Math.round((n * (z1 - z0)) / (x1 - x0)));
  const o = { paint: 'offWhite' as const, broken: 0.25 };
  L.windows('x', z1, 1, x0 + 1, x1 - 1, n, a, b, ((x1 - x0) / n) * 0.62, o);
  L.windows('x', z0, -1, x0 + 1, x1 - 1, n, a, b, ((x1 - x0) / n) * 0.62, o);
  L.windows('z', x1, 1, z0 + 1, z1 - 1, nz, a, b, ((z1 - z0) / nz) * 0.62, o);
  L.windows('z', x0, -1, z0 + 1, z1 - 1, nz, a, b, ((z1 - z0) / nz) * 0.62, o);
  // A thin rail band across the panels (the galleries' balustrade).
  L.box(x0 - 0.1, y0 + h * 0.3, z1, x1 + 0.1, y0 + h * 0.36, z1 + 0.15, 'paint', { paint: 'brown', solid: false });
  if (!skirt) return;
  const o2 = 1.3;
  L.box(x0 - o2, y0 + h - 0.2, z0 - o2, x1 + o2, y0 + h, z1 + o2, 'paint', { paint: 'charcoal', solid: false });
  L.shape('hip', x0 - o2, y0 + h, z0 - o2, x1 + o2, y0 + h + 1.5, z1 + o2, 'paint', { paint: 'kawara', axis: x1 - x0 >= z1 - z0 ? 'x' : 'z' });
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, D], [0, D]]);

  // The main hall: three storeys stepping in, the hip-and-gable roof.
  storey(L, X0, Z0, X1, Z1, 0, 4.2, 7, true);
  storey(L, X0 + 1.4, Z0 + 1.4, X1 - 1.4, Z1 - 1.4, 4.2, 3.6, 6, true);
  storey(L, X0 + 3.6, Z0 + 3.4, X1 - 3.6, Z1 - 3.4, 7.8, 3.4, 5, false);
  const [rx0, rz0, rx1, rz1] = [X0 + 2.2, Z0 + 2, X1 - 2.2, Z1 - 2];
  L.box(rx0, 11, rz0, rx1, 11.2, rz1, 'paint', { paint: 'charcoal', solid: false });
  L.shape('hip', rx0, 11.2, rz0, rx1, 13.6, rz1, 'paint', { paint: 'kawara', axis: 'x' });
  L.shape('gable', rx0 + 4, 12.8, rz0 + 3.2, rx1 - 4, 15.2, rz1 - 3.2, 'paint', { paint: 'kawara', axis: 'x' });
  for (const s of [-1, 1]) L.shape('gable', s < 0 ? rx0 + 3.95 : rx1 - 4.05, 12.9, rz0 + 3.6, s < 0 ? rx0 + 4.05 : rx1 - 3.95, 15, rz1 - 3.6, 'paint', { paint: 'offWhite', axis: 'z', solid: false });

  // 振鷺閣: the square drum tower on the ridge, its red glass windows on every face, the copper roof
  // and the white heron.
  const [tx, tz, th] = [CX, CZ, 2.1];
  L.box(tx - th, 14.4, tz - th, tx + th, 17.4, tz + th, 'woodDark');
  for (const s of [-1, 1] as const) {
    L.windows('x', tz + s * th, s, tx - th + 0.3, tx + th - 0.3, 3, 15.1, 16.9, 0.9, { paint: 'red' });
    L.windows('z', tx + s * th, s, tz - th + 0.3, tz + th - 0.3, 3, 15.1, 16.9, 0.9, { paint: 'red' });
  }
  L.box(tx - th - 0.6, 17.3, tz - th - 0.6, tx + th + 0.6, 17.5, tz + th + 0.6, 'paint', { paint: 'charcoal', solid: false });
  L.shape('hip', tx - th - 0.6, 17.5, tz - th - 0.6, tx + th + 0.6, 19.1, tz + th + 0.6, 'paint', { paint: 'copper', axis: 'x' });
  L.box(tx - 0.2, 19, tz - 0.55, tx + 0.2, 19.6, tz + 0.55, 'paint', { paint: 'white', solid: false });
  L.box(tx - 0.08, 19.5, tz + 0.3, tx + 0.08, 20.4, tz + 0.5, 'paint', { paint: 'white', solid: false });

  // The entrance hall in front, under its big curved gable; the lanterns either side of its door.
  const [ex0, ex1] = [CX - 5.5, CX + 5.5];
  L.box(ex0, 0, Z1, ex1, 4, Z1 + 6, 'woodDark');
  L.box(CX - 2.4, 0, Z1 + 6, CX + 2.4, 3, Z1 + 6.1, 'paint', { paint: 'black' });
  L.windows('z', ex0, -1, Z1 + 1, Z1 + 5, 2, 1.2, 3.2, 1.4, { paint: 'offWhite', broken: 0.3 });
  L.windows('z', ex1, 1, Z1 + 1, Z1 + 5, 2, 1.2, 3.2, 1.4, { paint: 'offWhite', broken: 0.3 });
  L.shape('gable', ex0 - 1, 4, Z1 - 0.5, ex1 + 1, 6.4, Z1 + 7, 'paint', { paint: 'kawara', axis: 'z' });
  karahafu(L, 'z+', Z1 + 6, CX, 4.6, 3.8, 6.8, 1.2, 'kawara', 'white');
  for (const s of [-1, 1]) L.box(CX + s * 3.4 - 0.35, 0, Z1 + 7, CX + s * 3.4 + 0.35, 2.6, Z1 + 7.7, 'paint', { paint: 'lampGlass', solid: false });

  // The east wing (又新殿・霊の湯棟): two storeys under one hipped roof, at the back of the hall.
  L.box(X1, 0, Z0 + 2, X1 + 8, 7, Z1 - 4, 'woodDark');
  L.windows('z', X1 + 8, 1, Z0 + 3, Z1 - 5, 4, 1, 3.4, 2.2, { paint: 'offWhite', broken: 0.3 });
  L.windows('z', X1 + 8, 1, Z0 + 3, Z1 - 5, 4, 4.4, 6.4, 2.2, { paint: 'offWhite', broken: 0.3 });
  L.shape('hip', X1 - 0.8, 7, Z0 + 1.2, X1 + 9, 9.4, Z1 - 3.2, 'paint', { paint: 'kawara', axis: 'z' });
  // The low south wing (南棟) at the side of the hall.
  L.box(1.5, 0, Z0 + 4, X0, 4, Z1 - 2, 'woodDark');
  L.windows('z', 1.5, -1, Z0 + 5, Z1 - 3, 3, 1, 3.2, 2.2, { paint: 'offWhite', broken: 0.3 });
  L.shape('hip', 0.8, 4, Z0 + 3.2, X0 + 0.6, 5.8, Z1 - 1.2, 'paint', { paint: 'kawara', axis: 'z' });

  pine(L, 3, 36, 7);
  pine(L, 41, 36, 7);

  // 90 days on: the square in front: relief crates and a tent, a fallen sign, a burnt car, scorch.
  L.crates(5, 31, 3);
  L.tent(36, 34, 'x', 5);
  L.fallenSign(14, 37, 'x');
  L.car(29, 38, 'x', { burnt: true });
  L.scorch(X1 + 8.04, 0.4, Z0 + 3, X1 + 8.14, 3.4, Z0 + 8);
}
