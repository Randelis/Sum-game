// Logical game canvas resolution (scaled via Phaser.Scale.FIT)
export const GAME_W = 1280;
export const GAME_H = 720;

// World dimensions
export const WORLD_W = 6400;
export const WORLD_H = 6400;

export const PLAYER = {
  RADIUS:        16,
  MAX_HP:        100,
  BASE_SPEED:    180,
  DASH_MULT:     4.5,
  DASH_MS:       220,
  INVULN_MS:     500,
  DASH_COOLDOWN: 3.5,
  FLASKS:        3,
  FLASK_HEAL:    50,
  FLASK_MS:      800,
} as const;

export const MOBILE_LIMITS = {
  maxEnemies:       45,
  maxPlayerBullets: 120,
  maxEnemyBullets:  80,
  maxDamageNumbers: 40,
} as const;

export const BOSS_WAVE = 5;
export const XP_BASE   = 100;
export const XP_SCALE  = 1.22;

export const CAMERA_ZOOM = 0.72;
export const CAMERA_LERP = 0.08;

export const DEPTH = {
  BG:      0,
  DECAL:   1,
  PICKUP:  2,
  ORB:     3,
  ENEMY:   10,
  PLAYER:  20,
  BULLET:  30,
  FX:      40,
  OVERLAY: 50,
  HUD:     100,
} as const;
