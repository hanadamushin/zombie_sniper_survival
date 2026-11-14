// Building & defense: blueprints, construction, durability, moats, hordes (owner: 06).
// step(): EVERY fixed step — keep it cheap; bump state.build.gridRev instead of recomputing
// flow fields inline. Heavy work belongs in minute()/hour() boundaries.
import type { System } from '../system.ts';

export const buildSystem: System = {
  id: 'build',
  commands: {
    // placeBlueprint, cancelStructure, foundOutpost
  },
  step(_state, _ctx) {
    // structure damage from attacking zombies, moat fill, gate state
  },
  hour(_state, _ctx) {
    // horde meter / warning / arrival checks
  },
};
