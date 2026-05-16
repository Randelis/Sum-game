import Phaser from 'phaser';
import { GAME_W, GAME_H } from './utils/constants';
import { BootScene }     from './scenes/BootScene';
import { PreloadScene }  from './scenes/PreloadScene';
import { MenuScene }     from './scenes/MenuScene';
import { GameScene }     from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type:            Phaser.AUTO,
  width:           GAME_W,
  height:          GAME_H,
  backgroundColor: '#0a0f0a',
  parent:          'game',
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    GameScene,
    GameOverScene,
  ],
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade:  {
      gravity: { x: 0, y: 0 },
      debug:   false,
    },
  },
  input: {
    activePointers: 4,
  },
  render: {
    pixelArt:      false,
    antialias:     true,
    roundPixels:   false,
  },
};

new Phaser.Game(config);
