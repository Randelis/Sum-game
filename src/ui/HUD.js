// DOM-based HUD overlay – no canvas rendering
export default class HUD {
  constructor(scene) {
    this.scene = scene;
    this._notifTimer = null;
    this._bossObj    = null;

    this.$hp         = document.getElementById('hp-bar');
    this.$hpText     = document.getElementById('hp-text');
    this.$flasks     = document.getElementById('flask-display');
    this.$xpBar      = document.getElementById('xp-bar');
    this.$xpText     = document.getElementById('xp-text');
    this.$wave       = document.getElementById('wave-val');
    this.$level      = document.getElementById('level-val');
    this.$kills      = document.getElementById('kills-val');
    this.$score      = document.getElementById('score-val');
    this.$best       = document.getElementById('best-val');
    this.$weapon     = document.getElementById('weapon-name');
    this.$weaponIcon = document.getElementById('weapon-icon');
    this.$ammoBar    = document.getElementById('ammo-bar');
    this.$ammoText   = document.getElementById('ammo-text');
    this.$bossCard   = document.getElementById('boss-bar-card');
    this.$bossBar    = document.getElementById('boss-bar-fill');
    this.$bossName   = document.getElementById('boss-bar-name');
    this.$notif      = document.getElementById('notification');
    this.$dashCd     = document.getElementById('dash-cd-fill');
    this.$reloadMsg  = document.getElementById('reload-msg');
  }

  updateHp(player) {
    const pct = Math.max(0, player.hp / player.maxHp * 100);
    this.$hp.style.width = pct + '%';
    this.$hp.style.background = pct > 50 ? '#44cc44' : pct > 25 ? '#ccaa22' : '#cc3333';
    this.$hpText.textContent  = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  }

  updateFlasks(player) {
    this.$flasks.textContent = '🍶'.repeat(player.flasks) || '—';
  }

  updateXp(player) {
    const pct = (player.xp / player.xpToNext * 100).toFixed(1);
    this.$xpBar.style.width = pct + '%';
    this.$xpText.textContent = `Lv ${player.level}  ${Math.floor(player.xp)}/${player.xpToNext} XP`;
    this.$level.textContent  = player.level;
  }

  updateWave(wave) {
    this.$wave.textContent = wave;
  }

  updateKills(kills) {
    this.$kills.textContent = kills;
  }

  updateScore(score) {
    this.$score.textContent = score.toLocaleString();
    const best = parseInt(localStorage.getItem('bestScore') || '0');
    if (score > best) {
      localStorage.setItem('bestScore', score);
      this.$best.textContent = score.toLocaleString();
    }
  }

  updateWeapon(player) {
    const w = player.currentWeapon;
    this.$weapon.textContent     = w.name;
    this.$weaponIcon.textContent = w.icon;
    this.updateAmmo(player);
  }

  updateAmmo(player) {
    const pct = player.ammoMax > 0 ? player.ammo / player.ammoMax * 100 : 0;
    this.$ammoBar.style.width = pct + '%';
    this.$ammoText.textContent = `${player.ammo} / ${player.ammoMax}`;
    this.$reloadMsg.style.display = player.reloading ? 'block' : 'none';
  }

  updateDashCooldown(fraction) {
    // fraction 0..1 of cooldown elapsed
    this.$dashCd.style.height = (fraction * 100) + '%';
  }

  showBossBar(boss) {
    this._bossObj = boss;
    this.$bossCard.style.display = 'flex';
    this.$bossName.textContent   = boss.def.name;
    this.tickBossBar();
  }

  tickBossBar() {
    if (!this._bossObj?.active) return;
    const pct = Math.max(0, this._bossObj.hp / this._bossObj.maxHp * 100);
    this.$bossBar.style.width = pct + '%';
    const phase = this._bossObj.actor.getSnapshot().context.phase;
    this.$bossBar.style.background = phase === 1 ? '#cc4444' : phase === 2 ? '#ff8822' : '#ff2222';
  }

  hideBossBar() {
    this.$bossCard.style.display = 'none';
    this._bossObj = null;
  }

  showNotification(text, color = '#ffffff', durationMs = 2000) {
    this.$notif.textContent  = text;
    this.$notif.style.color  = color;
    this.$notif.style.opacity = '1';
    if (this._notifTimer) clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => {
      this.$notif.style.opacity = '0';
    }, durationMs);
  }

  update(player) {
    this.tickBossBar();
    // Dash cooldown arc
    if (player) {
      const frac = player.dashCdTimer > 0
        ? 1 - player.dashCdTimer / (player.dashCooldown * Math.pow(0.75, player.upgrades.dashCd || 0))
        : 1;
      this.updateDashCooldown(Math.max(0, Math.min(1, frac)));
    }
  }

  initBest() {
    this.$best.textContent = (parseInt(localStorage.getItem('bestScore') || '0')).toLocaleString();
  }
}
