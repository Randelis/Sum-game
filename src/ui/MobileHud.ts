import Phaser from 'phaser';
import { GAME_W, DEPTH } from '../utils/constants';
import { Player } from '../entities/Player';
import { Boss }   from '../entities/Boss';

export class MobileHud {
  scene:  Phaser.Scene;

  private _hpBarBg!:    Phaser.GameObjects.Rectangle;
  private _hpBar!:      Phaser.GameObjects.Rectangle;
  private _hpText!:     Phaser.GameObjects.Text;
  private _ammoText!:   Phaser.GameObjects.Text;
  private _waveText!:   Phaser.GameObjects.Text;
  private _scoreText!:  Phaser.GameObjects.Text;
  private _levelText!:  Phaser.GameObjects.Text;
  private _xpBarBg!:    Phaser.GameObjects.Rectangle;
  private _xpBar!:      Phaser.GameObjects.Rectangle;
  private _flaskIcons:  Phaser.GameObjects.Text[] = [];
  private _reloadText!: Phaser.GameObjects.Text;

  private _bossBarBg!:    Phaser.GameObjects.Rectangle;
  private _bossBar!:      Phaser.GameObjects.Rectangle;
  private _bossNameText!: Phaser.GameObjects.Text;
  private _bossGroup!:    Phaser.GameObjects.Container;

  private _announceText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._buildHud();
    this._buildBossBar();
    this._buildAnnounce();
  }

  update(player: Player, wave: number, boss: Boss | null): void {
    // HP
    const hpFrac = Math.max(0, player.hp / player.stats.maxHp);
    this._hpBar.setScale(hpFrac, 1);
    this._hpText.setText(`${Math.ceil(player.hp)}/${player.stats.maxHp}`);
    this._hpBar.setFillStyle(hpFrac > 0.4 ? 0x44cc44 : hpFrac > 0.2 ? 0xffaa00 : 0xff3333);

    // Ammo / reload
    if (player.isReloading) {
      this._ammoText.setText('RELOADING…').setColor('#ffaa00');
    } else {
      this._ammoText.setText(`${player.ammo}/${player.weapon.ammoMax} ${player.weapon.icon}`).setColor('#ffffff');
    }

    // XP bar
    const xpFrac = Math.min(1, player.xp / Math.max(1, this._xpThreshold(player.level)));
    this._xpBar.setScale(xpFrac, 1);
    this._levelText.setText(`Lv.${player.level}`);

    // Wave / score
    this._waveText.setText(`Wave ${wave}`);
    this._scoreText.setText(`${player.score}`);

    // Flasks
    for (let i = 0; i < this._flaskIcons.length; i++) {
      this._flaskIcons[i].setAlpha(i < player.flasks ? 1 : 0.25);
    }

    // Boss bar
    if (boss && !boss.isDead) {
      this._bossGroup.setVisible(true);
      const bFrac = Math.max(0, boss.hpFraction);
      this._bossBar.setScale(bFrac, 1);
      this._bossNameText.setText(`${boss.def.name} — ${boss.def.subtitle}`);
    } else {
      this._bossGroup.setVisible(false);
    }
  }

  showAnnounce(text: string, durationMs = 2200): void {
    this._announceText.setText(text).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets:  this._announceText,
      alpha:    0,
      delay:    durationMs - 600,
      duration: 600,
      onComplete: () => this._announceText.setVisible(false),
    });
  }

  showDamageNumber(x: number, y: number, amount: number, color = 0xffffff): void {
    const screenPos = this.scene.cameras.main.getWorldPoint(0, 0); // dummy — calc below
    void screenPos;
    const cam = this.scene.cameras.main;
    const sx  = (x - cam.scrollX) * cam.zoom;
    const sy  = (y - cam.scrollY) * cam.zoom;
    const t   = this.scene.add.text(sx, sy, `-${amount}`, {
      fontSize: '20px', color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: '#000', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(DEPTH.HUD + 10);
    this.scene.tweens.add({
      targets: t, y: sy - 50, alpha: 0, duration: 900,
      onComplete: () => t.destroy(),
    });
  }

  private _buildHud(): void {
    const d = DEPTH.HUD;

    // HP bar — top-left
    this._hpBarBg = this.scene.add.rectangle(10, 10, 220, 20, 0x333333).setOrigin(0, 0).setScrollFactor(0).setDepth(d);
    this._hpBar   = this.scene.add.rectangle(10, 10, 220, 20, 0x44cc44).setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);
    this._hpText  = this.scene.add.text(120, 12, '', { fontSize: '13px', color: '#fff' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d + 2);

    // XP bar
    this._xpBarBg = this.scene.add.rectangle(10, 34, 220, 8, 0x222266).setOrigin(0, 0).setScrollFactor(0).setDepth(d);
    this._xpBar   = this.scene.add.rectangle(10, 34, 220, 8, 0x6666ff).setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);

    // Level / wave / score
    this._levelText = this.scene.add.text(12, 46, 'Lv.1', { fontSize: '14px', color: '#aaaaff' }).setScrollFactor(0).setDepth(d);
    this._waveText  = this.scene.add.text(GAME_W / 2, 10, 'Wave 1', { fontSize: '18px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d);
    this._scoreText = this.scene.add.text(GAME_W - 10, 10, '0', { fontSize: '18px', color: '#ffcc00' }).setOrigin(1, 0).setScrollFactor(0).setDepth(d);

    // Ammo — bottom left area (above joystick)
    this._ammoText = this.scene.add.text(12, 520, '', { fontSize: '16px', color: '#fff' }).setScrollFactor(0).setDepth(d);

    // Flask icons
    for (let i = 0; i < 5; i++) {
      const ico = this.scene.add.text(14 + i * 28, 545, '🧪', { fontSize: '20px' }).setScrollFactor(0).setDepth(d);
      this._flaskIcons.push(ico);
    }

    // Reload indicator
    this._reloadText = this.scene.add.text(14, 570, 'RELOADING', { fontSize: '14px', color: '#ffaa00' }).setScrollFactor(0).setDepth(d).setVisible(false);
  }

  private _buildBossBar(): void {
    const bw = GAME_W - 160;
    const bx = 80;
    const by = 60;
    const d  = DEPTH.HUD;

    this._bossBarBg    = this.scene.add.rectangle(bx, by, bw, 22, 0x330000).setOrigin(0, 0).setScrollFactor(0).setDepth(d);
    this._bossBar      = this.scene.add.rectangle(bx, by, bw, 22, 0xcc2222).setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1);
    this._bossNameText = this.scene.add.text(bx + bw / 2, by + 11, '', { fontSize: '13px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);

    this._bossGroup = this.scene.add.container(0, 0, [this._bossBarBg, this._bossBar, this._bossNameText])
      .setScrollFactor(0).setDepth(d).setVisible(false);
  }

  private _buildAnnounce(): void {
    this._announceText = this.scene.add.text(GAME_W / 2, 200, '', {
      fontSize: '36px', color: '#ffcc00',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD + 5).setVisible(false);
  }

  private _xpThreshold(level: number): number {
    return Math.round(100 * Math.pow(1.22, level - 1));
  }
}
