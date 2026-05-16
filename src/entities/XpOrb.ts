import Phaser from 'phaser';
import { DEPTH } from '../utils/constants';

export class XpOrb {
  sprite:  Phaser.Physics.Arcade.Image;
  xpValue: number;

  private static ATTRACT_SPEED = 280;
  private static ATTRACT_DIST  = 80;   // overridden by player magnetRadius

  constructor(scene: Phaser.Scene, x: number, y: number, xpValue: number) {
    this.xpValue = xpValue;
    this.sprite = scene.physics.add.image(x, y, 'xpOrb');
    this.sprite.setDepth(DEPTH.ORB);
    this.sprite.setData('orb', this);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setDamping(true);
    body.setDrag(0.92);

    // Small pop-out velocity
    const angle = Math.random() * Math.PI * 2;
    body.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
  }

  update(px: number, py: number, magnetRadius: number): void {
    const dx  = px - this.sprite.x;
    const dy  = py - this.sprite.y;
    const d2  = dx * dx + dy * dy;
    const r   = magnetRadius > 0 ? magnetRadius : XpOrb.ATTRACT_DIST;
    if (d2 < r * r) {
      const len = Math.sqrt(d2) || 1;
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(
        (dx / len) * XpOrb.ATTRACT_SPEED,
        (dy / len) * XpOrb.ATTRACT_SPEED,
      );
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
