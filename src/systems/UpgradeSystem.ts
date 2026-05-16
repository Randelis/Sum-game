import { Player }                      from '../entities/Player';
import { UPGRADES, pickUpgrades, UpgradeDef } from '../data/upgrades';
import { XP_BASE, XP_SCALE }           from '../utils/constants';

export class UpgradeSystem {
  player:  Player;
  levels:  Record<string, number> = {};

  private _onLevelUp: (choices: UpgradeDef[]) => void;

  constructor(player: Player, onLevelUp: (choices: UpgradeDef[]) => void) {
    this.player    = player;
    this._onLevelUp = onLevelUp;
  }

  addXp(amount: number): void {
    this.player.xp += amount;
    const threshold = this._xpForNextLevel(this.player.level);
    if (this.player.xp >= threshold) {
      this.player.xp    -= threshold;
      this.player.level += 1;
      this.player.hp     = Math.min(this.player.stats.maxHp, this.player.hp + 20); // partial heal on level-up

      const choices = pickUpgrades(this.levels, 3);
      this._onLevelUp(choices);
    }
  }

  applyUpgrade(def: UpgradeDef): void {
    const lvl = (this.levels[def.id] ?? 0) + 1;
    this.levels[def.id] = lvl;
    def.apply(this.player.stats, lvl);

    // Apply maxHp change immediately
    if (def.id === 'maxHp') {
      this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 25);
    }
  }

  xpProgress(): number {
    return this.player.xp / this._xpForNextLevel(this.player.level);
  }

  private _xpForNextLevel(level: number): number {
    return Math.round(XP_BASE * Math.pow(XP_SCALE, level - 1));
  }

  getUpgradeName(id: string): string {
    return UPGRADES.find(u => u.id === id)?.name ?? id;
  }
}
