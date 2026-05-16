const KEY_HIGHSCORE = 'zs_highscore';
const KEY_SETTINGS  = 'zs_settings';

export interface GameSettings {
  sfxVolume:   number;
  musicVolume: number;
}

export class SaveSystem {
  getHighScore(): number {
    return parseInt(localStorage.getItem(KEY_HIGHSCORE) ?? '0', 10) || 0;
  }

  saveHighScore(score: number): void {
    const current = this.getHighScore();
    if (score > current) {
      localStorage.setItem(KEY_HIGHSCORE, String(score));
    }
  }

  getSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(KEY_SETTINGS);
      if (raw) return JSON.parse(raw) as GameSettings;
    } catch { /* ignore */ }
    return { sfxVolume: 0.8, musicVolume: 0.5 };
  }

  saveSettings(s: GameSettings): void {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  }
}
