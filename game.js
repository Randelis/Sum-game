'use strict';
// ═══════════════════════════════════════════════════════════════
//  ZOMBIE SHOOTER  –  full game.js
// ═══════════════════════════════════════════════════════════════

// ── Canvas & context ──────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const mmc    = document.getElementById('mmc');   // minimap canvas
const mctx   = mmc.getContext('2d');

// ── UI refs ───────────────────────────────────────────────────
const hpBar       = document.getElementById('hp-bar');
const hpText      = document.getElementById('hp-text');
const xpBar       = document.getElementById('xp-bar');
const ammoBar     = document.getElementById('ammo-bar');
const reloadText  = document.getElementById('reload-text');
const weaponName  = document.getElementById('weapon-name');
const levelBadge  = document.getElementById('level-badge');
const scoreBadge  = document.getElementById('score-badge');
const waveBadge   = document.getElementById('wave-badge');
const bossBarWrap = document.getElementById('boss-bar-wrap');
const bossBarEl   = document.getElementById('boss-bar');
const bossLabel   = document.getElementById('boss-bar-label');
const notifEl     = document.getElementById('notif');
const overlay     = document.getElementById('overlay');
const startBtn    = document.getElementById('start-btn');
const upgPanel    = document.getElementById('upgrade-panel');
const upgChoices  = document.getElementById('upgrade-choices');
const upgLvlTxt   = document.getElementById('upg-lvl-txt');
const wpnPicker   = document.getElementById('weapon-picker');
const wpnList     = document.getElementById('weapon-list');
const wpnCloseBtn = document.getElementById('wpn-close-btn');

// ── Resize ────────────────────────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  mmc.width  = 90;
  mmc.height = 90;
}
resize();
window.addEventListener('resize', resize);

// ═══════════════════════════════════════════════════════════════
//  WEB AUDIO (procedural sfx)
// ═══════════════════════════════════════════════════════════════
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, gain=0.18, freqEnd=freq) {
  try {
    const ac = getAudio();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(freqEnd, ac.currentTime + duration);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + duration);
  } catch(e) {}
}
function sfxShoot()    { playTone(900, 'square', 0.07, 0.12, 200); }
function sfxHit()      { playTone(180, 'sawtooth', 0.12, 0.09, 60); }
function sfxDie()      { playTone(120, 'sawtooth', 0.35, 0.14, 40); }
function sfxExplode()  { playTone(80,  'sawtooth', 0.5,  0.22, 30); }
function sfxPickup()   { playTone(880, 'sine', 0.12, 0.08, 1200); }
function sfxLevelUp()  { playTone(440, 'sine', 0.5,  0.18, 880); }
function sfxReload()   { playTone(300, 'square', 0.15, 0.07, 500); }
function sfxPlayerHit(){ playTone(200, 'sawtooth', 0.2, 0.15, 80); }
function sfxBoss()     { playTone(55, 'sawtooth', 1.2, 0.3, 40); }

// ═══════════════════════════════════════════════════════════════
//  WEAPONS
// ═══════════════════════════════════════════════════════════════
const WEAPONS = {
  pistol: {
    id:'pistol', name:'Пистолет', color:'#88aaff',
    damage:18, fireRate:0.45, bulletSpeed:420, range:400,
    spread:0, bulletCount:1, pierce:1, aoe:0,
    maxAmmo:12, reloadTime:1.2,
    desc:'Надёжный, точный',
  },
  smg: {
    id:'smg', name:'Автомат', color:'#44ffaa',
    damage:10, fireRate:0.11, bulletSpeed:480, range:340,
    spread:0.08, bulletCount:1, pierce:1, aoe:0,
    maxAmmo:30, reloadTime:1.8,
    desc:'Высокая скорострельность',
  },
  shotgun: {
    id:'shotgun', name:'Дробовик', color:'#ffaa44',
    damage:22, fireRate:0.7, bulletSpeed:350, range:250,
    spread:0.25, bulletCount:6, pierce:1, aoe:0,
    maxAmmo:8, reloadTime:2.0,
    desc:'Широкий разброс, близкий бой',
  },
  sniper: {
    id:'sniper', name:'Снайпер', color:'#ff4444',
    damage:80, fireRate:1.2, bulletSpeed:700, range:800,
    spread:0, bulletCount:1, pierce:3, aoe:0,
    maxAmmo:5, reloadTime:2.5,
    desc:'Огромный урон, сквозной',
  },
  launcher: {
    id:'launcher', name:'Гранатомёт', color:'#ff8800',
    damage:55, fireRate:1.5, bulletSpeed:280, range:450,
    spread:0, bulletCount:1, pierce:1, aoe:3,
    maxAmmo:4, reloadTime:3.0,
    desc:'Взрыв при ударе',
  },
  dual: {
    id:'dual', name:'Два Узи', color:'#aaffff',
    damage:12, fireRate:0.14, bulletSpeed:440, range:320,
    spread:0.12, bulletCount:2, pierce:1, aoe:0,
    maxAmmo:40, reloadTime:2.2,
    desc:'Двойной ствол, высокий ДПС',
  },
};

let unlockedWeapons = ['pistol'];
let currentWeapon   = 'pistol';
let ammo            = WEAPONS.pistol.maxAmmo;
let reloading       = false;
let reloadTimer     = 0;

// ═══════════════════════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════════════════════
const player = {
  x:0, y:0, r:16,
  hp:100, maxHp:100,
  speed:170, angle:0,
  invincible:0,
  kills:0,
  xp:0, xpNext:100,
  level:1,
  score:0,
  upgrades:{
    damage:0,      // +20% each
    fireRate:0,    // +18% each
    bulletCount:0, // +1 bullet
    bulletSpeed:0, // +18%
    pierce:0,      // +1 pierce
    range:0,       // +20%
    aoe:0,         // +1 aoe level
    regen:0,       // +0.5 hp/s
    maxHp:0,       // +30 hp
    speed:0,       // +12%
    magnet:0,      // +35% magnet
    multishot:0,   // extra bullet directions
    critChance:0,  // +10%
    critMult:0,    // +0.5x
    shield:0,      // extra shield charges
    vampirism:0,   // +1% lifesteal
    explosive:0,   // bullet area scale
  },
  shieldCharges:0,
};

// ═══════════════════════════════════════════════════════════════
//  UPGRADE DEFS
// ═══════════════════════════════════════════════════════════════
const UPGRADES = [
  { id:'damage',      name:'Убойная сила',    desc:'+20% урон пуль',            max:10, icon:'💥' },
  { id:'fireRate',    name:'Скорострел',      desc:'+18% скорость стрельбы',    max:10, icon:'⚡' },
  { id:'bulletCount', name:'Лишние патроны',  desc:'+1 пуля за выстрел',        max:4,  icon:'🔫' },
  { id:'bulletSpeed', name:'Сверхзвук',       desc:'+18% скорость пуль',        max:8,  icon:'💨' },
  { id:'pierce',      name:'Бронебой',        desc:'Пробивает +1 врага',        max:5,  icon:'🎯' },
  { id:'range',       name:'Дальнобойность',  desc:'+20% дальность',            max:8,  icon:'📏' },
  { id:'aoe',         name:'Взрывчатка',      desc:'Пули взрываются при ударе', max:5,  icon:'💣' },
  { id:'regen',       name:'Регенерация',     desc:'+0.5 HP/сек',               max:6,  icon:'💚' },
  { id:'maxHp',       name:'Живучесть',       desc:'+30 макс. HP',              max:8,  icon:'❤' },
  { id:'speed',       name:'Ловкость',        desc:'+12% скорость бега',        max:8,  icon:'👟' },
  { id:'magnet',      name:'XP Магнит',       desc:'+35% радиус сбора опыта',   max:5,  icon:'🧲' },
  { id:'multishot',   name:'Мультивыстрел',   desc:'Дополнительные направления',max:3,  icon:'✳' },
  { id:'critChance',  name:'Критический удар',desc:'+10% шанс крита',           max:10, icon:'⭐' },
  { id:'critMult',    name:'Сила крита',      desc:'+0.5x крит-множитель',      max:5,  icon:'🌟' },
  { id:'shield',      name:'Энергощит',       desc:'+1 заряд щита (1 хит)',     max:3,  icon:'🛡' },
  { id:'vampirism',   name:'Вампиризм',       desc:'+1% вытягивание жизни',     max:5,  icon:'🩸' },
  { id:'explosive',   name:'Напалм',          desc:'+1 ур. взрывного урона',    max:4,  icon:'🔥' },
];

function applyUpgradeEffect(upg) {
  switch(upg.id) {
    case 'maxHp':
      player.maxHp += 30;
      player.hp = Math.min(player.hp + 30, player.maxHp);
      break;
    case 'critMult':
      player.upgrades.critMult++;
      break;
    case 'shield':
      player.upgrades.shield++;
      player.shieldCharges = Math.min(player.shieldCharges + 1, player.upgrades.shield);
      break;
    default:
      player.upgrades[upg.id]++;
  }
  // weapon unlock milestones
  if (player.level === 3  && !unlockedWeapons.includes('smg'))      { unlockedWeapons.push('smg');      showNotif('🔓 Разблокирован АВТОМАТ!', '#44ffaa'); }
  if (player.level === 6  && !unlockedWeapons.includes('shotgun'))  { unlockedWeapons.push('shotgun');  showNotif('🔓 Разблокирован ДРОБОВИК!','#ffaa44'); }
  if (player.level === 10 && !unlockedWeapons.includes('sniper'))   { unlockedWeapons.push('sniper');   showNotif('🔓 Разблокирован СНАЙПЕР!', '#ff4444'); }
  if (player.level === 14 && !unlockedWeapons.includes('launcher')) { unlockedWeapons.push('launcher'); showNotif('🔓 Разблокирован ГРАНАТОМЁТ!','#ff8800'); }
  if (player.level === 18 && !unlockedWeapons.includes('dual'))     { unlockedWeapons.push('dual');     showNotif('🔓 Разблокированы ДВА УЗИ!','#aaffff'); }
}

// ═══════════════════════════════════════════════════════════════
//  STAT GETTERS
// ═══════════════════════════════════════════════════════════════
function wpn() { return WEAPONS[currentWeapon]; }
function getDamage()      { return wpn().damage      * Math.pow(1.20, player.upgrades.damage); }
function getFireRate()    { return wpn().fireRate     / Math.pow(1.18, player.upgrades.fireRate); }
function getBulletSpd()   { return wpn().bulletSpeed  * Math.pow(1.18, player.upgrades.bulletSpeed); }
function getRange()       { return wpn().range        * Math.pow(1.20, player.upgrades.range); }
function getPlayerSpd()   { return player.speed       * Math.pow(1.12, player.upgrades.speed); }
function getMagnetR()     { return 55                 * Math.pow(1.35, player.upgrades.magnet); }
function getCritChance()  { return player.upgrades.critChance * 0.10; }
function getCritMult()    { return 2.0 + player.upgrades.critMult * 0.5; }
function getBulletCount() { return wpn().bulletCount  + player.upgrades.bulletCount; }
function getPierce()      { return wpn().pierce       + player.upgrades.pierce - 1; }
function getAoe()         { return wpn().aoe          + player.upgrades.aoe + player.upgrades.explosive; }
function getSpread()      { return wpn().spread; }

// ═══════════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════════
let gameRunning = false;
let paused      = false;
let lastTime    = 0;
let cameraShake = 0;

const cam = { x:0, y:0 };

let bullets       = [];
let enemyBullets  = [];
let enemies       = [];
let orbs          = [];
let particles     = [];
let damageNums    = [];
let bloodDecals   = [];

let shootTimer    = 0;
let currentBoss   = null;

// ═══════════════════════════════════════════════════════════════
//  WAVE SYSTEM
// ═══════════════════════════════════════════════════════════════
const wave = {
  current:1,
  spawnInterval:1.5, spawnTimer:0,
  enemiesPerWave:8,  spawned:0,
  bossSpawned:false,
  betweenWaves:false, betweenTimer:0,
};

function isBossWave() { return wave.current % 5 === 0; }

function startNextWaveSpawn() {
  wave.spawned = 0;
  wave.bossSpawned = false;
  wave.spawnTimer = 0;
  waveBadge.textContent = `Wave ${wave.current}`;
}

function finishWave() {
  wave.betweenWaves  = true;
  wave.betweenTimer  = 3.5;
  wave.current++;
  wave.enemiesPerWave = Math.floor(8 + wave.current * 3.2);
  wave.spawnInterval  = Math.max(0.35, 1.5 - wave.current * 0.055);
  showNotif(`Волна ${wave.current - 1} пройдена!`, '#aaffaa');
}

// ═══════════════════════════════════════════════════════════════
//  ENEMY DEFINITIONS
// ═══════════════════════════════════════════════════════════════
const ENEMY_DEFS = {
  basic:    { name:'Зомби',    color:'#44bb44', r:15, hp:w=>18+w*9,   spd:w=>58+w*5,  dmg:8,  xp:10, ranged:false, explodes:false },
  fast:     { name:'Бегун',   color:'#aaff44', r:11, hp:w=>12+w*5,   spd:w=>125+w*8, dmg:6,  xp:14, ranged:false, explodes:false },
  tank:     { name:'Брут',    color:'#226622', r:28, hp:w=>90+w*35,  spd:w=>42+w*3,  dmg:18, xp:28, ranged:false, explodes:false },
  spitter:  { name:'Плевун',  color:'#88ff22', r:13, hp:w=>22+w*9,   spd:w=>50+w*4,  dmg:10, xp:18, ranged:true,  explodes:false, shootInterval:2.2 },
  exploder: { name:'Камикадзе',color:'#ff8800',r:17, hp:w=>28+w*11,  spd:w=>72+w*6,  dmg:38, xp:22, ranged:false, explodes:true },
  armored:  { name:'Броневик',color:'#556677', r:22, hp:w=>120+w*50, spd:w=>48+w*3,  dmg:20, xp:35, ranged:false, explodes:false, armor:0.4 },
  shaman:   { name:'Шаман',   color:'#cc44ff', r:14, hp:w=>40+w*15,  spd:w=>60+w*5,  dmg:12, xp:30, ranged:true,  explodes:false, shootInterval:1.8, healer:true },
};

const BOSS_DEFS = [
  { name:'КОРОЛЬ ЗОМБИ', color:'#880000', outline:'#ff4444', r:46,
    hp:w=>600+w*220, spd:w=>52+w*3, dmg:28, xp:250,
    abilities:['slam','summon','roar'] },
  { name:'МУТАНТ ТОКСИН', color:'#006600', outline:'#00ff44', r:42,
    hp:w=>500+w*180, spd:w=>65+w*4, dmg:18, xp:220,
    abilities:['poisonCloud','spit','spawn'], ranged:true, shootInterval:1.4, shootTimer:0 },
  { name:'ЖЕЛЕЗНЫЙ ГОЛЕМ', color:'#445566', outline:'#aabbdd', r:58,
    hp:w=>1000+w*350, spd:w=>32+w*2, dmg:42, xp:300,
    abilities:['charge','shockwave','stomp'] },
  { name:'НЕКРОМАНТ',     color:'#220044', outline:'#cc44ff', r:36,
    hp:w=>450+w*160, spd:w=>70+w*4, dmg:14, xp:280,
    abilities:['summon','teleport','deathRay'], ranged:true, shootInterval:1.0, shootTimer:0 },
];

// ═══════════════════════════════════════════════════════════════
//  SPAWN HELPERS
// ═══════════════════════════════════════════════════════════════
function rand(a, b)    { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

function getSpawnPos() {
  const margin = 90, W = canvas.width, H = canvas.height;
  const side = randInt(0, 3);
  switch(side) {
    case 0: return { x: cam.x + rand(-margin, W+margin), y: cam.y - margin };
    case 1: return { x: cam.x + rand(-margin, W+margin), y: cam.y + H + margin };
    case 2: return { x: cam.x - margin,                  y: cam.y + rand(-margin, H+margin) };
    default:return { x: cam.x + W + margin,              y: cam.y + rand(-margin, H+margin) };
  }
}

function buildEnemy(def, x, y, isBoss) {
  const w = wave.current;
  return {
    x, y, r: def.r,
    hp: def.hp(w), maxHp: def.hp(w),
    speed: def.spd(w), color: def.color,
    outline: def.outline || null,
    damage: def.dmg, xp: def.xp,
    name: def.name, isBoss,
    alive: true,
    armor: def.armor || 0,
    ranged: def.ranged || false,
    healer: def.healer || false,
    explodes: def.explodes || false,
    shootInterval: def.shootInterval || 99,
    shootTimer: Math.random() * (def.shootInterval || 99),
    abilities: def.abilities || [],
    abilityTimer: rand(2, 5),
    charging: false, chargeVx:0, chargeVy:0, chargeDur:0,
    flash: 0, angle: 0,
  };
}

function spawnEnemy(key, x, y) {
  const e = buildEnemy(ENEMY_DEFS[key], x, y, false);
  enemies.push(e);
  return e;
}

function spawnBoss(bossIdx) {
  const def = BOSS_DEFS[bossIdx % BOSS_DEFS.length];
  const pos = getSpawnPos();
  const e = buildEnemy(def, pos.x, pos.y, true);
  enemies.push(e);
  currentBoss = e;
  bossLabel.textContent = def.name;
  bossBarWrap.style.display = 'block';
  sfxBoss();
  return e;
}

function pickEnemyType() {
  const w = wave.current, r = Math.random();
  if (w >= 7 && r < 0.08) return 'shaman';
  if (w >= 5 && r < 0.15) return 'armored';
  if (w >= 4 && r < 0.22) return 'exploder';
  if (w >= 3 && r < 0.30) return 'spitter';
  if (w >= 2 && r < 0.40) return 'fast';
  if (w >= 3 && r < 0.50) return 'tank';
  return 'basic';
}

// ═══════════════════════════════════════════════════════════════
//  BULLETS
// ═══════════════════════════════════════════════════════════════
function fireBullets(angle) {
  if (reloading) return;
  if (ammo <= 0) { startReload(); return; }

  ammo--;
  sfxShoot();
  updateAmmoBar();

  const count  = getBulletCount();
  const spd    = getBulletSpd();
  const dmg    = getDamage();
  const range  = getRange();
  const pierce = getPierce();
  const aoe    = getAoe();
  const spread = getSpread();
  const crit   = Math.random() < getCritChance();
  const finalDmg = crit ? dmg * getCritMult() : dmg;

  const angles = [angle];

  // multishot extra directions
  if (player.upgrades.multishot >= 1) angles.push(angle + Math.PI);
  if (player.upgrades.multishot >= 2) { angles.push(angle + Math.PI*2/3); angles.push(angle - Math.PI*2/3); }
  if (player.upgrades.multishot >= 3) { angles.push(angle + Math.PI/2); angles.push(angle - Math.PI/2); }

  for (const baseAngle of angles) {
    for (let i = 0; i < count; i++) {
      const off = count > 1 ? (i - (count-1)/2) * spread : 0;
      const a   = baseAngle + off + (spread ? rand(-spread*0.3, spread*0.3) : 0);
      bullets.push({
        x: player.x, y: player.y,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        dmg: finalDmg, crit,
        range, traveled: 0,
        pierce, pierced: 0,
        aoe, r: aoe > 0 ? 8 : 5,
        alive: true,
        color: wpn().color,
      });
    }
  }

  // auto-reload when empty
  if (ammo === 0) startReload();
}

function startReload() {
  if (reloading) return;
  reloading = true;
  reloadTimer = wpn().reloadTime;
  reloadText.style.display = 'inline';
  sfxReload();
}

// ── Enemy projectile ──
function fireEnemyBullet(e) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const spd = e.isBoss ? 180 : 150;
  const spread = e.isBoss ? 3 : 1;
  for (let i = 0; i < spread; i++) {
    const a = Math.atan2(dy, dx) + rand(-0.15, 0.15) * i;
    enemyBullets.push({
      x:e.x, y:e.y,
      vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
      dmg: e.damage * (e.isBoss ? 0.7 : 0.55),
      r:7, alive:true, life:3.5,
      color: e.isBoss ? '#ff4400' : '#aaff00',
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  COMBAT
// ═══════════════════════════════════════════════════════════════
function explode(x, y, aoeLevel) {
  const radius = 40 + aoeLevel * 22;
  const dmg    = getDamage() * (0.6 + aoeLevel * 0.15);
  spawnParticle(x, y, '#ff8800', 18, 220, 0.7);
  spawnParticle(x, y, '#ffcc00', 10, 140, 0.4);
  addScreenShake(aoeLevel * 2);
  sfxExplode();
  // draw ring
  particles.push({ type:'ring', x, y, r:0, maxR:radius, life:0.35, maxLife:0.35, color:'#ff8800' });
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x-x, e.y-y);
    if (d < radius + e.r) hitEnemy(e, dmg * (1 - d/(radius+e.r+1)));
  }
}

function hitEnemy(e, dmg) {
  const actual = dmg * (1 - e.armor);
  e.hp -= actual;
  e.flash = 0.12;
  spawnDamageNum(e.x, e.y - e.r - 4, actual, false);
  sfxHit();
  if (e.hp <= 0) killEnemy(e);
  else {
    // update boss bar
    if (e.isBoss) updateBossBar(e);
  }
}

function killEnemy(e) {
  e.alive = false;
  player.kills++;
  player.score += e.isBoss ? 50 : (e.armor > 0 ? 5 : 2);
  scoreBadge.textContent = `Kills: ${player.kills}`;

  sfxDie();
  spawnParticle(e.x, e.y, e.color, e.isBoss ? 35 : 12, 160, e.isBoss ? 1.3 : 0.55);
  bloodDecals.push({ x:e.x, y:e.y, r: e.r * 1.6 + rand(0,10), alpha:0.55, life:25 });

  if (e.explodes) explode(e.x, e.y, 2);

  dropOrbs(e);

  if (e.isBoss) {
    currentBoss = null;
    bossBarWrap.style.display = 'none';
    showNotif(`☠ ${e.name} ПОВЕРЖЕН!`, '#ffcc00');
    addScreenShake(12);
    finishWave();
  } else {
    const aliveCount = enemies.filter(x=>x.alive).length;
    if (!isBossWave() && wave.spawned >= wave.enemiesPerWave && aliveCount === 0) {
      finishWave();
    }
  }
}

function dropOrbs(e) {
  const orbCount = e.isBoss ? 25 : Math.ceil(e.xp / 12);
  const xpPer    = Math.ceil(e.xp / orbCount);
  for (let i = 0; i < orbCount; i++) {
    orbs.push({
      x: e.x + rand(-22, 22), y: e.y + rand(-22, 22),
      r: e.isBoss ? 9 : 5,
      xp: xpPer, alive: true,
      color: e.isBoss ? '#ff44ff' : '#aa44ff',
    });
  }
}

function damagePlayer(dmg) {
  if (player.invincible > 0) return;
  if (player.shieldCharges > 0) {
    player.shieldCharges--;
    spawnParticle(player.x, player.y, '#4488ff', 12, 100, 0.4);
    player.invincible = 0.3;
    return;
  }
  player.hp -= dmg;
  player.invincible = 0.5;
  addScreenShake(5);
  sfxPlayerHit();
  spawnParticle(player.x, player.y, '#ff2244', 8, 80, 0.3);
  if (player.hp <= 0) { player.hp = 0; gameOver(); }
}

// ═══════════════════════════════════════════════════════════════
//  XP / LEVEL UP
// ═══════════════════════════════════════════════════════════════
function xpForLevel(lvl) { return Math.floor(100 * Math.pow(1.22, lvl - 1)); }

function addXP(amount) {
  player.xp += amount;
  sfxPickup();
  while (player.xp >= player.xpNext && gameRunning) {
    player.xp    -= player.xpNext;
    player.level++;
    player.xpNext = xpForLevel(player.level);
    onLevelUp();
  }
  updateXPBar();
}

function onLevelUp() {
  levelBadge.textContent = `Lv ${player.level}`;
  sfxLevelUp();
  spawnParticle(player.x, player.y, '#e100ff', 20, 100, 0.8);
  paused = true;
  showUpgrades();
}

function showUpgrades() {
  upgLvlTxt.textContent = `Уровень ${player.level} — выбери улучшение`;
  upgChoices.innerHTML = '';

  const available = UPGRADES.filter(u => {
    const cur = player.upgrades[u.id];
    return cur < u.max;
  });
  const pool = available.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const upg of pool) {
    const cur = player.upgrades[upg.id];
    const stars = '★'.repeat(cur+1) + '☆'.repeat(upg.max - cur - 1);
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
      <div class="u-header">
        <span class="u-name">${upg.icon} ${upg.name}</span>
        <span class="u-lvl">Ур. ${cur+1}/${upg.max}</span>
      </div>
      <div class="u-desc">${upg.desc}</div>
      <div class="u-stars">${stars}</div>`;
    const pick = () => {
      applyUpgradeEffect(upg);
      upgPanel.style.display = 'none';
      // If more levels pending
      while (player.xp >= player.xpNext && gameRunning) {
        player.xp -= player.xpNext;
        player.level++;
        player.xpNext = xpForLevel(player.level);
        levelBadge.textContent = `Lv ${player.level}`;
        sfxLevelUp();
        showUpgrades();
        return;
      }
      paused = false;
    };
    card.addEventListener('click', pick);
    card.addEventListener('touchend', e => { e.preventDefault(); pick(); });
    upgChoices.appendChild(card);
  }

  upgPanel.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════
//  BOSS ABILITIES
// ═══════════════════════════════════════════════════════════════
function doBossAbility(e, ability) {
  switch(ability) {
    case 'slam': {
      addScreenShake(8);
      spawnParticle(e.x, e.y, '#ff2244', 28, 280, 0.9);
      if (Math.hypot(player.x-e.x, player.y-e.y) < 130) damagePlayer(e.damage * 0.7);
      break;
    }
    case 'summon': {
      for (let i = 0; i < 4; i++) {
        const a = (i/4)*Math.PI*2;
        spawnEnemy('basic', e.x+Math.cos(a)*70, e.y+Math.sin(a)*70);
      }
      showNotif('👻 Призыв зомби!', '#ff4444');
      break;
    }
    case 'roar': {
      addScreenShake(10);
      spawnParticle(e.x, e.y, '#ffcc00', 30, 200, 1.0);
      // push player
      const dx=player.x-e.x, dy=player.y-e.y;
      const dist=Math.hypot(dx,dy)||1;
      player.x += dx/dist*80; player.y += dy/dist*80;
      break;
    }
    case 'poisonCloud': {
      spawnParticle(e.x, e.y, '#00ff44', 22, 130, 1.8);
      if (Math.hypot(player.x-e.x, player.y-e.y) < 110) damagePlayer(e.damage*0.4);
      break;
    }
    case 'spit': {
      for (let i = 0; i < 6; i++) {
        const a = Math.atan2(player.y-e.y, player.x-e.x) + rand(-0.5, 0.5);
        enemyBullets.push({ x:e.x, y:e.y, vx:Math.cos(a)*210, vy:Math.sin(a)*210,
          dmg:e.damage*0.4, r:8, alive:true, life:2.8, color:'#00ff88' });
      }
      break;
    }
    case 'spawn': {
      for (let i = 0; i < 3; i++) spawnEnemy('fast', e.x+rand(-80,80), e.y+rand(-80,80));
      break;
    }
    case 'charge': {
      const dx=player.x-e.x, dy=player.y-e.y, dist=Math.hypot(dx,dy)||1;
      e.charging=true; e.chargeVx=dx/dist*e.speed; e.chargeVy=dy/dist*e.speed; e.chargeDur=0.9;
      break;
    }
    case 'shockwave': {
      addScreenShake(12);
      for (let i = 0; i < 16; i++) {
        const a=(i/16)*Math.PI*2;
        enemyBullets.push({ x:e.x, y:e.y, vx:Math.cos(a)*200, vy:Math.sin(a)*200,
          dmg:e.damage*0.45, r:9, alive:true, life:2.2, color:'#aaaaff' });
      }
      break;
    }
    case 'stomp': {
      addScreenShake(15);
      spawnParticle(e.x, e.y, '#555577', 35, 300, 1.0);
      if (Math.hypot(player.x-e.x, player.y-e.y) < 150) damagePlayer(e.damage*0.9);
      break;
    }
    case 'teleport': {
      const pos = getSpawnPos();
      e.x = pos.x; e.y = pos.y;
      spawnParticle(e.x, e.y, '#cc44ff', 20, 150, 0.7);
      break;
    }
    case 'deathRay': {
      // Burst of aimed projectiles
      for (let i = 0; i < 20; i++) {
        const a = Math.atan2(player.y-e.y, player.x-e.x) + rand(-0.08, 0.08);
        enemyBullets.push({ x:e.x, y:e.y, vx:Math.cos(a)*320, vy:Math.sin(a)*320,
          dmg:e.damage*0.35, r:6, alive:true, life:2.0, color:'#ff00ff' });
      }
      addScreenShake(6);
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  PARTICLES & VISUAL FX
// ═══════════════════════════════════════════════════════════════
function spawnParticle(x, y, color, count=8, spd=120, life=0.5) {
  for (let i=0; i<count; i++) {
    const a = Math.random()*Math.PI*2;
    const s = rand(spd*0.3, spd);
    particles.push({ type:'dot', x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life, maxLife:life, color, r:rand(2,5) });
  }
}

function spawnDamageNum(x, y, val, crit) {
  damageNums.push({ x, y, vy:-55, val:Math.round(val), life:0.9, maxLife:0.9, crit });
}

function addScreenShake(intensity) { cameraShake = Math.max(cameraShake, intensity); }

function showNotif(text, color='#ffffff') {
  notifEl.textContent = text;
  notifEl.style.color = color;
  notifEl.style.display = 'block';
  clearTimeout(notifEl._t);
  notifEl._t = setTimeout(() => { notifEl.style.display = 'none'; }, 2200);
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-AIM
// ═══════════════════════════════════════════════════════════════
function findNearestEnemy() {
  let nearest = null, minD = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < minD) { minD = d; nearest = e; }
  }
  return nearest;
}

// ═══════════════════════════════════════════════════════════════
//  HUD UPDATES
// ═══════════════════════════════════════════════════════════════
function updateHPBar() {
  const pct = player.hp / player.maxHp;
  hpBar.style.width = (pct*100) + '%';
  hpBar.style.background = pct < 0.3
    ? 'linear-gradient(90deg,#880000,#ff2244)'
    : 'linear-gradient(90deg,#cc0022,#ff4466)';
  hpText.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
}
function updateXPBar() {
  xpBar.style.width = (player.xp / player.xpNext * 100) + '%';
}
function updateAmmoBar() {
  const w = WEAPONS[currentWeapon];
  ammoBar.style.width = (ammo / w.maxAmmo * 100) + '%';
  weaponName.textContent = w.name + (player.shieldCharges > 0 ? ` 🛡${player.shieldCharges}` : '');
}
function updateBossBar(e) {
  bossBarEl.style.width = (e.hp / e.maxHp * 100) + '%';
}

// ═══════════════════════════════════════════════════════════════
//  JOYSTICK
// ═══════════════════════════════════════════════════════════════
const joyZone  = document.getElementById('joystick-zone');
const joyKnob  = document.getElementById('joystick-knob');
const joyCenter= { x:0, y:0 };
const joyInput = { x:0, y:0 };
let   joyId    = null;

function updateJoyCenter() {
  const r = joyZone.getBoundingClientRect();
  joyCenter.x = r.left + r.width/2;
  joyCenter.y = r.top  + r.height/2;
}

joyZone.addEventListener('touchstart', e => {
  e.preventDefault();
  if (joyId !== null) return;
  updateJoyCenter();
  joyId = e.changedTouches[0].identifier;
  handleJoyMove(e.changedTouches[0]);
}, { passive:false });

document.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier===joyId) { handleJoyMove(t); break; }
}, { passive:false });

document.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier===joyId) {
      joyId=null; joyInput.x=0; joyInput.y=0;
      joyKnob.style.left='50%'; joyKnob.style.top='50%';
      joyKnob.style.transform='translate(-50%,-50%)';
      break;
    }
  }
});

function handleJoyMove(t) {
  const dx = t.clientX - joyCenter.x;
  const dy = t.clientY - joyCenter.y;
  const dist = Math.hypot(dx, dy);
  const maxR = 38;
  const clamp = Math.min(dist, maxR);
  const nx = dist>0 ? dx/dist : 0;
  const ny = dist>0 ? dy/dist : 0;
  joyInput.x = nx*(clamp/maxR);
  joyInput.y = ny*(clamp/maxR);
  joyKnob.style.left      = (50 + nx*(clamp/57)*100)+'%';
  joyKnob.style.top       = (50 + ny*(clamp/57)*100)+'%';
  joyKnob.style.transform = 'translate(-50%,-50%)';
}

// Keyboard
const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup',   e => { keys[e.key] = false; });
document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') startReload();
});

// Shoot / weapon buttons
document.getElementById('shoot-btn').addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameRunning && !paused) shootTimer = 0;
}, { passive:false });

document.getElementById('weapon-btn').addEventListener('touchend', e => {
  e.preventDefault();
  openWeaponPicker();
});

document.getElementById('weapon-btn').addEventListener('click', openWeaponPicker);

wpnCloseBtn.addEventListener('click',    () => { wpnPicker.style.display='none'; paused=false; });
wpnCloseBtn.addEventListener('touchend', e  => { e.preventDefault(); wpnPicker.style.display='none'; paused=false; });

function openWeaponPicker() {
  if (!gameRunning) return;
  paused = true;
  wpnList.innerHTML = '';
  for (const id of unlockedWeapons) {
    const w = WEAPONS[id];
    const card = document.createElement('div');
    card.className = 'weapon-card';
    card.innerHTML = `
      <div class="w-name" style="color:${w.color}">${id===currentWeapon?'▶ ':''} ${w.name}</div>
      <div class="w-stats">Урон: ${w.damage} · Скорость: ${(1/w.fireRate).toFixed(1)}/с · Магазин: ${w.maxAmmo} · ${w.desc}</div>`;
    const pick = () => {
      currentWeapon = id;
      ammo = w.maxAmmo;
      reloading = false;
      reloadText.style.display = 'none';
      updateAmmoBar();
      wpnPicker.style.display = 'none';
      paused = false;
    };
    card.addEventListener('click', pick);
    card.addEventListener('touchend', e => { e.preventDefault(); pick(); });
    wpnList.appendChild(card);
  }
  wpnPicker.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════
//  DRAW HELPERS
// ═══════════════════════════════════════════════════════════════
function drawGrid() {
  const size = 64;
  ctx.strokeStyle = 'rgba(35,35,55,0.7)';
  ctx.lineWidth = 1;
  const ox = ((-cam.x % size) + size) % size;
  const oy = ((-cam.y % size) + size) % size;
  ctx.beginPath();
  for (let x=ox; x<canvas.width; x+=size)  { ctx.moveTo(x,0);            ctx.lineTo(x,canvas.height); }
  for (let y=oy; y<canvas.height; y+=size) { ctx.moveTo(0,y);            ctx.lineTo(canvas.width,y); }
  ctx.stroke();
}

function drawBloodDecals() {
  for (const d of bloodDecals) {
    const sx = d.x - cam.x, sy = d.y - cam.y;
    ctx.globalAlpha = d.alpha * (d.life / 25);
    ctx.fillStyle = '#550000';
    ctx.beginPath();
    ctx.ellipse(sx, sy, d.r, d.r*0.65, d.life*0.1, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOrbs() {
  const t = Date.now()/1000;
  for (const o of orbs) {
    if (!o.alive) continue;
    const sx = o.x-cam.x, sy = o.y-cam.y;
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = o.color;
    ctx.fillStyle  = o.color;
    ctx.globalAlpha = 0.8 + 0.2*Math.sin(t*5 + o.x*0.05);
    ctx.beginPath(); ctx.arc(sx, sy, o.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawEnemyBullets() {
  for (const b of enemyBullets) {
    if (!b.alive) continue;
    const sx = b.x-cam.x, sy = b.y-cam.y;
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = b.color;
    ctx.fillStyle  = b.color;
    ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawBullets() {
  for (const b of bullets) {
    if (!b.alive) continue;
    const sx = b.x-cam.x, sy = b.y-cam.y;
    ctx.save();
    ctx.shadowBlur  = b.crit ? 16 : 8;
    ctx.shadowColor = b.crit ? '#ffcc00' : b.color;
    ctx.fillStyle   = b.crit ? '#ffcc00' : b.color;
    ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawPlayer() {
  const sx = player.x - cam.x, sy = player.y - cam.y;

  // Shield aura
  if (player.shieldCharges > 0) {
    const t = Date.now()/300;
    ctx.save();
    ctx.globalAlpha   = 0.35 + 0.15*Math.sin(t);
    ctx.strokeStyle   = '#44aaff';
    ctx.lineWidth     = 4;
    ctx.shadowBlur    = 18; ctx.shadowColor = '#44aaff';
    ctx.beginPath(); ctx.arc(sx, sy, player.r+12, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // Blink on invincible
  if (player.invincible > 0 && Math.floor(Date.now()/75)%2===0) return;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(player.angle);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(3, 6, player.r*0.9, player.r*0.4, 0, 0, Math.PI*2); ctx.fill();

  // Body
  ctx.fillStyle = '#2255ff';
  ctx.shadowBlur = 12; ctx.shadowColor = '#4477ff';
  ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // Gun barrel
  ctx.fillStyle = WEAPONS[currentWeapon].color;
  ctx.fillRect(player.r*0.3, -3, player.r + 6, 6);

  // Visor
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(6, -5, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#001aff';
  ctx.beginPath(); ctx.arc(7, -5, 2.5, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = e.x-cam.x, sy = e.y-cam.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(e.angle);

    if (e.flash > 0) {
      ctx.shadowBlur = 20; ctx.shadowColor = '#ffffff';
    } else {
      ctx.shadowBlur = e.isBoss ? 18 : 6;
      ctx.shadowColor = e.color;
    }

    if (e.isBoss) {
      // spiky boss shape
      ctx.fillStyle = e.flash>0 ? '#ffffff' : e.color;
      ctx.beginPath();
      const spikes = 10;
      for (let i=0; i<spikes*2; i++) {
        const a = (i/spikes/2)*Math.PI*2;
        const r = i%2===0 ? e.r : e.r*0.55;
        i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
      // Outline glow
      if (e.outline) {
        ctx.strokeStyle = e.outline; ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = e.flash>0 ? '#ffffff' : e.color;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI*2); ctx.fill();
      if (e.armor > 0) {
        ctx.strokeStyle = '#aabbcc'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.stroke();
      }
    }

    // Eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(-e.r*0.28, -e.r*0.28, e.r*0.18, 0, Math.PI*2);
    ctx.arc( e.r*0.28, -e.r*0.28, e.r*0.18, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();

    // HP bar above
    const bw = e.r*2.6, bh = e.isBoss ? 8 : 5;
    const bx = sx - bw/2, by = sy - e.r - (e.isBoss ? 16 : 12);
    ctx.fillStyle = '#220000'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = e.isBoss ? '#ff3300' : '#ff2244';
    ctx.fillRect(bx, by, bw*(e.hp/e.maxHp), bh);

    if (e.isBoss) {
      ctx.fillStyle='#fff'; ctx.font='bold 11px Arial';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText(e.name, sx, by-3);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    if (p.type === 'ring') {
      const sx=p.x-cam.x, sy=p.y-cam.y;
      ctx.globalAlpha = p.life/p.maxLife * 0.7;
      ctx.strokeStyle = p.color; ctx.lineWidth = 3;
      ctx.shadowBlur = 10; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      const sx=p.x-cam.x, sy=p.y-cam.y;
      ctx.globalAlpha = p.life/p.maxLife;
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.r*(p.life/p.maxLife), 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawDamageNums() {
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for (const dn of damageNums) {
    const sx=dn.x-cam.x, sy=dn.y-cam.y;
    ctx.globalAlpha = dn.life/dn.maxLife;
    ctx.fillStyle   = dn.crit ? '#ffcc00' : '#ffffff';
    ctx.font        = `bold ${dn.crit?18:12}px Arial`;
    ctx.fillText(dn.crit ? `⭐${dn.val}` : dn.val, sx, sy);
  }
  ctx.globalAlpha = 1;
}

// ── Minimap ──
function drawMinimap() {
  const W=90, H=90, scale=0.035;
  mctx.clearRect(0,0,W,H);
  mctx.fillStyle='rgba(0,0,0,0.6)';
  mctx.fillRect(0,0,W,H);

  // enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const mx = W/2 + (e.x-player.x)*scale;
    const my = H/2 + (e.y-player.y)*scale;
    mctx.fillStyle = e.isBoss ? '#ff4400' : '#ff2244';
    mctx.beginPath(); mctx.arc(mx,my,e.isBoss?4:2,0,Math.PI*2); mctx.fill();
  }
  // orbs
  for (const o of orbs) {
    if (!o.alive) continue;
    const mx = W/2 + (o.x-player.x)*scale;
    const my = H/2 + (o.y-player.y)*scale;
    mctx.fillStyle = '#aa44ff';
    mctx.beginPath(); mctx.arc(mx,my,1.5,0,Math.PI*2); mctx.fill();
  }
  // player dot
  mctx.fillStyle='#4488ff';
  mctx.beginPath(); mctx.arc(W/2,H/2,3.5,0,Math.PI*2); mctx.fill();
}

// ═══════════════════════════════════════════════════════════════
//  MAIN UPDATE
// ═══════════════════════════════════════════════════════════════
function update(dt) {
  if (!gameRunning || paused) return;

  // ── Player movement ──
  let mx=0, my=0;
  if (keys['ArrowLeft']||keys['a']||keys['A']) mx-=1;
  if (keys['ArrowRight']||keys['d']||keys['D']) mx+=1;
  if (keys['ArrowUp']||keys['w']||keys['W']) my-=1;
  if (keys['ArrowDown']||keys['s']||keys['S']) my+=1;
  mx += joyInput.x; my += joyInput.y;
  const mlen = Math.hypot(mx,my);
  if (mlen>0) { mx/=mlen; my/=mlen; }
  player.x += mx*getPlayerSpd()*dt;
  player.y += my*getPlayerSpd()*dt;

  // ── Camera ──
  cam.x = player.x - canvas.width/2;
  cam.y = player.y - canvas.height/2;

  // ── Screen shake ──
  if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt*30);

  // ── Aim + auto shoot ──
  const target = findNearestEnemy();
  if (target) {
    player.angle = Math.atan2(target.y-player.y, target.x-player.x);
  }
  shootTimer -= dt;
  if (shootTimer <= 0 && target && !reloading) {
    shootTimer = getFireRate();
    fireBullets(player.angle);
  }

  // ── Reload ──
  if (reloading) {
    reloadTimer -= dt;
    const w = WEAPONS[currentWeapon];
    ammoBar.style.width = ((1 - reloadTimer/w.reloadTime)*100)+'%';
    if (reloadTimer <= 0) {
      reloading = false;
      ammo = w.maxAmmo;
      reloadText.style.display = 'none';
      updateAmmoBar();
    }
  }

  // ── Player invincible ──
  if (player.invincible > 0) player.invincible -= dt;

  // ── HP regen ──
  if (player.upgrades.regen > 0) {
    player.hp = Math.min(player.maxHp, player.hp + player.upgrades.regen*0.5*dt);
  }
  updateHPBar();

  // ── Player bullets ──
  for (const b of bullets) {
    if (!b.alive) continue;
    b.x += b.vx*dt; b.y += b.vy*dt;
    b.traveled += Math.hypot(b.vx*dt, b.vy*dt);
    if (b.traveled > b.range) {
      if (b.aoe > 0) explode(b.x, b.y, b.aoe);
      b.alive = false; continue;
    }
    for (const e of enemies) {
      if (!e.alive || !b.alive) continue;
      if (Math.hypot(e.x-b.x, e.y-b.y) < e.r+b.r) {
        // lifesteal
        if (player.upgrades.vampirism > 0) {
          const heal = b.dmg * player.upgrades.vampirism * 0.01;
          player.hp = Math.min(player.maxHp, player.hp + heal);
        }
        hitEnemy(e, b.dmg);
        b.pierced++;
        if (b.aoe > 0) explode(b.x, b.y, b.aoe);
        if (b.pierced >= b.pierce) { b.alive=false; break; }
      }
    }
  }
  bullets = bullets.filter(b=>b.alive);

  // ── Enemy bullets ──
  for (const b of enemyBullets) {
    if (!b.alive) continue;
    b.x += b.vx*dt; b.y += b.vy*dt;
    b.life -= dt;
    if (b.life <= 0) { b.alive=false; continue; }
    if (Math.hypot(player.x-b.x, player.y-b.y) < player.r+b.r) {
      damagePlayer(b.dmg);
      b.alive = false;
    }
  }
  enemyBullets = enemyBullets.filter(b=>b.alive);

  // ── Enemies ──
  for (const e of enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt);

    if (e.charging) {
      e.x += e.chargeVx*dt*3.5; e.y += e.chargeVy*dt*3.5;
      e.chargeDur -= dt;
      if (e.chargeDur <= 0) e.charging = false;
    } else {
      const dx=player.x-e.x, dy=player.y-e.y;
      const dist=Math.hypot(dx,dy)||1;
      e.x += dx/dist*e.speed*dt;
      e.y += dy/dist*e.speed*dt;
      e.angle = Math.atan2(dy,dx);

      // Ranged
      if (e.ranged) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 550) {
          e.shootTimer = e.shootInterval;
          fireEnemyBullet(e);
        }
      }

      // Healer (shaman buffs nearby zombies)
      if (e.healer) {
        for (const other of enemies) {
          if (other===e || !other.alive) continue;
          if (Math.hypot(other.x-e.x, other.y-e.y) < 100) {
            other.hp = Math.min(other.maxHp, other.hp + 8*dt);
          }
        }
      }
    }

    // Boss ability
    if (e.isBoss) {
      e.abilityTimer -= dt;
      if (e.abilityTimer <= 0) {
        e.abilityTimer = rand(2.5, 5);
        const ab = e.abilities[randInt(0, e.abilities.length-1)];
        doBossAbility(e, ab);
        if (e.alive) updateBossBar(e);
      }
    }

    // Melee contact
    const dist2 = Math.hypot(player.x-e.x, player.y-e.y);
    if (dist2 < player.r + e.r) {
      damagePlayer(e.damage * dt * (e.ranged && !e.isBoss ? 0.3 : 1));
    }
  }
  enemies = enemies.filter(e=>e.alive);

  // ── XP Orb pickup ──
  const magnet = getMagnetR();
  for (const o of orbs) {
    if (!o.alive) continue;
    const d = Math.hypot(player.x-o.x, player.y-o.y);
    if (d < magnet + player.r + o.r) {
      const pull = 220 + (magnet-d)*4;
      const dx=player.x-o.x, dy=player.y-o.y;
      const od=Math.hypot(dx,dy)||1;
      o.x += dx/od*pull*dt; o.y += dy/od*pull*dt;
      if (Math.hypot(player.x-o.x, player.y-o.y) < player.r+o.r) {
        addXP(o.xp); o.alive=false;
      }
    }
  }
  orbs = orbs.filter(o=>o.alive);

  // ── Particles ──
  for (const p of particles) {
    if (p.type==='dot') { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.88; p.vy*=0.88; }
    else if (p.type==='ring') { p.r = p.maxR*(1 - p.life/p.maxLife); }
    p.life -= dt;
  }
  particles = particles.filter(p=>p.life>0);

  // ── Damage numbers ──
  for (const dn of damageNums) { dn.y+=dn.vy*dt; dn.life-=dt; }
  damageNums = damageNums.filter(dn=>dn.life>0);

  // ── Blood decal fade ──
  for (const d of bloodDecals) d.life -= dt*0.3;
  bloodDecals = bloodDecals.filter(d=>d.life>0);

  // ── Wave spawning ──
  if (wave.betweenWaves) {
    wave.betweenTimer -= dt;
    if (wave.betweenTimer <= 0) {
      wave.betweenWaves = false;
      startNextWaveSpawn();
      if (isBossWave()) {
        showNotif(`⚠ BOSС НАДВИГАЕТСЯ!`, '#ff2244');
      }
    }
    return;
  }

  wave.spawnTimer -= dt;
  if (wave.spawnTimer <= 0) {
    const alive = enemies.filter(e=>e.alive).length;

    if (isBossWave() && !wave.bossSpawned) {
      wave.bossSpawned = true;
      wave.spawned++;
      const bossIdx = Math.floor((wave.current - 5) / 5);
      spawnBoss(bossIdx);
      wave.spawnTimer = 9999;

    } else if (!isBossWave()) {
      if (wave.spawned < wave.enemiesPerWave && alive < 45) {
        wave.spawnTimer = wave.spawnInterval;
        wave.spawned++;
        spawnEnemy(pickEnemyType(), getSpawnPos().x, getSpawnPos().y);
      }
      if (wave.spawned >= wave.enemiesPerWave && alive === 0) {
        finishWave();
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════
function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Apply camera shake
  const shakeX = cameraShake > 0 ? (Math.random()-0.5)*cameraShake*2 : 0;
  const shakeY = cameraShake > 0 ? (Math.random()-0.5)*cameraShake*2 : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Background
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(-2, -2, canvas.width+4, canvas.height+4);
  drawGrid();
  drawBloodDecals();
  drawOrbs();
  drawParticles();
  drawEnemies();
  drawPlayer();
  drawBullets();
  drawEnemyBullets();
  drawDamageNums();

  ctx.restore();
  drawMinimap();
}

// ═══════════════════════════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════════════════════════
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════════════════════════
//  GAME OVER
// ═══════════════════════════════════════════════════════════════
function gameOver() {
  gameRunning = false;
  overlay.innerHTML = `
    <h1>GAME OVER</h1>
    <div class="stat-grid">
      <div>Волна:</div><div><span>${wave.current}</span></div>
      <div>Убийств:</div><div><span>${player.kills}</span></div>
      <div>Уровень:</div><div><span>${player.level}</span></div>
      <div>Очки:</div><div><span>${player.score}</span></div>
    </div>
    <button class="big-btn purple" id="start-btn">ИГРАТЬ СНОВА</button>`;
  overlay.style.display = 'flex';
  document.getElementById('start-btn').addEventListener('click', startGame);
}

// ═══════════════════════════════════════════════════════════════
//  START / RESET
// ═══════════════════════════════════════════════════════════════
function startGame() {
  overlay.style.display    = 'none';
  upgPanel.style.display   = 'none';
  wpnPicker.style.display  = 'none';
  bossBarWrap.style.display= 'none';
  notifEl.style.display    = 'none';

  Object.assign(player, {
    x:0, y:0, r:16, hp:100, maxHp:100, speed:170,
    angle:0, invincible:0, kills:0, xp:0, xpNext:100, level:1, score:0,
    upgrades:{
      damage:0, fireRate:0, bulletCount:0, bulletSpeed:0,
      pierce:0, range:0, aoe:0, regen:0, maxHp:0, speed:0,
      magnet:0, multishot:0, critChance:0, critMult:0, shield:0,
      vampirism:0, explosive:0,
    },
    shieldCharges:0,
  });

  bullets=[]; enemyBullets=[]; enemies=[]; orbs=[];
  particles=[]; damageNums=[]; bloodDecals=[];

  Object.assign(wave, {
    current:1, spawnInterval:1.5, spawnTimer:0,
    enemiesPerWave:8, spawned:0,
    bossSpawned:false, betweenWaves:false, betweenTimer:0,
  });

  currentWeapon    = 'pistol';
  unlockedWeapons  = ['pistol'];
  ammo             = WEAPONS.pistol.maxAmmo;
  reloading        = false;
  reloadTimer      = 0;
  shootTimer       = 0;
  currentBoss      = null;
  cameraShake      = 0;
  paused           = false;
  gameRunning      = true;

  levelBadge.textContent = 'Lv 1';
  scoreBadge.textContent = 'Kills: 0';
  waveBadge.textContent  = 'Wave 1';
  reloadText.style.display = 'none';

  updateHPBar();
  updateXPBar();
  updateAmmoBar();
  updateJoyCenter();
  startNextWaveSpawn();

  // Spawn a few initial enemies immediately so game feels alive
  for (let i=0; i<4; i++) {
    const pos = getSpawnPos();
    spawnEnemy('basic', pos.x, pos.y);
    wave.spawned++;
  }
}

startBtn.addEventListener('click',    startGame);
startBtn.addEventListener('touchend', e => { e.preventDefault(); startGame(); });

requestAnimationFrame(gameLoop);
