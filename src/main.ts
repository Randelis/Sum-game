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
    width:      GAME_W,
    height:     GAME_H,
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
    // Mobile-only game — disable the keyboard plugin entirely so Phaser
    // doesn't allocate listeners we'd never use.
    keyboard: false,
  },
  render: {
    pixelArt:      false,
    antialias:     true,
    roundPixels:   false,
  },
};

const game = new Phaser.Game(config);

// Force Phaser to recompute scale on orientation/visibility changes — mobile
// browsers sometimes change viewport size without firing window.resize.
const refreshScale = (): void => {
  if (game.scale) game.scale.refresh();
};
window.addEventListener('orientationchange', () => setTimeout(refreshScale, 100));
window.addEventListener('resize',            () => setTimeout(refreshScale, 50));
document.addEventListener('visibilitychange', refreshScale);
