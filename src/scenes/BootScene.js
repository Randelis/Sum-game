import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // All visuals are procedural — nothing to load.
    // A loading bar for future asset loading:
    const bar = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      300, 12, 0x444444,
    );
    const fill = this.add.rectangle(
      this.scale.width / 2 - 150, this.scale.height / 2,
      0, 12, 0x4488ff,
    ).setOrigin(0, 0.5);

    this.load.on('progress', p => { fill.width = 300 * p; });
  }

  create() {
    this.scene.start('GameScene');
  }
}
