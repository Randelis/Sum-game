import Phaser from 'phaser';
import { ENEMY_TYPES } from '../data/enemies';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  create(): void {
    this._genTextures();
    this.scene.start('Menu');
  }

  private _genTextures(): void {
    // make.graphics() does not add to display list by default
    const g = (_w: number, _h: number) => this.make.graphics();

    // Player — white circle with blue tint
    {
      const gfx = g(32, 32);
      gfx.fillStyle(0x4488ff);
      gfx.fillCircle(16, 16, 16);
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(16, 16, 8);
      gfx.generateTexture('player', 32, 32);
      gfx.destroy();
    }

    // Bullet — small yellow rect
    {
      const gfx = g(8, 4);
      gfx.fillStyle(0xffee44);
      gfx.fillRect(0, 0, 8, 4);
      gfx.generateTexture('bullet', 8, 4);
      gfx.destroy();
    }

    // Boss — large red circle
    {
      const gfx = g(64, 64);
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(32, 32, 32);
      gfx.generateTexture('boss', 64, 64);
      gfx.destroy();
    }

    // XP orb — small cyan circle
    {
      const gfx = g(12, 12);
      gfx.fillStyle(0x00ffee);
      gfx.fillCircle(6, 6, 6);
      gfx.generateTexture('xpOrb', 12, 12);
      gfx.destroy();
    }

    // Flask pickup
    {
      const gfx = g(18, 24);
      gfx.fillStyle(0x33cc66);
      gfx.fillRoundedRect(3, 6, 12, 16, 3);
      gfx.fillStyle(0x888888);
      gfx.fillRect(6, 2, 6, 6);
      gfx.generateTexture('flask', 18, 24);
      gfx.destroy();
    }

    // Ammo box
    {
      const gfx = g(20, 16);
      gfx.fillStyle(0xaaaa44);
      gfx.fillRect(0, 0, 20, 16);
      gfx.lineStyle(1, 0x000000);
      gfx.strokeRect(0, 0, 20, 16);
      gfx.generateTexture('ammoBox', 20, 16);
      gfx.destroy();
    }

    // Enemy textures per type
    for (const def of Object.values(ENEMY_TYPES)) {
      const r   = def.radius;
      const d   = r * 2;
      const gfx = g(d, d);
      gfx.fillStyle(def.color);
      gfx.fillCircle(r, r, r);
      gfx.generateTexture(`enemy_${def.type}`, d, d);
      gfx.destroy();
    }

    // Ground tile
    {
      const gfx = g(128, 128);
      gfx.fillStyle(0x2a3a2a);
      gfx.fillRect(0, 0, 128, 128);
      gfx.lineStyle(1, 0x1e2e1e, 0.5);
      gfx.strokeRect(0, 0, 128, 128);
      gfx.generateTexture('ground', 128, 128);
      gfx.destroy();
    }

    // Minimap dot textures
    {
      const gfx = g(8, 8);
      gfx.fillStyle(0x4488ff);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture('mm_player', 8, 8);
      gfx.destroy();
    }
    {
      const gfx = g(6, 6);
      gfx.fillStyle(0xff4444);
      gfx.fillCircle(3, 3, 3);
      gfx.generateTexture('mm_enemy', 6, 6);
      gfx.destroy();
    }
  }
}
