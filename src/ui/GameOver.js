export default class GameOver {
  constructor(scene) {
    this.scene    = scene;
    this.$el      = document.getElementById('gameover-screen');
    this.$wave    = document.getElementById('go-wave');
    this.$kills   = document.getElementById('go-kills');
    this.$level   = document.getElementById('go-level');
    this.$score   = document.getElementById('go-score');
    this.$best    = document.getElementById('go-best');
    this.$restart = document.getElementById('go-restart');
    this.$restart?.addEventListener('click', () => {
      this.hide();
      this.scene.restartGame();
    });
  }

  show(stats) {
    const prev = parseInt(localStorage.getItem('bestScore') || '0');
    const best = Math.max(prev, stats.score);
    localStorage.setItem('bestScore', best);

    this.$wave.textContent  = stats.wave;
    this.$kills.textContent = stats.kills;
    this.$level.textContent = stats.level;
    this.$score.textContent = stats.score.toLocaleString();
    this.$best.textContent  = best.toLocaleString();
    this.$el.style.display  = 'flex';
  }

  hide() {
    this.$el.style.display = 'none';
  }
}
