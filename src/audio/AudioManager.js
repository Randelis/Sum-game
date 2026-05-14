// Procedural Web Audio synthesis – no audio files required
export default class AudioManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._enabled = true;
  }

  init() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.4;
      this._masterGain.connect(this._ctx.destination);
    } catch (_) { this._enabled = false; }
  }

  _resume() {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
  }

  _tone(freq, type, durSec, vol = 0.3, freqEnd = null) {
    if (!this._enabled || !this._ctx) return;
    this._resume();
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this._ctx.currentTime);
    if (freqEnd !== null)
      osc.frequency.exponentialRampToValueAtTime(freqEnd, this._ctx.currentTime + durSec);
    gain.gain.setValueAtTime(vol, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + durSec);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();
    osc.stop(this._ctx.currentTime + durSec);
  }

  _noise(durSec, vol = 0.2, cutoff = 2000) {
    if (!this._enabled || !this._ctx) return;
    this._resume();
    const len    = Math.ceil(this._ctx.sampleRate * durSec);
    const buf    = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src    = this._ctx.createBufferSource();
    src.buffer   = buf;
    const filter = this._ctx.createBiquadFilter();
    filter.type  = 'lowpass';
    filter.frequency.value = cutoff;
    const gain   = this._ctx.createGain();
    gain.gain.setValueAtTime(vol, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + durSec);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    src.start();
    src.stop(this._ctx.currentTime + durSec);
  }

  shoot()       { this._noise(0.07, 0.25, 3000); this._tone(220, 'square', 0.06, 0.1, 110); }
  shotgun()     { this._noise(0.12, 0.35, 5000); }
  reload()      { this._tone(440, 'sine', 0.08, 0.15, 220); this._tone(600, 'sine', 0.05, 0.1, 400); }
  hit()         { this._noise(0.05, 0.15, 1000); }
  playerHit()   { this._tone(150, 'sawtooth', 0.15, 0.2, 80); }
  dash()        { this._tone(800, 'sine', 0.12, 0.15, 1200); }
  heal()        { this._tone(600, 'sine', 0.4, 0.2, 800); }
  killEnemy()   { this._noise(0.08, 0.1, 800); }
  explosion()   { this._noise(0.35, 0.4, 800); this._tone(80, 'sawtooth', 0.3, 0.2, 40); }
  levelUp()     { [523,659,784,1047].forEach((f,i) => { this._tone(f,'sine',0.15,0.2); }); }
  bossRoar()    { this._tone(60, 'sawtooth', 0.8, 0.3, 40); this._noise(0.8, 0.2, 500); }
  bossPhase()   { this._tone(100, 'square', 0.5, 0.3, 200); this._noise(0.5, 0.25, 1500); }
  waveStart()   { this._tone(440, 'square', 0.1, 0.15); this._tone(660, 'square', 0.1, 0.15); }
  waveCleared() { [330,440,550,660].forEach((f,i) => { setTimeout(() => this._tone(f,'sine',0.2,0.18), i*80); }); }
}
