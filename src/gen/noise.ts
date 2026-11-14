// Seeded 2D gradient noise (no tables, no state): deterministic for (seed, x, z) on any platform.

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Uniform [0, 1) for an integer lattice point. */
export function hash01(ix: number, iz: number, seed: number): number {
  return hash(ix, iz, seed) / 4294967296;
}

const GX = [1, 0.7071, 0, -0.7071, -1, -0.7071, 0, 0.7071];
const GZ = [0, 0.7071, 1, 0.7071, 0, -0.7071, -1, -0.7071];

function grad(ix: number, iz: number, seed: number, dx: number, dz: number): number {
  const g = hash(ix, iz, seed) & 7;
  return GX[g]! * dx + GZ[g]! * dz;
}

/** Perlin-style noise, roughly in [-1, 1], period-free. */
export function noise2(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = grad(ix, iz, seed, fx, fz);
  const b = grad(ix + 1, iz, seed, fx - 1, fz);
  const c = grad(ix, iz + 1, seed, fx, fz - 1);
  const d = grad(ix + 1, iz + 1, seed, fx - 1, fz - 1);
  return (a + (b - a) * u + (c - a + (a - b + d - c) * u) * v) * 1.5;
}

/** Fractal sum, normalised to about [-1, 1]. */
export function fbm(x: number, z: number, seed: number, octaves: number, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x * f, z * f, seed + o * 1013) * amp;
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/** Ridged fractal in [0, 1]: sharp crests, broad valleys. */
export function ridged(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    const r = 1 - Math.abs(noise2(x * f, z * f, seed + o * 733));
    sum += r * r * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
