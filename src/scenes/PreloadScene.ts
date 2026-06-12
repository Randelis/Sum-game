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

    // Player — 32x32 circle (body radius 16). Drawn facing right (angle 0):
    // the sprite is rotated to the aim angle, so the visor/barrel reads as
    // a facing direction.
    {
      const gfx = g();
      gfx.fillStyle(0x0d1726);               // dark rim
      gfx.fillCircle(16, 16, 16);
      gfx.fillStyle(0x2f66b8);               // armor
      gfx.fillCircle(16, 16, 14);
      gfx.fillStyle(0x4f8de0);               // lit top
      gfx.fillCircle(14, 14, 11);
      gfx.fillStyle(0x0d1726);               // visor slot
      gfx.fillRoundedRect(17, 11, 13, 10, 4);
      gfx.fillStyle(0x9fd8ff);               // visor glow
      gfx.fillRoundedRect(19, 13, 10, 6, 3);
      gfx.generateTexture('player', 32, 32);
      gfx.destroy();
    }

    // Bullet — bright tracer capsule with a soft halo (rendered additively)
    {
      const gfx = g();
      gfx.fillStyle(0xffcc66, 0.35);
      gfx.fillRoundedRect(0, 0, 14, 8, 4);
      gfx.fillStyle(0xffffff);
      gfx.fillRoundedRect(2, 2, 10, 4, 2);
      gfx.generateTexture('bullet', 14, 8);
      gfx.destroy();
    }

    // Boss base — 64x64, white so def.color tint applies. Spiked silhouette
    // with shaded body and menacing eyes.
    {
      const gfx = g();
      // spikes
      gfx.fillStyle(0xbbbbbb);
      for (let i = 0; i < 10; i++) {
        const a  = (i / 10) * Math.PI * 2;
        const x1 = 32 + Math.cos(a) * 31;
        const y1 = 32 + Math.sin(a) * 31;
        const x2 = 32 + Math.cos(a + 0.22) * 24;
        const y2 = 32 + Math.sin(a + 0.22) * 24;
        const x3 = 32 + Math.cos(a - 0.22) * 24;
        const y3 = 32 + Math.sin(a - 0.22) * 24;
        gfx.fillTriangle(x1, y1, x2, y2, x3, y3);
      }
      gfx.fillStyle(0x666666);               // rim
      gfx.fillCircle(32, 32, 26);
      gfx.fillStyle(0xffffff);               // body (tint target)
      gfx.fillCircle(32, 32, 23);
      gfx.fillStyle(0xdddddd);               // lower shade
      gfx.fillCircle(34, 35, 18);
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(30, 29, 16);
      // eyes
      gfx.fillStyle(0x111111);
      gfx.fillCircle(24, 28, 5);
      gfx.fillCircle(40, 28, 5);
      gfx.fillStyle(0x440000);
      gfx.fillCircle(25, 29, 2);
      gfx.fillCircle(41, 29, 2);
      gfx.generateTexture('boss', 64, 64);
      gfx.destroy();
    }

    // XP orb — cyan glow
    {
      const gfx = g();
      gfx.fillStyle(0x00ffee, 0.18);
      gfx.fillCircle(8, 8, 8);
      gfx.fillStyle(0x008899);
      gfx.fillCircle(8, 8, 6);
      gfx.fillStyle(0x00ffee);
      gfx.fillCircle(8, 8, 4);
      gfx.fillStyle(0xeaffff, 0.9);
      gfx.fillCircle(6.5, 6.5, 1.8);
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
      gfx.fillStyle(0x4a4a20);
      gfx.fillRoundedRect(0, 0, 22, 18, 3);
      gfx.fillStyle(0x8a8a3a);
      gfx.fillRoundedRect(2, 2, 18, 14, 2);
      gfx.fillStyle(0x2a2a12);
      gfx.fillRect(8, 6, 6, 2);
      gfx.fillRect(8, 10, 6, 2);
      gfx.generateTexture('ammoBox', 22, 18);
      gfx.destroy();
    }

    // Enemy textures — texture size exactly matches body radius*2.
    // Shaded body, dark rim, glowing eyes, jagged mouth.
    for (const def of Object.values(ENEMY_TYPES)) {
      const r   = def.radius;
      const d   = r * 2;
      const gfx = g();
      gfx.fillStyle(this._shade(def.color, -70));      // rim
      gfx.fillCircle(r, r, r);
      gfx.fillStyle(this._shade(def.color, -25));      // base
      gfx.fillCircle(r, r, r - 1.5);
      gfx.fillStyle(def.color);                        // lit top-left
      gfx.fillCircle(r - r * 0.12, r - r * 0.12, r * 0.78);
      gfx.fillStyle(this._shade(def.color, 35), 0.55); // highlight
      gfx.fillCircle(r - r * 0.3, r - r * 0.35, r * 0.3);
      // Eyes — dark sockets with hot pupils
      const eyeR   = Math.max(1.5, r * 0.2);
      const eyeOff = r * 0.38;
      gfx.fillStyle(0x100808);
      gfx.fillCircle(r - eyeOff, r - r * 0.1, eyeR);
      gfx.fillCircle(r + eyeOff, r - r * 0.1, eyeR);
      gfx.fillStyle(0xff3322);
      gfx.fillCircle(r - eyeOff, r - r * 0.1, eyeR * 0.45);
      gfx.fillCircle(r + eyeOff, r - r * 0.1, eyeR * 0.45);
      // Mouth
      gfx.fillStyle(0x100808, 0.85);
      gfx.fillRoundedRect(r - r * 0.35, r + r * 0.35, r * 0.7, Math.max(2, r * 0.16), 2);
      gfx.generateTexture(`enemy_${def.type}`, d, d);
      gfx.destroy();
    }

    // Ground tile — 256px wasteland: layered soil patches, subtle speckle,
    // faint cracks. Larger tile + low contrast avoids the repeating-dot look.
    {
      const S   = 256;
      const gfx = g();
      gfx.fillStyle(0x252e1f);
      gfx.fillRect(0, 0, S, S);
      // Many small low-contrast tonal patches — big high-alpha blobs read as
      // repeating polka dots once tiled.
      for (let i = 0; i < 26; i++) {
        gfx.fillStyle(i % 2 ? 0x212a1c : 0x293323, 0.30);
        gfx.fillCircle(Math.random() * S, Math.random() * S, 12 + Math.random() * 22);
      }
      // Subtle grime
      gfx.fillStyle(0x1d2618, 0.22);
      for (let i = 0; i < 16; i++) {
        gfx.fillCircle(Math.random() * S, Math.random() * S, 8 + Math.random() * 14);
      }
      // Fine speckle
      for (let i = 0; i < 220; i++) {
        gfx.fillStyle(Math.random() < 0.5 ? 0x303d29 : 0x1c2517, 0.4);
        const x = Math.random() * S, y = Math.random() * S;
        gfx.fillRect(x, y, 1.5, 1.5);
      }
      // Cracks — short dark polylines
      gfx.lineStyle(1, 0x161e12, 0.6);
      for (let i = 0; i < 7; i++) {
        let x = Math.random() * S, y = Math.random() * S;
        gfx.beginPath();
        gfx.moveTo(x, y);
        for (let s2 = 0; s2 < 4; s2++) {
          x += (Math.random() - 0.5) * 42;
          y += (Math.random() - 0.5) * 42;
          gfx.lineTo(x, y);
        }
        gfx.strokePath();
      }
      gfx.generateTexture('ground', S, S);
      gfx.destroy();
    }

    // Vignette — real radial gradient via a CanvasTexture (Graphics can't
    // erase, so rings would band). Stretched over the screen at runtime.
    {
      const W = 480, H = 270;
      const tex  = this.textures.createCanvas('vignette', W, H);
      if (tex) {
        const ctx  = tex.getContext();
        const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.62);
        grad.addColorStop(0,   'rgba(0,0,0,0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.28)');
        grad.addColorStop(1,   'rgba(0,0,0,0.62)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        tex.refresh();
      }
    }
  }

  private _shade(color: number, amt: number): number {
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const r = clamp(((color >> 16) & 0xff) + amt);
    const g = clamp(((color >>  8) & 0xff) + amt);
    const b = clamp( (color        & 0xff) + amt);
    return (r << 16) | (g << 8) | b;
  }
}
