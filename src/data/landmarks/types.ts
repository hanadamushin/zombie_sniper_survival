// L1: the landmark table (名所の表) — one file per region (hokkaido.ts ... kyushu.ts), gathered in
// index.ts. A line places one exterior-only landmark (src/gen/buildings/defs/landmark/<region>/) at its
// real place: gen/real/landmarks.ts finds the cell of the point, shrinks it into the cell's area (the
// real 10 km square → 1024 m) and the area generator (gen/real/layout.ts) builds it there as a site:
// the town, the facilities and the minor roads keep out of its footprint. Nothing else to touch
// (docs/realmap_guide.md §7).

export interface LandmarkSpot {
  /** The landmark's building type (`landmark.<variant>`). Its name is the ja.ts text of the same key. */
  id: string;
  /** Real position (WGS84 degrees): the middle of the landmark. */
  lat: number;
  lon: number;
  /** The side its front faces: 0 south, 1 east, 2 north, 3 west (the building type's front is its local z = d side). */
  rot: 0 | 1 | 2 | 3;
  /**
   * When the area has a point of this name (an annotation, or an `addPois` of the region's overrides),
   * the landmark stands there instead of at lat / lon (and no lookout tower is built for that point).
   */
  poi?: string;
  /** How far (m, in the area) the middle may move to find free, dry, level ground (default 48; tried ×2 and ×3 too). */
  reach?: number;
}
