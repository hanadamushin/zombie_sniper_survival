// Web-Mercator tile math (the GSI tiles use the standard XYZ scheme).

export function lonToX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}
export function latToY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}
export function xToLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}
export function yToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}
/** Tiles [x, y] covering a lon/lat box at zoom z. */
export function tilesFor(lon0: number, lat0: number, lon1: number, lat1: number, z: number): [number, number][] {
  const x0 = Math.floor(lonToX(lon0, z));
  const x1 = Math.floor(lonToX(lon1, z) - 1e-9);
  const y0 = Math.floor(latToY(lat1, z));
  const y1 = Math.floor(latToY(lat0, z) - 1e-9);
  const out: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}
