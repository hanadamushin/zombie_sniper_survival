// Segment tests against the analytic hit shapes of a body: sphere (head) and capsule (torso, legs).
// A segment is given as origin o, unit direction d and length len; results are distances along d.

type V3 = readonly [number, number, number];

/** First hit of the segment on a sphere, or -1. Starting inside counts as a hit at 0. */
export function segmentSphere(o: V3, d: V3, len: number, cx: number, cy: number, cz: number, r: number): number {
  const ox = o[0] - cx;
  const oy = o[1] - cy;
  const oz = o[2] - cz;
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const c = ox * ox + oy * oy + oz * oz - r * r;
  if (c <= 0) return 0;
  if (b > 0) return -1;
  const h = b * b - c;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t <= len ? t : -1;
}

/** First hit of the segment on a capsule from a to b with radius r, or -1. */
export function segmentCapsule(o: V3, d: V3, len: number, a: V3, b: V3, r: number): number {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const oax = o[0] - a[0];
  const oay = o[1] - a[1];
  const oaz = o[2] - a[2];
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * d[0] + bay * d[1] + baz * d[2];
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d[0] * oax + d[1] * oay + d[2] * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const A = baba - bard * bard;
  if (A > 1e-9) {
    const B = baba * rdoa - baoa * bard;
    const C = baba * oaoa - baoa * baoa - r * r * baba;
    const h = B * B - A * C;
    if (h < 0) return -1; // misses the infinite cylinder, so it misses the caps too
    const t = (-B - Math.sqrt(h)) / A;
    const y = baoa + t * bard;
    if (y > 0 && y < baba) return t >= 0 && t <= len ? t : t < 0 && C <= 0 ? 0 : -1;
  }
  // End caps.
  const ta = segmentSphere(o, d, len, a[0], a[1], a[2], r);
  const tb = segmentSphere(o, d, len, b[0], b[1], b[2], r);
  if (ta < 0) return tb;
  if (tb < 0) return ta;
  return Math.min(ta, tb);
}
