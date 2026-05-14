import { createMachine, assign } from 'xstate';
import { PLAYER_DASH_MS, PLAYER_INVULN_MS, PLAYER_FLASK_MS } from '../constants.js';

export const playerMachine = createMachine({
  id: 'player',
  initial: 'alive',
  context: {
    invincible: false,
    dashing: false,
    healing: false,
  },
  states: {
    alive: {
      initial: 'idle',
      states: {
        idle: {
          entry: assign({ invincible: false, dashing: false, healing: false }),
          on: {
            DASH:  { target: 'dashing' },
            HEAL:  { target: 'healing' },
            HIT:   { target: 'hitStun' },
          },
        },
        dashing: {
          entry: assign({ dashing: true, invincible: true }),
          after: { [PLAYER_DASH_MS]: { target: 'idle' } },
        },
        healing: {
          entry: assign({ healing: true }),
          after: { [PLAYER_FLASK_MS]: { target: 'idle' } },
          on: {
            HIT: { target: 'hitStun' },
          },
        },
        hitStun: {
          entry: assign({ invincible: true, dashing: false, healing: false }),
          after: { [PLAYER_INVULN_MS]: { target: 'idle' } },
        },
      },
      on: {
        DIE: { target: 'dead' },
      },
    },
    dead: {
      type: 'final',
    },
  },
});
