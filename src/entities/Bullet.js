import { DEPTH_BULLET } from '../constants.js';

let _nextId = 0;

export default class Bullet {
  constructor(scene, x, y, angle, weaponDef, isEnemy = false) {
    this.id       = _nextId++;
    this.scene    = scene;
    this.isEnemy  = isEnemy;
    this.active   = true;
    this.isCrit   = false;

    const p = scene.player;
    const up = p?.upgrades ?? {};

    this.damage     = weaponDef.damage;
    this.pierceLeft = (weaponDef.pierce || 0) + (isEnemy ? 0 : (up.pierce || 0));
    this.aoe        = (weaponDef.aoe || 0) + (isEnemy ? 0 : (up.aoe || 0) * 12);
    this.chain      = weaponDef.chain || 0;
    this.napalmPatch = !isEnemy && (up.napalm > 0) && (this.aoe > 0);

    const spd = weaponDef.bulletSpd * (1 + (isEnemy ? 0 : (up.bulletSpeed || 0) * 0.18));
    const maxRange = weaponDef.range * (1 + (isEnemy ? 0 : (up.range || 0) * 0.2));

    const color  = isEnemy ? 0xff6666 : (this.isCrit ? 0xffd700 : 0xffee44);
    const radius = isEnemy ? 5 : (this.aoe > 0 ? 7 : 5);

    this.sprite = scene.add.circle(x, y, radius, color)
      .setDepth(DEPTH_BULLET)
      .setBlendMode('ADD');
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(radius, -radius, -radius);
    this.sprite.body.setVelocity(
      Math.cos(angle) * spd,
      Math.sin(angle) * spd,
    );
    this.sprite.body.setMaxVelocity(spd);
    this.sprite.body.allowGravity = false;

    this._startX = x;
    this._startY = y;
    this._maxRangeSq = maxRange * maxRange;
  }

  update() {
    if (!this.active) return;
    const dx = this.sprite.x - this._startX;
    const dy = this.sprite.y - this._startY;
    if (dx*dx + dy*dy > this._maxRangeSq) {
      this.destroy();
    }
  }

  destroy() {
    if (!this.active) return;
    this.active = false;
    this.sprite.destroy();
  }
}
