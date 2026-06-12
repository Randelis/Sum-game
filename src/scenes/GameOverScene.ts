import Phaser from 'phaser';
import { GAME_W, GAME_H, FONT } from '../utils/constants';
import { SaveSystem }     from '../systems/SaveSystem';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create(data: { score: number; wave: number; level: number }): void {
    const save = new SaveSystem();
    const wasNewBest = data.score > save.getHighScore();
    save.saveHighScore(data.score);
    const best = save.getHighScore();

    // Blood-dark backdrop with vignette
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x180406, 0x180406, 0x060203, 0x060203, 1);
    bg.fillRect(0, 0, GAME_W, GAME_H);
    this.add.image(GAME_W / 2, GAME_H / 2, 'vignette').setDisplaySize(GAME_W + 80, GAME_H + 80);

    const title = this.add.text(GAME_W / 2, 128, 'GAME OVER', {
      fontFamily: FONT, fontSize: '72px', color: '#ff3b30', fontStyle: 'bold',
      stroke: '#1c0000', strokeThickness: 12,
    }).setOrigin(0.5);
    title.setShadow(0, 10, '#000000', 18);

    const rule = this.add.graphics();
    rule.fillGradientStyle(0x4a0e0e, 0xff3b30, 0xff3b30, 0x4a0e0e, 1);
    rule.fillRect(GAME_W / 2 - 220, 182, 440, 3);

    // Stats panel
    const sy = 244;
    this.add.text(GAME_W / 2, sy, `WAVE REACHED   ${data.wave}`, {
      fontFamily: FONT, fontSize: '24px', color: '#e8eef4', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, sy + 38, `LEVEL   ${data.level}`, {
      fontFamily: FONT, fontSize: '20px', color: '#93a3b3',
    }).setOrigin(0.5);
    const scoreText = this.add.text(GAME_W / 2, sy + 86, `${data.score.toLocaleString()}`, {
      fontFamily: FONT, fontSize: '40px', color: '#ffd24a', fontStyle: 'bold',
      stroke: '#241a00', strokeThickness: 5,
    }).setOrigin(0.5);
    scoreText.setShadow(0, 4, '#000000', 8);

    if (wasNewBest) {
      const nb = this.add.text(GAME_W / 2, sy + 138, '⭐ NEW HIGH SCORE ⭐', {
        fontFamily: FONT, fontSize: '24px', color: '#ffb02e', fontStyle: 'bold',
        stroke: '#241400', strokeThickness: 4,
      }).setOrigin(0.5);
      this.tweens.add({ targets: nb, scale: 1.06, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
    } else {
      this.add.text(GAME_W / 2, sy + 138, `BEST   ${best.toLocaleString()}`, {
        fontFamily: FONT, fontSize: '17px', color: '#5d6a76',
      }).setOrigin(0.5);
    }

    this._button(GAME_W / 2, 518, 300, 78, '▶  PLAY AGAIN', 0x2e8b3a, 0x174a1e, 0x6fe07f, '#ffffff', 26, () => this.scene.start('Game'));
    this._button(GAME_W / 2, 618, 200, 52, 'Main Menu', 0x222c38, 0x10161e, 0x4a5a6a, '#aebccb', 18, () => this.scene.start('Menu'));
  }

  /** Rounded gradient button (same style as MenuScene). */
  private _button(
    cx: number, cy: number, w: number, h: number,
    label: string, fillTop: number, fillBottom: number, edge: number,
    textColor: string, fontSize: number,
    onTap: () => void,
  ): void {
    const r = Math.min(18, h / 3);
    const gfx = this.add.graphics({ x: cx, y: cy });
    gfx.fillStyle(0x000000, 0.45);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, r);
    gfx.fillStyle(fillTop, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    gfx.fillStyle(fillBottom, 0.55);
    gfx.fillRoundedRect(-w / 2, 0, w, h / 2, { tl: 0, tr: 0, bl: r, br: r });
    gfx.fillStyle(0xffffff, 0.08);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.34, Math.min(r - 2, h * 0.17));
    gfx.lineStyle(2, edge, 0.8);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    const txt = this.add.text(cx, cy, label, {
      fontFamily: FONT, fontSize: `${fontSize}px`, color: textColor, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    txt.setShadow(0, 3, '#000000', 5);

    const hit = this.add.rectangle(cx, cy, w, h, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      gfx.setScale(0.97); txt.setScale(0.97);
      this.tweens.add({ targets: [gfx, txt], scale: 1, duration: 130, ease: 'Back.Out' });
      onTap();
    });
  }
}
