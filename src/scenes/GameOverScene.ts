import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../utils/constants';
import { SaveSystem }     from '../systems/SaveSystem';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create(data: { score: number; wave: number; level: number }): void {
    const save = new SaveSystem();
    const wasNewBest = data.score > save.getHighScore();
    save.saveHighScore(data.score);
    const best = save.getHighScore();

    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0000);

    this.add.text(GAME_W / 2, 130, 'GAME OVER', {
      fontSize: '68px', color: '#ff2222', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 10,
    }).setOrigin(0.5);

    // Stats panel
    const sy = 240;
    this.add.text(GAME_W / 2, sy,        `Wave reached:  ${data.wave}`,  { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, sy + 38,   `Level:  ${data.level}`,         { fontSize: '22px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, sy + 80,   `Score:  ${data.score.toLocaleString()}`, {
      fontSize: '30px', color: '#ffcc00', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    if (wasNewBest) {
      this.add.text(GAME_W / 2, sy + 130, '⭐ NEW HIGH SCORE! ⭐', {
        fontSize: '24px', color: '#ffaa00', fontStyle: 'bold',
      }).setOrigin(0.5);
    } else {
      this.add.text(GAME_W / 2, sy + 130, `Best:  ${best.toLocaleString()}`, {
        fontSize: '18px', color: '#666666',
      }).setOrigin(0.5);
    }

    // Play again button
    this._button(GAME_W / 2, 510, 260, 70, '▶ PLAY AGAIN', 0x226622, 0x33aa33, '#ffffff', 26, () => this.scene.start('Game'));

    // Main menu button (smaller)
    this._button(GAME_W / 2, 605, 180, 50, 'Main Menu', 0x222222, 0x444444, '#aaaaaa', 18, () => this.scene.start('Menu'));

    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Game'));
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Game'));
    }
  }

  private _button(
    cx: number, cy: number, w: number, h: number,
    label: string, fill: number, fillHover: number,
    textColor: string, fontSize: number,
    onTap: () => void,
  ): void {
    const bg = this.add.rectangle(cx, cy, w, h, fill)
      .setStrokeStyle(2, 0xffffff, 0.15)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(cx, cy, label, {
      fontSize: `${fontSize}px`, color: textColor, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setFillStyle(fillHover); txt.setScale(1.04); });
    bg.on('pointerout',  () => { bg.setFillStyle(fill); txt.setScale(1); });
    bg.on('pointerdown', () => {
      bg.setScale(0.96);
      this.tweens.add({ targets: bg, scale: 1, duration: 120 });
      onTap();
    });
  }
}
