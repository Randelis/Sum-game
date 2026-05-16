import Phaser from 'phaser';
import { GAME_W, GAME_H, DEPTH } from '../utils/constants';
import { Player } from '../entities/Player';
import { Boss }   from '../entities/Boss';

/**
 * Mobile HUD layout for 1280×720 landscape.
 *
 *  Top-left  (HP bar + XP bar + level + flasks below)
 *  Top-mid   (wave banner)
 *  Top-right (score)
 *  Top-center-below-wave (boss bar when active)
 *  Bottom-mid (ammo / weapon — safely above and BETWEEN the joystick and buttons)
 *
 * Joystick lives bottom-left (around x≈150, y≈600).
 * Action buttons live bottom-right (x≈1100-1220, y≈600).
 * Ammo/weapon goes in the safe gap between them (x≈640, y≈680).
 */
export class MobileHud {
  scene: Phaser.Scene;

  private _hpBarBg!:    Phaser.GameObjects.Rectangle;
  private _hpBar!:      Phaser.GameObjects.Rectangle;
  private _hpText!:     Phaser.GameObjects.Text;
  private _xpBarBg!:    Phaser.GameObjects.Rectangle;
  private _xpBar!:      Phaser.GameObjects.Rectangle;
  private _levelText!:  Phaser.GameObjects.Text;

  private _waveText!:   Phaser.GameObjects.Text;
  private _scoreText!:  Phaser.GameObjects.Text;

  private _ammoBg!:     Phaser.GameObjects.Rectangle;
  private _ammoText!:   Phaser.GameObjects.Text;

  private _flaskIcons:  Phaser.GameObjects.Text[] = [];

  private _bossBarBg!:    Phaser.GameObjects.Rectangle;
  private _bossBar!:      Phaser.GameObjects.Rectangle;
  private _bossNameText!: Phaser.GameObjects.Text;
  private _bossGroup!:    Phaser.GameObjects.Container;

  private _announceText!: Phaser.GameObjects.Text;

  // Cached last values to avoid pointless re-renders
  private _lastHp = -1;
  private _lastMaxHp = -1;
  private _lastAmmo = -1;
  private _lastReload = false;
  private _lastFlasks = -1;
  private _lastLevel  = -1;
  private _lastScore  = -1;
  private _lastWave   = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._buildTopBar();
    this._buildBossBar();
    this._buildAmmoPanel();
    this._buildAnnounce();
  }

  update(player: Player, wave: number, boss: Boss | null): void {
    // HP
    if (player.hp !== this._lastHp || player.stats.maxHp !== this._lastMaxHp) {
      const hpFrac = Math.max(0, player.hp / player.stats.maxHp);
      this._hpBar.scaleX = hpFrac;
      this._hpText.setText(`${Math.ceil(player.hp)} / ${player.stats.maxHp}`);
      this._hpBar.setFillStyle(hpFrac > 0.5 ? 0x44cc44 : hpFrac > 0.25 ? 0xffaa00 : 0xff3333);
      this._lastHp    = player.hp;
      this._lastMaxHp = player.stats.maxHp;
    }

    // Ammo
    if (player.ammo !== this._lastAmmo || player.isReloading !== this._lastReload) {
      if (player.isReloading) {
        this._ammoText.setText('RELOADING…').setColor('#ffaa00');
        this._ammoBg.setStrokeStyle(2, 0xffaa00);
      } else {
        this._ammoText.setText(`${player.weapon.icon} ${player.ammo}/${player.weapon.ammoMax}`).setColor('#ffffff');
        this._ammoBg.setStrokeStyle(2, 0x445566);
      }
      this._lastAmmo   = player.ammo;
      this._lastReload = player.isReloading;
    }

    // XP / level
    if (player.level !== this._lastLevel || Math.floor(player.xp * 100) !== Math.floor(this._lastScore)) {
      const xpFrac = Math.min(1, player.xp / Math.max(1, this._xpThreshold(player.level)));
      this._xpBar.scaleX = xpFrac;
      this._levelText.setText(`LV ${player.level}`);
      this._lastLevel = player.level;
    }

    // Score / wave
    if (player.score !== this._lastScore) {
      this._scoreText.setText(player.score.toLocaleString());
      this._lastScore = player.score;
    }
    if (wave !== this._lastWave) {
      this._waveText.setText(`Wave ${wave}`);
      this._lastWave = wave;
    }

    // Flasks
    if (player.flasks !== this._lastFlasks) {
      for (let i = 0; i < this._flaskIcons.length; i++) {
        this._flaskIcons[i].setAlpha(i < player.flasks ? 1 : 0.18);
      }
      this._lastFlasks = player.flasks;
    }

    // Boss bar
    if (boss && !boss.isDead) {
      this._bossGroup.setVisible(true);
      const bFrac = Math.max(0, boss.hpFraction);
      this._bossBar.scaleX = bFrac;
      this._bossNameText.setText(`${boss.def.name}`);
    } else {
      this._bossGroup.setVisible(false);
    }
  }

  showAnnounce(text: string, durationMs = 2200): void {
    this._announceText.setText(text).setAlpha(1).setVisible(true);
    this.scene.tweens.killTweensOf(this._announceText);
    this.scene.tweens.add({
      targets:    this._announceText,
      alpha:      0,
      delay:      Math.max(0, durationMs - 600),
      duration:   600,
      onComplete: () => this._announceText.setVisible(false),
    });
  }

  showDamageNumber(x: number, y: number, amount: number, color = 0xffffff): void {
    const cam = this.scene.cameras.main;
    const sx  = (x - cam.scrollX) * cam.zoom;
    const sy  = (y - cam.scrollY) * cam.zoom;
    const t   = this.scene.add.text(sx, sy, `${amount}`, {
      fontSize: '18px',
      color:    Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke:   '#000', strokeThickness: 3,
      fontStyle:'bold',
    }).setScrollFactor(0).setDepth(DEPTH.HUD + 10).setOrigin(0.5);

    this.scene.tweens.add({
      targets: t, y: sy - 40, alpha: 0,
      duration: 750, ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    });
  }

  // ─── builders ─────────────────────────────────────────────────────────────

  private _buildTopBar(): void {
    const d = DEPTH.HUD;

    // HP bar (top-left)
    const hpX = 16, hpY = 16, hpW = 280, hpH = 22;
    this._hpBarBg = this.scene.add.rectangle(hpX, hpY, hpW, hpH, 0x000000, 0.55)
      .setOrigin(0, 0).setStrokeStyle(2, 0x445566)
      .setScrollFactor(0).setDepth(d);
    this._hpBar = this.scene.add.rectangle(hpX + 2, hpY + 2, hpW - 4, hpH - 4, 0x44cc44)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);
    this._hpText = this.scene.add.text(hpX + hpW / 2, hpY + hpH / 2, '', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);

    // XP bar (below HP, thinner)
    const xpY = hpY + hpH + 6;
    this._xpBarBg = this.scene.add.rectangle(hpX, xpY, hpW, 8, 0x000000, 0.55)
      .setOrigin(0, 0).setStrokeStyle(1, 0x335577)
      .setScrollFactor(0).setDepth(d);
    this._xpBar = this.scene.add.rectangle(hpX + 1, xpY + 1, hpW - 2, 6, 0x66aaff)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);

    // Level chip
    this._levelText = this.scene.add.text(hpX + hpW + 10, hpY + 6, 'LV 1', {
      fontSize: '14px', color: '#cce4ff', fontStyle: 'bold',
      backgroundColor: '#223344', padding: { left: 6, right: 6, top: 2, bottom: 2 },
    }).setScrollFactor(0).setDepth(d);

    // Wave (top center)
    this._waveText = this.scene.add.text(GAME_W / 2, 22, 'Wave 1', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(d);

    // Score (top right)
    this._scoreText = this.scene.add.text(GAME_W - 16, 22, '0', {
      fontSize: '22px', color: '#ffcc00', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(d);

    // Flask icons (below XP bar, top-left area — NOT near joystick)
    const fY = xpY + 18;
    for (let i = 0; i < 5; i++) {
      const ico = this.scene.add.text(hpX + i * 26, fY, '🧪', {
        fontSize: '20px',
      }).setScrollFactor(0).setDepth(d).setAlpha(0.18);
      this._flaskIcons.push(ico);
    }
  }

  private _buildBossBar(): void {
    const bw = 720;
    const bx = (GAME_W - bw) / 2;
    const by = 56;
    const d  = DEPTH.HUD;

    this._bossBarBg = this.scene.add.rectangle(bx, by, bw, 18, 0x110000, 0.85)
      .setOrigin(0, 0).setStrokeStyle(2, 0xcc4444)
      .setScrollFactor(0).setDepth(d);
    this._bossBar = this.scene.add.rectangle(bx + 2, by + 2, bw - 4, 14, 0xdd2222)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);
    this._bossNameText = this.scene.add.text(GAME_W / 2, by - 12, '', {
      fontSize: '14px', color: '#ff8888', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(d + 2);

    this._bossGroup = this.scene.add.container(0, 0, [this._bossBarBg, this._bossBar, this._bossNameText])
      .setScrollFactor(0).setDepth(d).setVisible(false);
  }

  private _buildAmmoPanel(): void {
    // Bottom CENTER — between the joystick (bottom-left) and action buttons
    // (bottom-right). Safe x range is roughly 320-980 in 1280-wide canvas.
    const d  = DEPTH.HUD;
    const cx = GAME_W / 2;
    const cy = GAME_H - 38;
    const w  = 200;
    const h  = 44;

    this._ammoBg = this.scene.add.rectangle(cx, cy, w, h, 0x000000, 0.55)
      .setOrigin(0.5).setStrokeStyle(2, 0x445566)
      .setScrollFactor(0).setDepth(d);
    this._ammoText = this.scene.add.text(cx, cy, '', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1);
  }

  private _buildAnnounce(): void {
    this._announceText = this.scene.add.text(GAME_W / 2, GAME_H / 2 - 80, '', {
      fontSize: '44px', color: '#ffcc00', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD + 5).setVisible(false);
  }

  private _xpThreshold(level: number): number {
    return Math.round(100 * Math.pow(1.22, level - 1));
  }
}
