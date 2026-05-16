export class AudioSystem {
  private _ctx:     AudioContext | null = null;
  private _sfxVol:  number = 0.8;
  private _enabled: boolean = true;

  constructor(sfxVolume = 0.8) {
    this._sfxVol = sfxVolume;
    try {
      this._ctx = new AudioContext();
    } catch {
      this._enabled = false;
    }
  }

  setVolume(v: number): void { this._sfxVol = v; }
  setEnabled(on: boolean): void { this._enabled = on; }

  // Resume AudioContext on first user gesture (required by browsers)
  resume(): void {
    if (this._ctx?.state === 'suspended') {
      this._ctx.resume().catch(() => { /* ignore */ });
    }
  }

  shoot(): void      { this._beep(880, 0.04, 'square', 0.12); }
  hit():   void      { this._beep(220, 0.06, 'sawtooth', 0.08); }
  die():   void      { this._beep(110, 0.15, 'sine', 0.35); }
  pickup():void      { this._beep(660, 0.05, 'sine', 0.18); }
  levelUp():void     { this._chord([523, 659, 784], 0.12, 0.4); }
  bossRoar():void    { this._beep(55,  0.3,  'sawtooth', 0.6); }
  dash(): void       { this._beep(440, 0.04, 'sine', 0.1); }

  private _beep(freq: number, gain: number, type: OscillatorType, dur: number): void {
    if (!this._enabled || !this._ctx) return;
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type            = type;
    env.gain.setValueAtTime(gain * this._sfxVol, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  }

  private _chord(freqs: number[], gain: number, dur: number): void {
    for (const f of freqs) this._beep(f, gain, 'sine', dur);
  }
}
