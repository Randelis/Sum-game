import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../utils/constants';
import { SaveSystem }      from '../systems/SaveSystem';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    // Backup: hide the HTML boot-status if it's still showing
    const _w = window as unknown as { hideBootStatus?: () => void };
    _w.hideBootStatus?.();

    const save   = new SaveSystem();
    const hiScore = save.getHighScore();

    // Background
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0f0a);

    // Title
    this.add.text(GAME_W / 2, 180, '☠ ZOMBIE SHOOTER', {
      fontSize: '52px', color: '#ff4444',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 250, 'Survive the endless horde', {
      fontSize: '22px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // High score
    if (hiScore > 0) {
      this.add.text(GAME_W / 2, 310, `Best score: ${hiScore}`, {
        fontSize: '20px', color: '#ffcc00',
      }).setOrigin(0.5);
    }

    // PLAY button
    const btnBg = this.add.rectangle(GAME_W / 2, 420, 240, 70, 0x226622)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(GAME_W / 2, 420, 'PLAY', {
      fontSize: '34px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x33aa33); btnText.setScale(1.06); });
    btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x226622); btnText.setScale(1); });
    btnBg.on('pointerdown', () => { this._startGame(); });

    // Controls hint
    this.add.text(GAME_W / 2, 530, 'WASD/Joystick to move  •  Auto-aim & shoot  •  SPACE/💨 to dash  •  H/🧪 to heal', {
      fontSize: '15px', color: '#666666',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 560, 'Survive to wave 5 to face the BOSS!', {
      fontSize: '16px', color: '#aa4444',
    }).setOrigin(0.5);

    // Keyboard shortcut
    this.input.keyboard!.once('keydown-ENTER', () => this._startGame());
    this.input.keyboard!.once('keydown-SPACE', () => this._startGame());
  }

  private _startGame(): void {
    this.scene.start('Game');
  }
}
