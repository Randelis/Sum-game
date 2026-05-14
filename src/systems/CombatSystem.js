// Handles collision resolution, AOE, chain lightning, napalm patches.
// Called from GameScene.update() after physics overlap callbacks collect hits.
import { DEPTH_FX } from '../constants.js';

export default class CombatSystem {
  constructor(scene) {
    this.scene = scene;
  }

  // ── Bullet → Enemy hit ──────────────────────────────────────────────────
  bulletHitEnemy(bullet, enemyObj) {
    if (!bullet.active || !enemyObj.active) return;

    const dmg = this._calcDamage(bullet);
    const isCrit = bullet.isCrit;

    this.applyDamage(enemyObj, dmg, isCrit);
    this.scene.audio.hit();
    this.spawnDamageNumber(enemyObj.sprite.x, enemyObj.sprite.y, dmg, isCrit);

    // Vampirism life steal
    const vamp = this.scene.player.stats.vampirism;
    if (vamp > 0) {
      this.scene.player.heal(dmg * vamp * 0.01);
    }

    // Chain lightning
    if (bullet.chain > 0) {
      this._chainLightning(bullet, enemyObj, dmg * 0.75, bullet.chain - 1);
      bullet.chain = 0;
    }

    // Pierce logic
    bullet.pierceLeft--;
    if (bullet.pierceLeft <= 0) {
      bullet.destroy();
    }

    // AOE explosion
    if (bullet.aoe > 0) {
      this._explode(bullet.sprite.x, bullet.sprite.y, bullet.aoe, dmg * 0.6, bullet);
      bullet.destroy();
    }
  }

  // ── Enemy → Player contact ──────────────────────────────────────────────
  enemyTouchPlayer(enemyObj) {
    const player = this.scene.player;
    if (player.isInvincible()) return;

    const dmg = enemyObj.def.contactDmg ?? 12;
    player.takeDamage(dmg);
    this.scene.audio.playerHit();
    this.scene.cameras.main.shake(120, 0.008);
  }

  // ── AOE explosion ───────────────────────────────────────────────────────
  _explode(wx, wy, radius, baseDmg, sourceBullet = null) {
    this.spawnExplosionFX(wx, wy, radius);
    this.scene.audio.explosion();
    this.scene.cameras.main.shake(200, 0.012);

    for (const e of this.scene.enemies) {
      if (!e.active) continue;
      const dx = e.sprite.x - wx;
      const dy = e.sprite.y - wy;
      if (dx*dx + dy*dy < radius*radius) {
        const dmg = this._calcDamage(sourceBullet, baseDmg);
        this.applyDamage(e, dmg, false);
        this.spawnDamageNumber(e.sprite.x, e.sprite.y, dmg, false);
      }
    }

    // Napalm: leave a fire patch
    if (sourceBullet?.napalmPatch) {
      this.scene.firePatches.push({
        x: wx, y: wy, r: radius * 0.6,
        duration: 3 + (this.scene.player.upgrades.napalm || 0) * 0.6,
        elapsed: 0,
        dps: 8,
      });
    }
  }

  _chainLightning(originBullet, hitEnemy, dmg, hopsLeft) {
    const CHAIN_RANGE = 160;
    const already = new Set([hitEnemy.id]);
    let prev = hitEnemy;

    for (let hop = 0; hop < hopsLeft; hop++) {
      let nearest = null, bestDist = CHAIN_RANGE * CHAIN_RANGE;
      for (const e of this.scene.enemies) {
        if (!e.active || already.has(e.id)) continue;
        const dx = e.sprite.x - prev.sprite.x;
        const dy = e.sprite.y - prev.sprite.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestDist) { bestDist = d2; nearest = e; }
      }
      if (!nearest) break;
      already.add(nearest.id);
      this.applyDamage(nearest, dmg, false);
      this.spawnLightningFX(prev.sprite.x, prev.sprite.y, nearest.sprite.x, nearest.sprite.y);
      dmg *= 0.75;
      prev = nearest;
    }
  }

  applyDamage(enemyObj, dmg, isCrit) {
    // Death touch
    const dtChance = (this.scene.player.upgrades.deathTouch || 0) * 0.05;
    if (dtChance > 0 && Math.random() < dtChance) {
      dmg = enemyObj.hp;
    }

    // Armor mitigation
    if (enemyObj.def.armorMult) dmg *= enemyObj.def.armorMult;
    if (enemyObj.def.takingExtraDamage) dmg *= 1.5;

    dmg = Math.max(1, Math.round(dmg));
    enemyObj.hp -= dmg;
    enemyObj.flashHit();

    if (enemyObj.hp <= 0) {
      this.scene.onEnemyKilled(enemyObj);
    }
  }

  _calcDamage(bullet, override = null) {
    const base = override ?? bullet?.damage ?? 10;
    const player = this.scene.player;
    const dmgMult = 1 + (player.upgrades.damage || 0) * 0.2;
    let d = base * dmgMult;

    // Kill streak bonus
    d *= this.scene.killStreakMult;

    // Berserk event
    if (this.scene.activeEvent?.id === 'berserk') d *= 2.0;

    // Crit
    const critChance = (player.upgrades.critChance || 0) * 0.1;
    const critMult   = 2.0 + (player.upgrades.critMult || 0) * 0.5;
    if (Math.random() < critChance) {
      bullet && (bullet.isCrit = true);
      d *= critMult;
    }

    return Math.round(d);
  }

  // ── Visual helpers ──────────────────────────────────────────────────────
  spawnDamageNumber(wx, wy, dmg, isCrit) {
    const color  = isCrit ? '#ffd700' : '#ffffff';
    const size   = isCrit ? 20 : 14;
    const txt = this.scene.add.text(wx, wy - 20, String(Math.round(dmg)), {
      fontSize: `${size}px`,
      fontFamily: 'Arial',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setDepth(DEPTH_FX + 10).setOrigin(0.5, 1);

    this.scene.tweens.add({
      targets: txt,
      y: wy - 70,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => txt.destroy(),
    });
  }

  spawnExplosionFX(wx, wy, radius) {
    const circ = this.scene.add.circle(wx, wy, radius, 0xff6622, 0.5).setDepth(DEPTH_FX);
    this.scene.tweens.add({
      targets: circ,
      scaleX: 1.6, scaleY: 1.6,
      alpha: 0,
      duration: 350,
      ease: 'Quad.Out',
      onComplete: () => circ.destroy(),
    });
  }

  spawnLightningFX(x0, y0, x1, y1) {
    const g = this.scene.add.graphics().setDepth(DEPTH_FX + 5);
    g.lineStyle(2, 0xaaddff, 0.9);
    g.beginPath();
    g.moveTo(x0, y0);
    // jitter midpoints
    const mx = (x0 + x1) * 0.5 + (Math.random() - 0.5) * 40;
    const my = (y0 + y1) * 0.5 + (Math.random() - 0.5) * 40;
    g.lineTo(mx, my);
    g.lineTo(x1, y1);
    g.strokePath();
    this.scene.time.delayedCall(120, () => g.destroy());
  }
}
