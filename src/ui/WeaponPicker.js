import { WEAPONS } from '../data/weapons.js';

export default class WeaponPicker {
  constructor(scene) {
    this.scene = scene;
    this.$el   = document.getElementById('weapon-picker');
    this.$grid = document.getElementById('weapon-grid');
    this.$close = document.getElementById('weapon-picker-close');
    this.$close?.addEventListener('click', () => this.hide());
  }

  show(player, wave) {
    this.$grid.innerHTML = '';
    const unlocked = WEAPONS.filter(w => w.unlock <= wave);

    unlocked.forEach(w => {
      const owned   = player.weapons.find(pw => pw.id === w.id);
      const current = player.currentWeapon.id === w.id;
      const btn     = document.createElement('button');
      btn.className = 'weapon-btn' + (current ? ' active' : '') + (owned ? '' : ' locked');
      btn.innerHTML = `
        <span class="wpn-icon">${w.icon}</span>
        <span class="wpn-name">${w.name}</span>
        <div class="wpn-stats">
          <span>DMG ${w.damage}</span>
          <span>RNG ${w.range}</span>
          <span>RoF ${w.fireRate}/s</span>
        </div>
        ${!owned ? '<span class="wpn-locked">🔒</span>' : ''}
      `;
      if (owned) {
        btn.addEventListener('click', () => {
          player.switchWeapon(player.weapons.indexOf(w));
          this.hide();
          this.scene.resumeGame?.();
        });
      }
      this.$grid.appendChild(btn);
    });

    this.$el.style.display = 'flex';
  }

  hide() {
    this.$el.style.display = 'none';
  }
}
