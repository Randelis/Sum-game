import Phaser from 'phaser';
import Player          from '../entities/Player.js';
import CombatSystem    from '../systems/CombatSystem.js';
import PathfindingSystem from '../systems/PathfindingSystem.js';
import WaveSystem      from '../systems/WaveSystem.js';
import AudioManager    from '../audio/AudioManager.js';
import HUD             from '../ui/HUD.js';
import LevelUpMenu     from '../ui/LevelUpMenu.js';
import WeaponPicker    from '../ui/WeaponPicker.js';
import GameOver        from '../ui/GameOver.js';
import StartScreen     from '../ui/StartScreen.js';
import {
  WORLD_WIDTH, WORLD_HEIGHT, CAMERA_ZOOM, CAMERA_LERP,
  DEPTH_BG, DEPTH_FX, DEPTH_OVERLAY, DEPTH_UI,
} from '../constants.js';
import { WEAPONS, unlockedWeapons } from '../data/weapons.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  create() {
    this.worldWidth  = WORLD_WIDTH;
    this.worldHeight = WORLD_HEIGHT;

    // Physics world bounds
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // ── Systems ────────────────────────────────────────────────────────────
    this.audio       = new AudioManager();
    this.pathfinding = new PathfindingSystem();
    this.combat      = new CombatSystem(this);

    // ── Entity arrays ──────────────────────────────────────────────────────
    this.enemies      = [];   // Enemy instances
    this.bullets      = [];   // Player Bullet instances
    this.enemyBullets = [];   // Enemy Bullet instances
    this.xpOrbs       = [];   // {x,y,value,sprite}
    this.pickups      = [];   // {x,y,type,sprite}
    this.firePatches  = [];   // napalm ground fire
    this.boss         = null;

    // ── State ──────────────────────────────────────────────────────────────
    this.kills         = 0;
    this.score         = 0;
    this.killStreak    = 0;
    this.killStreakMult = 1.0;
    this.activeEvent   = null;
    this._eventTimer   = 0;
    this._paused       = false;
    this._started      = false;

    // ── Background ─────────────────────────────────────────────────────────
    this._buildBackground();

    // ── Overlay graphics (HP bars, telegraphs) ────────────────────────────
    this.overlayGfx = this.add.graphics().setDepth(DEPTH_OVERLAY);

    // ── Player ────────────────────────────────────────────────────────────
    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    // ── Camera ────────────────────────────────────────────────────────────
    this.cameras.main
      .setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      .startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP)
      .setZoom(CAMERA_ZOOM);

    // ── Wave / UI systems ─────────────────────────────────────────────────
    this.wave        = new WaveSystem(this);
    this.hud         = new HUD(this);
    this.levelUpMenu = new LevelUpMenu(this);
    this.weaponPicker= new WeaponPicker(this);
    this.gameOverUI  = new GameOver(this);
    this.startScreen = new StartScreen(() => this._startGame());

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this._setupKeyboard();
    this._setupTouchJoystick();

    // ── Minimap canvas ────────────────────────────────────────────────────
    this._minimapCtx = document.getElementById('minimap-canvas')?.getContext('2d');

    // ── Init HUD ──────────────────────────────────────────────────────────
    this.hud.initBest();
    this.hud.updateHp(this.player);
    this.hud.updateFlasks(this.player);
    this.hud.updateWeapon(this.player);
    this.hud.updateXp(this.player);
    this.hud.updateWave(0);

    // Show start screen
    this.startScreen.show();
    this.scene.pause();
  }

  _startGame() {
    this._started = true;
    this.audio.init();
    this.scene.resume();
    this.wave.start();
    this.hud.updateScore(0);
  }

  // ── Main loop ─────────────────────────────────────────────────────────
  update(time, deltaMs) {
    if (!this._started || this._paused) return;
    const dt = deltaMs / 1000;

    // Step pathfinding queue
    this.pathfinding.step();

    // Player
    this.player.update(dt, this.cursors);

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) { this.enemies.splice(i, 1); continue; }
      e.update(dt);
    }

    // Boss
    if (this.boss?.active) {
      this.boss.update(dt);
      this.hud.tickBossBar();
    } else if (this.boss && !this.boss.active) {
      this.boss = null;
    }

    // Player bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.active) { this.bullets.splice(i, 1); continue; }
      b.update();
    }

    // Enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      if (!b.active) { this.enemyBullets.splice(i, 1); continue; }
      b.update();
    }

    // XP orb pickup
    this._updateOrbPickup(dt);

    // Pickup collection
    this._updatePickups(dt);

    // Fire patches
    this._updateFirePatches(dt);

    // Wave system
    this.wave.update(dt);

    // Active event timer
    if (this.activeEvent && this.activeEvent.dur > 0) {
      this._eventTimer -= dt;
      if (this._eventTimer <= 0) this.activeEvent = null;
    }

    // Kill streak decay
    this._updateKillStreak(dt);

    // Collision resolution (manual overlap — more control than Phaser groups)
    this._resolveCollisions();

    // Overlay draw
    this._drawOverlay();

    // HUD
    this.hud.update(this.player);
    this._drawMinimap();
  }

  // ── Background ────────────────────────────────────────────────────────
  _buildBackground() {
    const g = this.add.graphics().setDepth(DEPTH_BG);

    // Dark base
    g.fillStyle(0x111111);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Grid
    g.lineStyle(1, 0x1a1a1a, 0.8);
    const TILE = 64;
    for (let x = 0; x <= WORLD_WIDTH; x += TILE) {
      g.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += TILE) {
      g.lineBetween(0, y, WORLD_WIDTH, y);
    }

    // World border
    g.lineStyle(4, 0x333333, 1);
    g.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  // ── Collision resolution ──────────────────────────────────────────────
  _resolveCollisions() {
    const player = this.player;
    const px = player.sprite.x, py = player.sprite.y;

    // Player bullets vs enemies + boss
    for (const b of this.bullets) {
      if (!b.active) continue;
      const bx = b.sprite.x, by = b.sprite.y;
      const br = b.sprite.radius ?? 5;

      for (const e of this.enemies) {
        if (!e.active) continue;
        const er = e.sprite.radius ?? 16;
        const dx = bx - e.sprite.x, dy = by - e.sprite.y;
        if (dx*dx + dy*dy < (br+er)*(br+er)) {
          this.combat.bulletHitEnemy(b, e);
          if (!b.active) break;
        }
      }

      if (b.active && this.boss?.active) {
        const er = 36;
        const dx = bx - this.boss.sprite.x, dy = by - this.boss.sprite.y;
        if (dx*dx + dy*dy < (br+er)*(br+er)) {
          const dmg = this.combat._calcDamage(b);
          this.boss.takeDamage(dmg);
          b.pierceLeft--;
          if (b.pierceLeft <= 0) b.destroy();
        }
      }
    }

    // Enemy bullets vs player
    if (!player.isInvincible()) {
      for (const b of this.enemyBullets) {
        if (!b.active) continue;
        const dx = b.sprite.x - px, dy = b.sprite.y - py;
        const r = 16 + (b.sprite.radius ?? 5);
        if (dx*dx + dy*dy < r*r) {
          const dmg = b.damage;
          player.takeDamage(dmg);
          if (b.aoe > 0) {
            this.combat.spawnExplosionFX(b.sprite.x, b.sprite.y, b.aoe);
            this.audio.explosion();
          }
          b.destroy();
        }
      }
    }

    // Enemies vs player (contact damage)
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.sprite.x - px, dy = e.sprite.y - py;
      const r = (e.sprite.radius ?? 16) + 14;
      if (dx*dx + dy*dy < r*r) {
        this.combat.enemyTouchPlayer(e);
      }
    }

    // Boss vs player
    if (this.boss?.active && !player.isInvincible()) {
      const dx = this.boss.sprite.x - px, dy = this.boss.sprite.y - py;
      if (dx*dx + dy*dy < (36+14)*(36+14)) {
        const dmg = this.boss.def.contactDmg * this.boss.actor.getSnapshot().context.damageMult;
        if (!player.isInvincible()) player.takeDamage(dmg);
      }
    }
  }

  // ── Orbs & pickups ────────────────────────────────────────────────────
  _updateOrbPickup(dt) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const up = this.player.upgrades;
    const pullR = 60 * (1 + (up.magnet || 0) * 0.35);
    const pickR = 20;

    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
      const o = this.xpOrbs[i];
      const dx = px - o.x, dy = py - o.y;
      const d2 = dx*dx + dy*dy;

      if (d2 < pullR * pullR) {
        const d = Math.sqrt(d2) || 1;
        const spd = 220;
        o.x += dx/d * spd * dt;
        o.y += dy/d * spd * dt;
        o.sprite.setPosition(o.x, o.y);
      }

      if (d2 < pickR * pickR) {
        this.player.gainXp(o.value);
        o.sprite.destroy();
        this.xpOrbs.splice(i, 1);
      }
    }
  }

  _updatePickups(dt) {
    const px = this.player.sprite.x, py = this.player.sprite.y;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      const dx = px - pk.x, dy = py - pk.y;
      if (dx*dx + dy*dy < 22*22) {
        if (pk.type === 'hp') {
          this.player.heal(30);
          this.audio.heal?.();
        } else if (pk.type === 'ammo') {
          this.player.ammo = this.player.ammoMax;
          this.player.reloading = false;
          this.hud.updateAmmo(this.player);
        }
        pk.sprite.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  _updateFirePatches(dt) {
    for (let i = this.firePatches.length - 1; i >= 0; i--) {
      const f = this.firePatches[i];
      f.elapsed += dt;
      if (f.elapsed >= f.duration) {
        this.firePatches.splice(i, 1);
        continue;
      }
      // Apply DPS to player if standing in fire
      const p = this.player;
      const dx = p.sprite.x - f.x, dy = p.sprite.y - f.y;
      if (dx*dx + dy*dy < f.r*f.r && !p.isInvincible()) {
        p.takeDamage(f.dps * dt);
      }
    }
  }

  // ── Overlay (HP bars, boss telegraph, fire patches) ───────────────────
  _drawOverlay() {
    const g = this.overlayGfx;
    g.clear();

    // Enemy HP bars
    for (const e of this.enemies) {
      if (!e.active) continue;
      const x = e.sprite.x, y = e.sprite.y;
      const r = e.sprite.radius ?? 16;
      const bw = r * 2;
      const pct = e.hp / e.maxHp;
      g.fillStyle(0x222222, 0.8);
      g.fillRect(x - bw/2, y - r - 8, bw, 4);
      g.fillStyle(pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xccaa22 : 0xcc3333, 1);
      g.fillRect(x - bw/2, y - r - 8, bw * pct, 4);
    }

    // Boss HP bar (in HUD, but also show telegraph windup ring)
    if (this.boss?.active) {
      const snap = this.boss.actor.getSnapshot();
      const bx = this.boss.sprite.x, by = this.boss.sprite.y;
      const isWindup = snap.matches({ phase1: 'windup' }) ||
                       snap.matches({ phase2: 'windup' }) ||
                       snap.matches({ phase3: 'windup' });
      const isUltWindup = snap.matches({ phase3: 'ultimateWindup' });

      if (isWindup) {
        g.lineStyle(3, 0xffdd44, 0.7 + Math.sin(Date.now() * 0.01) * 0.3);
        g.strokeCircle(bx, by, 55);
      }
      if (isUltWindup) {
        g.lineStyle(5, 0xff2222, 0.8 + Math.sin(Date.now() * 0.015) * 0.2);
        g.strokeCircle(bx, by, 70);
      }
    }

    // Screamer slow aura
    for (const e of this.enemies) {
      if (!e.active || !e.def.screamer) continue;
      g.lineStyle(1, 0xcc44cc, 0.25);
      g.strokeCircle(e.sprite.x, e.sprite.y, e.def.slowRadius);
    }

    // Healer aura
    for (const e of this.enemies) {
      if (!e.active || !e.def.healer) continue;
      g.lineStyle(1, 0x44aa44, 0.2);
      g.strokeCircle(e.sprite.x, e.sprite.y, e.def.healRadius);
    }

    // Fire patches
    for (const f of this.firePatches) {
      const alpha = 0.5 * (1 - f.elapsed / f.duration);
      g.fillStyle(0xff6600, alpha);
      g.fillCircle(f.x, f.y, f.r);
    }

    // XP orb glow
    for (const o of this.xpOrbs) {
      g.fillStyle(0x8844ff, 0.35);
      g.fillCircle(o.x, o.y, 9 + Math.sin(Date.now() * 0.005 + o.x) * 2);
    }

    // Player eye
    {
      const px = this.player.sprite.x, py = this.player.sprite.y;
      const ex = px + Math.cos(this.player.eyeAngle) * 8;
      const ey = py + Math.sin(this.player.eyeAngle) * 8;
      g.fillStyle(0x00ffff, 1);
      g.fillCircle(ex, ey, 4);
    }

    // Enemy eyes
    for (const e of this.enemies) {
      if (!e.active) continue;
      const r = e.sprite.radius ?? 16;
      const ex = e.sprite.x + Math.cos(e.eyeAngle) * (r * 0.5);
      const ey = e.sprite.y + Math.sin(e.eyeAngle) * (r * 0.5);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(ex, ey, 3);
      g.fillStyle(0x000000, 1);
      g.fillCircle(ex + Math.cos(e.eyeAngle), ey + Math.sin(e.eyeAngle), 1.5);
    }
  }

  // ── Minimap ───────────────────────────────────────────────────────────
  _drawMinimap() {
    const ctx = this._minimapCtx;
    if (!ctx) return;
    const SIZE  = 84;
    const SCALE = 0.030;
    const px = this.player.sprite.x, py = this.player.sprite.y;
    const cx = SIZE / 2, cy = SIZE / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    for (const e of this.enemies) {
      if (!e.active) continue;
      const mx = cx + (e.sprite.x - px) * SCALE;
      const my = cy + (e.sprite.y - py) * SCALE;
      ctx.fillStyle = e.def.berserker && e.raging ? '#ff3333' : '#ff6666';
      ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI*2); ctx.fill();
    }

    if (this.boss?.active) {
      const mx = cx + (this.boss.sprite.x - px) * SCALE;
      const my = cy + (this.boss.sprite.y - py) * SCALE;
      ctx.fillStyle = '#ff2200';
      ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI*2); ctx.fill();
    }

    for (const o of this.xpOrbs) {
      const mx = cx + (o.x - px) * SCALE;
      const my = cy + (o.y - py) * SCALE;
      ctx.fillStyle = '#8844ff';
      ctx.beginPath(); ctx.arc(mx, my, 1.5, 0, Math.PI*2); ctx.fill();
    }

    // Player dot
    ctx.fillStyle = '#4488ff';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();

    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, SIZE, SIZE);
  }

  // ── Kill streak ───────────────────────────────────────────────────────
  _updateKillStreak(dt) {
    const k = this.killStreak;
    if      (k >= 35) this.killStreakMult = 3.0;
    else if (k >= 20) this.killStreakMult = 2.0;
    else if (k >= 10) this.killStreakMult = 1.5;
    else if (k >= 5)  this.killStreakMult = 1.2;
    else              this.killStreakMult = 1.0;
  }

  // ── Keyboard setup ────────────────────────────────────────────────────
  _setupKeyboard() {
    this.input.keyboard.on('keydown-SPACE', () => this.player.dash());
    this.input.keyboard.on('keydown-SHIFT', () => this.player.dash());
    this.input.keyboard.on('keydown-F',     () => this.player.useFlask());
    this.input.keyboard.on('keydown-R',     () => this.player.startReload());
    this.input.keyboard.on('keydown-Q',     () => this.player.nextWeapon());
    this.input.keyboard.on('keydown-ESC',   () => this._toggleWeaponPicker());

    // Hook up DOM buttons
    document.getElementById('btn-dash')?.addEventListener('click', () => {
      this.audio.init(); this.player.dash();
    });
    document.getElementById('btn-guns')?.addEventListener('click', () => {
      this.audio.init(); this._toggleWeaponPicker();
    });
    document.getElementById('btn-flask')?.addEventListener('click', () => {
      this.audio.init(); this.player.useFlask();
    });
  }

  _toggleWeaponPicker() {
    if (document.getElementById('weapon-picker').style.display !== 'none') {
      this.weaponPicker.hide();
      this.resumeGame();
    } else {
      this._paused = true;
      this.weaponPicker.show(this.player, this.wave.current);
    }
  }

  resumeGame() { this._paused = false; }

  // ── Touch joystick ────────────────────────────────────────────────────
  _setupTouchJoystick() {
    this.joystick = null;
    const el = document.getElementById('joystick-zone');
    if (!el) return;

    let touchId = null, baseX = 0, baseY = 0;
    const knob = document.getElementById('joystick-knob');
    const MAX_R = 40;

    el.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const rect = el.getBoundingClientRect();
      baseX = rect.left + rect.width/2;
      baseY = rect.top  + rect.height/2;
      this.audio.init();
    }, { passive: false });

    el.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        let dx = t.clientX - baseX, dy = t.clientY - baseY;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d > MAX_R) { dx *= MAX_R/d; dy *= MAX_R/d; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        this.joystick = { dx: dx/MAX_R, dy: dy/MAX_R };
      }
    }, { passive: false });

    const end = () => {
      touchId = null;
      this.joystick = null;
      if (knob) knob.style.transform = 'translate(0,0)';
    };
    el.addEventListener('touchend',    end);
    el.addEventListener('touchcancel', end);
  }

  // ── Event callbacks ───────────────────────────────────────────────────
  triggerEvent(ev) {
    this.activeEvent  = ev;
    this._eventTimer  = ev.dur;
    this.hud.showNotification(`${ev.name}: ${ev.msg}`, '#ffcc44', 3000);

    if (ev.id === 'craterain') {
      for (let i = 0; i < 6; i++) {
        this._spawnPickup(
          this.player.sprite.x + (Math.random()-0.5)*400,
          this.player.sprite.y + (Math.random()-0.5)*400,
          Math.random() < 0.5 ? 'hp' : 'ammo',
        );
      }
      this.activeEvent = null;
    } else if (ev.id === 'invasion') {
      const count = 6 + Math.floor(Math.random() * 15);
      for (let i = 0; i < count; i++) {
        const [x, y] = this._edgePos();
        this.wave.spawnOne(x, y, 'basic');
      }
      this.activeEvent = null;
    }
  }

  _spawnPickup(x, y, type) {
    const color = type === 'hp' ? 0xff4444 : 0x4444ff;
    const sprite = this.add.rectangle(x, y, 16, 16, color).setDepth(3);
    this.add.text(x, y, type === 'hp' ? '♥' : '⬡', {
      fontSize: '11px', color: '#fff' }).setDepth(4).setOrigin(0.5);
    this.pickups.push({ x, y, type, sprite });
  }

  _edgePos() {
    const margin = 80;
    const side = Math.floor(Math.random()*4);
    switch (side) {
      case 0: return [Math.random()*WORLD_WIDTH, margin];
      case 1: return [Math.random()*WORLD_WIDTH, WORLD_HEIGHT-margin];
      case 2: return [margin, Math.random()*WORLD_HEIGHT];
      default:return [WORLD_WIDTH-margin, Math.random()*WORLD_HEIGHT];
    }
  }

  onEnemyKilled(e) {
    this.kills++;
    this.killStreak++;
    const reward = Math.round((e.def.score ?? 10) * this.killStreakMult);
    this.score += reward;
    this.hud.updateKills(this.kills);
    this.hud.updateScore(this.score);
    this.audio.killEnemy?.();

    // Drop XP orb
    this._spawnXpOrb(e.sprite.x, e.sprite.y, e.def.xp ?? 10);

    // Chance to drop pickup
    if (Math.random() < 0.06) this._spawnPickup(e.sprite.x, e.sprite.y, 'hp');
    if (Math.random() < 0.05) this._spawnPickup(e.sprite.x, e.sprite.y, 'ammo');

    // Crawler death spawns more crawlers (up to wave limit)
    if (e.def.name === 'Crawler' && this.wave.current >= 8 && Math.random() < 0.3) {
      const off = [[20,0],[-20,0],[0,20]];
      off.forEach(([ox,oy]) => this.wave.spawnOne(e.sprite.x+ox, e.sprite.y+oy, 'crawler'));
    }

    // Kill streak notifications
    const streak = this.killStreak;
    if      (streak === 35) this.hud.showNotification('🏆 LEGENDARY!',    '#ffd700', 2000);
    else if (streak === 20) this.hud.showNotification('💀 GODLIKE!',       '#ff4400', 2000);
    else if (streak === 10) this.hud.showNotification('⚡ UNSTOPPABLE!',   '#ff8800', 1500);
    else if (streak === 5)  this.hud.showNotification('🔥 KILLER!',        '#ffaa00', 1500);
  }

  _spawnXpOrb(x, y, value) {
    const sprite = this.add.circle(x, y, 7, 0x8844ff).setDepth(3);
    this.xpOrbs.push({ x, y, value, sprite });
  }

  onBossKilled(boss) {
    this.wave.onBossKilled();
    this._spawnXpOrb(boss.sprite.x, boss.sprite.y, 200);
    // Unlock new weapon
    const unlocked = unlockedWeapons(this.wave.current + 1);
    const newWpns  = unlocked.filter(w => !this.player.weapons.find(pw => pw.id === w.id));
    if (newWpns.length > 0) {
      const w = newWpns[0];
      this.player.addWeapon(w);
      this.hud.showNotification(`🔓 Unlocked: ${w.name}`, '#44ffdd', 3000);
    }
  }

  onBossPhaseChange(boss, phase) {
    this.cameras.main.shake(400, 0.018);
    this.audio.bossPhase?.();
    this.hud.showNotification(`⚠️ Phase ${phase}!`, '#ff8822', 2000);
  }

  onLevelUp() {
    this.audio.levelUp?.();
    this.hud.showNotification('⬆ Level Up!', '#44ffdd', 1500);
    this._paused = true;
    this.time.delayedCall(300, () => this.levelUpMenu.show(this.player));
  }

  onUpgradeChosen() {
    this._paused = false;
    this.hud.updateHp(this.player);
    this.hud.updateXp(this.player);
  }

  onPlayerDead() {
    this._paused = true;
    this.cameras.main.shake(600, 0.03);
    this.time.delayedCall(1200, () => {
      this.gameOverUI.show({
        wave:  this.wave.current,
        kills: this.kills,
        level: this.player.level,
        score: this.score,
      });
    });
  }

  onWaveCleared() {
    this.wave.onWaveCleared();
  }

  restartGame() {
    // Clean up all entities
    this.enemies.forEach(e => e.sprite?.destroy());
    this.bullets.forEach(b => b.sprite?.destroy());
    this.enemyBullets.forEach(b => b.sprite?.destroy());
    this.xpOrbs.forEach(o => o.sprite?.destroy());
    this.pickups.forEach(p => p.sprite?.destroy());
    this.boss?.sprite?.destroy();
    this.hud.hideBossBar();

    this.scene.restart();
  }
}
