import { createActor } from 'xstate';
import { playerMachine } from '../machines/playerMachine.js';
import Bullet from './Bullet.js';
import {
  PLAYER_RADIUS, PLAYER_SPEED, PLAYER_DASH_SPEED, PLAYER_MAX_HP,
  PLAYER_FLASKS, PLAYER_FLASK_HEAL, DEPTH_PLAYER, WORLD_WIDTH, WORLD_HEIGHT,
} from '../constants.js';
import { WEAPONS } from '../data/weapons.js';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;

    // ── Stats & upgrades ──────────────────────────────────────────────────
    this.maxHp   = PLAYER_MAX_HP;
    this.hp      = PLAYER_MAX_HP;
    this.flasks  = PLAYER_FLASKS;
    this.upgrades = {};       // { upgradeId: level }
    this.shieldCharges = 0;
    this.xp      = 0;
    this.xpToNext = 100;
    this.level   = 1;

    // Weapon state
    this.weapons     = [WEAPONS[0]];
    this.weaponIndex = 0;
    this.ammo        = WEAPONS[0].ammoMax ?? 30;
    this.ammoMax     = 30;
    this.reloading   = false;
    this.reloadTimer = 0;
    this.shootTimer  = 0;
    this.angle       = 0;

    // Dash
    this.dashTimer    = 0;
    this.dashCooldown = 3.5;
    this.dashCdTimer  = 0;

    // Timers driven by external systems
    this._slowTimer  = 0;
    this._regenTimer = 0;

    // ── Sprite ───────────────────────────────────────────────────────────
    this.sprite = scene.add.circle(x, y, PLAYER_RADIUS, 0x4488ff).setDepth(DEPTH_PLAYER);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(PLAYER_RADIUS, -PLAYER_RADIUS, -PLAYER_RADIUS);
    this.sprite.body.setDrag(1200);
    this.sprite.body.setMaxVelocity(600);
    this.sprite.body.allowGravity = false;
    this.sprite.body.setCollideWorldBounds(true);

    // Eye angle (visual)
    this.eyeAngle = 0;

    // ── XState machine ───────────────────────────────────────────────────
    this.actor = createActor(playerMachine);
    this.actor.start();
  }

  // ── Computed stat helpers ─────────────────────────────────────────────
  get currentWeapon() { return this.weapons[this.weaponIndex]; }

  effectiveSpeed() {
    const up = this.upgrades;
    let spd = PLAYER_SPEED * (1 + (up.speed || 0) * 0.12);
    if (this.scene.activeEvent?.id === 'adrenaline') spd *= 1.8;
    if (this._slowTimer > 0) spd *= 0.5;
    return spd;
  }

  fireRate() {
    const w   = this.currentWeapon;
    const up  = this.upgrades;
    return w.fireRate * (1 + (up.fireRate || 0) * 0.18);
  }

  // ── Per-frame update ──────────────────────────────────────────────────
  update(dt, cursors) {
    const snap = this.actor.getSnapshot();

    // Timers
    this.shootTimer   = Math.max(0, this.shootTimer - dt);
    this.dashCdTimer  = Math.max(0, this.dashCdTimer - dt);
    this._slowTimer   = Math.max(0, this._slowTimer - dt);
    this._regenTimer -= dt;

    // HP regen
    if (this._regenTimer <= 0) {
      this._regenTimer = 1.0;
      const regenAmt = (this.upgrades.regen || 0) * 0.5;
      if (regenAmt > 0) this.heal(regenAmt);
    }

    // Movement
    const isAlive = !snap.matches('dead');
    const isDashing = snap.context.dashing;
    if (isAlive && !isDashing) {
      this._handleMovement(dt, cursors);
    }

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo      = this.ammoMax;
        this.scene.hud.updateAmmo(this);
      }
    }

    // Auto-aim + auto-shoot
    if (isAlive && !isDashing && !this.reloading) {
      this._handleShooting(dt);
    }

    // Face nearest enemy
    const nearest = this._findNearestTarget();
    if (nearest) {
      const dx = nearest.sprite.x - this.sprite.x;
      const dy = nearest.sprite.y - this.sprite.y;
      this.eyeAngle = Math.atan2(dy, dx);
    }
  }

  _handleMovement(dt, cursors) {
    const spd = this.effectiveSpeed();
    let vx = 0, vy = 0;

    if (cursors.left.isDown  || this.scene.input.keyboard.addKey('A').isDown) vx -= 1;
    if (cursors.right.isDown || this.scene.input.keyboard.addKey('D').isDown) vx += 1;
    if (cursors.up.isDown    || this.scene.input.keyboard.addKey('W').isDown) vy -= 1;
    if (cursors.down.isDown  || this.scene.input.keyboard.addKey('S').isDown) vy += 1;

    // Touch joystick
    if (this.scene.joystick) {
      const { dx, dy } = this.scene.joystick;
      vx += dx; vy += dy;
    }

    const mag = Math.sqrt(vx*vx + vy*vy);
    if (mag > 0) {
      this.sprite.body.setVelocity(vx / mag * spd, vy / mag * spd);
    } else {
      this.sprite.body.setVelocity(0, 0);
    }
  }

  _handleShooting(dt) {
    const nearest = this._findNearestTarget();
    if (!nearest) return;

    const dx = nearest.sprite.x - this.sprite.x;
    const dy = nearest.sprite.y - this.sprite.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const w  = this.currentWeapon;
    const rangeBonus = 1 + (this.upgrades.range || 0) * 0.2;
    if (dist > w.range * rangeBonus) return;

    this.angle = Math.atan2(dy, dx);
    if (this.shootTimer <= 0) {
      this.shootTimer = 1 / this.fireRate();
      this._fire();
    }
  }

  _fire() {
    const w   = this.currentWeapon;
    const up  = this.upgrades;

    if (this.ammo <= 0) { this.startReload(); return; }

    const count     = (w.bulletCount || 1) + (up.bulletCount || 0);
    const multExtra = up.multishot || 0;
    const angles    = [this.angle];

    if (multExtra >= 1) angles.push(this.angle + Math.PI);
    if (multExtra >= 2) { angles.push(this.angle + Math.PI*2/3); angles.push(this.angle - Math.PI*2/3); }
    if (multExtra >= 3) { angles.push(this.angle + Math.PI/2); angles.push(this.angle - Math.PI/2); }

    for (const baseAngle of angles) {
      for (let i = 0; i < count; i++) {
        const spread = (w.spread || 0) * (Math.random() - 0.5) * 2;
        const b = new Bullet(this.scene, this.sprite.x, this.sprite.y, baseAngle + spread, w);
        this.scene.bullets.push(b);
      }
    }

    this.ammo -= count;
    if (this.ammo <= 0) this.startReload();
    this.scene.audio.shoot?.();
    this.scene.hud.updateAmmo(this);
  }

  _findNearestTarget() {
    let best = null, bestDist2 = Infinity;
    const targets = [...this.scene.enemies, ...(this.scene.boss ? [this.scene.boss] : [])];
    for (const t of targets) {
      if (!t.active) continue;
      const dx = t.sprite.x - this.sprite.x;
      const dy = t.sprite.y - this.sprite.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDist2) { bestDist2 = d2; best = t; }
    }
    return best;
  }

  // ── Actions ───────────────────────────────────────────────────────────
  dash() {
    const snap = this.actor.getSnapshot();
    if (!snap.matches({ alive: 'idle' }) && !snap.matches({ alive: 'idle' })) return;
    if (this.dashCdTimer > 0) return;

    const cd = this.dashCooldown * Math.pow(0.75, this.upgrades.dashCd || 0);
    this.dashCdTimer = cd;
    this.actor.send({ type: 'DASH' });
    this.scene.audio.dash?.();

    // Apply dash velocity in current movement direction
    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    const mag = Math.sqrt(vx*vx + vy*vy) || 1;
    const spd = this.effectiveSpeed() * PLAYER_DASH_SPEED;
    this.sprite.body.setVelocity(vx / mag * spd, vy / mag * spd);
    if (navigator.vibrate) navigator.vibrate(30);
  }

  useFlask() {
    const snap = this.actor.getSnapshot();
    if (this.flasks <= 0 || this.hp >= this.maxHp) return;
    if (!snap.matches({ alive: 'idle' })) return;
    this.flasks--;
    this.actor.send({ type: 'HEAL' });
    this.scene.audio.heal?.();
    // Heal over 800ms in ticks
    let elapsed = 0;
    const interval = this.scene.time.addEvent({
      delay: 80, repeat: 9,
      callback: () => {
        elapsed++;
        this.heal(PLAYER_FLASK_HEAL / 10);
      },
    });
    this.scene.hud.updateFlasks(this);
  }

  startReload() {
    if (this.reloading) return;
    this.reloading   = true;
    const reloadTime = 2.0 * Math.pow(0.85, this.upgrades.reloadSpd || 0);
    this.reloadTimer = reloadTime;
    this.scene.audio.reload?.();
  }

  switchWeapon(idx) {
    if (idx < 0 || idx >= this.weapons.length) return;
    this.weaponIndex = idx;
    const w = this.currentWeapon;
    this.ammoMax = Math.round((w.ammoMax ?? 30) * (1 + (this.upgrades.ammoMax || 0) * 0.3));
    this.ammo    = this.ammoMax;
    this.reloading = false;
    this.scene.hud.updateWeapon(this);
  }

  addWeapon(weapon) {
    if (!this.weapons.find(w => w.id === weapon.id)) {
      this.weapons.push(weapon);
    }
    this.switchWeapon(this.weapons.indexOf(weapon));
  }

  nextWeapon() {
    this.switchWeapon((this.weaponIndex + 1) % this.weapons.length);
  }

  // ── Damage & healing ──────────────────────────────────────────────────
  takeDamage(dmg) {
    const snap = this.actor.getSnapshot();
    if (snap.context.invincible) return;

    // Shield block
    if (this.shieldCharges > 0) {
      this.shieldCharges--;
      this.actor.send({ type: 'HIT' });
      return;
    }

    this.hp = Math.max(0, this.hp - dmg);
    this.actor.send({ type: 'HIT' });
    this.scene.hud.updateHp(this);
    this.scene.killStreak = 0;

    if (this.hp <= 0) {
      this.actor.send({ type: 'DIE' });
      this.scene.onPlayerDead();
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.scene.hud.updateHp(this);
  }

  isInvincible() {
    return this.actor.getSnapshot().context.invincible;
  }

  gainXp(amount) {
    if (this.scene.activeEvent?.id === 'bloodmoon') amount *= 2;
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.xpToNext = Math.round(100 * Math.pow(1.22, this.level - 1));
      this.level++;
      this.scene.onLevelUp();
    }
    this.scene.hud.updateXp(this);
  }
}
