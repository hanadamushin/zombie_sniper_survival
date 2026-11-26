// Enterable buildings (07d): real-scale dimensions every blueprint is drawn to, and the triangle
// budget per category. Read by src/gen/buildings/kit.ts and by the tests; docs/buildings_guide.md
// explains them to the people adding building types.

export const ARCH = {
  /** Storey height floor-to-floor (m): wooden houses, concrete blocks. */
  storey: { house: 2.85, concrete: 3.3, shop: 3.6 },
  /** Thickness of floor / ceiling slabs (m). */
  slab: 0.2,
  /** How far the outer walls and the ground slab reach below the ground level (hides gaps on slopes; matches the collision envelope). */
  foundation: 3,
  /** Wall thickness (m). */
  wall: { exterior: 0.2, concrete: 0.25, partition: 0.12 },
  /** Doors: clear width and height (m). People are 0.35 m in radius, walkers 0.32, brutes 0.5 (they do not fit through 0.9 m). */
  door: { width: 0.9, height: 2.0, wide: 1.8, leaf: 0.05 },
  /** Windows: default sill and head above the floor (m), glass thickness. */
  window: { sill: 0.9, head: 2.0, pane: 0.03 },
  /** Corridors at least this wide (m). */
  corridor: 1.2,
  /** Stairs: largest rise per step (the walkers' step-up is 0.5 m), going per step, flight width, tread slab thickness, landing depth (m). */
  stair: { maxRise: 0.2, going: 0.25, width: 0.9, wideWidth: 1.2, tread: 0.3, landing: 1.3 },
  /** Railings and parapets (m). */
  rail: { height: 1.0, thick: 0.06, parapet: 1.1 },
  /** Roof overhang past the walls (m) and the furthest a part may stick out of the footprint. */
  overhang: 0.45,
  maxOverhang: 0.6,
  /** Stacked boxes that stand in for a sloped roof in the collision (inscribed in the slope). */
  roofSlices: 3,
  /** Nav: how far from a door's centre the waypoints on each side lie (m). */
  doorReach: 0.55,
  /** Clearance a zombie needs on top of its diameter to use a door (m). */
  doorSlack: 0.08,
  /**
   * Triangle limits per building (docs/buildings_guide.md): `shell` = the outside (walls, windows,
   * doors, roof); `interior` = per storey (floors, partitions, stairs, furniture).
   */
  limits: {
    house: { shell: 1500, interior: 4000 },
    apartment: { shell: 3000, interior: 3000 },
    shop: { shell: 2000, interior: 4000 },
    office: { shell: 3000, interior: 3000 },
    public: { shell: 4000, interior: 4000 },
    transport: { shell: 4000, interior: 4000 },
    military: { shell: 3000, interior: 3000 },
    base: { shell: 1500, interior: 3000 },
    /** R0: landmarks of the regions (castles, towers...): as the tallest office tower (25+ storeys). */
    landmark: { shell: 6000, interior: 3000 },
  },
  /** Generating one blueprint must stay below this (ms, Node) — tests. */
  generateMs: 4,
} as const;

/**
 * 09b: steps up to the outside doors of buildings on sloping ground (src/gen/doorsteps.ts). A building's
 * ground level is the highest ground under it; where the way in meets a drop of more than `over`
 * (the walkers' step-up is 0.5 m) a landing and a flight are added.
 */
export const DOORSTEPS = {
  /** A drop on the way in higher than this gets steps (m; a little under the step-up). */
  over: 0.45,
  /** Rise and going of a step, and the most the last step down to the ground may be (m). */
  rise: 0.25,
  going: 0.3,
  last: 0.3,
  /** Going of the top step of a flight straight out of a door; the flight is at least `minWidth` wide, `widen` wider than the door (m). */
  topGoing: 0.6,
  minWidth: 1.4,
  /** The narrowest flight (where nothing wider fits). */
  narrow: 0.8,
  widen: 0.5,
  /** A flight along the wall (when something stands in the way straight out): how far it and its landing stand out (m). */
  sideWidth: 1.0,
  /** Clear ground kept at the foot (m; a walker is 0.7 m across). */
  foot: 0.8,
  /** Where that does not fit (a small walled yard): a steeper flight with less room at the foot (m). */
  tightGoing: 0.2,
  tightFoot: 0.45,
  tightSide: 0.72,
  /** The last resort where even that does not fit: steps as steep as a ship's ladder (m; a walker moves less than this per step of the simulation). */
  steepGoing: 0.12,
  /** Steps per flight at most (a drop of maxSteps × rise). */
  maxSteps: 64,
  /** How far past the footprint the way out is looked at, and how far inside it from the door (a porch, a small yard) (m). */
  probe: 1.2,
  yard: 4,
  /** A lot counts as level (nothing to do) when its lowest ground is this much closer to the floor than `over` (m; the ground is sampled every 2 m). */
  levelMargin: 0.1,
  /** Ground this far above a building's ground level at one of its doors (earthworks laid later): the building is seated again (m). */
  buried: 0.3,
  /** Half the side of the square in front of a door that the flights of the other doors keep clear of (m). */
  front: 0.55,
  /** Only doors whose floor is at most this high above the building's ground level (the ground storey). */
  maxFloor: 2,
  /** The boxes reach this far under the lowest ground below them, and are at least `thick` high (m). */
  sunk: 0.3,
  thick: 0.7,
} as const;
