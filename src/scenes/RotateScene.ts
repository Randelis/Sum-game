import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../utils/constants';

export class RotateScene extends Phaser.Scene {
  constructor() { super('Rotate'); }

  create(): void {
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000);
    this.add.text(GAME_W / 2, GAME_H / 2 - 40, '↩ Please rotate your device to landscape', {
      fontSize: '26px', color: '#ffffff', align: 'center',
      wordWrap: { width: GAME_W - 80 },
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H / 2 + 40, '📱', { fontSize: '64px' }).setOrigin(0.5);

    // Poll for orientation change
    this.time.addEvent({
      loop: true, delay: 500,
      callback: () => {
        if (window.innerWidth > window.innerHeight) {
          this.scene.stop('Rotate');
          this.scene.resume(this.registry.get('_rotateReturnScene') ?? 'Menu');
        }
      },
    });
  }
}
