import Enemy from '../entities/Enemy.js';
import Boss  from '../entities/Boss.js';
import { ENEMY_TYPES, pickEnemyType } from '../data/enemies.js';
import { getBossForWave } from '../data/bosses.js';
import { BOSS_WAVE_INTERVAL, MAX_ENEMIES, WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';

const EVENTS = [
  { id:'bloodmoon',  name:'🌑 Blood Moon',   msg:'2× XP – enemies +40% HP',  dur:30  },
  { id:'frenzy',     name:'⚡ Horde Fury',    msg:'Enemies 2× speed',          dur:12  },
  { id:'berserk',    name:'💢 Berserk Mode',  msg:'Bullets 2× damage',         dur:12  },
  { id:'adrenaline', name:'💨 Adrenaline',    msg:'You move 1.8× faster',      dur:12  },
  { id:'craterain',  name:'📦 Crate Rain',    msg:'Supply drop!',              dur:0   },
  { id:'invasion',   name:'💀 Invasion',      msg:'Extra enemies inbound',     dur:0   },
];

export default class WaveSystem {
  constructor(scene) {
    this.scene   = scene;
    this.current = 0;
    this._spawnTimer   = 0;
    this._spawnInterval = 1.2;
    this._toSpawn      = 0;
    this._waveActive   = false;
    this._eventCooldown = 0;
    this._bossPending  = false;
  }

  start() {
    this._nextWave();
  }

  _nextWave() {
    this.current++;
    const scene = this.scene;
    scene.hud.updateWave(this.current);
    scene.hud.showNotification(`Wave ${this.current}`, '#ffdd44', 2000);
    scene.audio.waveStart?.();

    if (this.current % BOSS_WAVE_INTERVAL === 0) {
      // Boss wave
      this._bossPending  = true;
      this._waveActive   = false;
      this._spawnBoss();
    } else {
      this._bossPending  = false;
      this._waveActive   = true;
      this._toSpawn      = Math.round(8 + this.current * 3.2);
      this._spawnTimer   = 0.5;
      this._spawnInterval = Math.max(0.3, 1.2 - this.current * 0.04);
      this._tryEvent();
    }
  }

  _tryEvent() {
    if (this._eventCooldown > 0 || Math.random() > 0.38) { this._eventCooldown--; return; }
    this._eventCooldown = 2;
    const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    this.scene.triggerEvent(ev);
  }

  _spawnBoss() {
    const scene = this.scene;
    const def   = getBossForWave(this.current);
    const [bx, by] = this._spawnEdge();
    const boss  = new Boss(scene, bx, by, def, this.current);
    scene.boss  = boss;
    scene.hud.showBossBar(boss);
    scene.hud.showNotification(`⚠️ ${def.name}`, '#ff4444', 3000);
    scene.cameras.main.shake(400, 0.02);
    scene.audio.bossRoar?.();
  }

  update(dt) {
    if (!this._waveActive) return;
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0 && this._toSpawn > 0) {
      if (this.scene.enemies.filter(e => e.active).length < MAX_ENEMIES) {
        this._spawnTimer = this._spawnInterval;
        this._toSpawn--;
        const type = pickEnemyType(this.current);
        const [x, y] = this._spawnEdge();
        this.spawnOne(x, y, type);
      }
    }

    // Check wave cleared
    if (this._toSpawn === 0 && this.scene.enemies.filter(e => e.active).length === 0) {
      this._waveActive = false;
      this.scene.onWaveCleared();
    }
  }

  spawnOne(x, y, type) {
    const def   = ENEMY_TYPES[type] ?? ENEMY_TYPES.basic;
    const enemy = new Enemy(this.scene, x, y, def, this.current);
    this.scene.enemies.push(enemy);
    return enemy;
  }

  onBossKilled() {
    this._bossPending = false;
    // Restore flasks after boss
    this.scene.player.flasks = 3;
    this.scene.hud.updateFlasks(this.scene.player);
    this.scene.hud.hideBossBar();
    this.scene.hud.showNotification('✓ Boss Slain!', '#44ff88', 3000);
    this.scene.audio.waveCleared?.();
    this.scene.time.delayedCall(2000, () => this._nextWave());
  }

  onWaveCleared() {
    this.scene.hud.showNotification(`Wave ${this.current} Cleared!`, '#44ffdd', 2500);
    this.scene.audio.waveCleared?.();
    this.scene.time.delayedCall(2000, () => this._nextWave());
  }

  _spawnEdge() {
    const cam  = this.scene.cameras.main;
    const vw   = cam.width  / cam.zoom;
    const vh   = cam.height / cam.zoom;
    const cx   = this.scene.player.sprite.x;
    const cy   = this.scene.player.sprite.y;
    const margin = 80;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
      case 0: x = cx + (Math.random() - 0.5) * vw; y = cy - vh*0.5 - margin; break;
      case 1: x = cx + (Math.random() - 0.5) * vw; y = cy + vh*0.5 + margin; break;
      case 2: x = cx - vw*0.5 - margin; y = cy + (Math.random() - 0.5) * vh; break;
      default:x = cx + vw*0.5 + margin; y = cy + (Math.random() - 0.5) * vh; break;
    }
    x = Math.max(50, Math.min(WORLD_WIDTH  - 50, x));
    y = Math.max(50, Math.min(WORLD_HEIGHT - 50, y));
    return [x, y];
  }
}
