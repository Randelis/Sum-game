import Phaser from 'phaser';
import { EnemyDef } from '../data/enemies';
import { DEPTH } from '../utils/constants';
import { Bullet } from './Bullet';

export class Enemy {
  scene:   Phaser.Scene;
  sprite:  Phaser.Physics.Arcade.Image;
  def:     EnemyDef;
  type:    string;
  hp:      number;
  maxHp:   number;
  wave:    number;
  isDead:  boolean = false;

  // Behaviour timers
  private _shootTimer:  number = 0;
  private _healTimer:   number = 0;
  private _slowTimer:   number = 0;

  // Berserker
  private _isRaging: boolean = false;

  // For ghost dodge flash
  private _dodgeFlash: number = 0;

  constructor(
    scene:  Phaser.Scene,
    x:      number,
    y:      number,
    def:    EnemyDef,
    wave:   number,
  ) {
    this.scene  = scene;
    this.def    = def;
    this.type   = def.type;
    this.wave   = wave;
    this.maxHp  = def.hp(wave);
    this.hp     = this.maxHp;

    this.sprite = scene.physics.add.image(x, y, `enemy_${def.type}`);
    if (!scene.textures.exists(`enemy_${def.type}`)) {
      this.sprite.setTexture('enemy_basic');
    }
    this.sprite.setDepth(DEPTH.ENEMY);
    this.sprite.setData('enemy', this);
    if (def.alpha !== undefined) this.sprite.setAlpha(def.alpha);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(def.radius);
    body.setCollideWorldBounds(true);
  }

  update(dt: number, px: number, py: number, enemyBulletGroup: Phaser.Physics.Arcade.Group, nearbyEnemies: Enemy[]): void {
    if (this.isDead) return;

    this._tickTimers(dt);
    this._moveTowardPlayer(px, py);
    this._handleRanged(dt, px, py, enemyBulletGroup);
    this._handleHealer(dt, nearbyEnemies);
    this._handleScreamer(px, py, nearbyEnemies);
    this._handleBerserker();

    if (this._dodgeFlash > 0) {
      this._dodgeFlash -= dt;
      if (this._dodgeFlash <= 0) this.sprite.setAlpha(this.def.alpha ?? 1);
    }
  }

  takeDamage(amount: number, _fromAoe = false): boolean {
    if (this.isDead) return false;

    // Ghost dodge
    if (this.def.ghost && Math.random() < (this.def.dodgeChance ?? 0)) {
      this.sprite.setAlpha(1);
      this._dodgeFlash = 0.12;
      this.scene.time.delayedCall(120, () => {
        if (!this.isDead) this.sprite.setAlpha(this.def.alpha ?? 1);
      });
      return false;
    }

    let dmg = amount;
    if (this.def.armored) dmg *= (this.def.armorMult ?? 0.5);
    this.hp -= dmg;

    if (this.hp <= 0) {
      this.isDead = true;
      return true; // caller handles death FX / loot
    }
    return false;
  }

  slowFor(ms: number): void {
    this._slowTimer = Math.max(this._slowTimer, ms / 1000);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  private _tickTimers(dt: number): void {
    if (this._shootTimer > 0) this._shootTimer -= dt;
    if (this._healTimer  > 0) this._healTimer  -= dt;
    if (this._slowTimer  > 0) this._slowTimer  -= dt;
  }

  private _moveTowardPlayer(px: number, py: number): void {
    const dx  = px - this.sprite.x;
    const dy  = py - this.sprite.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    let spd   = this.def.speed(this.wave);
    if (this._slowTimer > 0) spd *= 0.4;
    if (this._isRaging)      spd *= (this.def.rageMult ?? 1.8);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / len) * spd, (dy / len) * spd);
  }

  private _handleRanged(dt: number, px: number, py: number, group: Phaser.Physics.Arcade.Group): void {
    if (!this.def.ranged) return;
    void dt;

    const dx   = px - this.sprite.x;
    const dy   = py - this.sprite.y;
    const d2   = dx * dx + dy * dy;
    const rng  = this.def.shootRange ?? 340;
    if (d2 > rng * rng) return;
    if (this._shootTimer > 0) return;

    this._shootTimer = this.def.shootInterval ?? 2.2;
    const angle      = Math.atan2(dy, dx);
    const bullet     = group.get() as Bullet | null;
    if (!bullet) return;

    bullet.fire(
      this.sprite.x, this.sprite.y,
      angle, 220,
      this.def.projDamage ?? 8,
      0, 0, rng * 1.2,
      false,
    );
  }

  private _handleHealer(dt: number, others: Enemy[]): void {
    if (!this.def.healer) return;
    void dt;
    if (this._healTimer > 0) return;
    this._healTimer = 1;

    const r2 = (this.def.healRadius ?? 110) ** 2;
    for (const e of others) {
      if (e === this || e.isDead) continue;
      const dx = e.sprite.x - this.sprite.x;
      const dy = e.sprite.y - this.sprite.y;
      if (dx * dx + dy * dy < r2) {
        e.hp = Math.min(e.maxHp, e.hp + (this.def.healRate ?? 3));
      }
    }
  }

  private _handleScreamer(_px: number, _py: number, others: Enemy[]): void {
    if (!this.def.screamer) return;
    const r2 = (this.def.slowRadius ?? 120) ** 2;
    for (const e of others) {
      if (e === this || e.isDead) continue;
      const dx = e.sprite.x - this.sprite.x;
      const dy = e.sprite.y - this.sprite.y;
      if (dx * dx + dy * dy < r2) {
        // screamers buff nearby rather than slowing them; slow the PLAYER instead (handled in CombatSystem)
      }
    }
  }

  private _handleBerserker(): void {
    if (!this.def.berserker) return;
    this._isRaging = (this.hp / this.maxHp) <= (this.def.rageThreshold ?? 0.4);
    if (this._isRaging) this.sprite.setTint(0xff2200);
    else                this.sprite.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
