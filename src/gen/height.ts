// Height sampling shared by generation, collision and rendering. The interpolation matches the
// render mesh exactly: each 4 m quad is split along the diagonal from (ix, iz + 1) to (ix + 1, iz).

/** Height of a sampled grid at (x, z); coordinates are clamped to the grid. */
export function sampleHeight(height: Float32Array, n: number, tile: number, x: number, z: number): number {
  const max = n - 1;
  let gx = x / tile;
  let gz = z / tile;
  if (gx < 0) gx = 0;
  else if (gx > max) gx = max;
  if (gz < 0) gz = 0;
  else if (gz > max) gz = max;
  let ix = Math.floor(gx);
  let iz = Math.floor(gz);
  if (ix >= max) ix = max - 1;
  if (iz >= max) iz = max - 1;
  const fx = gx - ix;
  const fz = gz - iz;
  const i = iz * n + ix;
  const h10 = height[i + 1]!;
  const h01 = height[i + n]!;
  if (fx + fz <= 1) {
    const h00 = height[i]!;
    return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  }
  const h11 = height[i + n + 1]!;
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

/** Gradient (dh/dx, dh/dz) of the triangle under (x, z). Writes into `out`. */
export function sampleGradient(height: Float32Array, n: number, tile: number, x: number, z: number, out: [number, number]): [number, number] {
  const max = n - 1;
  const gx = Math.min(max, Math.max(0, x / tile));
  const gz = Math.min(max, Math.max(0, z / tile));
  const ix = Math.min(max - 1, Math.floor(gx));
  const iz = Math.min(max - 1, Math.floor(gz));
  const i = iz * n + ix;
  const h10 = height[i + 1]!;
  const h01 = height[i + n]!;
  if (gx - ix + (gz - iz) <= 1) {
    const h00 = height[i]!;
    out[0] = (h10 - h00) / tile;
    out[1] = (h01 - h00) / tile;
  } else {
    const h11 = height[i + n + 1]!;
    out[0] = (h11 - h01) / tile;
    out[1] = (h11 - h10) / tile;
  }
  return out;
}
