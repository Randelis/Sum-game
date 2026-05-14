export default class StartScreen {
  constructor(onStart) {
    this.$el    = document.getElementById('start-screen');
    this.$btn   = document.getElementById('start-btn');
    this.$best  = document.getElementById('start-best');
    this.$btn?.addEventListener('click', () => {
      this.hide();
      onStart();
    });
  }

  show() {
    const best = parseInt(localStorage.getItem('bestScore') || '0');
    this.$best.textContent = best > 0 ? `Best: ${best.toLocaleString()}` : '';
    this.$el.style.display = 'flex';
  }

  hide() {
    this.$el.style.display = 'none';
  }
}
