import Phaser from 'phaser';
import { PLAYER, DEPTH } from '../utils/constants';
import { defaultStats, PlayerStats } from '../data/upgrades';
import { WeaponDef, getWeapon, unlockedWeapons } from '../data/weapons';
import { Bullet } from './Bullet';

export class Player {
  scene:      Phaser.Scene;
  sprite:     Phaser.Physics.Arcade.Image;
  stats:      PlayerStats;
  upgrades:   Record<string, number> = {};

  hp:         number;
  level:      number   = 1;
  xp:         number   = 0;
  score:      number   = 0;
  flasks:     number   = PLAYER.FLASKS;
  weapon:     WeaponDef;
  ammo:       number;

  isDashing:    boolean = false;
  isInvincible: boolean = false;
  isReloading:  boolean = false;
  isDead:       boolean = false;

  private _dashTimer:    number = 0;
  private _dashCd:       number = 0;
  private _invulnTimer:  number = 0;
  private _reloadTimer:  number = 0;
  private _shootTimer:   number = 0;
  private _healTimer:    number = 0;
  private _contactCd:    number = 0;

  // auto-aim state
  private _aimAngle: number = 0;

  // pending mobile inputs
  private _pendingDash:   boolean = false;
  private _pendingHeal:   boolean = false;
  private _mobileMove:    { x: number; y: number } = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene  = scene;
    this.stats  = defaultStats();
    this.weapon = getWeapon('pistol');
    this.ammo   = this.weapon.ammoMax;
    this.hp     = this.stats.maxHp;

    this.sprite = scene.physics.add.image(x, y, 'player');
    this.sprite.setDepth(DEPTH.PLAYER);
    this.sprite.setData('player', this);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER.RADIUS);
    body.setCollideWorldBounds(true);
  }

  // Called by MobileInputSystem each frame
  setMobileMove(x: number, y: number): void {
    this._mobileMove.x = x;
    this._mobileMove.y = y;
  }
  triggerDash():  void { this._pendingDash = true; }
  triggerHeal():  void { this._pendingHeal = true; }

  setWeapon(id: string): void {
    this.weapon       = getWeapon(id);
    this.ammo         = this.weapon.ammoMax;
    this.isReloading  = false;
    this._reloadTimer = 0;
  }

  cycleWeapon(): void {
    const available = unlockedWeapons(this.level);
    const idx       = available.findIndex(w => w.id === this.weapon.id);
    const next      = available[(idx + 1) % available.length];
    this.setWeapon(next.id);
  }

  update(dt: number, nearestEnemyX: number | null, nearestEnemyY: number | null, bulletGroup: Phaser.Physics.Arcade.Group): void {
    if (this.isDead) return;

    this._tickTimers(dt);
    this._handleMovement(dt);
    this._handleDash(dt);
    this._handleHeal(dt);
    this._handleAutoAim(nearestEnemyX, nearestEnemyY);
    this._handleAutoShoot(dt, bulletGroup);
    this._handleReload(dt);

    this._pendingDash = false;
    this._pendingHeal = false;
  }

  takeDamage(amount: number): void {
    if (this.isDead || this.isInvincible) return;
    if (Math.random() < this.stats.dodgeChance) return;

    this.hp = Math.max(0, this.hp - amount);
    this.isInvincible   = true;
    this._invulnTimer   = PLAYER.INVULN_MS / 1000;
    this.sprite.setAlpha(0.5);

    if (this.hp <= 0) {
      this.isDead = true;
      this.sprite.setVisible(false);
    }
  }

  // Continuous-contact damage (touching enemies / bosses). Bypasses the long
  // 600 ms iframe so standing on a boss actually deals real DPS, but throttled
  // by its own short cooldown so it remains frame-rate independent.
  takeContactDamage(amount: number): void {
    if (this.isDead || this.isDashing) return;
    if (this._contactCd > 0) return;
    if (Math.random() < this.stats.dodgeChance) return;

    this._contactCd = 0.10;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.isDead = true;
      this.sprite.setVisible(false);
    }
  }

  heal(amount: number): void {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  private _tickTimers(dt: number): void {
    if (this._invulnTimer > 0) {
      this._invulnTimer -= dt;
      if (this._invulnTimer <= 0) {
        this.isInvincible = false;
        this.sprite.setAlpha(1);
      }
    }
    if (this._dashTimer > 0)  this._dashTimer -= dt;
    if (this._dashCd > 0)     this._dashCd    -= dt;
    if (this._shootTimer > 0) this._shootTimer -= dt;
    if (this._healTimer > 0)  this._healTimer  -= dt;
    if (this._contactCd > 0)  this._contactCd  -= dt;
  }

  private _handleMovement(dt: number): void {
    if (this.isDashing) return;

    const mx = this._mobileMove.x;
    const my = this._mobileMove.y;

    const len = Math.sqrt(mx * mx + my * my) || 1;
    const spd = PLAYER.BASE_SPEED * this.stats.speedMult * (mx !== 0 || my !== 0 ? 1 : 0);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((mx / len) * spd, (my / len) * spd);

    void dt;
  }

  private _handleDash(_dt: number): void {
    if (!this._pendingDash) return;
    if (this.isDashing || this._dashCd > 0) return;

    this.isDashing      = true;
    this._dashTimer     = PLAYER.DASH_MS / 1000;
    this._dashCd        = PLAYER.DASH_COOLDOWN;
    this.isInvincible   = true;
    this._invulnTimer   = Math.max(this._invulnTimer, PLAYER.DASH_MS / 1000);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const vx   = body.velocity.x || Math.cos(this._aimAngle);
    const vy   = body.velocity.y || Math.sin(this._aimAngle);
    const len  = Math.sqrt(vx * vx + vy * vy) || 1;
    const spd  = PLAYER.BASE_SPEED * PLAYER.DASH_MULT;
    body.setVelocity((vx / len) * spd, (vy / len) * spd);

    this.scene.time.delayedCall(PLAYER.DASH_MS, () => {
      this.isDashing = false;
    });
  }

  private _handleHeal(_dt: number): void {
    if (this._healTimer > 0) return;
    if (!this._pendingHeal) return;
    if (this.flasks <= 0) return;
    if (this.hp >= this.stats.maxHp) return; // don't waste a flask at full HP

    this.flasks--;
    this._healTimer = PLAYER.FLASK_MS / 1000;
    this.scene.time.delayedCall(PLAYER.FLASK_MS, () => {
      this.heal(PLAYER.FLASK_HEAL);
    });
  }

  private _handleAutoAim(ex: number | null, ey: number | null): void {
    if (ex === null || ey === null) return;
    this._aimAngle = Math.atan2(ey - this.sprite.y, ex - this.sprite.x);
  }

  private _handleAutoShoot(dt: number, bulletGroup: Phaser.Physics.Arcade.Group): void {
    void dt;
    if (this.isReloading) return;
    if (this.ammo <= 0) {
      this._startReload();
      return;
    }

    const interval = 1 / (this.weapon.fireRate * this.stats.fireRateMult);
    if (this._shootTimer > 0) return;

    const totalBullets = this.weapon.bulletCount + this.stats.bulletCount;
    for (let i = 0; i < totalBullets; i++) {
      const spread  = this.weapon.spread;
      const angle   = this._aimAngle + (Math.random() - 0.5) * spread * 2;
      const damage  = Math.round(this.weapon.damage * this.stats.damageMult);
      const pierce  = this.weapon.pierce + Math.round(this.stats.pierceMult);
      const aoe     = this.weapon.aoe * this.stats.aoeMult;
      const bullet  = bulletGroup.get() as Bullet | null;
      if (!bullet) continue;

      bullet.fire(
        this.sprite.x, this.sprite.y,
        angle, this.weapon.bulletSpeed,
        damage, pierce, aoe,
        this.weapon.range,
        true,
      );
    }

    this.ammo--;
    this._shootTimer = interval;
  }

  private _handleReload(dt: number): void {
    if (!this.isReloading) return;
    this._reloadTimer -= dt;
    if (this._reloadTimer <= 0) {
      this.ammo        = this.weapon.ammoMax;
      this.isReloading = false;
    }
  }

  private _startReload(): void {
    if (this.isReloading) return;
    this.isReloading  = true;
    this._reloadTimer = this.weapon.reloadTime * this.stats.reloadMult;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
