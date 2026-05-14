import { createMachine, assign } from 'xstate';

// The boss machine tracks combat phase and ability-execution state.
// The GameScene drives transitions by sending events; the machine
// owns timing for windup and exhaustion windows.
export const bossMachine = createMachine({
  id: 'boss',
  initial: 'phase1',
  context: {
    phase: 1,
    speedMult: 1.0,
    damageMult: 1.0,
    cdScale: 1.0,
    currentAbilityId: null,
    isHardAbility: false,
    windupMs: 550,
    exhaustedMs: 1000,
    takingExtraDamage: false,
  },

  states: {
    // ── Phase 1 ──────────────────────────────────────────────────────────
    phase1: {
      initial: 'cooldown',
      entry: assign({ phase: 1, speedMult: 1.0, damageMult: 1.0, cdScale: 1.0 }),
      states: {
        cooldown: {
          entry: assign({ takingExtraDamage: false }),
          on: { NEXT_ABILITY: { target: 'windup', actions: assign(({ event }) => ({
            currentAbilityId: event.abilityId,
            isHardAbility:    event.isHard,
            windupMs:         event.windupMs ?? 550,
          })) } },
        },
        windup: {
          after: [{ delay: ({ context }) => context.windupMs, target: 'firing' }],
          on: { INTERRUPTED: 'cooldown' },
        },
        firing: {
          on: {
            ABILITY_DONE: [
              { target: 'exhausted', guard: ({ context }) => context.isHardAbility },
              { target: 'cooldown' },
            ],
          },
        },
        exhausted: {
          entry: assign({ takingExtraDamage: true }),
          after: [{ delay: ({ context }) => context.exhaustedMs, target: 'cooldown' }],
        },
      },
      on: {
        PHASE_2: { target: 'phaseTransition', actions: assign({ phase: 2 }) },
        DIE:     'dead',
      },
    },

    // ── Phase 2 ──────────────────────────────────────────────────────────
    phase2: {
      initial: 'cooldown',
      entry: assign({ phase: 2, speedMult: 1.35, damageMult: 1.4, cdScale: 0.7, exhaustedMs: 850 }),
      states: {
        cooldown: {
          entry: assign({ takingExtraDamage: false }),
          on: { NEXT_ABILITY: { target: 'windup', actions: assign(({ event }) => ({
            currentAbilityId: event.abilityId,
            isHardAbility:    event.isHard,
            windupMs:         event.windupMs ?? 450,
          })) } },
        },
        windup: {
          after: [{ delay: ({ context }) => context.windupMs, target: 'firing' }],
          on: { INTERRUPTED: 'cooldown' },
        },
        firing: {
          on: {
            ABILITY_DONE: [
              { target: 'exhausted', guard: ({ context }) => context.isHardAbility },
              { target: 'cooldown' },
            ],
          },
        },
        exhausted: {
          entry: assign({ takingExtraDamage: true }),
          after: [{ delay: ({ context }) => context.exhaustedMs, target: 'cooldown' }],
        },
      },
      on: {
        PHASE_3: { target: 'phaseTransition', actions: assign({ phase: 3 }) },
        DIE:     'dead',
      },
    },

    // ── Phase 3 ──────────────────────────────────────────────────────────
    phase3: {
      initial: 'ultimateWindup',
      entry: assign({ phase: 3, speedMult: 1.8, damageMult: 2.0, cdScale: 0.4, exhaustedMs: 700 }),
      states: {
        ultimateWindup: {
          after: [{ delay: 2000, target: 'ultimateFiring' }],
        },
        ultimateFiring: {
          on: { ULTIMATE_DONE: 'cooldown' },
        },
        cooldown: {
          entry: assign({ takingExtraDamage: false }),
          on: { NEXT_ABILITY: { target: 'windup', actions: assign(({ event }) => ({
            currentAbilityId: event.abilityId,
            isHardAbility:    event.isHard,
            windupMs:         event.windupMs ?? 350,
          })) } },
        },
        windup: {
          after: [{ delay: ({ context }) => context.windupMs, target: 'firing' }],
          on: { INTERRUPTED: 'cooldown' },
        },
        firing: {
          on: {
            ABILITY_DONE: [
              { target: 'exhausted', guard: ({ context }) => context.isHardAbility },
              { target: 'cooldown' },
            ],
          },
        },
        exhausted: {
          entry: assign({ takingExtraDamage: true }),
          after: [{ delay: ({ context }) => context.exhaustedMs, target: 'cooldown' }],
        },
      },
      on: { DIE: 'dead' },
    },

    // ── Phase transition pause ────────────────────────────────────────────
    phaseTransition: {
      after: [{
        delay: 1500,
        target: [
          { target: 'phase2', guard: ({ context }) => context.phase === 2 },
          { target: 'phase3', guard: ({ context }) => context.phase === 3 },
        ],
      }],
      on: { DIE: 'dead' },
    },

    dead: { type: 'final' },
  },
});
