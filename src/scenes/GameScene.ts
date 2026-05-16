import Phaser from 'phaser';
import { WORLD_W, WORLD_H, CAMERA_ZOOM, CAMERA_LERP, DEPTH, MOBILE_LIMITS } from '../utils/constants';
import { Player }            from '../entities/Player';
import { Enemy }             from '../entities/Enemy';
import { Boss }              from '../entities/Boss';
import { Bullet }            from '../entities/Bullet';
import { XpOrb }             from '../entities/XpOrb';
import { Pickup, PickupKind }from '../entities/Pickup';
import { MobileInputSystem } from '../systems/MobileInputSystem';
import { WaveSystem }        from '../systems/WaveSystem';
import { CombatSystem }      from '../systems/CombatSystem';
import { UpgradeSystem }     from '../systems/UpgradeSystem';
import { AudioSystem }       from '../systems/AudioSystem';
import { SaveSystem }        from '../systems/SaveSystem';
import { MobileHud }         from '../ui/MobileHud';
import { UpgradeMenu }       from '../ui/UpgradeMenu';
import { WeaponPicker }      from '../ui/WeaponPicker';
import { pickEnemyType, ENEMY_TYPES } from '../data/enemies';
import { getBossForWave }             from '../data/bosses';
import { unlockedWeapons }   from '../data/weapons';
import { randRange }         from '../utils/math';

export class GameScene extends Phaser.Scene {
  // Core entities
  player!:  Player;
  boss:     Boss | null = null;
  enemies:  Enemy[]     = [];
  xpOrbs:   XpOrb[]    = [];
  pickups:  Pickup[]    = [];

  // Phaser groups (for overlap / pooling)
  private _playerBullets!: Phaser.Physics.Arcade.Group;
  private _enemyBullets!:  Phaser.Physics.Arcade.Group;
  private _enemySprites!:  Phaser.Physics.Arcade.Group;
  private _bossSprites!:   Phaser.Physics.Arcade.Group;
  private _xpOrbSprites!:  Phaser.Physics.Arcade.Group;
  private _pickupSprites!: Phaser.Physics.Arcade.Group;

  // Systems
  private _mobileInput!:  MobileInputSystem;
  private _waveSystem!:   WaveSystem;
  private _combat!:       CombatSystem;
  private _upgrades!:     UpgradeSystem;
  private _audio!:        AudioSystem;
  private _save!:         SaveSystem;

  // UI
  private _hud!:          MobileHud;
  private _upgradeMenu!:  UpgradeMenu;
  private _weaponPicker!: WeaponPicker;

  // Game state
  private _paused:        boolean = false;
  private _gameOver:      boolean = false;
  private _currentWave:   number  = 1;

  constructor() { super('Game'); }

  create(): void {
    this._audio = new AudioSystem();
    this._save  = new SaveSystem();

    this._buildWorld();
    this._buildGroups();
    this._buildPlayer();
    this._buildSystems();
    this._buildCamera();
    this._buildUI();
    this._setupExplosionHandler();

    this._waveSystem.start();
    this._audio.resume();
  }

  update(_time: number, delta: number): void {
    if (this._paused || this._gameOver) return;

    const dt = Math.min(delta / 1000, 0.05); // clamp big deltas (tab switch / lag)

    // Mobile input
    this._mobileInput.update();
    this.player.setMobileMove(this._mobileInput.move.x, this._mobileInput.move.y);
    if (this._mobileInput.consumeDash())         this.player.triggerDash();
    if (this._mobileInput.consumeHeal())         this.player.triggerHeal();
    if (this._mobileInput.consumeWeaponSwitch()) this._openWeaponPicker();

    // Compact enemies array — single pass that removes dead entries and finds
    // the nearest live target. Avoids the per-frame filter/splice churn.
    const px = this.player.x;
    const py = this.player.y;
    let nearestX: number | null = null;
    let nearestY: number | null = null;
    let nearestD2 = Infinity;

    let w = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.isDead) continue;
      this.enemies[w++] = e;

      e.update(dt, px, py, this._enemyBullets, this.enemies);

      const dx = e.x - px, dy = e.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestD2) { nearestD2 = d2; nearestX = e.x; nearestY = e.y; }
    }
    this.enemies.length = w;

    // Boss is also a target
    if (this.boss && !this.boss.isDead) {
      const dx = this.boss.x - px, dy = this.boss.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestD2) { nearestX = this.boss.x; nearestY = this.boss.y; }
      this.boss.update(dt, px, py, this._enemyBullets);
    }

    // Update player
    this.player.update(dt, nearestX, nearestY, this._playerBullets);

    // XP orbs — compact in place too
    let ow = 0;
    for (let i = 0; i < this.xpOrbs.length; i++) {
      const orb = this.xpOrbs[i];
      if (!orb.sprite.active) continue;
      this.xpOrbs[ow++] = orb;
      orb.update(px, py, this.player.stats.magnetRadius);
    }
    this.xpOrbs.length = ow;

    // Bullets — update only active ones
    this._updateBulletGroup(this._playerBullets, delta);
    this._updateBulletGroup(this._enemyBullets,  delta);

    // Wave system
    this._waveSystem.update(dt, this.enemies.length);

    // HUD
    this._hud.update(this.player, this._currentWave, this.boss);

    // Check game over
    if (this.player.isDead && !this._gameOver) this._triggerGameOver();
  }

  private _updateBulletGroup(group: Phaser.Physics.Arcade.Group, delta: number): void {
    const children = group.getChildren();
    for (let i = 0; i < children.length; i++) {
      const b = children[i] as Bullet;
      if (b.active) b.update(0, delta);
    }
  }

  // ─── World ──────────────────────────────────────────────────────────────────

  private _buildWorld(): void {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Single TileSprite instead of thousands of image sprites — much cheaper.
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'ground')
      .setOrigin(0).setDepth(DEPTH.BG);

    // World border
    const g = this.add.graphics().setDepth(DEPTH.BG + 1);
    g.lineStyle(6, 0xaa3333, 0.8);
    g.strokeRect(0, 0, WORLD_W, WORLD_H);
  }

  // ─── Groups ─────────────────────────────────────────────────────────────────

  private _buildGroups(): void {
    this._playerBullets = this.physics.add.group({
      classType:   Bullet,
      maxSize:     MOBILE_LIMITS.maxPlayerBullets,
      runChildUpdate: false,
    });
    this._enemyBullets = this.physics.add.group({
      classType:   Bullet,
      maxSize:     MOBILE_LIMITS.maxEnemyBullets,
      runChildUpdate: false,
    });
    this._enemySprites  = this.physics.add.group();
    this._bossSprites   = this.physics.add.group();
    this._xpOrbSprites  = this.physics.add.group();
    this._pickupSprites = this.physics.add.group();
  }

  // ─── Player ─────────────────────────────────────────────────────────────────

  private _buildPlayer(): void {
    this.player = new Player(this, WORLD_W / 2, WORLD_H / 2);
    // Pre-populate bullet pools — must pass classType: Bullet so the group
    // returns actual Bullet instances (with fire(), kill(), damage, pierce…)
    // rather than plain Phaser.Physics.Arcade.Image.
    this._playerBullets.createMultiple({ classType: Bullet, key: 'bullet', quantity: 40, active: false, visible: false });
    this._enemyBullets.createMultiple({ classType: Bullet, key: 'bullet', quantity: 20, active: false, visible: false });
  }

  // ─── Systems ────────────────────────────────────────────────────────────────

  private _buildSystems(): void {
    this._mobileInput = new MobileInputSystem(this);

    this._waveSystem = new WaveSystem(this, {
      onWaveStart:    (w) => { this._currentWave = w; this._hud.showAnnounce(`Wave ${w}`); },
      onWaveComplete: (w) => { this._hud.showAnnounce(`Wave ${w} cleared!`); this._tryDropPickup(); },
      onBossWave:     (w) => { this._spawnBoss(w); this._hud.showAnnounce(`BOSS INCOMING!`, 3000); },
      spawnEnemy:     (type, count = 1) => this._spawnEnemies(type, count),
      showAnnounce:   (text, ms) => this._hud.showAnnounce(text, ms),
    });

    this._upgrades = new UpgradeSystem(this.player, (choices) => {
      this._paused = true;
      this._upgradeMenu.show(choices);
      this._audio.levelUp();
    });

    this._combat = new CombatSystem(this, this.player, {
      onEnemyKilled:  (enemy, x, y) => this._handleEnemyDeath(enemy, x, y),
      onBossKilled:   (boss)        => this._handleBossDeath(boss),
      onPlayerDamage: (_amt)        => { this._audio.hit(); },
      showDamageNum:  (x, y, amt, col) => this._hud.showDamageNumber(x, y, amt, col),
    });

    this._combat.setupOverlaps(
      this._playerBullets,
      this._enemyBullets,
      this._enemySprites,
      this._bossSprites,
      this.player.sprite,
      this._xpOrbSprites,
      this._pickupSprites,
    );

    // XP pickup event from CombatSystem
    this.events.on('xpPickup', (amount: number) => {
      this._upgrades.addXp(amount);
      this.player.score += amount;
    });
  }

  // ─── Camera ─────────────────────────────────────────────────────────────────

  private _buildCamera(): void {
    this.cameras.main
      .setZoom(CAMERA_ZOOM)
      .setBounds(0, 0, WORLD_W, WORLD_H)
      .startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP);
  }


  // ─── UI ─────────────────────────────────────────────────────────────────────

  private _buildUI(): void {
    this._hud = new MobileHud(this);

    this._upgradeMenu = new UpgradeMenu(this, (def) => {
      this._upgrades.applyUpgrade(def);
      this._paused = false;
    });

    this._weaponPicker = new WeaponPicker(this, (def) => {
      this.player.setWeapon(def.id);
      this._paused = false;
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => {
        if (this._upgradeMenu.isOpen || this._weaponPicker.isOpen) {
          this._upgradeMenu.hide();
          this._weaponPicker.hide();
          this._paused = false;
        } else {
          this._paused = !this._paused;
        }
      });
      this.input.keyboard.on('keydown-Q', () => { this._openWeaponPicker(); });
    }
  }

  private _openWeaponPicker(): void {
    if (this._paused) return;
    this._paused = true;
    this._weaponPicker.show(unlockedWeapons(this.player.level), this.player.weapon.id);
  }

  // ─── Explosion handler ───────────────────────────────────────────────────────

  private _setupExplosionHandler(): void {
    this.events.on('explosion', (data: { x: number; y: number; radius: number; damage: number }) => {
      const r2 = data.radius * data.radius;
      for (const e of this.enemies) {
        if (e.isDead) continue;
        const dx = e.x - data.x;
        const dy = e.y - data.y;
        if (dx * dx + dy * dy < r2) {
          const killed = e.takeDamage(data.damage, true);
          if (killed) this._handleEnemyDeath(e, e.x, e.y);
        }
      }
      if (this.boss && !this.boss.isDead) {
        const dx = this.boss.x - data.x;
        const dy = this.boss.y - data.y;
        if (dx * dx + dy * dy < r2) {
          this.boss.takeDamage(data.damage);
          if (this.boss.isDead) this._handleBossDeath(this.boss);
        }
      }
    });
  }

  // ─── Spawning ────────────────────────────────────────────────────────────────

  private _spawnEnemies(type: string, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.enemies.filter(e => !e.isDead).length >= MOBILE_LIMITS.maxEnemies) break;
      const wave    = this._currentWave;
      const pos     = this._spawnPos();
      const finalDef = (type && ENEMY_TYPES[type]) ? ENEMY_TYPES[type] : pickEnemyType(wave);
      const enemy   = new Enemy(this, pos.x, pos.y, finalDef, wave);
      this.enemies.push(enemy);
      this._enemySprites.add(enemy.sprite);
    }
  }

  private _spawnBoss(wave: number): void {
    const def = getBossForWave(wave);
    const pos = this._spawnPos();
    this.boss = new Boss(this, pos.x, pos.y, def, wave);
    this._bossSprites.add(this.boss.sprite);

    this.boss.onAbility = (id) => {
      if (id === 'summon') this._spawnEnemies('', 3);
      this._audio.bossRoar();
    };
  }

  private _spawnPos(): { x: number; y: number } {
    // Pick a random angle and spawn just outside the visible area so the
    // enemy walks into view rather than appearing mid-screen.
    const margin = 80;
    const px     = this.player.x;
    const py     = this.player.y;
    // Visible half-extents at zoom 0.72: ~890×500 — spawn 250 px beyond
    const minR = 750;
    const maxR = 1100;
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = randRange(minR, maxR);
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      if (x > margin && x < WORLD_W - margin && y > margin && y < WORLD_H - margin) {
        return { x, y };
      }
    }
    // Player must be near a world edge — clamp into bounds
    const a = Math.random() * Math.PI * 2;
    return {
      x: Phaser.Math.Clamp(px + Math.cos(a) * minR, margin, WORLD_W - margin),
      y: Phaser.Math.Clamp(py + Math.sin(a) * minR, margin, WORLD_H - margin),
    };
  }

  // ─── Death handling ──────────────────────────────────────────────────────────

  private _handleEnemyDeath(enemy: Enemy, x: number, y: number): void {
    this.player.score += enemy.def.score;
    this._audio.die();

    // XP orb
    const orb = new XpOrb(this, x, y, enemy.def.xp);
    this.xpOrbs.push(orb);
    this._xpOrbSprites.add(orb.sprite);

    // Chance to drop pickup
    if (Math.random() < 0.04) this._dropPickup(x, y, 'flask');
    if (Math.random() < 0.06) this._dropPickup(x, y, 'ammo');

    // Mark dead and destroy sprite immediately; the update loop compacts
    // this.enemies on the next tick.
    enemy.isDead = true;
    this._enemySprites.remove(enemy.sprite, true, true);
  }

  private _handleBossDeath(boss: Boss): void {
    this.player.score += 500 + this._currentWave * 50;
    this._hud.showAnnounce(`${boss.def.name} defeated!`, 3000);
    this._audio.die();

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const dx    = Math.cos(angle) * 80;
      const dy    = Math.sin(angle) * 80;
      const orb   = new XpOrb(this, boss.x + dx, boss.y + dy, 80);
      this.xpOrbs.push(orb);
      this._xpOrbSprites.add(orb.sprite);
    }
    this._dropPickup(boss.x, boss.y, 'flask');

    this.time.delayedCall(200, () => {
      boss.destroy();
      this._bossSprites.clear(true, true);
      this.boss = null;
      this._waveSystem.notifyBossDefeated();
    });
  }

  // ─── Pickups ─────────────────────────────────────────────────────────────────

  private _dropPickup(x: number, y: number, kind: PickupKind): void {
    const pickup = new Pickup(this, x, y, kind);
    this.pickups.push(pickup);
    this._pickupSprites.add(pickup.sprite);
  }

  private _tryDropPickup(): void {
    if (Math.random() < 0.5) {
      const px = this.player.x + (Math.random() - 0.5) * 200;
      const py = this.player.y + (Math.random() - 0.5) * 200;
      this._dropPickup(px, py, Math.random() < 0.6 ? 'flask' : 'ammo');
    }
  }

  // ─── Game over ───────────────────────────────────────────────────────────────

  private _triggerGameOver(): void {
    this._gameOver = true;
    this._save.saveHighScore(this.player.score);

    this.time.delayedCall(1500, () => {
      this.scene.start('GameOver', {
        score: this.player.score,
        wave:  this._currentWave,
        level: this.player.level,
      });
    });
  }
}
