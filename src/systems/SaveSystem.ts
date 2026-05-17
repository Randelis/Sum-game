const KEY_HIGHSCORE = 'zs_highscore';
const KEY_SETTINGS  = 'zs_settings';

export interface GameSettings {
  sfxVolume:   number;
  musicVolume: number;
}

// localStorage throws in private mode / when cookies are blocked — wrap every
// access so the game still boots and a forgotten high score is treated as 0.
function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export class SaveSystem {
  getHighScore(): number {
    return parseInt(safeGet(KEY_HIGHSCORE) ?? '0', 10) || 0;
  }

  saveHighScore(score: number): void {
    const current = this.getHighScore();
    if (score > current) safeSet(KEY_HIGHSCORE, String(score));
  }

  getSettings(): GameSettings {
    try {
      const raw = safeGet(KEY_SETTINGS);
      if (raw) return JSON.parse(raw) as GameSettings;
    } catch { /* ignore */ }
    return { sfxVolume: 0.8, musicVolume: 0.5 };
  }

  saveSettings(s: GameSettings): void {
    safeSet(KEY_SETTINGS, JSON.stringify(s));
  }
}
