// R0: numbers of the real-map pipeline (docs/02_systems_spec.md §2.6). The build tools
// (tools/real/) and the area generator (gen/real.ts) both read them.

export const REAL_GRID = {
  /** Elevation samples per cell edge for land share and elevation statistics (500 m apart). */
  elevSamples: 20,
  /** Share of a cell that must be land (elevation data present), or less when it is populated. */
  landMin: 0.35,
  landMinPopulated: 0.12,
  populated: 3000,
  /** Density thresholds, persons per km² of land (02 §2.1). */
  density: { urban: 2000, suburb: 300, rural: 20 },
  /** Sparse cells are mountains (impassable on the strategic map) when high or rugged (m). */
  mountain: { mean: 850, meanRugged: 600, std: 260, p90: 1450 },
  /** Daily passengers at or above which a station is a town / city / prefectural capital / designated-city station. */
  stationPax: [300, 3000, 15000, 100000] as const,
  /**
   * R9: temporary stations (臨時駅: open a few days or one season a year). S12 gives their passengers
   * per operating day, so they outranked the real station of the cell (津島ノ宮 over 詫間). Never the
   * representative station of a cell.
   */
  temporaryStations: ['津島ノ宮', '田井ノ浜', '偕楽園', '鹿島サッカースタジアム', 'ガーラ湯沢', '原生花園'] as readonly string[],
  /** Runway length (m) for a medium / large airport. */
  airportRunway: [1800, 2800] as const,
  /** Residents per police station / fire station (estimate until a region build counts them). */
  facilityPerPop: { police: 45000, fire: 40000 },
  /** Hub table names whose airport has another official name in C28. */
  airportNames: {
    羽田空港: '東京国際空港',
    成田空港: '成田国際空港',
    関西空港: '関西国際空港',
    伊丹空港: '大阪国際空港',
    中部空港: '中部国際空港',
    北九州空港: '北九州空港',
    高知空港: '高知空港',
    女満別空港: '女満別空港',
    徳島空港: '徳島飛行場',
    小松空港: '小松飛行場',
    米子空港: '美保飛行場',
  } as Record<string, string>,
} as const;

/** R0: operation areas made from the real data of a cell (gen/real/*). */
export const REAL_AREA = {
  /** Build-time choices (tools/real/region.ts). */
  build: {
    /** Elevation tile zoom (DEM10B; 12 = about 32 m pixels, the area samples every 78 m of the real ground). */
    demZoom: 12,
    /** Real road widths (m): drawn at true size although positions are shrunk 1/10. */
    width: { motorway: 20, national: 11, prefectural: 8, wide: 15, local: 6, rail: 5, railDouble: 8 },
    /** Local (5.5–13 m) roads are kept only in cells with fewer residents per km² than this (towns draw their own streets). */
    denseLocalRoads: 300,
    /** Douglas–Peucker tolerance (game m) and the shortest line kept that does not reach the edge. */
    simplify: 1.2,
    minLine: 25,
    /** A zoom-14 tile's annotations are read when 8 × 8 land-use samples of it hold this many building-land / "other" samples. */
    labelTileTown: 3,
    labelTileOther: 6,
  },
  /**
   * Height compression: knots [real elevation (m), game metres per real metre]. Horizontal distances
   * shrink about 1/10; heights shrink 1/4 near the sea and 1/12 in high mountains, so that hills stay
   * hills and mountain sides stay walkable (measured in tests/realmap.test.ts). `detail`: amplitude of
   * a little world-position noise (the data have 78 m between samples).
   */
  height: {
    knots: [[0, 0.22], [60, 0.18], [250, 0.13], [700, 0.095], [1500, 0.075]] as [number, number][],
    detail: 0.25,
  },
  /** Game height of the sea bed (the sea surface is 0) and of rivers: depth carved, surface below the banks. */
  seaBed: -3.5,
  riverDepth: 1.6,
  riverSurface: 0.6,
  /** A road over water stands this far above the water (an embankment; R0 has no bridge decks). */
  causeway: 0.9,
  /** Towards a neighbour without real data the terrain fades into the random world over this band (m). */
  seamBand: 120,
  /** Town lattice (world-aligned) and what fills it. */
  town: {
    block: 84,
    /** Town streets end this far from the map edge (m). */
    edgeClear: 16,
    offset: 20,
    street: 6,
    streetWide: 9,
    /** A block is filled when this share of its lattice points is built-up or open ground, and blockMinTown is building land. */
    blockMinShare: 0.5,
    blockMinTown: 0.2,
    /** Grades: durable-building share / persons per km² (real) for high-rise, mid-rise, dense low-rise. */
    highDurable: 0.45,
    highPop: 6000,
    midDurable: 0.22,
    midPop: 8000,
    densePop: 2500,
    highFloors: [8, 22] as [number, number],
    midFloors: [3, 8] as [number, number],
    lotMax: 32,
    lotMin: 13,
    lotMinDense: 11,
    lotMaxDense: 14,
    /** Gap filling between the real roads: scan step (m) and the share of candidates skipped. */
    gapStep: 9,
    /** Smallest gap between houses (m). */
    gapHouse: 2.5,
    gapSkip: 0.1,
    openShare: 0.1,
    apartmentShare: 0.12,
    climbable: 6,
    /** 07d-3: a roof is a firing position (up to `climbable` of them) from this eaves height (m). */
    roofMinEaves: 15,
    /** ... and it must see this far (m) over the building boxes on one side (the sight-line rule of R1). */
    roofSight: 300,
  },
  /**
   * Trees per hectare of land-use forest (a fully wooded real area then has about as many trees as
   * the densest random forest map; measured against the overhead view budget of e2e/build.spec.ts).
   */
  forestTreesPerHa: 80,
  /** Field plots on the land-use lattice: largest side and smallest side (m). */
  fields: { max: 72, min: 10 },
  /** Facilities R0 builds as boxes at their real place: footprint (m), height range, kind, school yard depth. */
  facilityMaxSlope: 3,
  facilities: {
    station: { w: 28, d: 12, h: [6, 8] as [number, number], kind: 'shop', yard: 0 },
    stationBig: { w: 60, d: 22, h: [12, 16] as [number, number], kind: 'office', yard: 0 },
    prefOffice: { w: 44, d: 26, h: [30, 40] as [number, number], kind: 'office', yard: 0 },
    cityHall: { w: 36, d: 22, h: [18, 26] as [number, number], kind: 'office', yard: 0 },
    townHall: { w: 26, d: 16, h: [8, 11] as [number, number], kind: 'office', yard: 0 },
    hospital: { w: 30, d: 18, h: [12, 15] as [number, number], kind: 'apartment', yard: 0 },
    hospitalBig: { w: 48, d: 24, h: [18, 27] as [number, number], kind: 'apartment', yard: 0 },
    university: { w: 50, d: 18, h: [12, 16] as [number, number], kind: 'office', yard: 30 },
    school: { w: 44, d: 12, h: [9, 12] as [number, number], kind: 'apartment', yard: 28 },
    small: { w: 14, d: 12, h: [6, 8] as [number, number], kind: 'office', yard: 0 },
  } satisfies Record<string, { w: number; d: number; h: [number, number]; kind: 'shop' | 'office' | 'apartment'; yard: number }>,
} as const;

/**
 * R1..R8: landmark buildings (src/gen/buildings/defs/landmark/<region>/) placed by gen/real/layout.ts
 * at the real point whose name is the key (an annotation or an `addPois` of the region's overrides;
 * centred on the point, front to the south). One line per landmark, each region its own lines.
 */
export const REAL_LANDMARKS: Record<string, string> = {
  // hokkaido (R1)
  さっぽろテレビ塔: 'landmark.sapporo_tv_tower',
  五稜郭タワー: 'landmark.goryokaku_tower',
};

/** R0: thresholds of the automatic inspection of real areas (tools/real/check.ts, tests/realmap.test.ts). */
export const REAL_CHECK = {
  /** Share of the dry land that is walkable (nav tiles). */
  walkable: 0.6,
  /** Elevated firing positions (03/07b: three or more), unless the area is mostly sea. */
  vantages: 3,
  /** Shared edge with a real neighbour: height difference (m), water samples that differ, road ends without a partner. */
  seamHeight: 0.01,
  seamWater: 0,
  seamRoads: 0,
  overlaps: 0,
  /** Largest area file (bytes, gzip) and generation time (ms, Node). */
  maxBytes: 80_000,
  maxMs: 900,
} as const;
