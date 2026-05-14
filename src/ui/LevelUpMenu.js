import { pickRandomUpgrades, applyUpgrade, UPGRADES } from '../data/upgrades.js';

export default class LevelUpMenu {
  constructor(scene) {
    this.scene = scene;
    this.$el   = document.getElementById('levelup-modal');
    this.$list = document.getElementById('levelup-choices');
  }

  show(player) {
    const choices = pickRandomUpgrades(player.upgrades, 3);
    this.$list.innerHTML = '';

    choices.forEach(upg => {
      const current = player.upgrades[upg.id] || 0;
      const btn = document.createElement('button');
      btn.className = 'upgrade-btn';
      btn.innerHTML = `
        <span class="upg-icon">${upg.icon}</span>
        <span class="upg-name">${upg.name}</span>
        <span class="upg-desc">${upg.desc}</span>
        <span class="upg-level">${this._stars(current, upg.max)}</span>
      `;
      btn.addEventListener('click', () => {
        applyUpgrade(player, upg.id);
        this.hide();
        this.scene.onUpgradeChosen();
      });
      this.$list.appendChild(btn);
    });

    this.$el.style.display = 'flex';
  }

  hide() {
    this.$el.style.display = 'none';
  }

  _stars(current, max) {
    return '★'.repeat(current) + '☆'.repeat(max - current);
  }
}
