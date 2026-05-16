import Phaser from 'phaser';
import { BossDef, BossAbility } from '../data/bosses';
import { DEPTH } from '../utils/constants';
import { Bullet } from './Bullet';

export class Boss {
  scene:    Phaser.Scene;
  sprite:   Phaser.Physics.Arcade.Image;
  def:      BossDef;
  hp:       number;
  maxHp:    number;
  phase:    1 | 2 | 3 = 1;
  isDead:   boolean   = false;

  private _abilityCooldowns: Map<string, number> = new Map();
  private _ultimateTimer: number;
  private _slowTimer: number = 0;

  onDeath?: () => void;
  onAbility?: (id: string) => void;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    def: BossDef,
    wave: number,
  ) {
    this.scene    = scene;
    this.def      = def;
    this.maxHp    = def.hp(wave);
    this.hp       = this.maxHp;
    this._ultimateTimer = def.ultimateMs / 1000;

    this.sprite = scene.physics.add.image(x, y, 'boss');
    this.sprite.setDepth(DEPTH.ENEMY + 1);
    this.sprite.setTint(def.color);
    this.sprite.setScale(2.2);
    this.sprite.setData('boss', this);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(32);
    body.setCollideWorldBounds(true);

    for (const ab of def.abilities) {
      this._abilityCooldowns.set(ab.id, 0);
    }
  }

  update(dt: number, px: number, py: number, bulletGroup: Phaser.Physics.Arcade.Group): void {
    if (this.isDead) return;

    this._tickPhase();
    this._moveTowardPlayer(dt, px, py);
    this._tickAbilities(dt, px, py, bulletGroup);
    this._tickUltimate(dt, px, py);
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.isDead = true;
      this.sprite.setVisible(false);
      this.onDeath?.();
    }
  }

  slowFor(ms: number): void {
    this._slowTimer = Math.max(this._slowTimer, ms / 1000);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get hpFraction(): number { return this.hp / this.maxHp; }

  private _tickPhase(): void {
    const f = this.hpFraction;
    const newPhase: 1 | 2 | 3 = f > 0.6 ? 1 : f > 0.25 ? 2 : 3;
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      this.sprite.setAlpha(newPhase === 3 ? 0.85 : 1);
      // Speed boost at phase transitions
      const spd = this.def.speed * (1 + (newPhase - 1) * 0.25);
      (this.sprite.body as Phaser.Physics.Arcade.Body).setMaxVelocity(spd * 2, spd * 2);
    }
  }

  private _moveTowardPlayer(_dt: number, px: number, py: number): void {
    const dx   = px - this.sprite.x;
    const dy   = py - this.sprite.y;
    const len  = Math.sqrt(dx * dx + dy * dy) || 1;
    let   spd  = this.def.speed * (1 + (this.phase - 1) * 0.2);
    if (this._slowTimer > 0) {
      this._slowTimer -= _dt;
      spd *= 0.5;
    }
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / len) * spd, (dy / len) * spd);
  }

  private _tickAbilities(dt: number, px: number, py: number, group: Phaser.Physics.Arcade.Group): void {
    for (const ab of this.def.abilities) {
      const cd = (this._abilityCooldowns.get(ab.id) ?? 0) - dt;
      this._abilityCooldowns.set(ab.id, cd);
      if (cd <= 0) {
        this._abilityCooldowns.set(ab.id, ab.cooldown * (this.phase === 3 ? 0.7 : 1));
        this._fireAbility(ab, px, py, group);
      }
    }
  }

  private _fireAbility(ab: BossAbility, px: number, py: number, group: Phaser.Physics.Arcade.Group): void {
    this.onAbility?.(ab.id);

    switch (ab.id) {
      case 'slam':
        this._burstShot(group, px, py, 8, 200, 25, 0);
        break;
      case 'summon':
        // WaveSystem handles enemy spawning; signal only
        break;
      case 'roar':
        // Visual handled by CombatSystem slow effect on player
        break;
      case 'charge':
        this._dashToward(px, py);
        break;
      case 'deathRay':
        this._burstShot(group, px, py, 1, 600, 40, 0);
        break;
      case 'shockwave':
        this._radialShot(group, 12, 180, 20, 60);
        break;
      case 'teleport':
        this._teleportNear(px, py);
        break;
      case 'poisonCloud':
      case 'spitVolley':
        this._burstShot(group, px, py, 5, 220, 15, 0);
        break;
      case 'fireRing':
      case 'firePillars':
        this._radialShot(group, 8, 250, 18, 0);
        break;
      case 'webSnare':
      case 'poisonSpit':
      case 'spiderSpawn':
        this._burstShot(group, px, py, 3, 200, 12, 0);
        break;
      default:
        break;
    }
  }

  private _burstShot(
    group: Phaser.Physics.Arcade.Group,
    tx: number, ty: number,
    count: number, speed: number, damage: number, aoe: number,
  ): void {
    const baseAngle = Math.atan2(ty - this.sprite.y, tx - this.sprite.x);
    const spread    = 0.15;
    for (let i = 0; i < count; i++) {
      const angle  = baseAngle + (Math.random() - 0.5) * spread * 2;
      const bullet = group.get() as Bullet | null;
      if (!bullet) return;
      bullet.fire(this.sprite.x, this.sprite.y, angle, speed, damage, 0, aoe, 600, false);
    }
  }

  private _radialShot(
    group: Phaser.Physics.Arcade.Group,
    count: number, speed: number, damage: number, aoe: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      const bullet = group.get() as Bullet | null;
      if (!bullet) return;
      bullet.fire(this.sprite.x, this.sprite.y, angle, speed, damage, 0, aoe, 500, false);
    }
  }

  private _dashToward(px: number, py: number): void {
    const dx   = px - this.sprite.x;
    const dy   = py - this.sprite.y;
    const len  = Math.sqrt(dx * dx + dy * dy) || 1;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / len) * this.def.speed * 4, (dy / len) * this.def.speed * 4);
    this.scene.time.delayedCall(500, () => {
      if (!this.isDead) body.setVelocity(0, 0);
    });
  }

  private _teleportNear(px: number, py: number): void {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 120 + Math.random() * 80;
    this.sprite.setPosition(px + Math.cos(angle) * dist, py + Math.sin(angle) * dist);
  }

  private _tickUltimate(dt: number, px: number, py: number): void {
    this._ultimateTimer -= dt;
    if (this._ultimateTimer > 0) return;
    this._ultimateTimer = this.def.ultimateMs / 1000 * (this.phase === 3 ? 0.6 : 1);

    // Ultimate: large radial burst
    this.onAbility?.('ultimate');
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    void px; void py; void body;
    // Radial burst — requires bullet group; skip if full
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
