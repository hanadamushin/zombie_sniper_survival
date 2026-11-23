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
  /**
   * L2: the largest rise (m) of the ground under the lot (default: 6 m for a lot under 100 m, 14 m
   * for a bigger one). More for a temple on a mountainside: the lot is levelled into a terrace.
   */
  level?: number;
  /**
   * L2: the share (0..1) of the lot that may be water in the area data — a castle standing over the
   * remains of its own moat (the water under the lot is filled; the blueprint digs its own moat).
   * Default 0. Sea and rivers in the share are filled as well, so keep it small.
   */
  drain?: number;
  /**
   * L3a: the lot may cut every road — expressways and national roads too (they stop at its fence, like
   * the minor roads). For the heart of a great city, where an expressway or a national road runs every
   * 60–120 m of the shrunk area and no lot of a big landmark fits between them (central Tokyo). The
   * expressways are avenues on the ground in an area (no decks). Railways are never cut. Default false.
   */
  cutRoads?: boolean;
}
