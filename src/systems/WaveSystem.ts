import Phaser from 'phaser';
import { BOSS_WAVE } from '../utils/constants';
import { pickWaveEvent, WaveEventContext } from '../data/events';

export interface WaveSystemCallbacks {
  onWaveStart:    (wave: number) => void;
  onWaveComplete: (wave: number) => void;
  onBossWave:     (wave: number) => void;
  spawnEnemy:     (type: string, count?: number) => void;
  showAnnounce:   (text: string, ms?: number) => void;
}

export class WaveSystem {
  scene:    Phaser.Scene;

  wave:          number  = 1;
  enemiesLeft:   number  = 0;
  bossActive:    boolean = false;

  private _cb:             WaveSystemCallbacks;
  private _waveTimer:      number  = 0;     // seconds
  private _betweenWaves:   boolean = false;
  private _betweenSec:     number  = 3;     // 3s rest between waves
  private _eventCooldown:  number  = 0;
  private _started:        boolean = false;

  constructor(scene: Phaser.Scene, cb: WaveSystemCallbacks) {
    this.scene = scene;
    this._cb   = cb;
  }

  start(): void {
    if (this._started) return;
    this._started = true;
    this._beginWave();
  }

  update(dt: number, liveEnemyCount: number): void {
    if (!this._started || this.bossActive) return;

    this.enemiesLeft = liveEnemyCount;

    if (this._betweenWaves) {
      this._waveTimer -= dt;
      if (this._waveTimer <= 0) {
        this._betweenWaves = false;
        this._beginWave();
      }
      return;
    }

    if (liveEnemyCount === 0 && !this._betweenWaves) {
      this._cb.onWaveComplete(this.wave);
      this.wave++;
      this._betweenWaves = true;
      this._waveTimer    = this._betweenSec;
      return;
    }

    // Random mid-wave event
    if (this._eventCooldown > 0) {
      this._eventCooldown--;
      return;
    }
    if (Math.random() > 0.38) return;

    const ev = pickWaveEvent(this.wave);
    if (!ev) return;

    const ctx: WaveEventContext = {
      wave:         this.wave,
      requestSpawn: (type, count = 1) => this._cb.spawnEnemy(type, count),
      addEventTimer: (ms, fn) => { this.scene.time.delayedCall(ms, fn); },
      showAnnounce: (text, dur) => this._cb.showAnnounce(text, dur),
    };
    ev.apply(ctx);
    this._eventCooldown = 180; // ~3 seconds at 60fps ticks
  }

  notifyBossDefeated(): void {
    this.bossActive    = false;
    this._betweenWaves = true;
    this._waveTimer    = this._betweenSec;
    this.wave++;
  }

  private _beginWave(): void {
    this._cb.onWaveStart(this.wave);

    if (this.wave % BOSS_WAVE === 0) {
      this.bossActive = true;
      this._cb.onBossWave(this.wave);
      return;
    }

    const count = this._enemyCount();
    this._cb.spawnEnemy('', count);  // empty type → caller picks via pickEnemyType
  }

  private _enemyCount(): number {
    return Math.min(40, 6 + Math.floor(this.wave * 1.4));
  }
}
