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
  },
  /** Generating one blueprint must stay below this (ms, Node) — tests. */
  generateMs: 4,
} as const;
