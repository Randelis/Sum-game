import { createActor } from 'xstate';
import { bossMachine } from '../machines/bossMachine.js';
import { DEPTH_ENEMY, BOSS_RADIUS } from '../constants.js';
import Bullet from './Bullet.js';

let _nextId = 0;

export default class Boss {
  constructor(scene, x, y, def, wave) {
    this.id     = _nextId++;
    this.scene  = scene;
    this.def    = def;
    this.active = true;
    this.wave   = wave;

    this.maxHp = Math.round(def.hp(wave));
    this.hp    = this.maxHp;

    // Star-shaped sprite
    this.sprite = scene.add.star(x, y, 8, BOSS_RADIUS * 0.55, BOSS_RADIUS, def.color)
      .setDepth(DEPTH_ENEMY + 2);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(BOSS_RADIUS, -BOSS_RADIUS, -BOSS_RADIUS);
    this.sprite.body.allowGravity = false;

    // XState boss machine
    this.actor = createActor(bossMachine);
    this.actor.start();

    // Ability scheduling
    this._abilityCooldown = 3.5;   // seconds until first ability
    this._abilityCooldownTimer = this._abilityCooldown;
    this._abilityQueue = this._buildAbilityQueue();
    this._queueIndex   = 0;

    // Combo tracking
    this._comboIndex  = 0;
    this._activeCombo = this._pickCombo();
    this._comboStep   = 0;
    this._comboTimer  = 0;

    // Charge state
    this._charging    = false;
    this._chargeVelX  = 0;
    this._chargeVelY  = 0;
    this._chargeDur   = 0;

    // Death anim flag
    this._dying = false;

    // Hit flash
    this._flashTimer = 0;

    this._sub = this.actor.subscribe(snap => this._onStateChange(snap));
  }

  _buildAbilityQueue() {
    return this.def.abilities.map(a => a.id);
  }

  _pickCombo() {
    const combos = this.def.combos;
    if (!combos?.length) return null;
    return combos[Math.floor(Math.random() * combos.length)];
  }

  _nextAbilityId() {
    if (this._activeCombo) {
      const step = this._activeCombo.steps[this._comboStep];
      this._comboStep++;
      if (this._comboStep >= this._activeCombo.steps.length) {
        this._comboStep   = 0;
        this._activeCombo = this._pickCombo();
      }
      return step;
    }
    const id = this._abilityQueue[this._queueIndex % this._abilityQueue.length];
    this._queueIndex++;
    return id;
  }

  update(dt) {
    if (!this.active || this._dying) return;

    const snap = this.actor.getSnapshot();
    const ctx  = snap.context;

    // Phase transitions driven by HP
    const hpPct = this.hp / this.maxHp;
    if (snap.matches('phase1') && hpPct <= 0.6) {
      this.actor.send({ type: 'PHASE_2' });
      this.scene.onBossPhaseChange(this, 2);
    } else if (snap.matches('phase2') && hpPct <= 0.25) {
      this.actor.send({ type: 'PHASE_3' });
      this.scene.onBossPhaseChange(this, 3);
    }

    // Speed / rotation
    const baseSpd = this.def.spd * ctx.speedMult;
    this.sprite.angle += dt * 45;

    // Charge movement
    if (this._charging) {
      this.sprite.body.setVelocity(this._chargeVelX, this._chargeVelY);
      this._chargeDur -= dt;
      if (this._chargeDur <= 0) {
        this._charging = false;
        this.sprite.body.setVelocity(0, 0);
        this.actor.send({ type: 'ABILITY_DONE' });
      }
      return;
    }

    // Normal seek movement (slower during windup)
    const isWindup = snap.matches({ phase1: 'windup' }) ||
                     snap.matches({ phase2: 'windup' }) ||
                     snap.matches({ phase3: 'windup' });
    const movSpd = isWindup ? baseSpd * 0.4 : baseSpd;
    const dx = this.scene.player.sprite.x - this.sprite.x;
    const dy = this.scene.player.sprite.y - this.sprite.y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d > BOSS_RADIUS * 1.5) {
      this.sprite.body.setVelocity(dx / d * movSpd, dy / d * movSpd);
    } else {
      this.sprite.body.setVelocity(0, 0);
    }

    // Cooldown timer (machine is in cooldown, drive NEXT_ABILITY)
    const inCooldown = snap.matches({ phase1: 'cooldown' }) ||
                       snap.matches({ phase2: 'cooldown' }) ||
                       snap.matches({ phase3: 'cooldown' });
    if (inCooldown) {
      this._abilityCooldownTimer -= dt;
      if (this._abilityCooldownTimer <= 0) {
        const abilityId  = this._nextAbilityId();
        const abilityDef = this.def.abilities.find(a => a.id === abilityId);
        if (abilityDef) {
          const cd  = abilityDef.cd * ctx.cdScale;
          this._abilityCooldownTimer = cd;
          this.actor.send({
            type:      'NEXT_ABILITY',
            abilityId: abilityDef.id,
            isHard:    abilityDef.isHard,
            windupMs:  abilityDef.windupMs * (ctx.cdScale < 0.5 ? 0.6 : 1),
          });
        }
      }
    }

    // Ultimate firing
    const inUltWindup = snap.matches({ phase3: 'ultimateWindup' });
    const inUltFiring = snap.matches({ phase3: 'ultimateFiring' });
    if (inUltFiring) {
      this._fireUltimate();
    }

    // Windup visual telegraph done → fire
    const inFiring = snap.matches({ phase1: 'firing' }) ||
                     snap.matches({ phase2: 'firing' }) ||
                     snap.matches({ phase3: 'firing' });
    if (inFiring && !this._firingHandled) {
      this._firingHandled = true;
      this._fireAbility(snap.context.currentAbilityId);
    }
    if (!inFiring) this._firingHandled = false;

    // Hit flash
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      if (this._flashTimer === 0) this.sprite.setFillStyle(this.def.color);
    }

    // Punish window glow
    if (ctx.takingExtraDamage) {
      this.sprite.setStrokeStyle(4, 0xffffff);
    } else {
      this.sprite.setStrokeStyle(0);
    }
  }

  _fireAbility(abilityId) {
    const scene = this.scene;
    const px = scene.player.sprite.x;
    const py = scene.player.sprite.y;
    const bx = this.sprite.x;
    const by = this.sprite.y;

    switch (abilityId) {
      case 'slam': {
        scene.cameras.main.shake(300, 0.018);
        scene.audio.bossRoar();
        scene.combat.spawnExplosionFX(bx, by, 120);
        // Summon 4 zombies
        const angles = [0, Math.PI/2, Math.PI, Math.PI*1.5];
        angles.forEach(a => scene.wave.spawnOne(
          bx + Math.cos(a)*70, by + Math.sin(a)*70, 'basic'));
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'shockwave': {
        scene.cameras.main.shake(250, 0.015);
        scene.audio.explosion();
        const ring = scene.add.circle(bx, by, 10, 0xff8800, 0.7).setDepth(50);
        scene.tweens.add({ targets: ring, scaleX: 18, scaleY: 18, alpha: 0, duration: 600,
          onComplete: () => ring.destroy() });
        // Damage in radius
        const r = 180;
        if (this._dist2(bx, by, px, py) < r*r) {
          if (!scene.player.isInvincible()) scene.player.takeDamage(20);
        }
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'charge': {
        const dx = px - bx; const dy = py - by;
        const d  = Math.sqrt(dx*dx + dy*dy) || 1;
        this._charging    = true;
        this._chargeVelX  = dx/d * 420;
        this._chargeVelY  = dy/d * 420;
        this._chargeDur   = 0.55;
        break; // ABILITY_DONE sent when charge ends
      }
      case 'roar': {
        scene.cameras.main.shake(200, 0.012);
        scene.audio.bossRoar();
        // Knockback player
        const dx2 = px - bx; const dy2 = py - by;
        const d2  = Math.sqrt(dx2*dx2 + dy2*dy2) || 1;
        scene.player.sprite.body.setVelocity(dx2/d2*500, dy2/d2*500);
        scene.time.delayedCall(300, () => scene.player.sprite.body.setVelocity(0, 0));
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'spitVolley': case 'poisonSpit': case 'poisonCloud': {
        const count = 8;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI*2 / count) * i;
          const proj = { damage: 15, bulletSpd: 200, range: 500, aoe: 0, pierce: 0, chain: 0 };
          const b = new Bullet(scene, bx, by, a, proj, true);
          scene.enemyBullets.push(b);
        }
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'teleport': {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 200 + Math.random() * 150;
        this.sprite.setPosition(
          Math.max(50, Math.min(scene.worldWidth - 50,  px + Math.cos(angle)*dist)),
          Math.max(50, Math.min(scene.worldHeight - 50, py + Math.sin(angle)*dist)),
        );
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'deathRay': {
        const angle2 = Math.atan2(py - by, px - bx);
        for (let i = -2; i <= 2; i++) {
          const a = angle2 + i * 0.15;
          const proj = { damage: 25, bulletSpd: 400, range: 700, aoe: 0, pierce: 3, chain: 0 };
          const b = new Bullet(scene, bx, by, a, proj, true);
          scene.enemyBullets.push(b);
        }
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'fireRing': {
        const cnt = 12;
        for (let i = 0; i < cnt; i++) {
          const a = (Math.PI*2 / cnt) * i;
          const proj = { damage: 18, bulletSpd: 180, range: 450, aoe: 40, pierce: 0, chain: 0 };
          const b = new Bullet(scene, bx, by, a, proj, true);
          scene.enemyBullets.push(b);
        }
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'firePillars': {
        scene.cameras.main.shake(200, 0.01);
        for (let i = 0; i < 5; i++) {
          const ox = (Math.random() - 0.5) * 300;
          const oy = (Math.random() - 0.5) * 300;
          scene.time.delayedCall(i * 200, () => {
            scene.combat.spawnExplosionFX(px + ox, py + oy, 80);
            if (scene.player.isInvincible()) return;
            const ddx = (px+ox) - scene.player.sprite.x;
            const ddy = (py+oy) - scene.player.sprite.y;
            if (ddx*ddx+ddy*ddy < 80*80) scene.player.takeDamage(20);
          });
        }
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'webSnare': {
        scene.player._slowTimer = 3.0;
        scene.hud.showNotification('⚠️ Web Snare!', '#cc66ff', 1500);
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'spiderSpawn': {
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI*2/5)*i;
          scene.wave.spawnOne(bx + Math.cos(a)*60, by + Math.sin(a)*60, 'crawler');
        }
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      case 'summon': {
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI*2/4)*i;
          scene.wave.spawnOne(bx + Math.cos(a)*70, by + Math.sin(a)*70, 'basic');
        }
        this.actor.send({ type: 'ABILITY_DONE' });
        break;
      }
      default:
        this.actor.send({ type: 'ABILITY_DONE' });
    }
  }

  _fireUltimate() {
    if (this._ultimateFired) return;
    this._ultimateFired = true;
    const scene = this.scene;
    const bx = this.sprite.x, by = this.sprite.y;
    scene.cameras.main.shake(500, 0.025);
    scene.audio.bossPhase();

    // Big explosion ring + 16 projectiles
    scene.combat.spawnExplosionFX(bx, by, 240);
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI*2/16)*i;
      const proj = { damage: 35, bulletSpd: 260, range: 650, aoe: 60, pierce: 0, chain: 0 };
      const b = new Bullet(scene, bx, by, a, proj, true);
      scene.enemyBullets.push(b);
    }
    this.actor.send({ type: 'ULTIMATE_DONE' });
  }

  _onStateChange(snap) {
    const inTransition = snap.matches('phaseTransition');
    if (inTransition) {
      this.sprite.body.setVelocity(0, 0);
    }
  }

  flashHit() {
    this._flashTimer = 0.1;
    this.sprite.setFillStyle(0xffffff);
  }

  takeDamage(dmg) {
    const snap = this.actor.getSnapshot();
    if (snap.context.takingExtraDamage) dmg = Math.round(dmg * 1.5);
    this.hp -= dmg;
    this.flashHit();
    this.scene.combat.spawnDamageNumber(this.sprite.x, this.sprite.y - 40, dmg, false);
    if (this.hp <= 0) this._die();
  }

  _die() {
    if (this._dying) return;
    this._dying = true;
    this.actor.send({ type: 'DIE' });
    this.scene.onBossKilled(this);
    this.sprite.destroy();
    this.active = false;
  }

  _dist2(x0, y0, x1, y1) {
    const dx = x1-x0, dy = y1-y0; return dx*dx+dy*dy;
  }

  destroy() { this._die(); }
}
