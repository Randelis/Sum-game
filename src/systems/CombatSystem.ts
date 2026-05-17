import Phaser from 'phaser';
import { Player }  from '../entities/Player';
import { Enemy }   from '../entities/Enemy';
import { Boss }    from '../entities/Boss';
import { Bullet }  from '../entities/Bullet';
import { XpOrb }   from '../entities/XpOrb';
import { Pickup }  from '../entities/Pickup';
import { DEPTH }   from '../utils/constants';

export interface CombatCallbacks {
  onEnemyKilled:  (enemy: Enemy, x: number, y: number) => void;
  onBossKilled:   (boss: Boss)  => void;
  onPlayerDamage: (amount: number) => void;
  showDamageNum:  (x: number, y: number, amount: number, color?: number) => void;
}

export class CombatSystem {
  scene:  Phaser.Scene;
  player: Player;

  private _cb: CombatCallbacks;

  constructor(scene: Phaser.Scene, player: Player, cb: CombatCallbacks) {
    this.scene  = scene;
    this.player = player;
    this._cb    = cb;
  }

  // Call once after bullet group and enemy sprite group are ready
  setupOverlaps(
    playerBullets:  Phaser.Physics.Arcade.Group,
    enemyBullets:   Phaser.Physics.Arcade.Group,
    enemySprites:   Phaser.Physics.Arcade.Group,
    bossSprites:    Phaser.Physics.Arcade.Group,
    playerSprite:   Phaser.Physics.Arcade.Image,
    xpOrbSprites:   Phaser.Physics.Arcade.Group,
    pickupSprites:  Phaser.Physics.Arcade.Group,
  ): void {
    // Player bullets → enemies
    this.scene.physics.add.overlap(
      playerBullets, enemySprites,
      this._onPlayerBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Player bullets → boss
    this.scene.physics.add.overlap(
      playerBullets, bossSprites,
      this._onPlayerBulletHitBoss as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Enemy bullets → player
    this.scene.physics.add.overlap(
      enemyBullets, playerSprite,
      this._onEnemyBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Enemy contact → player
    this.scene.physics.add.overlap(
      enemySprites, playerSprite,
      this._onEnemyContactPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Boss contact → player
    this.scene.physics.add.overlap(
      bossSprites, playerSprite,
      this._onBossContactPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // XP orb pickup
    this.scene.physics.add.overlap(
      xpOrbSprites, playerSprite,
      this._onXpOrbPickup as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Pickup (flask / ammo)
    this.scene.physics.add.overlap(
      pickupSprites, playerSprite,
      this._onPickup as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );
  }

  private _onPlayerBulletHitEnemy(bulletObj: Phaser.GameObjects.GameObject, spriteObj: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObj as Bullet;
    const sprite = spriteObj as Phaser.Physics.Arcade.Image;
    const enemy  = sprite.getData('enemy') as Enemy | undefined;
    if (!enemy || enemy.isDead) return;

    const killed = enemy.takeDamage(bullet.damage);
    this._cb.showDamageNum(enemy.x, enemy.y, bullet.damage, 0xffffff);

    // Vampirism — heal player for fraction of damage dealt
    if (this.player.stats.vampirism > 0) {
      this.player.heal(Math.round(bullet.damage * this.player.stats.vampirism));
    }

    if (killed) {
      this._cb.onEnemyKilled(enemy, enemy.x, enemy.y);
      if (enemy.def.explodes) {
        this._doExplosion(enemy.x, enemy.y, enemy.def.explosionRadius ?? 80, 30);
      }
    }

    if (bullet.pierce <= 0) {
      if (bullet.aoe > 0) this._doExplosion(bullet.x, bullet.y, bullet.aoe, bullet.damage * 0.6);
      bullet.kill();
    } else {
      bullet.pierce--;
    }
  }

  private _onPlayerBulletHitBoss(bulletObj: Phaser.GameObjects.GameObject, spriteObj: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObj as Bullet;
    const sprite = spriteObj as Phaser.Physics.Arcade.Image;
    const boss   = sprite.getData('boss') as Boss | undefined;
    if (!boss || boss.isDead) return;

    boss.takeDamage(bullet.damage);
    this._cb.showDamageNum(boss.x, boss.y, bullet.damage, 0xffff00);

    if (this.player.stats.vampirism > 0) {
      this.player.heal(Math.round(bullet.damage * this.player.stats.vampirism));
    }

    if (boss.isDead) this._cb.onBossKilled(boss);

    if (bullet.pierce <= 0) {
      if (bullet.aoe > 0) this._doExplosion(bullet.x, bullet.y, bullet.aoe, bullet.damage * 0.5);
      bullet.kill();
    } else {
      bullet.pierce--;
    }
  }

  private _onEnemyBulletHitPlayer(bulletObj: Phaser.GameObjects.GameObject, _playerObj: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObj as Bullet;
    if (!bullet.active) return;
    this.player.takeDamage(bullet.damage);
    this._cb.onPlayerDamage(bullet.damage);
    bullet.kill();
  }

  private _onEnemyContactPlayer(_spriteObj: Phaser.GameObjects.GameObject, _playerObj: Phaser.GameObjects.GameObject): void {
    const sprite = _spriteObj as Phaser.Physics.Arcade.Image;
    const enemy  = sprite.getData('enemy') as Enemy | undefined;
    if (!enemy || enemy.isDead) return;
    // Use the short-cooldown contact path so continuous overlap deals real DPS
    // (routing through the 600ms iframe makes standing on enemies harmless).
    this.player.takeContactDamage(enemy.def.contactDamage);
    this._cb.onPlayerDamage(enemy.def.contactDamage);
  }

  private _onBossContactPlayer(_spriteObj: Phaser.GameObjects.GameObject, _playerObj: Phaser.GameObjects.GameObject): void {
    const sprite = _spriteObj as Phaser.Physics.Arcade.Image;
    const boss   = sprite.getData('boss') as Boss | undefined;
    if (!boss || boss.isDead) return;
    // Bosses tick contact damage at a higher multiplier — touching a boss
    // should hurt much more than touching a regular zombie.
    this.player.takeContactDamage(boss.def.contactDamage * 1.5);
    this._cb.onPlayerDamage(boss.def.contactDamage);
  }

  private _onXpOrbPickup(orbSpriteObj: Phaser.GameObjects.GameObject, _playerObj: Phaser.GameObjects.GameObject): void {
    const sprite = orbSpriteObj as Phaser.Physics.Arcade.Image;
    const orb    = sprite.getData('orb') as XpOrb | undefined;
    if (!orb) return;
    // UpgradeSystem handles XP; emit event via scene
    this.scene.events.emit('xpPickup', orb.xpValue);
    orb.destroy();
  }

  private _onPickup(pickupSpriteObj: Phaser.GameObjects.GameObject, _playerObj: Phaser.GameObjects.GameObject): void {
    const sprite  = pickupSpriteObj as Phaser.Physics.Arcade.Image;
    const pickup  = sprite.getData('pickup') as Pickup | undefined;
    if (!pickup) return;
    if (pickup.kind === 'flask') {
      this.player.flasks = Math.min(this.player.flasks + 1, 5);
    } else if (pickup.kind === 'ammo') {
      this.player.ammo = this.player.weapon.ammoMax;
    }
    pickup.destroy();
  }

  private _doExplosion(x: number, y: number, radius: number, damage: number): void {
    // Visual ring
    const ring = this.scene.add.circle(x, y, radius, 0xff6600, 0.4).setDepth(DEPTH.FX);
    this.scene.tweens.add({
      targets: ring, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 350, ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
    // Damage is applied by the caller per-enemy via overlap — here we emit so GameScene can check radius
    this.scene.events.emit('explosion', { x, y, radius, damage });
  }
}
