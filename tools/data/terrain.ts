// Hand-made terrain correction table for tools/build-grid.ts (no elevation data is downloaded).
// Pseudo-elevation = max(ridges, inland base) flattened around cities, plus noise.

/** A mountain range: polyline of [lat, lon], crest height (m) and half-width (km). */
export interface Ridge {
  name: string;
  h: number;
  w: number;
  pts: [number, number][];
}

export const RIDGES: Ridge[] = [
  // Hokkaido
  { name: 'Hidaka', h: 1700, w: 12, pts: [[43.0, 142.8], [42.6, 142.9], [42.2, 143.1]] },
  { name: 'Daisetsu-Ishikari', h: 1900, w: 20, pts: [[43.7, 142.9], [43.4, 143.1], [43.3, 142.7]] },
  { name: 'Kitami', h: 1000, w: 15, pts: [[44.4, 142.9], [43.9, 143.2]] },
  { name: 'Teshio', h: 900, w: 10, pts: [[44.7, 142.2], [44.0, 142.1]] },
  { name: 'Yubari', h: 1300, w: 9, pts: [[43.3, 142.25], [42.9, 142.2]] },
  { name: 'Shiretoko', h: 1300, w: 7, pts: [[44.2, 145.25], [43.9, 144.9]] },
  { name: 'Akan', h: 1100, w: 12, pts: [[43.6, 144.3], [43.4, 144.0]] },
  { name: 'Niseko-Yotei', h: 1200, w: 10, pts: [[42.95, 140.95], [42.85, 140.65]] },
  { name: 'Oshima', h: 900, w: 10, pts: [[42.5, 140.1], [41.7, 140.2]] },
  { name: 'Mashike', h: 1100, w: 10, pts: [[43.75, 141.5], [43.55, 141.45]] },
  // Tohoku
  { name: 'Shirakami', h: 1100, w: 12, pts: [[40.5, 140.1], [40.45, 140.3]] },
  { name: 'Ou', h: 1400, w: 11, pts: [[40.65, 140.88], [39.85, 140.9], [39.0, 140.8], [38.15, 140.45], [37.72, 140.22], [37.2, 139.98]] },
  { name: 'Dewa', h: 1400, w: 10, pts: [[40.0, 140.4], [39.1, 140.05], [38.55, 140.0], [38.0, 139.85], [37.85, 139.7]] },
  { name: 'Kitakami', h: 950, w: 16, pts: [[40.0, 141.6], [39.2, 141.5]] },
  { name: 'Abukuma', h: 750, w: 12, pts: [[37.5, 140.7], [36.9, 140.6]] },
  // Kanto / Chubu
  { name: 'Echigo-Mikuni', h: 1800, w: 13, pts: [[37.4, 139.4], [37.1, 139.25], [36.85, 138.9], [36.75, 138.65]] },
  { name: 'Nikko-Oze', h: 2100, w: 12, pts: [[36.95, 139.25], [36.8, 139.5]] },
  { name: 'Kanto-sanchi', h: 1900, w: 14, pts: [[36.1, 138.75], [35.85, 138.9], [35.7, 139.0]] },
  { name: 'Tanzawa', h: 1500, w: 7, pts: [[35.47, 139.16], [35.45, 139.0]] },
  { name: 'Hida (N. Alps)', h: 2900, w: 12, pts: [[36.9, 137.7], [36.55, 137.65], [36.3, 137.65], [36.1, 137.55], [35.9, 137.48]] },
  { name: 'Kiso (C. Alps)', h: 2700, w: 7, pts: [[35.85, 137.82], [35.55, 137.8]] },
  { name: 'Akaishi (S. Alps)', h: 3000, w: 12, pts: [[35.8, 138.25], [35.45, 138.15], [35.15, 138.05]] },
  { name: 'Yatsugatake', h: 2500, w: 7, pts: [[36.05, 138.37], [35.95, 138.37]] },
  { name: 'Fuji', h: 3000, w: 7, pts: [[35.36, 138.73], [35.36, 138.74]] },
  { name: 'Asama-Shiga', h: 2100, w: 9, pts: [[36.4, 138.52], [36.7, 138.5]] },
  { name: 'Myoko-Togakushi', h: 2100, w: 10, pts: [[36.9, 138.1], [36.75, 138.0]] },
  { name: 'Hakusan-Ryohaku', h: 2400, w: 13, pts: [[36.3, 136.8], [36.1, 136.77], [35.8, 136.6]] },
  { name: 'Mino-Hida', h: 1500, w: 14, pts: [[36.0, 137.1], [35.75, 137.15]] },
  { name: 'Ibuki-Suzuka', h: 1200, w: 7, pts: [[35.45, 136.4], [35.2, 136.42], [34.9, 136.4]] },
  // Kinki / Chugoku / Shikoku
  { name: 'Kii', h: 1800, w: 20, pts: [[34.25, 135.95], [34.0, 135.85], [33.85, 135.75]] },
  { name: 'Tamba', h: 800, w: 14, pts: [[35.3, 135.6], [35.15, 135.35]] },
  { name: 'Chugoku', h: 1200, w: 12, pts: [[35.35, 134.5], [35.3, 133.9], [35.2, 133.4], [35.05, 132.9], [34.7, 132.2], [34.45, 131.95]] },
  { name: 'Daisen', h: 1700, w: 7, pts: [[35.37, 133.55], [35.37, 133.56]] },
  { name: 'Shikoku', h: 1900, w: 14, pts: [[33.9, 134.1], [33.78, 133.6], [33.77, 133.12], [33.5, 132.9]] },
  // Kyushu
  { name: 'Aso-Kuju', h: 1600, w: 9, pts: [[33.08, 131.25], [32.88, 131.1]] },
  { name: 'Kyushu-sanchi', h: 1600, w: 16, pts: [[32.65, 131.1], [32.35, 131.0], [32.1, 130.95]] },
  { name: 'Kirishima', h: 1600, w: 7, pts: [[31.93, 130.86], [31.92, 130.9]] },
  { name: 'Sefuri', h: 1000, w: 6, pts: [[33.44, 130.37], [33.42, 130.2]] },
  { name: 'Yakushima', h: 1900, w: 6, pts: [[30.34, 130.5], [30.34, 130.51]] },
];

/** Inland water that Natural Earth leaves as land: ellipses [lat, lon, radiusNS km, radiusEW km]. */
export const LAKES: [number, number, number, number][] = [
  [35.33, 136.12, 17, 9], // Lake Biwa (north basin)
  [35.12, 135.94, 7, 4], // Lake Biwa (south basin)
];
