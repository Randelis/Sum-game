import Phaser from 'phaser';
import { DEPTH } from '../utils/constants';

export type PickupKind = 'flask' | 'ammo';

export class Pickup {
  sprite: Phaser.Physics.Arcade.Image;
  kind:   PickupKind;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PickupKind) {
    this.kind   = kind;
    const key   = kind === 'flask' ? 'flask' : 'ammoBox';
    this.sprite = scene.physics.add.image(x, y, key);
    this.sprite.setDepth(DEPTH.PICKUP);
    this.sprite.setData('pickup', this);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    (this.sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
