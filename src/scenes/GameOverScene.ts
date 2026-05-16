import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../utils/constants';
import { SaveSystem }     from '../systems/SaveSystem';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create(data: { score: number; wave: number; level: number }): void {
    const save = new SaveSystem();
    save.saveHighScore(data.score);
    const best = save.getHighScore();

    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0000);

    this.add.text(GAME_W / 2, 160, 'GAME OVER', {
      fontSize: '60px', color: '#ff2222',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 260, `Wave reached: ${data.wave}`, {
      fontSize: '26px', color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 300, `Level: ${data.level}`, {
      fontSize: '22px', color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 340, `Score: ${data.score}`, {
      fontSize: '28px', color: '#ffcc00',
    }).setOrigin(0.5);

    if (data.score >= best) {
      this.add.text(GAME_W / 2, 385, '⭐ NEW HIGH SCORE! ⭐', {
        fontSize: '24px', color: '#ffaa00',
      }).setOrigin(0.5);
    } else {
      this.add.text(GAME_W / 2, 385, `Best: ${best}`, {
        fontSize: '20px', color: '#888888',
      }).setOrigin(0.5);
    }

    // Play again button
    const btnBg = this.add.rectangle(GAME_W / 2, 480, 240, 65, 0x226622)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(GAME_W / 2, 480, 'PLAY AGAIN', {
      fontSize: '28px', color: '#fff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x33aa33); btnText.setScale(1.05); });
    btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x226622); btnText.setScale(1); });
    btnBg.on('pointerdown', () => { this.scene.start('Game'); });

    // Menu button
    const menuBg = this.add.rectangle(GAME_W / 2, 560, 180, 50, 0x333333)
      .setInteractive({ useHandCursor: true });
    this.add.text(GAME_W / 2, 560, 'Main Menu', {
      fontSize: '20px', color: '#aaaaaa',
    }).setOrigin(0.5);

    menuBg.on('pointerdown', () => { this.scene.start('Menu'); });

    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('Game'));
    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Game'));
  }
}
