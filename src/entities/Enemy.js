import { DEPTH_ENEMY, DEPTH_FX, ENEMY_RADIUS } from '../constants.js';
import Bullet from './Bullet.js';

let _nextId = 0;

export default class Enemy {
  constructor(scene, x, y, typeDef, wave) {
    this.id     = _nextId++;
    this.scene  = scene;
    this.def    = typeDef;
    this.active = true;

    this.maxHp = Math.round(typeDef.hp(wave));
    this.hp    = this.maxHp;
    const r    = typeDef.radius ?? ENEMY_RADIUS;

    // Sprite (circle)
    this.sprite = scene.add.circle(x, y, r, typeDef.color, typeDef.alpha ?? 1.0)
      .setDepth(DEPTH_ENEMY);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(r, -r, -r);
    this.sprite.body.allowGravity = false;

    this.baseSpeed = typeDef.spd(wave);
    this.speed     = this.baseSpeed;

    // Pathfinding state
    this.path       = null;
    this.pathIdx    = 0;
    this.pathTimer  = Math.random() * 0.5; // stagger first request

    // Ranged shooter state
    this.shootTimer = 0;

    // Raging berserker
    this.raging = false;

    // Bounce (bouncer enemy type)
    this.bounceOffset = 0;
    this.bounceTime   = Math.random() * Math.PI * 2;

    // Hit flash timer
    this._flashTimer = 0;

    // Eye decoration (rendered in overlay)
    this.eyeAngle = 0;
  }

  update(dt) {
    if (!this.active) return;

    // Berserker rage trigger
    if (this.def.berserker && !this.raging && this.hp < this.maxHp * this.def.rageHpPct) {
      this.raging = true;
      this.speed  = this.baseSpeed * this.def.rageSpdMult;
      this.sprite.setFillStyle(0xff1111);
    }

    // Slow (applied from scene event or screamer)
    const effectiveSpeed = this.scene.player._slowTimer > 0
      ? this.speed * 0.5
      : this.speed;

    // Pathfinding movement
    this._moveAlongPath(effectiveSpeed, dt);

    // Ranged attack
    if (this.def.ranged) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.def.shootInterval;
        this._shootAtPlayer();
      }
    }

    // Healer aura
    if (this.def.healer) {
      this._healNearby(dt);
    }

    // Screamer slow aura
    if (this.def.screamer) {
      this._applySlowAura();
    }

    // Bounce Y offset
    if (this.def.bouncer) {
      this.bounceTime += dt * 5;
      this.bounceOffset = Math.sin(this.bounceTime) * 14;
      this.sprite.y += this.bounceOffset * dt; // small continuous oscillation
    }

    // Hit flash fade
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      if (this._flashTimer === 0) {
        this.sprite.setFillStyle(this.def.color);
      }
    }

    // Face player
    const dx = this.scene.player.sprite.x - this.sprite.x;
    const dy = this.scene.player.sprite.y - this.sprite.y;
    this.eyeAngle = Math.atan2(dy, dx);
  }

  _moveAlongPath(speed, dt) {
    // Refresh path periodically
    this.pathTimer -= dt;
    if (this.pathTimer <= 0) {
      this.pathTimer = 1.2 + Math.random() * 0.6;
      this.scene.pathfinding.findPath(
        this.sprite.x, this.sprite.y,
        this.scene.player.sprite.x, this.scene.player.sprite.y,
        (path) => {
          if (path && path.length > 0) {
            this.path    = path;
            this.pathIdx = 0;
          }
        },
      );
    }

    let tx, ty;
    if (this.path && this.pathIdx < this.path.length) {
      tx = this.path[this.pathIdx].x;
      ty = this.path[this.pathIdx].y;
      const dx = tx - this.sprite.x;
      const dy = ty - this.sprite.y;
      if (dx*dx + dy*dy < 12*12) this.pathIdx++;
    } else {
      // Direct fallback
      tx = this.scene.player.sprite.x;
      ty = this.scene.player.sprite.y;
    }

    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.5) {
      this.sprite.body.setVelocity(dx / d * speed, dy / d * speed);
    } else {
      this.sprite.body.setVelocity(0, 0);
    }
  }

  _shootAtPlayer() {
    const dx = this.scene.player.sprite.x - this.sprite.x;
    const dy = this.scene.player.sprite.y - this.sprite.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > (this.def.shootRange ?? 340)) return;

    const angle = Math.atan2(dy, dx);
    const proj = {
      damage:     Math.round(this.def.hp(this.scene.wave.current) * (this.def.projDmg ?? 0.4)),
      bulletSpd:  160,
      range:      500,
      aoe:        this.def.projAoe ?? 0,
      pierce:     0,
      chain:      0,
    };
    const b = new Bullet(this.scene, this.sprite.x, this.sprite.y, angle, proj, true);
    this.scene.enemyBullets.push(b);
  }

  _healNearby(dt) {
    const hr = this.def.healRadius;
    const healAmt = this.def.healRate * dt;
    for (const e of this.scene.enemies) {
      if (!e.active || e === this) continue;
      const dx = e.sprite.x - this.sprite.x;
      const dy = e.sprite.y - this.sprite.y;
      if (dx*dx + dy*dy < hr*hr) {
        e.hp = Math.min(e.maxHp, e.hp + healAmt);
      }
    }
  }

  _applySlowAura() {
    const sr = this.def.slowRadius;
    const p  = this.scene.player;
    const dx = p.sprite.x - this.sprite.x;
    const dy = p.sprite.y - this.sprite.y;
    if (dx*dx + dy*dy < sr*sr) {
      p._slowTimer = 0.3; // refreshed each frame when in range
    }
  }

  flashHit() {
    this._flashTimer = 0.12;
    this.sprite.setFillStyle(0xffffff);
  }

  destroy() {
    if (!this.active) return;
    this.active = false;
    if (this.def.explodes) {
      this.scene.combat.spawnExplosionFX(this.sprite.x, this.sprite.y, this.def.aoeRadius);
      this.scene.audio.explosion();
      const dmg = Math.round(this.maxHp * 0.4);
      const p   = this.scene.player;
      const dx  = p.sprite.x - this.sprite.x;
      const dy  = p.sprite.y - this.sprite.y;
      if (dx*dx + dy*dy < this.def.aoeRadius * this.def.aoeRadius) {
        if (!p.isInvincible()) p.takeDamage(dmg);
      }
    }
    this.sprite.destroy();
  }
}
