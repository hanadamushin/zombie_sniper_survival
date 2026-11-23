// L3a: 日本武道館 (Nippon Budōkan, 1964, Yamada Mamoru), in Kitanomaru Park. An octagonal hall, 42 m
// high, its great roof modelled on the 夢殿 (Yumedono) of Hōryū-ji: a broad octagonal skirt of grey-
// green metal, a short drum, the upper roof, and on the top the golden 擬宝珠 (an onion-shaped finial).
// Under the skirt the light walls stand on a wide plinth with steps and the entrances.
//
// The octagon: walls as rings of eight boxes, each roof as eight ramps per step of its profile (each
// ramp as wide as its face at the step's outer edge, so the eaves are exact and the hips show only
// small steps).
// The front (local z = d) faces south (the Tayasu gate side).

import { landmarkDef, type Lm } from '../common.ts';
import { polyRing } from './parts.ts';

const W = 112;
const C = W / 2;
const SIDE = Math.tan(Math.PI / 8); // half a side of an octagon per unit of its apothem

export const LANDMARK_NIPPON_BUDOKAN = landmarkDef({
  variant: 'nippon_budokan',
  size: { w: [W, W], d: [W, W] },
  eaves: 17,
  top: 42,
  kind: 'office',
  build,
});

/**
 * An octagonal roof face by face, along a profile of (apothem, height) points from the eaves inwards
 * (a sweep: gentle at the eaves, steeper above): one ramp per face and step, each as wide as its face
 * at the step's outer edge.
 */
function octRoof(L: Lm, profile: readonly (readonly [number, number])[], paint: 'grayGreen'): void {
  for (let b = 1; b < profile.length; b++) {
    const [ro, yo] = profile[b - 1]!;
    const [ri, yi] = profile[b]!;
    const rc = (ro + ri) / 2;
    const half = ro * SIDE;
    const dr = (ro - ri) / 2;
    for (let k = 0; k < 8; k++) {
      const th = (k * Math.PI) / 4;
      const [px, pz] = [C + Math.cos(th) * rc, C + Math.sin(th) * rc];
      // The four square faces unturned (the ramp rises to the middle); the diagonal ones turned by
      // 45° with their local x along the face's normal, one way or the other.
      if (k % 2 === 0) {
        const alongX = k % 4 === 0;
        const slope = (['x-', 'z-', 'x+', 'z+'] as const)[k / 2]!;
        const [hx, hz] = alongX ? [dr, half] : [half, dr];
        L.shape('wedge', px - hx, yo, pz - hz, px + hx, yi, pz + hz, 'paint', { paint, slope });
      } else {
        const yaw = k === 1 || k === 5 ? -Math.PI / 4 : Math.PI / 4;
        const slope = k === 1 || k === 7 ? 'x-' : 'x+';
        L.shape('wedge', px - dr, yo, pz - half, px + dr, yi, pz + half, 'paint', { paint, slope, yaw });
      }
    }
  }
}

function build(L: Lm): void {
  L.ground('paved', [[0, 0], [W, 0], [W, W], [0, W]]);

  // The plinth (a wide low octagon), the walls, the entrance doors on the four main faces.
  polyRing(L, C, C, 46, 0, 4.5, 4, 8, 'gray');
  polyRing(L, C, C, 40.5, 0, 4.5, 7, 8, 'gray');
  polyRing(L, C, C, 40, 4.5, 17, 1.6, 8, 'offWhite');
  polyRing(L, C, C, 40.9, 11.5, 13, 0.3, 8, 'windowDark', false);
  for (let k = 0; k < 4; k++) {
    const th = (k * Math.PI) / 2;
    const [x, z] = [C + Math.cos(th) * 48.2, C + Math.sin(th) * 48.2];
    const [hx, hz] = k % 2 === 0 ? [0.1, 5] : [5, 0.1];
    L.box(x - hx, 0, z - hz, x + hx, 4, z + hz, 'paint', { paint: 'windowDark' });
  }

  // The great roof: the skirt over the walls, a thin fascia at the eaves, the drum, the upper roof.
  polyRing(L, C, C, 48, 16.2, 17.2, 0.8, 8, 'grayGreen', false);
  octRoof(L, [[48.3, 17], [41, 19.4], [33, 24], [23, 30.4]], 'grayGreen');
  polyRing(L, C, C, 21, 30, 33.4, 1, 8, 'offWhite');
  polyRing(L, C, C, 24.6, 32.8, 33.6, 0.6, 8, 'grayGreen', false);
  octRoof(L, [[24.9, 33.4], [17, 35.6], [9, 38.2], [2.5, 39.4]], 'grayGreen');

  // The golden finial (擬宝珠) on its stem.
  L.column(C, C, 1.8, 39, 39.7, 'paint', { paint: 'gold' });
  L.column(C, C, 2.1, 39.7, 40.8, 'paint', { paint: 'gold', taper: 1.15 });
  L.column(C, C, 2.4, 40.8, 41.7, 'paint', { paint: 'gold', taper: 0.25 });
  L.column(C, C, 0.25, 41.7, 42, 'paint', { paint: 'gold', taper: 0.3 });

  // 90 days on: a relief station on the forecourt (tents, crates), a burnt-out bus shelter's sign, sandbags.
  L.tent(14, 98, 'x', 8);
  L.tent(98, 98, 'x', 8);
  L.crates(24, 106, 5);
  L.sandbags(C - 8, 108, C + 8, 108);
  L.car(104, 80, 'z', { burnt: true });
  L.fallenSign(10, 80, 'z');
}
