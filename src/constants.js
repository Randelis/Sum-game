export const WORLD_WIDTH  = 6400;
export const WORLD_HEIGHT = 6400;
export const TILE_SIZE    = 64;
export const GRID_COLS    = WORLD_WIDTH  / TILE_SIZE; // 100
export const GRID_ROWS    = WORLD_HEIGHT / TILE_SIZE; // 100

export const PLAYER_SPEED        = 175;
export const PLAYER_MAX_HP       = 100;
export const PLAYER_DASH_SPEED   = 4.5;
export const PLAYER_DASH_MS      = 220;
export const PLAYER_INVULN_MS    = 500;
export const PLAYER_FLASKS       = 3;
export const PLAYER_FLASK_HEAL   = 50;
export const PLAYER_FLASK_MS     = 800;
export const PLAYER_RADIUS       = 16;

export const BULLET_RADIUS   = 5;
export const ENEMY_RADIUS    = 16;
export const BOSS_RADIUS     = 36;

export const MAX_ENEMIES     = 50;
export const XP_BASE         = 100;
export const XP_SCALE        = 1.22;

export const CAMERA_ZOOM     = 0.78;
export const CAMERA_LERP     = 0.1;

export const MINIMAP_SIZE    = 84;
export const MINIMAP_SCALE   = 0.030;

export const BOSS_WAVE_INTERVAL = 5;

export const DEPTH_BG        = 0;
export const DEPTH_DECALS    = 1;
export const DEPTH_PICKUP    = 2;
export const DEPTH_ORB       = 3;
export const DEPTH_ENEMY     = 10;
export const DEPTH_PLAYER    = 20;
export const DEPTH_BULLET    = 30;
export const DEPTH_FX        = 40;
export const DEPTH_OVERLAY   = 50;
export const DEPTH_UI        = 100;
