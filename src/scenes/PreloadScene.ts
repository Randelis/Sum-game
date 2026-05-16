import Phaser from 'phaser';
import { ENEMY_TYPES } from '../data/enemies';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  create(): void {
    this._genTextures();
    this.scene.start('Menu');
  }

  private _genTextures(): void {
    const g = () => this.make.graphics();

    // Player — 32x32 (matches PLAYER.RADIUS=16 → diameter 32)
    {
      const gfx = g();
      gfx.fillStyle(0x1a3050);
      gfx.fillCircle(16, 16, 16);
      gfx.fillStyle(0x4488ff);
      gfx.fillCircle(16, 16, 14);
      gfx.fillStyle(0xeeeeff);
      gfx.fillCircle(16, 16, 6);
      gfx.generateTexture('player', 32, 32);
      gfx.destroy();
    }

    // Bullet — small bright capsule
    {
      const gfx = g();
      gfx.fillStyle(0xffffff);
      gfx.fillRoundedRect(0, 1, 10, 4, 2);
      gfx.generateTexture('bullet', 10, 6);
      gfx.destroy();
    }

    // Boss base — 64x64 (matches body radius 32)
    {
      const gfx = g();
      gfx.fillStyle(0x000000);
      gfx.fillCircle(32, 32, 32);
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(32, 32, 28);
      gfx.generateTexture('boss', 64, 64);
      gfx.destroy();
    }

    // XP orb — cyan glow
    {
      const gfx = g();
      gfx.fillStyle(0x004466);
      gfx.fillCircle(8, 8, 8);
      gfx.fillStyle(0x00ffee);
      gfx.fillCircle(8, 8, 5);
      gfx.fillStyle(0xffffff, 0.7);
      gfx.fillCircle(7, 7, 2);
      gfx.generateTexture('xpOrb', 16, 16);
      gfx.destroy();
    }

    // Flask pickup
    {
      const gfx = g();
      gfx.fillStyle(0x886633);
      gfx.fillRect(7, 2, 8, 4); // cork
      gfx.fillStyle(0x1a4d2a);
      gfx.fillRoundedRect(3, 6, 16, 20, 4);
      gfx.fillStyle(0x33cc66);
      gfx.fillRoundedRect(5, 9, 12, 15, 3);
      gfx.fillStyle(0xaaffaa, 0.6);
      gfx.fillCircle(8, 13, 2);
      gfx.generateTexture('flask', 22, 28);
      gfx.destroy();
    }

    // Ammo box
    {
      const gfx = g();
      gfx.fillStyle(0x6b6b2a);
      gfx.fillRect(0, 0, 22, 18);
      gfx.fillStyle(0xaaaa44);
      gfx.fillRect(2, 2, 18, 14);
      gfx.fillStyle(0x000000);
      gfx.fillRect(8, 6, 6, 2);
      gfx.fillRect(8, 10, 6, 2);
      gfx.generateTexture('ammoBox', 22, 18);
      gfx.destroy();
    }

    // Enemy textures — texture size exactly matches body radius*2
    for (const def of Object.values(ENEMY_TYPES)) {
      const r   = def.radius;
      const d   = r * 2;
      const gfx = g();
      gfx.fillStyle(this._darken(def.color));
      gfx.fillCircle(r, r, r);
      gfx.fillStyle(def.color);
      gfx.fillCircle(r, r, r - 2);
      // Eye dots
      gfx.fillStyle(0x111111);
      const eyeR = Math.max(1, Math.round(r * 0.18));
      const eyeOff = Math.round(r * 0.35);
      gfx.fillCircle(r - eyeOff, r - 2, eyeR);
      gfx.fillCircle(r + eyeOff, r - 2, eyeR);
      gfx.generateTexture(`enemy_${def.type}`, d, d);
      gfx.destroy();
    }

    // Ground tile (dark dirt with cracks)
    {
      const gfx = g();
      gfx.fillStyle(0x2c3825);
      gfx.fillRect(0, 0, 128, 128);
      // Sparse noise dots
      gfx.fillStyle(0x3a4830, 0.6);
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(Math.random() * 128);
        const y = Math.floor(Math.random() * 128);
        gfx.fillRect(x, y, 2, 2);
      }
      // Darker grime patches
      gfx.fillStyle(0x1f2818, 0.3);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(Math.random() * 96);
        const y = Math.floor(Math.random() * 96);
        gfx.fillCircle(x + 16, y + 16, 8 + Math.random() * 12);
      }
      gfx.generateTexture('ground', 128, 128);
      gfx.destroy();
    }
  }

  private _darken(color: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) - 40);
    const g = Math.max(0, ((color >>  8) & 0xff) - 40);
    const b = Math.max(0,  (color        & 0xff) - 40);
    return (r << 16) | (g << 8) | b;
  }
}
