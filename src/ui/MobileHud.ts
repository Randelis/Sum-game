import Phaser from 'phaser';
import { GAME_W, GAME_H, DEPTH, FONT } from '../utils/constants';
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
      this._waveText.setText(`WAVE ${wave}`);
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
      fontFamily: FONT,
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
    this._hpBarBg = this.scene.add.rectangle(hpX, hpY, hpW, hpH, 0x0a0e14, 0.72)
      .setOrigin(0, 0).setStrokeStyle(2, 0x36506a, 0.9)
      .setScrollFactor(0).setDepth(d);
    this._hpBar = this.scene.add.rectangle(hpX + 2, hpY + 2, hpW - 4, hpH - 4, 0x44cc44)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);
    this._hpText = this.scene.add.text(hpX + hpW / 2, hpY + hpH / 2, '', {
      fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#0a2010', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);

    // XP bar (below HP, thinner)
    const xpY = hpY + hpH + 6;
    this._xpBarBg = this.scene.add.rectangle(hpX, xpY, hpW, 8, 0x0a0e14, 0.72)
      .setOrigin(0, 0).setStrokeStyle(1, 0x36506a, 0.9)
      .setScrollFactor(0).setDepth(d);
    this._xpBar = this.scene.add.rectangle(hpX + 1, xpY + 1, hpW - 2, 6, 0x59b7ff)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);

    // Level chip
    this._levelText = this.scene.add.text(hpX + hpW + 10, hpY + 4, 'LV 1', {
      fontFamily: FONT, fontSize: '14px', color: '#cfe6ff', fontStyle: 'bold',
      backgroundColor: '#16273c', padding: { left: 8, right: 8, top: 3, bottom: 3 },
    }).setScrollFactor(0).setDepth(d);

    // Wave (top center)
    this._waveText = this.scene.add.text(GAME_W / 2, 24, 'WAVE 1', {
      fontFamily: FONT, fontSize: '26px', color: '#f2f6fa', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(d);
    this._waveText.setShadow(0, 3, '#000000', 6);

    // Score (top right)
    this._scoreText = this.scene.add.text(GAME_W - 16, 24, '0', {
      fontFamily: FONT, fontSize: '24px', color: '#ffd24a', fontStyle: 'bold',
      stroke: '#241a00', strokeThickness: 4,
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(d);
    this._scoreText.setShadow(0, 3, '#000000', 6);

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
      fontFamily: FONT, fontSize: '15px', color: '#ff9d9d', fontStyle: 'bold',
      stroke: '#1a0000', strokeThickness: 3,
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

    this._ammoBg = this.scene.add.rectangle(cx, cy, w, h, 0x0a0e14, 0.72)
      .setOrigin(0.5).setStrokeStyle(2, 0x36506a, 0.9)
      .setScrollFactor(0).setDepth(d);
    this._ammoText = this.scene.add.text(cx, cy, '', {
      fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1);
  }

  private _buildAnnounce(): void {
    this._announceText = this.scene.add.text(GAME_W / 2, GAME_H / 2 - 80, '', {
      fontFamily: FONT, fontSize: '46px', color: '#ffd24a', fontStyle: 'bold',
      stroke: '#241400', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD + 5).setVisible(false);
    this._announceText.setShadow(0, 5, '#000000', 10);
  }

  private _xpThreshold(level: number): number {
    return Math.round(100 * Math.pow(1.22, level - 1));
  }
}
