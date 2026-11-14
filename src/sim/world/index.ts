// World layer: infection, supply, outposts, travel, expeditions (owner: 02, later 05/06).
// day(): once per GAME DAY (infection step, supply). hour(): once per GAME HOUR (expedition
// resolution, travel progress).
import type { System } from '../system.ts';

export const worldSystem: System = {
  id: 'world',
  commands: {
    // travel
  },
  hour(_state, _ctx) {
    // expeditions, travel
  },
  day(_state, _ctx) {
    // infection simulation step, outpost supply
  },
};
