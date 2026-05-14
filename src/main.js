import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'phaser-parent',
  backgroundColor: '#111111',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:      window.innerWidth,
    height:     window.innerHeight,
  },
  scene: [BootScene, GameScene],
};

const game = new Phaser.Game(config);
export default game;
