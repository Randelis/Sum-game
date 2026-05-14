'use strict';
/* ════════════════════════════════════════════════════════════
   ZOMBIE SHOOTER  –  game.js
   Sections:
     1) Canvas / DOM
     2) Audio
     3) Math + utils
     4) Data: weapons, enemies, bosses, upgrades
     5) State
     6) Player
     7) Spawning / waves
     8) Combat (bullets, hits, explosions)
     9) FX (particles, shake, damage numbers)
    10) Boss abilities
    11) Input (joystick, keyboard, buttons)
    12) HUD updates
    13) Rendering (world space via camera transform)
    14) Game loop
    15) UI flow: start, levelup, weapon picker, game over
   ════════════════════════════════════════════════════════════ */


/* ════════════ 1) CANVAS / DOM ════════════ */
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const mmc    = document.getElementById('mmc');
const mctx   = mmc.getContext('2d');

const $ = id => document.getElementById(id);
const ui = {
  hpBar: $('hp-bar'), hpText: $('hp-text'),
  xpBar: $('xp-bar'),
  ammoBar: $('ammo-bar'), ammoText: $('ammo-text'),
  weaponName: $('weapon-name'), weaponIcon: $('weapon-icon'),
  weaponCard: $('weapon-card'),
  levelBadge: $('level-badge'),
  waveBadge: $('wave-badge'),
  killsBadge: $('kills-badge'),
  scoreBadge: $('score-badge'),
  bossBarWrap: $('boss-bar-wrap'), bossBar: $('boss-bar'), bossLabel: $('boss-bar-label'),
  notif: $('notif'),
  overlay: $('overlay'),
  startBtn: $('start-btn'),
  upgPanel: $('upgrade-panel'), upgChoices: $('upgrade-choices'), upgLvlTxt: $('upg-lvl-txt'),
  wpnPicker: $('weapon-picker'), wpnList: $('weapon-list'), wpnCloseBtn: $('wpn-close-btn'),
  joyZone: $('joystick-zone'), joyKnob: $('joystick-knob'),
  shootBtn: $('shoot-btn'), weaponBtn: $('weapon-btn'),
  hiBadge: $('hi-badge'), hiOverlay: $('hi-overlay'),
};
// initial hi-score display
if ($('hi-badge')) $('hi-badge').textContent = `Best ${+(localStorage.getItem('zs_hi')||0)}`;
if ($('hi-overlay')) {
  const h = +(localStorage.getItem('zs_hi')||0);
  $('hi-overlay').textContent = h > 0 ? `★ Best: ${h}` : '';
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(window.innerWidth  * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx._dpr = dpr;
  mmc.width = 84; mmc.height = 84;
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));


/* ════════════ 2) AUDIO (Web Audio procedural) ════════════ */
let audioCtx = null;
function audio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}
function resumeAudio() {
  const ac = audio();
  if (ac && ac.state === 'suspended') ac.resume().catch(()=>{});
}

/* ── Haptic feedback ── */
function vibrate(ms) {
  if (navigator.vibrate) { try { navigator.vibrate(ms); } catch(e) {} }
}

/* ── Wake lock (prevent screen dim on mobile) ── */
let wakeLockSentinel = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
  } catch(e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && gameRunning && !wakeLockSentinel) requestWakeLock();
});
function tone(freq, type, dur, gain=0.16, freqEnd=freq) {
  try {
    const ac=audio(), o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(freq, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd,0.01), ac.currentTime+dur);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime+dur);
  } catch(e) {}
}
const sfx = {
  shoot:    () => tone(900,'square',0.06,0.10,200),
  hit:      () => tone(180,'sawtooth',0.10,0.08,60),
  die:      () => tone(120,'sawtooth',0.30,0.13,40),
  explode:  () => tone(80, 'sawtooth',0.5, 0.20,30),
  pickup:   () => tone(880,'sine',    0.10,0.07,1200),
  levelup:  () => tone(440,'sine',    0.5, 0.16,1320),
  reload:   () => tone(300,'square',  0.12,0.06,500),
  hurt:     () => tone(200,'sawtooth',0.18,0.13,80),
  boss:     () => tone(55, 'sawtooth',1.2, 0.30,40),
  phaseTransition: () => tone(45,'sawtooth',0.7,0.35,22),
  unlock:   () => tone(660,'triangle',0.30,0.14,1320),
  shieldHit:() => tone(800,'sine',    0.15,0.10,1600),
  dash:     () => tone(520,'square',  0.18,0.08,1100),
};


/* ════════════ 3) MATH + UTILS ════════════ */
const TAU = Math.PI * 2;
const rand    = (a,b) => a + Math.random()*(b-a);
const randInt = (a,b) => Math.floor(rand(a,b+1));
const clamp   = (v,a,b) => v<a?a:(v>b?b:v);
const dist    = (ax,ay,bx,by) => Math.hypot(ax-bx, ay-by);
const distSq  = (ax,ay,bx,by) => { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
const within  = (ax,ay,bx,by,r) => distSq(ax,ay,bx,by) < r*r;
const pickOne = arr => arr[(Math.random() * arr.length) | 0];

// In-place compaction (no new array allocation per frame).
function keep(arr) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i].alive) arr[w++] = arr[i];
  arr.length = w;
}
function keepAlive(arr) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i].life > 0) arr[w++] = arr[i];
  arr.length = w;
}


/* ════════════ 4) DATA ════════════ */

// ── WEAPONS ──
const WEAPONS = {
  pistol: {
    name:'Pistol', icon:'🔫', color:'#88aaff', unlockLvl:1,
    damage:18, fireRate:0.45, bulletSpd:420, range:420,
    spread:0,    bulletCount:1, pierce:1, aoe:0,
    maxAmmo:12, reload:1.1,
    desc:'Надёжный, точный',
  },
  smg: {
    name:'SMG', icon:'🔫', color:'#44ffaa', unlockLvl:3,
    damage:9, fireRate:0.10, bulletSpd:500, range:340,
    spread:0.10, bulletCount:1, pierce:1, aoe:0,
    maxAmmo:30, reload:1.7,
    desc:'Высокая скорострельность',
  },
  shotgun: {
    name:'Shotgun', icon:'💥', color:'#ffaa44', unlockLvl:5,
    damage:14, fireRate:0.7, bulletSpd:380, range:240,
    spread:0.28, bulletCount:7, pierce:1, aoe:0,
    maxAmmo:8, reload:1.9,
    desc:'Широкий разброс, ближний бой',
  },
  minigun: {
    name:'Minigun', icon:'🔥', color:'#ff6644', unlockLvl:7,
    damage:7, fireRate:0.05, bulletSpd:520, range:320,
    spread:0.14, bulletCount:1, pierce:1, aoe:0,
    maxAmmo:80, reload:3.2,
    desc:'Ураган свинца',
  },
  sniper: {
    name:'Sniper', icon:'🎯', color:'#ff4444', unlockLvl:9,
    damage:95, fireRate:1.1, bulletSpd:780, range:900,
    spread:0,    bulletCount:1, pierce:4, aoe:0,
    maxAmmo:5, reload:2.3,
    desc:'Один выстрел = один труп',
  },
  flame: {
    name:'Flamethrower', icon:'🔥', color:'#ff8822', unlockLvl:11,
    damage:5, fireRate:0.05, bulletSpd:280, range:180,
    spread:0.4,  bulletCount:3, pierce:99, aoe:0,
    maxAmmo:120, reload:2.8,
    desc:'Сжигает всё в конусе',
  },
  plasma: {
    name:'Plasma Rifle', icon:'🟢', color:'#aaffff', unlockLvl:13,
    damage:32, fireRate:0.28, bulletSpd:460, range:480,
    spread:0,    bulletCount:1, pierce:3, aoe:1,
    maxAmmo:20, reload:1.9,
    desc:'Сквозной, мини-взрыв',
  },
  launcher: {
    name:'Grenade Launcher', icon:'💣', color:'#ff8800', unlockLvl:15,
    damage:60, fireRate:1.3, bulletSpd:300, range:480,
    spread:0,    bulletCount:1, pierce:1, aoe:3,
    maxAmmo:4, reload:2.7,
    desc:'Взрыв при попадании',
  },
  dual: {
    name:'Dual Uzi', icon:'🔫', color:'#ffaaff', unlockLvl:17,
    damage:11, fireRate:0.085, bulletSpd:460, range:340,
    spread:0.16, bulletCount:2, pierce:1, aoe:0,
    maxAmmo:40, reload:2.0,
    desc:'Двойной ствол, гигантский ДПС',
  },
  lightning: {
    name:'Lightning Gun', icon:'⚡', color:'#ffff44', unlockLvl:19,
    damage:42, fireRate:0.32, bulletSpd:900, range:520,
    spread:0,    bulletCount:1, pierce:5, aoe:0,
    maxAmmo:12, reload:2.0,
    desc:'Бьёт сквозь врагов, цепная молния',
    chain:true,
  },
  laser: {
    name:'Laser Beam', icon:'🟥', color:'#ff44ff', unlockLvl:21,
    damage:55, fireRate:0.18, bulletSpd:1200, range:700,
    spread:0,    bulletCount:1, pierce:8, aoe:0,
    maxAmmo:25, reload:2.3,
    desc:'Светоскоростной лазер',
  },
  railgun: {
    name:'Railgun', icon:'☄', color:'#88ffff', unlockLvl:23,
    damage:180, fireRate:1.8, bulletSpd:1600, range:1400,
    spread:0,    bulletCount:1, pierce:99, aoe:0,
    maxAmmo:3, reload:3.0,
    desc:'Пробивает всю карту',
  },
};
const WEAPON_ORDER = ['pistol','smg','shotgun','minigun','sniper','flame','plasma','launcher','dual','lightning','laser','railgun'];

// ── ENEMIES (regular) ──
const ENEMY_DEFS = {
  basic:    { name:'Zombie',   color:'#44bb44', r:14, hp:w=>16+w*8,    spd:w=>56+w*5,  dmg:8,  xp:10 },
  fast:     { name:'Runner',   color:'#aaff44', r:11, hp:w=>11+w*5,    spd:w=>120+w*8, dmg:6,  xp:14 },
  tank:     { name:'Brute',    color:'#226622', r:26, hp:w=>85+w*32,   spd:w=>42+w*3,  dmg:18, xp:28 },
  spitter:  { name:'Spitter',  color:'#88ff22', r:12, hp:w=>22+w*9,    spd:w=>50+w*4,  dmg:10, xp:18,
              ranged:true, shootInterval:2.0 },
  exploder: { name:'Kamikaze', color:'#ff8800', r:16, hp:w=>26+w*10,   spd:w=>76+w*6,  dmg:38, xp:22, explodes:true },
  armored:  { name:'Armored',  color:'#556677', r:21, hp:w=>110+w*48,  spd:w=>46+w*3,  dmg:20, xp:35, armor:0.45 },
  shaman:   { name:'Shaman',   color:'#cc44ff', r:13, hp:w=>38+w*14,   spd:w=>58+w*5,  dmg:12, xp:30,
              ranged:true, shootInterval:1.7, healer:true },

  crawler:  { name:'Crawler',  color:'#669944', r:8,  hp:w=>6+w*3,     spd:w=>140+w*9, dmg:4,  xp:6, swarm:true },
  bomber:   { name:'Bomber',   color:'#cc4422', r:15, hp:w=>30+w*11,   spd:w=>55+w*4,  dmg:14, xp:24,
              ranged:true, shootInterval:2.4, bomber:true },
  screamer: { name:'Screamer', color:'#ff44aa', r:13, hp:w=>34+w*12,   spd:w=>50+w*4,  dmg:8,  xp:25, screamer:true },
  berserker:{ name:'Berserker',color:'#cc2244', r:17, hp:w=>55+w*20,   spd:w=>70+w*5,  dmg:22, xp:32, berserker:true },
  ghost:    { name:'Ghost',    color:'#aaccff', r:13, hp:w=>28+w*10,   spd:w=>85+w*6,  dmg:10, xp:28, dodge:0.45 },
  bouncer:  { name:'Bouncer',  color:'#ffcc44', r:14, hp:w=>32+w*12,   spd:w=>95+w*6,  dmg:14, xp:24, bouncer:true },
};

// ── BOSSES ──
const BOSS_DEFS = [
  { name:'ZOMBIE KING',   color:'#770000', outline:'#ff4444', r:46,
    hp:w=>620+w*220, spd:w=>52+w*3, dmg:28, xp:260,
    abilities:['slam','summon','roar'] },
  { name:'TOXIC MUTANT',  color:'#005500', outline:'#00ff44', r:42,
    hp:w=>520+w*180, spd:w=>65+w*4, dmg:18, xp:240,
    abilities:['poisonCloud','spit','spawnFast'],
    ranged:true, shootInterval:1.4 },
  { name:'IRON GOLEM',    color:'#445566', outline:'#aabbdd', r:58,
    hp:w=>1050+w*350, spd:w=>32+w*2, dmg:42, xp:320,
    abilities:['charge','shockwave','stomp'] },
  { name:'NECROMANCER',   color:'#220044', outline:'#cc44ff', r:36,
    hp:w=>470+w*160, spd:w=>70+w*4, dmg:14, xp:300,
    abilities:['summon','teleport','deathRay'],
    ranged:true, shootInterval:1.0 },
  { name:'HELLFIRE DEMON',color:'#aa0000', outline:'#ffaa00', r:50,
    hp:w=>900+w*280, spd:w=>60+w*4, dmg:32, xp:340,
    abilities:['fireRing','firePillars','dash'],
    ranged:true, shootInterval:1.6 },
  { name:'SPIDER QUEEN',  color:'#220022', outline:'#ff44ff', r:48,
    hp:w=>780+w*240, spd:w=>72+w*4, dmg:24, xp:320,
    abilities:['spawnSpiders','webBurst','poisonCloud'],
    ranged:true, shootInterval:1.2 },
];

const BOSS_PHASES = [
  { hpPct:0.60, speedMult:1.35, cdMin:1.6, cdMax:3.0, dmgMult:1.4,
    msg:'⚡ ЯРОСТЬ!',          color:'#ff8800' },
  { hpPct:0.25, speedMult:1.80, cdMin:0.8, cdMax:1.6, dmgMult:2.0,
    msg:'💀 ПОСЛЕДНЯЯ ФАЗА!', color:'#ff2244' },
];

// ── UPGRADES ──
const UPGRADES = [
  { id:'damage',      icon:'💥', name:'Power Shot',   desc:'+20% урон пуль',         max:10 },
  { id:'fireRate',    icon:'⚡', name:'Rapid Fire',    desc:'+18% скорострельность',  max:10 },
  { id:'bulletCount', icon:'🔫', name:'Extra Bullet',  desc:'+1 пуля за выстрел',     max:4  },
  { id:'bulletSpeed', icon:'💨', name:'Velocity',      desc:'+18% скорость пуль',     max:8  },
  { id:'pierce',      icon:'🎯', name:'Piercing',      desc:'Пробивает +1 врага',     max:5  },
  { id:'range',       icon:'📏', name:'Range',         desc:'+20% дальность',         max:8  },
  { id:'aoe',         icon:'💣', name:'Explosive',     desc:'Пули взрываются (+радиус)', max:5 },
  { id:'regen',       icon:'💚', name:'Regen',         desc:'+0.5 HP/сек',            max:6  },
  { id:'maxHp',       icon:'❤', name:'Vitality',      desc:'+30 макс. HP',           max:8  },
  { id:'speed',       icon:'👟', name:'Agility',       desc:'+12% скорость бега',     max:8  },
  { id:'magnet',      icon:'🧲', name:'XP Magnet',     desc:'+35% радиус сбора',      max:5  },
  { id:'multishot',   icon:'✳', name:'Multishot',     desc:'Стрельба в стороны',     max:3  },
  { id:'critChance',  icon:'⭐', name:'Crit Chance',   desc:'+10% шанс крита',        max:10 },
  { id:'critMult',    icon:'🌟', name:'Crit Power',    desc:'+0.5x крит-множитель',   max:5  },
  { id:'shield',      icon:'🛡', name:'Energy Shield', desc:'+1 заряд щита',          max:3  },
  { id:'vampirism',   icon:'🩸', name:'Vampirism',     desc:'+1% вытягивание HP',     max:5  },
  { id:'napalm',      icon:'🔥', name:'Napalm',        desc:'Поджигает землю в зоне взрыва', max:4 },
  { id:'ammoMax',     icon:'📦', name:'Big Mag',       desc:'+30% макс. патронов',    max:5  },
  { id:'reloadSpd',   icon:'🔄', name:'Fast Reload',   desc:'-15% время перезарядки', max:5  },
  { id:'deathTouch',  icon:'💀', name:'Death Touch',   desc:'+5% шанс мгновенно убить', max:3 },
  { id:'dashCd',      icon:'💨', name:'Quick Dash',    desc:'-25% откат рывка',       max:4  },
];


/* ════════════ 5) STATE ════════════ */
let gameRunning = false;
let paused      = false;
let lastTime    = 0;
let cameraShake = 0;
const cam = { x:0, y:0 };
const zoom = { value: 0.78 };   // zoom-out: ниже = больше видно

let bullets      = [];
let enemyBullets = [];
let enemies      = [];
let orbs         = [];
let pickups      = [];   // health, ammo crates
let particles    = [];
let damageNums   = [];
let bloodDecals  = [];
let lightnings   = [];   // for lightning gun visuals
let firePatches  = [];   // napalm ground fire

// ── Kill streak ──
let killStreak = 0;
let streakMult = 1;

// ── Active event ──
let activeEvent   = null;  // { id, name, color, timer, dmgMult, spdMult, xpMult }
let eventCooldown = 0;     // waves before next event can trigger
let eventBgTint   = null;

// ── Wave variant ──
let waveVariant = null;    // null | 'speed' | 'swarm' | 'elite' | 'sniper'

let shootTimer  = 0;
let currentBoss = null;

let unlockedWeapons = ['pistol'];
let currentWeapon   = 'pistol';
let ammo            = WEAPONS.pistol.maxAmmo;
let reloading       = false;
let reloadTimer     = 0;


/* ════════════ 6) PLAYER ════════════ */
const player = {
  x:0, y:0, r:15,
  hp:100, maxHp:100,
  baseSpeed:175, angle:0,
  invincible:0,
  contactCd:0,  // cooldown for continuous melee contact damage
  kills:0, score:0,
  xp:0, xpNext:100, level:1,
  slow:0,       // slow effect timer (seconds)
  slowFactor:1, // current slow multiplier
  shieldCharges:0,
  dashTime:0,   // dash active timer
  dashCd:0,     // dash cooldown
  dashVx:0, dashVy:0,
  upgrades:newUpgrades(),
};
function newUpgrades() {
  const u = {};
  for (const upg of UPGRADES) u[upg.id] = 0;
  return u;
}

const DASH_BASE_CD = 4.0;      // seconds
const DASH_DURATION = 0.22;    // seconds
const DASH_SPEED_MULT = 4.5;   // x player speed during dash
let hiScore = +(localStorage.getItem('zs_hi') || 0);

const W = () => WEAPONS[currentWeapon];
const STATS = {
  damage:      () => W().damage     * Math.pow(1.20, player.upgrades.damage),
  fireRate:    () => W().fireRate    / Math.pow(1.18, player.upgrades.fireRate),
  bulletSpd:   () => W().bulletSpd   * Math.pow(1.18, player.upgrades.bulletSpeed),
  range:       () => W().range       * Math.pow(1.20, player.upgrades.range),
  playerSpd:   () => player.baseSpeed* Math.pow(1.12, player.upgrades.speed) * player.slowFactor,
  magnetR:     () => 55              * Math.pow(1.35, player.upgrades.magnet),
  critChance:  () => player.upgrades.critChance * 0.10,
  critMult:    () => 2.0 + player.upgrades.critMult * 0.5,
  bulletCount: () => W().bulletCount + player.upgrades.bulletCount,
  pierce:      () => W().pierce      + player.upgrades.pierce - 1,
  aoe:         () => W().aoe         + player.upgrades.aoe,
  spread:      () => W().spread,
  maxAmmo:     () => Math.floor(W().maxAmmo * (1 + player.upgrades.ammoMax * 0.30)),
  reload:      () => W().reload * Math.pow(0.85, player.upgrades.reloadSpd),
  deathTouchCh:() => player.upgrades.deathTouch * 0.05,
  dashCd:      () => DASH_BASE_CD * Math.pow(0.75, player.upgrades.dashCd),
  napalmLvl:   () => player.upgrades.napalm,
};


/* ════════════ 7) SPAWNING / WAVES ════════════ */
const wave = {
  current:1,
  spawnInterval:1.4, spawnTimer:0,
  enemiesPerWave:8,  spawned:0,
  bossSpawned:false,
  betweenWaves:false, betweenTimer:0,
};

function isBossWave() { return wave.current % 5 === 0; }

// View extents in world space (used for spawning just outside view)
function viewExtents() {
  const w = canvas.width  / ctx._dpr / zoom.value;
  const h = canvas.height / ctx._dpr / zoom.value;
  return { w, h, halfW:w/2, halfH:h/2 };
}

function getSpawnPos() {
  const { halfW, halfH } = viewExtents();
  const margin = 80;
  const side = randInt(0, 3);
  switch (side) {
    case 0: return { x: player.x + rand(-halfW, halfW), y: player.y - halfH - margin };
    case 1: return { x: player.x + rand(-halfW, halfW), y: player.y + halfH + margin };
    case 2: return { x: player.x - halfW - margin,     y: player.y + rand(-halfH, halfH) };
    default:return { x: player.x + halfW + margin,     y: player.y + rand(-halfH, halfH) };
  }
}

function makeEnemy(def, x, y, isBoss=false) {
  const w = wave.current;
  const e = {
    x, y, r: def.r,
    hp: def.hp(w), maxHp: def.hp(w),
    speed: def.spd(w), baseSpeed: def.spd(w),
    color: def.color, outline: def.outline || null,
    damage: def.dmg, xp: def.xp,
    name: def.name, isBoss,
    alive:true,
    armor: def.armor || 0,
    ranged: def.ranged || false,
    healer: def.healer || false,
    explodes: def.explodes || false,
    swarm: def.swarm || false,
    bomber: def.bomber || false,
    screamer: def.screamer || false,
    berserker: def.berserker || false,
    bouncer: def.bouncer || false,
    dodge: def.dodge || 0,
    shootInterval: def.shootInterval || 99,
    shootTimer: Math.random() * (def.shootInterval || 99),
    abilities: def.abilities || [],
    abilityTimer: rand(2,5),
    charging:false, chargeVx:0, chargeVy:0, chargeDur:0,
    bounceT: Math.random()*TAU,
    flash:0, angle:0,
    raging:false,
    // soulslike boss phase fields (only used when isBoss===true)
    phase: 1, phaseTransition: 0,
    windupTimer: 0, windupAbility: null,
    abilityDmgMult: 1,
  };
  return e;
}

function spawnEnemyType(key, x, y) {
  const e = makeEnemy(ENEMY_DEFS[key], x, y, false);
  if (activeEvent?.id === 'bloodmoon') { e.hp *= 1.4; e.maxHp *= 1.4; }
  enemies.push(e);
}

function spawnBoss(bossIdx) {
  const def = BOSS_DEFS[bossIdx % BOSS_DEFS.length];
  const pos = getSpawnPos();
  const e   = makeEnemy(def, pos.x, pos.y, true);
  e.hp    = Math.round(e.hp    * 1.8);
  e.maxHp = Math.round(e.maxHp * 1.8);
  e.armor = 0.20;
  enemies.push(e);
  currentBoss = e;
  ui.bossLabel.textContent = def.name;
  ui.bossBarWrap.style.display = 'block';
  updateBossBar(e);
  sfx.boss();
}

function pickEnemyType() {
  if (waveVariant === 'speed') {
    const r = Math.random();
    return r < 0.6 ? 'fast' : r < 0.8 ? 'bouncer' : 'ghost';
  }
  if (waveVariant === 'swarm')  return Math.random() < 0.85 ? 'crawler' : 'fast';
  if (waveVariant === 'elite') {
    if (wave.current >= 10 && Math.random() < 0.3) return 'berserker';
    return Math.random() < 0.55 ? 'armored' : 'tank';
  }
  if (waveVariant === 'sniper') {
    const r = Math.random();
    return r < 0.4 ? 'spitter' : r < 0.7 ? 'bomber' : 'tank';
  }
  const w = wave.current, r = Math.random();
  if (w >= 10 && r < 0.05) return 'berserker';
  if (w >= 8  && r < 0.10) return 'ghost';
  if (w >= 8  && r < 0.14) return 'bouncer';
  if (w >= 7  && r < 0.10) return 'screamer';
  if (w >= 7  && r < 0.16) return 'shaman';
  if (w >= 6  && r < 0.18) return 'bomber';
  if (w >= 5  && r < 0.20) return 'armored';
  if (w >= 4  && r < 0.22) return 'exploder';
  if (w >= 3  && r < 0.18) return 'crawler';
  if (w >= 3  && r < 0.30) return 'spitter';
  if (w >= 2  && r < 0.38) return 'fast';
  if (w >= 3  && r < 0.48) return 'tank';
  return 'basic';
}

function startNextWaveSpawn() {
  wave.spawned = 0;
  wave.bossSpawned = false;
  wave.spawnTimer = 0;
  ui.waveBadge.textContent = `Wave ${wave.current}`;

  if (waveVariant) {
    const variantDefs = {
      speed:  { name:'⚡ СКОРОСТНАЯ ВОЛНА', color:'#00ffcc', enemyMult:1.5,  intervalMult:0.55 },
      swarm:  { name:'🐛 РОЙ',             color:'#ffcc00', enemyMult:2.2,  intervalMult:0.40 },
      elite:  { name:'💀 ЭЛИТА',           color:'#ff4400', enemyMult:0.55, intervalMult:1.0  },
      sniper: { name:'🎯 СНАЙПЕРЫ',        color:'#ff00ff', enemyMult:1.0,  intervalMult:0.85 },
    };
    const vd = variantDefs[waveVariant];
    showNotif(vd.name, vd.color);
    wave.enemiesPerWave = Math.max(4, Math.floor(wave.enemiesPerWave * vd.enemyMult));
    wave.spawnInterval  = Math.max(0.15, wave.spawnInterval * vd.intervalMult);
  }
}

function finishWave() {
  if (wave.betweenWaves) return;
  wave.betweenWaves = true;
  wave.betweenTimer = 2.0;
  wave.current++;
  wave.enemiesPerWave = Math.floor(8 + wave.current * 3.2);
  wave.spawnInterval  = Math.max(0.30, 1.4 - wave.current * 0.05);
  showNotif(`Wave ${wave.current - 1} cleared!`, '#aaffaa');

  if (eventCooldown > 0) eventCooldown--;
  tryTriggerEvent();

  waveVariant = null;
  if (!isBossWave() && Math.random() < 0.38) {
    const opts = ['speed', 'swarm', 'elite'];
    if (wave.current >= 5) opts.push('sniper');
    waveVariant = opts[Math.floor(Math.random() * opts.length)];
  }
}


/* ════════════ 8) COMBAT ════════════ */

function startReload() {
  if (reloading) return;
  reloading = true;
  reloadTimer = STATS.reload();
  sfx.reload();
}

function fireBullets(angle) {
  if (reloading) return;
  if (ammo <= 0) { startReload(); return; }
  ammo--;
  sfx.shoot();
  updateAmmoBar();

  const count  = STATS.bulletCount();
  const spd    = STATS.bulletSpd();
  const dmg    = STATS.damage();
  const range  = STATS.range();
  const pierce = STATS.pierce();
  const aoe    = STATS.aoe();
  const spread = STATS.spread();
  const isCrit = Math.random() < STATS.critChance();
  const evDmgMult = activeEvent?.dmgMult || 1;
  const finalDmg  = (isCrit ? dmg * STATS.critMult() : dmg) * evDmgMult;
  const color  = W().color;
  const chain  = W().chain || false;

  const angles = [angle];
  if (player.upgrades.multishot >= 1) angles.push(angle + Math.PI);
  if (player.upgrades.multishot >= 2) { angles.push(angle + Math.PI*2/3); angles.push(angle - Math.PI*2/3); }
  if (player.upgrades.multishot >= 3) { angles.push(angle + Math.PI/2);   angles.push(angle - Math.PI/2); }

  const napalm = STATS.napalmLvl();
  for (const baseA of angles) {
    for (let i=0; i<count; i++) {
      const off = count > 1 ? (i - (count-1)/2) * spread : 0;
      const jitter = spread ? rand(-spread*0.3, spread*0.3) : 0;
      const a = baseA + off + jitter;
      bullets.push({
        x: player.x, y: player.y,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        dmg: finalDmg, crit: isCrit,
        range, traveled: 0,
        pierce, pierced: 0,
        aoe, napalm, chain,
        r: aoe > 0 ? 8 : 5,
        alive: true, color,
        deathTouchCh: STATS.deathTouchCh(),
      });
    }
  }
  if (ammo === 0) startReload();
}

function fireEnemyProjectile(e) {
  const base = Math.atan2(player.y - e.y, player.x - e.x);
  const count  = e.isBoss ? 3 : 1;
  const spread = e.isBoss ? 0.15 : 0;
  const speed  = e.isBoss ? 200 : 160;
  const mult   = e.isBoss ? 0.7 : 0.55;
  const color  = e.isBoss ? '#ff4400' : '#aaff00';
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * spread;
    pushEnemyBullet(e, a, speed, mult, 7, 3.5, color);
  }
}

function fireBomb(e) {
  // arcing bomb that lands and explodes
  const dx = player.x - e.x, dy = player.y - e.y;
  const d  = Math.hypot(dx, dy) || 1;
  const flightTime = 1.5;
  enemyBullets.push({
    bomb: true,
    x:e.x, y:e.y,
    tx:player.x, ty:player.y,
    sx:e.x, sy:e.y,
    t:0, totalT:flightTime,
    dmg: e.damage * 1.4,
    radius: 80,
    r:8, alive:true, life:flightTime,
    color:'#ff4400',
  });
}

function explode(x, y, aoeLevel, baseDmg, dmgMult=1, napalmLvl=0) {
  const radius = 40 + aoeLevel * 22;
  const dmg    = baseDmg * (0.6 + aoeLevel * 0.18) * dmgMult;
  spawnParticles(x, y, '#ff8800', 18, 220, 0.7);
  spawnParticles(x, y, '#ffcc00', 10, 140, 0.4);
  particles.push({ type:'ring', x, y, r:0, maxR:radius, life:0.35, maxLife:0.35, color:'#ff8800' });
  addShake(aoeLevel * 2);
  sfx.explode();
  vibrate(30);
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - x, dy = e.y - y;
    const d2 = dx*dx + dy*dy;
    const total = radius + e.r;
    if (d2 < total * total) {
      const d = Math.sqrt(d2);
      hitEnemy(e, dmg * (1 - d / (total + 1)));
    }
  }
  if (napalmLvl > 0) spawnFirePatch(x, y, radius * 0.95, napalmLvl, baseDmg);
}

function spawnFirePatch(x, y, radius, lvl, baseDmg) {
  firePatches.push({
    x, y, r: radius,
    dps: baseDmg * (0.25 + lvl * 0.15),
    life: 3 + lvl * 0.6, maxLife: 3 + lvl * 0.6,
    alive: true,
  });
}

function bombExplode(b) {
  spawnParticles(b.tx, b.ty, '#ff4400', 22, 240, 0.7);
  particles.push({ type:'ring', x:b.tx, y:b.ty, r:0, maxR:b.radius, life:0.4, maxLife:0.4, color:'#ff4400' });
  addShake(5);
  sfx.explode();
  if (within(player.x, player.y, b.tx, b.ty, b.radius)) damagePlayer(b.dmg);
}

function hitEnemy(e, dmg) {
  if (Math.random() < e.dodge) {
    spawnDamageNum(e.x, e.y - e.r, 'MISS', false);
    return;
  }
  if (e.isBoss && e.phaseTransition > 0) {
    spawnDamageNum(e.x, e.y - e.r - 4, '✦', false);
    return;
  }
  const actual = dmg * (1 - e.armor);
  e.hp -= actual;
  e.flash = 0.12;
  spawnDamageNum(e.x, e.y - e.r - 4, Math.round(actual), false);
  sfx.hit();

  // berserker rage trigger
  if (e.berserker && !e.raging && e.hp < e.maxHp * 0.4) {
    e.raging = true;
    e.speed = e.baseSpeed * 1.8;
    spawnParticles(e.x, e.y, '#ff0000', 14, 140, 0.6);
  }

  if (e.hp <= 0) killEnemy(e);
  else if (e.isBoss) updateBossBar(e);
}

function chainLightning(srcEnemy, originBullet, dmg, hopsLeft) {
  if (hopsLeft <= 0) return;
  let closest = null, minD = 220;
  for (const e of enemies) {
    if (!e.alive || e === srcEnemy) continue;
    const d = dist(e.x, e.y, srcEnemy.x, srcEnemy.y);
    if (d < minD) { minD = d; closest = e; }
  }
  if (!closest) return;
  lightnings.push({ x1:srcEnemy.x, y1:srcEnemy.y, x2:closest.x, y2:closest.y, life:0.20, maxLife:0.20 });
  hitEnemy(closest, dmg);
  if (closest.alive) chainLightning(closest, originBullet, dmg * 0.75, hopsLeft - 1);
}

function killEnemy(e) {
  e.alive = false;
  player.kills++;
  const baseScore = e.isBoss ? 500 : Math.max(5, Math.round(e.xp * 0.6));
  player.score += Math.round(baseScore * streakMult);
  ui.killsBadge.textContent = `Kills ${player.kills}`;
  ui.scoreBadge.textContent = `Score ${player.score}`;
  if (!e.isBoss) { killStreak++; checkStreak(); }
  if (e.isBoss) vibrate([0, 80, 60, 80, 60, 120]);

  sfx.die();
  spawnParticles(e.x, e.y, e.color, e.isBoss ? 36 : 12, 160, e.isBoss ? 1.3 : 0.55);
  bloodDecals.push({ x:e.x, y:e.y, r:e.r*1.6 + rand(0,10), life:25 });

  if (e.explodes) explode(e.x, e.y, 2, e.damage * 1.2);
  dropOrbs(e);

  // rare health pickup drop
  if (!e.isBoss && Math.random() < 0.04) {
    pickups.push({ type:'hp', x:e.x, y:e.y, r:8, alive:true, color:'#ff4466', life:25 });
  }

  if (e.isBoss) {
    currentBoss = null;
    ui.bossBarWrap.style.display = 'none';
    showNotif(`☠ ${e.name} DEFEATED!`, '#ffcc00');
    addShake(12);
    finishWave();
  } else {
    if (!isBossWave() && wave.spawned >= wave.enemiesPerWave) {
      let alive = 0;
      for (const x of enemies) if (x.alive) alive++;
      if (alive === 0) finishWave();
    }
  }
}

function dropOrbs(e) {
  const count = e.isBoss ? 26 : Math.ceil(e.xp / 12);
  const xpPer = Math.ceil(e.xp / count);
  for (let i = 0; i < count; i++) {
    orbs.push({
      x: e.x + rand(-22, 22), y: e.y + rand(-22, 22),
      r: e.isBoss ? 9 : 5, xp: xpPer, alive: true,
      color: e.isBoss ? '#ff44ff' : '#aa44ff',
    });
  }
}

function damagePlayer(dmg) {
  if (player.invincible > 0 || player.dashTime > 0) return;
  if (player.shieldCharges > 0) {
    player.shieldCharges--;
    spawnParticles(player.x, player.y, '#44aaff', 14, 120, 0.4);
    player.invincible = 0.3;
    sfx.shieldHit();
    vibrate(40);
    return;
  }
  player.hp -= dmg;
  player.invincible = 0.5;
  addShake(5);
  sfx.hurt();
  spawnParticles(player.x, player.y, '#ff2244', 8, 80, 0.3);
  vibrate([0, 25, 30, 25]);
  if (player.hp <= 0) { player.hp = 0; killStreak = 0; streakMult = 1; gameOver(); return; }
  if (killStreak >= 5) showNotif(`💔 СЕРИЯ ${killStreak} ПРЕРВАНА`, '#ff4444');
  killStreak = 0; streakMult = 1;
}


// Contact damage: bypasses invincibility so continuous overlap deals real DPS.
// Uses a separate 0.08s cooldown to stay frame-rate independent.
function damagePlayerContact(dmg) {
  if (player.dashTime > 0) return;
  if (player.shieldCharges > 0) return; // shield blocks contact too
  if (player.contactCd > 0) return;
  player.contactCd = 0.08;
  player.hp -= dmg;
  addShake(2);
  sfx.hurt();
  spawnParticles(player.x, player.y, '#ff2244', 4, 60, 0.2);
  vibrate(15);
  if (player.hp <= 0) { player.hp = 0; gameOver(); }
}

/* ════════════ 9) FX ════════════ */
function spawnParticles(x, y, color, count=8, spd=120, life=0.5) {
  for (let i=0; i<count; i++) {
    const a = Math.random()*TAU;
    const s = rand(spd*0.3, spd);
    particles.push({ type:'dot', x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life, maxLife:life, color, r:rand(2,5) });
  }
}
function spawnRing(x, y, maxR, life, color) {
  particles.push({ type:'ring', x, y, r:0, maxR, life, maxLife:life, color });
}
function spawnDamageNum(x, y, val, crit) {
  damageNums.push({ x, y, vy:-55, val, life:0.9, maxLife:0.9, crit });
}
function addShake(intensity) { cameraShake = Math.max(cameraShake, intensity); }
function showNotif(text, color='#ffffff') {
  ui.notif.textContent = text;
  ui.notif.style.color = color;
  ui.notif.style.display = 'block';
  clearTimeout(ui.notif._t);
  ui.notif._t = setTimeout(() => { ui.notif.style.display = 'none'; }, 2200);
}

function checkStreak() {
  const thresholds = [5,   10,             20,          35];
  const mults      = [1.2, 1.5,            2.0,         3.0];
  const names      = ['УБИЙЦА', 'НЕОСТАНОВИМЫЙ', 'БОГОПОДОБНЫЙ', 'ЛЕГЕНДАРНЫЙ'];
  const colors     = ['#ffff00', '#ffaa00', '#ff4400', '#ff00ff'];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (killStreak >= thresholds[i]) {
      if (streakMult < mults[i]) {
        streakMult = mults[i];
        showNotif(`🔥 ${names[i]}! ×${mults[i]} урон`, colors[i]);
        addShake(6);
        spawnParticles(player.x, player.y, colors[i], 18, 140, 0.7);
      }
      break;
    }
  }
}

const EVENT_POOL = [
  { id:'bloodmoon',  name:'🌑 КРОВАВАЯ ЛУНА',  color:'#ff2244', duration:30, xpMult:2,   bgTint:'rgba(100,0,0,0.22)'  },
  { id:'frenzy',     name:'⚡ ЯРОСТЬ ОРДЫ',     color:'#ffaa00', duration:12,             bgTint:'rgba(80,30,0,0.22)'  },
  { id:'berserk',    name:'💢 РЕЖИМ БЕРСЕРКА',  color:'#ff6600', duration:12, dmgMult:2,  bgTint:'rgba(50,10,0,0.22)'  },
  { id:'adrenaline', name:'💨 АДРЕНАЛИН',       color:'#00ccff', duration:12, spdMult:1.8,bgTint:'rgba(0,20,50,0.22)'  },
  { id:'craterain',  name:'📦 ГРУЗ С НЕБА',     color:'#44ff88', duration:0                                            },
  { id:'invasion',   name:'💀 НАШЕСТВИЕ',       color:'#ff0066', duration:0                                            },
];

function tryTriggerEvent() {
  if (isBossWave() || eventCooldown > 0) return;
  if (Math.random() > 0.55) return;
  eventCooldown = 2;
  const ev = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
  setTimeout(() => {
    if (!gameRunning) return;
    showNotif(`⚡ ИВЕНТ: ${ev.name}!`, ev.color);
    addShake(8);
    spawnParticles(player.x, player.y, ev.color, 24, 180, 1.0);
    if (ev.id === 'craterain') {
      for (let i = 0; i < 6; i++) {
        pickups.push({ type: Math.random() < 0.55 ? 'hp' : 'ammo',
          x: player.x + rand(-280, 280), y: player.y + rand(-280, 280),
          r: 10, alive: true, color: '#44ff88', life: 30 });
      }
    } else if (ev.id === 'invasion') {
      const count = Math.min(20, 6 + Math.floor(wave.current * 1.2));
      for (let i = 0; i < count; i++) {
        const pos = getSpawnPos();
        enemies.push(makeEnemy(ENEMY_DEFS[pickEnemyType()], pos.x, pos.y));
      }
    } else if (ev.duration > 0) {
      activeEvent = { ...ev, timer: ev.duration };
      eventBgTint = ev.bgTint || null;
    }
  }, 1600);
}


/* ════════════ 10) BOSS ABILITIES ════════════ */
function triggerBossPhaseTransition(e, phaseIdx) {
  const ph = BOSS_PHASES[phaseIdx];
  e.phase           = phaseIdx + 2;  // 1→2→3
  e.phaseTransition = 1.5;
  e.speed           = e.baseSpeed * ph.speedMult;
  e.abilityDmgMult  = ph.dmgMult;
  e.charging        = false;
  e.windupTimer     = 0;
  e.windupAbility   = null;

  addShake(20);
  showNotif(ph.msg, ph.color);
  sfx.phaseTransition();
  spawnParticles(e.x, e.y, ph.color, 60, 300, 1.8);
  spawnRing(e.x, e.y, 340, 0.9,  ph.color);
  spawnRing(e.x, e.y, 180, 0.55, '#ffffff');

  const barColors = [
    'linear-gradient(90deg,#884400,#ff8800,#ffcc00)',
    'linear-gradient(90deg,#550000,#ff0000,#ffff00)',
  ];
  ui.bossBar.style.background = barColors[phaseIdx];
  ui.bossLabel.textContent = e.name + ` [Phase ${e.phase}]`;
}

function pushEnemyBullet(e, a, spd, mult, r, life, color, extra) {
  const b = {
    x: e.x, y: e.y,
    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
    dmg: e.damage * (e.abilityDmgMult || 1) * mult,
    r, alive: true, life, color,
  };
  if (extra) Object.assign(b, extra);
  enemyBullets.push(b);
}

function spawnEnemiesInRing(type, cx, cy, count, radius) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    spawnEnemyType(type, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  }
}
function spawnEnemiesScattered(type, cx, cy, count, spread) {
  for (let i = 0; i < count; i++) {
    spawnEnemyType(type, cx + rand(-spread, spread), cy + rand(-spread, spread));
  }
}

// Boss ability building blocks
function abilityPointDmg(e, radius, mult, shake, pColor, pCount, pSpd, pLife) {
  if (shake)  addShake(shake);
  if (pColor) spawnParticles(e.x, e.y, pColor, pCount, pSpd, pLife);
  if (within(player.x, player.y, e.x, e.y, radius)) {
    damagePlayer(e.damage * (e.abilityDmgMult || 1) * mult);
  }
}
function abilityProjectiles(e, opts) {
  if (opts.shake) addShake(opts.shake);
  const aimP = opts.aim === 'player';
  const base = aimP ? Math.atan2(player.y - e.y, player.x - e.x) : 0;
  for (let i = 0; i < opts.count; i++) {
    const a = aimP
      ? base + rand(-opts.spread / 2, opts.spread / 2)
      : base + (i / opts.count) * TAU;
    pushEnemyBullet(e, a, opts.spd, opts.mult, opts.r, opts.life, opts.color, opts.extra);
  }
}
function abilityCharge(e, dur, speedMult) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d  = Math.hypot(dx, dy) || 1;
  e.charging  = true;
  e.chargeVx  = dx / d * e.speed * speedMult;
  e.chargeVy  = dy / d * e.speed * speedMult;
  e.chargeDur = dur;
}

const BOSS_ABILITY_HANDLERS = {
  slam:        e => abilityPointDmg(e, 130, 0.7, 8, '#ff2244', 28, 280, 0.9),
  poisonCloud: e => abilityPointDmg(e, 110, 0.4, 0, '#00ff44', 24, 130, 1.8),
  stomp:       e => abilityPointDmg(e, 150, 0.9, 15,'#555577', 35, 300, 1.0),

  spit:      e => abilityProjectiles(e, {count:6,  spd:210, mult:0.4,  r:8, life:2.8, color:'#00ff88', aim:'player', spread:1.0}),
  shockwave: e => abilityProjectiles(e, {count:16, spd:200, mult:0.45, r:9, life:2.2, color:'#aaaaff', aim:'circle', shake:12}),
  deathRay:  e => { abilityProjectiles(e, {count:22, spd:320, mult:0.35, r:6, life:2.0, color:'#ff00ff', aim:'player', spread:0.16}); addShake(6); },
  fireRing:  e => abilityProjectiles(e, {count:24, spd:150, mult:0.4,  r:9, life:3.0, color:'#ff4400', aim:'circle', shake:8}),
  webBurst:  e => abilityProjectiles(e, {count:8,  spd:180, mult:0.3,  r:8, life:2.5, color:'#ffffff', aim:'circle', extra:{web:true}}),

  charge: e => abilityCharge(e, 0.9, 1.0),
  dash:   e => abilityCharge(e, 0.7, 1.4),

  summon:       e => { spawnEnemiesInRing('basic',   e.x, e.y, 4, 70); showNotif('👻 Summoning!', '#ff4444'); },
  spawnFast:    e => spawnEnemiesScattered('fast', e.x, e.y, 3, 80),
  spawnSpiders: e => { spawnEnemiesInRing('crawler', e.x, e.y, 5, 60); showNotif('🕷 Spider swarm!', '#ff44ff'); },

  roar: e => {
    addShake(10);
    spawnParticles(e.x, e.y, '#ffcc00', 30, 200, 1.0);
    const dx = player.x - e.x, dy = player.y - e.y;
    const d  = Math.hypot(dx, dy) || 1;
    player.x += dx / d * 80; player.y += dy / d * 80;
  },
  teleport: e => {
    const pos = getSpawnPos();
    spawnParticles(e.x, e.y, '#cc44ff', 18, 130, 0.6);
    e.x = pos.x; e.y = pos.y;
    spawnParticles(e.x, e.y, '#cc44ff', 18, 130, 0.6);
  },
  firePillars: e => {
    const adm = e.abilityDmgMult || 1;
    for (let i = 0; i < 6; i++) {
      const px = player.x + rand(-200, 200);
      const py = player.y + rand(-200, 200);
      spawnRing(px, py, 70, 0.5, '#ff4400');
      spawnParticles(px, py, '#ff8800', 14, 200, 0.6);
      if (within(player.x, player.y, px, py, 80)) damagePlayer(e.damage * adm * 0.5);
    }
  },
};

function doBossAbility(e, ability) {
  const handler = BOSS_ABILITY_HANDLERS[ability];
  if (handler) handler(e);
}


/* ════════════ 11) INPUT ════════════ */
const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup',   e => { keys[e.key] = false; });
document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') startReload();
  if (e.key === 'q' || e.key === 'Q') cycleWeapon();
  if (e.key === ' ' || e.key === 'Shift') { e.preventDefault(); tryDash(); }
});

function readInputDir() {
  let dx = 0, dy = 0;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
  if (keys['ArrowRight']|| keys['d'] || keys['D']) dx += 1;
  if (keys['ArrowUp']   || keys['w'] || keys['W']) dy -= 1;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;
  dx += joy.vec.x; dy += joy.vec.y;
  return { dx, dy };
}

function tryDash() {
  if (!gameRunning || paused) return;
  if (player.dashCd > 0 || player.dashTime > 0) return;
  // direction from joystick/keys, fallback to facing angle
  let { dx, dy } = readInputDir();
  const len = Math.hypot(dx, dy);
  if (len < 0.1) { dx = Math.cos(player.angle); dy = Math.sin(player.angle); }
  else { dx /= len; dy /= len; }
  const spd = STATS.playerSpd() * DASH_SPEED_MULT;
  player.dashVx = dx * spd;
  player.dashVy = dy * spd;
  player.dashTime = DASH_DURATION;
  player.dashCd   = STATS.dashCd();
  player.invincible = Math.max(player.invincible, DASH_DURATION + 0.05);
  sfx.dash();
  vibrate(20);
}

// Joystick
const joy = { center:{x:0,y:0}, vec:{x:0,y:0}, touchId:null };
function updateJoyCenter() {
  const r = ui.joyZone.getBoundingClientRect();
  joy.center.x = r.left + r.width  / 2;
  joy.center.y = r.top  + r.height / 2;
}
ui.joyZone.addEventListener('touchstart', e => {
  e.preventDefault();
  if (joy.touchId !== null) return;
  updateJoyCenter();
  joy.touchId = e.changedTouches[0].identifier;
  handleJoyMove(e.changedTouches[0]);
}, { passive:false });
document.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === joy.touchId) { handleJoyMove(t); break; }
}, { passive:false });
document.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.touchId) {
      joy.touchId = null; joy.vec.x = 0; joy.vec.y = 0;
      ui.joyKnob.style.left='50%'; ui.joyKnob.style.top='50%';
      ui.joyKnob.style.transform='translate(-50%,-50%)';
      break;
    }
  }
});
function handleJoyMove(t) {
  const dx = t.clientX - joy.center.x;
  const dy = t.clientY - joy.center.y;
  const d  = Math.hypot(dx, dy);
  const maxR = 35;
  const c  = Math.min(d, maxR);
  const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
  joy.vec.x = nx * (c / maxR); joy.vec.y = ny * (c / maxR);
  ui.joyKnob.style.left = (50 + nx * (c/54) * 100) + '%';
  ui.joyKnob.style.top  = (50 + ny * (c/54) * 100) + '%';
  ui.joyKnob.style.transform = 'translate(-50%,-50%)';
}

// Buttons — FIRE is now a DASH button
ui.shootBtn.addEventListener('touchstart', e => { e.preventDefault(); resumeAudio(); tryDash(); }, { passive:false });
ui.shootBtn.addEventListener('mousedown',  e => { e.preventDefault(); resumeAudio(); tryDash(); });
ui.weaponBtn.addEventListener('click',    e => { e.preventDefault(); openWeaponPicker(); });
ui.weaponBtn.addEventListener('touchend', e => { e.preventDefault(); openWeaponPicker(); }, { passive:false });
ui.wpnCloseBtn.addEventListener('click',    () => { ui.wpnPicker.style.display='none'; paused=false; });
ui.wpnCloseBtn.addEventListener('touchend', e => { e.preventDefault(); ui.wpnPicker.style.display='none'; paused=false; }, { passive:false });


/* ════════════ 12) HUD UPDATES ════════════ */
function updateHPBar() {
  const pct = player.hp / player.maxHp;
  ui.hpBar.style.width = (pct * 100) + '%';
  ui.hpBar.style.background = pct < 0.3
    ? 'linear-gradient(90deg,#880000,#ff2244)'
    : 'linear-gradient(90deg,#cc0022,#ff4466)';
  ui.hpText.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
}
function updateXPBar() { ui.xpBar.style.width = (player.xp / player.xpNext * 100) + '%'; }
function updateAmmoBar() {
  const max = STATS.maxAmmo();
  if (reloading) {
    ui.weaponCard.classList.add('reload-flash');
    const t = 1 - reloadTimer / STATS.reload();
    ui.ammoBar.style.width = (t * 100) + '%';
    ui.ammoText.textContent = `${Math.ceil(reloadTimer*10)/10}s`;
  } else {
    ui.weaponCard.classList.remove('reload-flash');
    ui.ammoBar.style.width = (ammo / max * 100) + '%';
    ui.ammoText.textContent = `${ammo}/${max}`;
  }
  ui.weaponName.textContent = W().name + (player.shieldCharges > 0 ? ` 🛡${player.shieldCharges}` : '');
  ui.weaponIcon.textContent = W().icon;
}
function updateBossBar(e) {
  ui.bossBar.style.width = (e.hp / e.maxHp * 100) + '%';
  if (!e.isBoss) return;
  if (e.phase >= 3) {
    ui.bossBar.style.background = 'linear-gradient(90deg,#550000,#ff0000,#ffff00)';
  } else if (e.phase >= 2) {
    ui.bossBar.style.background = 'linear-gradient(90deg,#884400,#ff8800,#ffcc00)';
  } else {
    ui.bossBar.style.background = '';
  }
}

function updateDashBtn() {
  const btn = ui.shootBtn;
  if (player.dashCd > 0) {
    const pct = 1 - player.dashCd / STATS.dashCd();
    btn.style.background =
      `conic-gradient(rgba(255,40,80,.45) ${pct*360}deg, rgba(60,60,60,.45) ${pct*360}deg)`;
    btn.textContent = player.dashCd.toFixed(1) + 's';
  } else {
    btn.style.background = 'radial-gradient(circle,rgba(0,200,255,.5),rgba(0,80,140,.8))';
    btn.textContent = 'DASH';
  }
}


/* ════════════ 13) RENDERING ════════════ */

function applyCameraTransform() {
  const dpr = ctx._dpr;
  const sx = cameraShake > 0 ? (Math.random()-0.5)*cameraShake*2 : 0;
  const sy = cameraShake > 0 ? (Math.random()-0.5)*cameraShake*2 : 0;
  const screenW = canvas.width / dpr;
  const screenH = canvas.height / dpr;
  ctx.setTransform(
    dpr * zoom.value, 0,
    0, dpr * zoom.value,
    (screenW / 2 + sx) * dpr,
    (screenH / 2 + sy) * dpr,
  );
  ctx.translate(-player.x, -player.y);
}
function resetTransform() {
  ctx.setTransform(ctx._dpr, 0, 0, ctx._dpr, 0, 0);
}

function drawGrid() {
  const { halfW, halfH } = viewExtents();
  const size = 64;
  const left   = player.x - halfW - size;
  const right  = player.x + halfW + size;
  const top    = player.y - halfH - size;
  const bottom = player.y + halfH + size;
  const sx = Math.floor(left  / size) * size;
  const sy = Math.floor(top   / size) * size;

  ctx.strokeStyle = 'rgba(35,35,55,0.7)';
  ctx.lineWidth   = 1 / zoom.value;
  ctx.beginPath();
  for (let x = sx; x <= right;  x += size) { ctx.moveTo(x, top);  ctx.lineTo(x, bottom); }
  for (let y = sy; y <= bottom; y += size) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
  ctx.stroke();
}

function drawBloodDecals() {
  for (const d of bloodDecals) {
    ctx.globalAlpha = 0.55 * (d.life / 25);
    ctx.fillStyle = '#550000';
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r, d.r * 0.65, d.life * 0.1, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFirePatches() {
  for (const fp of firePatches) {
    if (!fp.alive) continue;
    const a = fp.life / fp.maxLife;
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = '#ff5500';
    ctx.beginPath(); ctx.arc(fp.x, fp.y, fp.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.55 * a;
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath(); ctx.arc(fp.x, fp.y, fp.r * 0.55, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOrbs() {
  const t = Date.now() / 1000;
  for (const o of orbs) {
    if (!o.alive) continue;
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = o.color;
    ctx.fillStyle = o.color;
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 5 + o.x * 0.05);
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawPickups() {
  for (const p of pickups) {
    if (!p.alive) continue;
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('+', p.x, p.y);
    ctx.restore();
  }
}

function drawEnemyBullets() {
  for (const b of enemyBullets) {
    if (!b.alive) continue;
    if (b.bomb) {
      // arc projectile - show as bouncing dot
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      // target indicator
      ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 1.5/zoom.value;
      ctx.beginPath(); ctx.arc(b.tx, b.ty, b.radius * (b.t/b.totalT), 0, TAU); ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
}

function drawBullets() {
  for (const b of bullets) {
    if (!b.alive) continue;
    ctx.save();
    ctx.shadowBlur  = b.crit ? 16 : 9;
    ctx.shadowColor = b.crit ? '#ffcc00' : b.color;
    ctx.fillStyle   = b.crit ? '#ffcc00' : b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawLightnings() {
  for (const L of lightnings) {
    const a = L.life / L.maxLife;
    ctx.strokeStyle = `rgba(255,255,160,${a})`;
    ctx.lineWidth = 3 / zoom.value;
    ctx.shadowBlur = 14; ctx.shadowColor = '#ffff44';
    ctx.beginPath();
    // zigzag line
    const segs = 5;
    let x = L.x1, y = L.y1;
    ctx.moveTo(x, y);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const nx = L.x1 + (L.x2 - L.x1) * t + rand(-8, 8);
      const ny = L.y1 + (L.y2 - L.y1) * t + rand(-8, 8);
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawPlayer() {
  // Shield aura
  if (player.shieldCharges > 0) {
    const t = Date.now() / 300;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t);
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth   = 3.5 / zoom.value;
    ctx.shadowBlur  = 18; ctx.shadowColor = '#44aaff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 12, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  if (player.invincible > 0 && Math.floor(Date.now()/75) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(3, 6, player.r * 0.9, player.r * 0.4, 0, 0, TAU); ctx.fill();

  ctx.fillStyle = '#2255ff';
  ctx.shadowBlur = 12; ctx.shadowColor = '#4477ff';
  ctx.beginPath(); ctx.arc(0, 0, player.r, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = W().color;
  ctx.fillRect(player.r * 0.3, -3, player.r + 6, 6);

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(6, -5, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#001aff';
  ctx.beginPath(); ctx.arc(7, -5, 2.5, 0, TAU); ctx.fill();

  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.save();
    ctx.translate(e.x, e.y + (e.bouncer ? -Math.abs(Math.sin(e.bounceT))*12 : 0));
    ctx.rotate(e.angle);

    if (e.flash > 0) { ctx.shadowBlur = 18; ctx.shadowColor = '#ffffff'; }
    else { ctx.shadowBlur = e.isBoss ? 18 : 6; ctx.shadowColor = e.color; }

    if (e.isBoss) {
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
      ctx.beginPath();
      const spikes = 10;
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / spikes / 2) * TAU;
        const rr = i % 2 === 0 ? e.r : e.r * 0.55;
        i === 0 ? ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr)
                : ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
      }
      ctx.closePath(); ctx.fill();
      if (e.outline) {
        ctx.strokeStyle = e.outline;
        ctx.lineWidth = 2.5 / zoom.value;
        ctx.stroke();
      }
    } else {
      // ghost = semi-transparent
      if (e.dodge) ctx.globalAlpha = 0.65;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : (e.raging ? '#ff2244' : e.color);
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      if (e.armor > 0) {
        ctx.strokeStyle = '#aabbcc';
        ctx.lineWidth = 2.5 / zoom.value;
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.stroke();
      }
    }

    // Eyes
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(-e.r*0.28, -e.r*0.28, e.r*0.18, 0, TAU);
    ctx.arc( e.r*0.28, -e.r*0.28, e.r*0.18, 0, TAU);
    ctx.fill();

    // screamer aura
    if (e.screamer) {
      ctx.strokeStyle = 'rgba(255,68,170,0.4)';
      ctx.lineWidth = 2 / zoom.value;
      ctx.beginPath(); ctx.arc(0, 0, 120, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // HP bar
    const bw = e.r * 2.6, bh = e.isBoss ? 7 : 4;
    const bx = e.x - bw/2;
    const by = e.y - e.r - (e.isBoss ? 14 : 10) - (e.bouncer ? Math.abs(Math.sin(e.bounceT))*12 : 0);
    ctx.fillStyle = '#220000'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = e.isBoss ? '#ff3300' : '#ff2244';
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);

    if (e.isBoss) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${10/zoom.value}px Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(e.name, e.x, by - 3);

      // Windup telegraph: pulsing yellow ring
      if (e.windupTimer > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 55);
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35 * pulse;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth   = (3 + pulse * 3) / zoom.value;
        ctx.shadowBlur  = 24; ctx.shadowColor = '#ffff00';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 12 + pulse * 7, 0, TAU); ctx.stroke();
        ctx.restore();
      }

      // Phase transition: colored freeze ring
      if (e.phaseTransition > 0) {
        const frac = e.phaseTransition / 1.5;
        const pc = e.phase >= 3 ? '#ff2244' : '#ff8800';
        ctx.save();
        ctx.globalAlpha = frac * 0.75;
        ctx.strokeStyle = pc;
        ctx.lineWidth   = 7 / zoom.value;
        ctx.shadowBlur  = 30; ctx.shadowColor = pc;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 18, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    if (p.type === 'ring') {
      ctx.globalAlpha = p.life / p.maxLife * 0.7;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 / zoom.value;
      ctx.shadowBlur = 10; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawDamageNums() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const dn of damageNums) {
    ctx.globalAlpha = dn.life / dn.maxLife;
    ctx.fillStyle   = dn.crit ? '#ffcc00' : '#ffffff';
    ctx.font        = `bold ${(dn.crit ? 14 : 11) / zoom.value}px Arial`;
    ctx.fillText(dn.crit ? `⭐${dn.val}` : dn.val, dn.x, dn.y);
  }
  ctx.globalAlpha = 1;
}

function drawMinimap() {
  const MW = 84, MH = 84, scale = 0.030;
  mctx.clearRect(0, 0, MW, MH);
  mctx.fillStyle = 'rgba(0,0,0,0.6)';
  mctx.fillRect(0, 0, MW, MH);

  for (const e of enemies) {
    if (!e.alive) continue;
    const mx = MW/2 + (e.x - player.x) * scale;
    const my = MH/2 + (e.y - player.y) * scale;
    if (mx < 0 || mx > MW || my < 0 || my > MH) continue;
    mctx.fillStyle = e.isBoss ? '#ff4400' : (e.berserker ? '#ff2244' : '#ff8888');
    mctx.beginPath(); mctx.arc(mx, my, e.isBoss ? 4 : 2, 0, TAU); mctx.fill();
  }
  for (const o of orbs) {
    if (!o.alive) continue;
    const mx = MW/2 + (o.x - player.x) * scale;
    const my = MH/2 + (o.y - player.y) * scale;
    if (mx < 0 || mx > MW || my < 0 || my > MH) continue;
    mctx.fillStyle = '#aa44ff';
    mctx.fillRect(mx-0.5, my-0.5, 1.5, 1.5);
  }
  for (const p of pickups) {
    if (!p.alive) continue;
    const mx = MW/2 + (p.x - player.x) * scale;
    const my = MH/2 + (p.y - player.y) * scale;
    if (mx < 0 || mx > MW || my < 0 || my > MH) continue;
    mctx.fillStyle = p.color;
    mctx.fillRect(mx-1, my-1, 3, 3);
  }
  mctx.fillStyle = '#4488ff';
  mctx.beginPath(); mctx.arc(MW/2, MH/2, 3.5, 0, TAU); mctx.fill();
}


/* ════════════ 14) UPDATE LOGIC ════════════ */

function findNearestEnemy() {
  let nearest = null, minD = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.y, player.x, player.y);
    if (d < minD) { minD = d; nearest = e; }
  }
  return nearest;
}

function update(dt) {
  if (!gameRunning || paused) return;

  // ── Contact damage cooldown ──
  if (player.contactCd > 0) player.contactCd -= dt;

  // ── Slow effect tick ──
  if (player.slow > 0) {
    player.slow -= dt;
    player.slowFactor = 0.55;
  } else {
    player.slowFactor = 1;
  }

  // ── Movement ──
  if (player.dashCd > 0) player.dashCd = Math.max(0, player.dashCd - dt);
  if (player.dashTime > 0) {
    player.x += player.dashVx * dt;
    player.y += player.dashVy * dt;
    player.dashTime -= dt;
    if (Math.random() < 0.8) {
      particles.push({ type:'dot', x:player.x, y:player.y,
        vx:rand(-20,20), vy:rand(-20,20), life:0.4, maxLife:0.4,
        color:'#44ddff', r:rand(3,5) });
    }
  } else {
    let { dx: mx, dy: my } = readInputDir();
    const ml = Math.hypot(mx, my);
    if (ml > 0) { mx /= ml; my /= ml; }
    const evSpdMult = activeEvent?.spdMult || 1;
    player.x += mx * STATS.playerSpd() * evSpdMult * dt;
    player.y += my * STATS.playerSpd() * evSpdMult * dt;
  }

  cam.x = player.x; cam.y = player.y;

  if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 30);

  // ── Aim + auto shoot ──
  const target = findNearestEnemy();
  if (target) player.angle = Math.atan2(target.y - player.y, target.x - player.x);

  shootTimer -= dt;
  if (shootTimer <= 0 && target && !reloading) {
    shootTimer = STATS.fireRate();
    fireBullets(player.angle);
  }

  // ── Reload ──
  if (reloading) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) {
      reloading = false;
      ammo = STATS.maxAmmo();
    }
    updateAmmoBar();
  }

  if (player.invincible > 0) player.invincible -= dt;

  if (player.upgrades.regen > 0) {
    player.hp = Math.min(player.maxHp, player.hp + player.upgrades.regen * 0.5 * dt);
  }
  updateHPBar();

  // ── Player bullets ──
  for (const b of bullets) {
    if (!b.alive) continue;
    const stepX = b.vx * dt, stepY = b.vy * dt;
    b.x += stepX; b.y += stepY;
    b.traveled += Math.sqrt(stepX*stepX + stepY*stepY);
    if (b.traveled > b.range) {
      if (b.aoe > 0) explode(b.x, b.y, b.aoe, b.dmg, 1, b.napalm);
      b.alive = false; continue;
    }
    for (const e of enemies) {
      if (!e.alive || !b.alive) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      const rr = e.r + b.r;
      if (dx*dx + dy*dy < rr*rr) {
        if (Math.random() < b.deathTouchCh && !e.isBoss) {
          hitEnemy(e, 99999);
          b.alive = false;
          break;
        }
        if (player.upgrades.vampirism > 0) {
          player.hp = Math.min(player.maxHp, player.hp + b.dmg * player.upgrades.vampirism * 0.01);
        }
        hitEnemy(e, b.dmg);
        if (b.chain && e.alive) chainLightning(e, b, b.dmg * 0.6, 3);
        b.pierced++;
        if (b.pierced >= b.pierce) {
          if (b.aoe > 0) explode(b.x, b.y, b.aoe, b.dmg, 0.7, b.napalm);
          b.alive = false;
          break;
        }
      }
    }
  }
  keep(bullets);

  // ── Enemy bullets ──
  for (const b of enemyBullets) {
    if (!b.alive) continue;
    if (b.bomb) {
      b.t += dt;
      const u = b.t / b.totalT;
      b.x = b.sx + (b.tx - b.sx) * u;
      b.y = b.sy + (b.ty - b.sy) * u - Math.sin(u * Math.PI) * 60;
      if (b.t >= b.totalT) { bombExplode(b); b.alive = false; }
      continue;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.alive = false; continue; }
    if (within(player.x, player.y, b.x, b.y, player.r + b.r)) {
      if (b.web) { player.slow = 2; spawnParticles(player.x, player.y, '#ffffff', 8, 80, 0.4); }
      damagePlayer(b.dmg);
      b.alive = false;
    }
  }
  keep(enemyBullets);

  // ── Enemies ──
  for (const e of enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.bouncer) e.bounceT += dt * 6;

    if (e.isBoss && e.phaseTransition > 0) {
      // frozen during phase transition — emit phase-colored sparks
      if (Math.random() < 0.55) {
        const pc = e.phase >= 3 ? '#ff2244' : '#ff8800';
        spawnParticles(e.x, e.y, pc, 2, 200, 0.35);
      }
    } else if (e.charging) {
      e.x += e.chargeVx * dt * 3.5; e.y += e.chargeVy * dt * 3.5;
      e.chargeDur -= dt;
      if (e.chargeDur <= 0) e.charging = false;
    } else {
      const dx = player.x - e.x, dy = player.y - e.y;
      const d  = Math.hypot(dx, dy) || 1;
      const evESpdMult = activeEvent
        ? (activeEvent.id === 'frenzy' ? 2.0 : activeEvent.id === 'bloodmoon' ? 1.5 : 1) : 1;
      e.x += dx/d * e.speed * evESpdMult * dt;
      e.y += dy/d * e.speed * evESpdMult * dt;
      e.angle = Math.atan2(dy, dx);

      // Ranged
      if (e.ranged) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 600) {
          e.shootTimer = e.shootInterval;
          if (e.bomber) fireBomb(e);
          else fireEnemyProjectile(e);
        }
      }

      // Healer
      if (e.healer) {
        for (const other of enemies) {
          if (other === e || !other.alive) continue;
          if (within(other.x, other.y, e.x, e.y, 110)) {
            other.hp = Math.min(other.maxHp, other.hp + 7 * dt);
          }
        }
      }

      // Screamer aura → slow player
      if (e.screamer) {
        if (within(player.x, player.y, e.x, e.y, 120)) player.slow = 0.3;
      }
    }

    // Boss abilities + phase system
    if (e.isBoss) {
      if (e.phaseTransition > 0) {
        e.phaseTransition -= dt;
        e.flash = 0.08;
      } else {
        // Phase threshold checks
        const hpPct = e.hp / e.maxHp;
        if (e.phase === 1 && hpPct <= BOSS_PHASES[0].hpPct) {
          triggerBossPhaseTransition(e, 0);
        } else if (e.phase === 2 && hpPct <= BOSS_PHASES[1].hpPct) {
          triggerBossPhaseTransition(e, 1);
        }

        // Windup: telegraph + fire
        if (e.windupTimer > 0) {
          e.windupTimer -= dt;
          if (Math.random() < 0.5)
            spawnRing(e.x, e.y, e.r * 2.5, 0.22, e.outline);
          if (e.windupTimer <= 0) {
            doBossAbility(e, e.windupAbility);
            e.windupAbility = null;
            const ph = e.phase;
            const cdMin = ph >= 3 ? 0.8 : ph === 2 ? 1.6 : 2.5;
            const cdMax = ph >= 3 ? 1.6 : ph === 2 ? 3.0 : 4.5;
            e.abilityTimer = rand(cdMin, cdMax);
            if (e.alive) updateBossBar(e);
          }
        } else {
          e.abilityTimer -= dt;
          if (e.abilityTimer <= 0) {
            const ab = pickOne(e.abilities);
            e.windupTimer   = 0.55;
            e.windupAbility = ab;
            spawnParticles(e.x, e.y, e.outline, 10, 160, 0.5);
          }
        }
      }
    }

    // Melee contact
    const d2 = dist(player.x, player.y, e.x, e.y);
    if (d2 < player.r + e.r) {
      const contactDmg = e.damage * (e.isBoss ? (e.abilityDmgMult||1) : 1)
                       * dt * (e.ranged && !e.isBoss ? 0.3 : 1);
      if (e.isBoss) damagePlayer(contactDmg);        // boss contact: respects iframes
      else          damagePlayerContact(contactDmg); // zombie contact: continuous DPS
    }
  }
  keep(enemies);

  // ── XP orb pickup ──
  const magnet = STATS.magnetR();
  for (const o of orbs) {
    if (!o.alive) continue;
    const d = dist(player.x, player.y, o.x, o.y);
    if (d < magnet + player.r + o.r) {
      const pull = 220 + (magnet - d) * 4;
      const dx = player.x - o.x, dy = player.y - o.y;
      const od = Math.hypot(dx, dy) || 1;
      o.x += dx/od * pull * dt; o.y += dy/od * pull * dt;
      if (within(player.x, player.y, o.x, o.y, player.r + o.r)) {
        addXP(o.xp); o.alive = false;
      }
    }
  }
  keep(orbs);

  // ── Pickups ──
  for (const p of pickups) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    if (within(player.x, player.y, p.x, p.y, player.r + p.r + 4)) {
      if (p.type === 'hp') {
        player.hp = Math.min(player.maxHp, player.hp + 25);
        spawnParticles(player.x, player.y, '#ff4466', 12, 100, 0.5);
        sfx.pickup();
        vibrate(15);
      } else if (p.type === 'ammo') {
        ammo = STATS.maxAmmo();
        reloading = false;
        spawnParticles(player.x, player.y, '#44aaff', 10, 100, 0.5);
        sfx.reload();
      }
      p.alive = false;
    }
  }
  keep(pickups);

  // ── Fire patches (napalm) ──
  for (const fp of firePatches) {
    if (!fp.alive) continue;
    fp.life -= dt;
    if (fp.life <= 0) { fp.alive = false; continue; }
    const r2 = fp.r * fp.r;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - fp.x, dy = e.y - fp.y;
      if (dx*dx + dy*dy < r2) e.hp -= fp.dps * dt;
      if (e.hp <= 0 && e.alive) killEnemy(e);
    }
    // emit fire particles
    if (Math.random() < 0.6) {
      const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * fp.r;
      particles.push({ type:'dot',
        x: fp.x + Math.cos(a)*rr, y: fp.y + Math.sin(a)*rr,
        vx: rand(-10,10), vy: rand(-40,-15),
        life:0.5, maxLife:0.5, color: Math.random()<0.5?'#ff6622':'#ffcc00', r:rand(2,4) });
    }
  }
  keep(firePatches);

  // ── Particles ──
  for (const p of particles) {
    if (p.type === 'dot') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.88; p.vy *= 0.88; }
    else if (p.type === 'ring') { p.r = p.maxR * (1 - p.life / p.maxLife); }
    p.life -= dt;
  }
  keepAlive(particles);

  for (const dn of damageNums) { dn.y += dn.vy * dt; dn.life -= dt; }
  keepAlive(damageNums);

  for (const d of bloodDecals) d.life -= dt * 0.3;
  keepAlive(bloodDecals);

  for (const L of lightnings) L.life -= dt;
  keepAlive(lightnings);

  // ── Active event countdown ──
  if (activeEvent && activeEvent.timer > 0) {
    activeEvent.timer -= dt;
    if (activeEvent.timer <= 0) {
      showNotif(`${activeEvent.name} — завершился`, '#888888');
      activeEvent = null;
      eventBgTint = null;
    }
  }

  // ── Wave spawning ──
  if (wave.betweenWaves) {
    wave.betweenTimer -= dt;
    if (wave.betweenTimer <= 0) {
      wave.betweenWaves = false;
      startNextWaveSpawn();
      if (isBossWave()) showNotif('⚠ BOSS INCOMING ⚠', '#ff2244');
    }
    return;
  }

  // Don't tick spawn timer once the boss is alive on a boss wave.
  if (isBossWave() && wave.bossSpawned) return;

  wave.spawnTimer -= dt;
  if (wave.spawnTimer <= 0) {
    let alive = 0;
    for (const x of enemies) if (x.alive) alive++;

    if (isBossWave()) {
      wave.bossSpawned = true;
      wave.spawned++;
      const bossIdx = Math.floor((wave.current - 5) / 5);
      spawnBoss(bossIdx);
    } else {
      if (wave.spawned < wave.enemiesPerWave && alive < 50) {
        wave.spawnTimer = wave.spawnInterval;
        wave.spawned++;
        const type = pickEnemyType();
        const pos  = getSpawnPos();
        spawnEnemyType(type, pos.x, pos.y);
        // swarm spawns extras
        if (ENEMY_DEFS[type].swarm) {
          for (let i = 0; i < 3; i++) {
            wave.spawned++;
            spawnEnemyType(type, pos.x + rand(-40,40), pos.y + rand(-40,40));
          }
        }
      }
      if (wave.spawned >= wave.enemiesPerWave && alive === 0) finishWave();
    }
  }
}


/* ════════════ RENDER ════════════ */
function render() {
  resetTransform();
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(0, 0, canvas.width / ctx._dpr, canvas.height / ctx._dpr);
  if (eventBgTint) {
    ctx.fillStyle = eventBgTint;
    ctx.fillRect(0, 0, canvas.width / ctx._dpr, canvas.height / ctx._dpr);
  }

  applyCameraTransform();
  drawGrid();
  drawBloodDecals();
  drawFirePatches();
  drawOrbs();
  drawPickups();
  drawParticles();
  drawEnemies();
  drawPlayer();
  drawBullets();
  drawEnemyBullets();
  drawLightnings();
  drawDamageNums();

  resetTransform();
  drawMinimap();
  updateDashBtn();
}


/* ════════════ GAME LOOP ════════════ */
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}


/* ════════════ 15) UI FLOW ════════════ */

function xpForLevel(lvl) { return Math.floor(100 * Math.pow(1.22, lvl - 1)); }

function addXP(amount) {
  player.xp += amount * (activeEvent?.xpMult || 1);
  sfx.pickup();
  if (player.xp >= player.xpNext && gameRunning) {
    player.xp    -= player.xpNext;
    player.level++;
    player.xpNext = xpForLevel(player.level);
    onLevelUp();
  }
  updateXPBar();
}

function onLevelUp() {
  ui.levelBadge.textContent = `Lv ${player.level}`;
  sfx.levelup();
  spawnParticles(player.x, player.y, '#e100ff', 22, 110, 0.8);
  paused = true;
  showUpgrades();
  // Weapon unlock notifications
  for (const id of WEAPON_ORDER) {
    if (WEAPONS[id].unlockLvl === player.level && !unlockedWeapons.includes(id)) {
      unlockedWeapons.push(id);
      sfx.unlock();
      setTimeout(() => showNotif(`🔓 ${WEAPONS[id].name} UNLOCKED!`, WEAPONS[id].color), 200);
    }
  }
}

function applyUpgrade(upg) {
  player.upgrades[upg.id]++;
  switch (upg.id) {
    case 'maxHp':
      player.maxHp += 30;
      player.hp = Math.min(player.hp + 30, player.maxHp);
      break;
    case 'shield':
      // refill to max on every shield upgrade
      player.shieldCharges = player.upgrades.shield;
      break;
    case 'ammoMax':
      ammo = Math.min(STATS.maxAmmo(), ammo + 10);
      break;
  }
}

function showUpgrades() {
  ui.upgLvlTxt.textContent = `Уровень ${player.level} — выбери одно из 3`;
  ui.upgChoices.innerHTML = '';

  const available = UPGRADES.filter(u => player.upgrades[u.id] < u.max);
  const pool = available.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const upg of pool) {
    const cur = player.upgrades[upg.id];
    const stars = '★'.repeat(cur+1) + '☆'.repeat(upg.max - cur - 1);
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
      <div>
        <span class="u-name">${upg.icon} ${upg.name}</span>
        <span class="u-lvl">${cur+1}/${upg.max}</span>
      </div>
      <div class="u-desc">${upg.desc}</div>
      <div class="u-stars">${stars}</div>`;
    const pick = () => {
      applyUpgrade(upg);
      ui.upgPanel.style.display = 'none';
      // chain levelups
      if (player.xp >= player.xpNext && gameRunning) {
        player.xp -= player.xpNext;
        player.level++;
        player.xpNext = xpForLevel(player.level);
        ui.levelBadge.textContent = `Lv ${player.level}`;
        sfx.levelup();
        showUpgrades();
        return;
      }
      paused = false;
    };
    card.addEventListener('click', pick);
    card.addEventListener('touchend', e => { e.preventDefault(); pick(); });
    ui.upgChoices.appendChild(card);
  }
  ui.upgPanel.style.display = 'flex';
}

function openWeaponPicker() {
  if (!gameRunning) return;
  paused = true;
  ui.wpnList.innerHTML = '';
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id];
    const locked = !unlockedWeapons.includes(id);
    const card = document.createElement('div');
    card.className = 'weapon-card' + (locked ? ' locked' : '');
    card.innerHTML = `
      <div class="w-name" style="color:${w.color}">
        ${id === currentWeapon ? '▶ ' : ''}${w.icon} ${w.name}
        ${locked ? ` 🔒Lv${w.unlockLvl}` : ''}
      </div>
      <div class="w-stats">Урон ${w.damage} · Скорострельн. ${(1/w.fireRate).toFixed(1)}/с · Магаз. ${w.maxAmmo} · ${w.desc}</div>`;
    if (!locked) {
      const pick = () => {
        currentWeapon = id;
        ammo = STATS.maxAmmo();
        reloading = false;
        updateAmmoBar();
        ui.wpnPicker.style.display = 'none';
        paused = false;
      };
      card.addEventListener('click', pick);
      card.addEventListener('touchend', e => { e.preventDefault(); pick(); });
    }
    ui.wpnList.appendChild(card);
  }
  ui.wpnPicker.style.display = 'flex';
}

function cycleWeapon() {
  const unlocked = WEAPON_ORDER.filter(id => unlockedWeapons.includes(id));
  const idx = unlocked.indexOf(currentWeapon);
  currentWeapon = unlocked[(idx + 1) % unlocked.length];
  ammo = STATS.maxAmmo();
  reloading = false;
  updateAmmoBar();
}

function gameOver() {
  gameRunning = false;
  const isNewHi = player.score > hiScore;
  if (isNewHi) { hiScore = player.score; localStorage.setItem('zs_hi', hiScore); }
  if (wakeLockSentinel) { try { wakeLockSentinel.release(); } catch(e){} wakeLockSentinel = null; }
  vibrate([0, 60, 40, 60, 40, 200]);
  ui.overlay.innerHTML = `
    <h1>GAME OVER</h1>
    ${isNewHi ? '<div class="sub" style="color:#ffcc00;font-size:14px;font-weight:bold;">★ NEW HIGH SCORE ★</div>' : ''}
    <div class="stat-grid">
      <div>Wave:</div><div><span>${wave.current}</span></div>
      <div>Kills:</div><div><span>${player.kills}</span></div>
      <div>Level:</div><div><span>${player.level}</span></div>
      <div>Score:</div><div><span>${player.score}</span></div>
      <div>Best:</div><div><span>${hiScore}</span></div>
    </div>
    <button class="big-btn purple" id="start-btn">PLAY AGAIN</button>`;
  ui.overlay.style.display = 'flex';
  $('start-btn').addEventListener('click', startGame);
  $('start-btn').addEventListener('touchend', e => { e.preventDefault(); startGame(); }, { passive:false });
}

function startGame() {
  resumeAudio();
  requestWakeLock();

  ui.overlay.style.display    = 'none';
  ui.upgPanel.style.display   = 'none';
  ui.wpnPicker.style.display  = 'none';
  ui.bossBarWrap.style.display= 'none';
  ui.notif.style.display      = 'none';

  Object.assign(player, {
    x:0, y:0, r:15, hp:100, maxHp:100, baseSpeed:175,
    angle:0, invincible:0, contactCd:0,
    kills:0, score:0, xp:0, xpNext:100, level:1,
    slow:0, slowFactor:1, shieldCharges:0,
    dashTime:0, dashCd:0, dashVx:0, dashVy:0,
    upgrades: newUpgrades(),
  });

  bullets=[]; enemyBullets=[]; enemies=[]; orbs=[]; pickups=[];
  particles=[]; damageNums=[]; bloodDecals=[]; lightnings=[]; firePatches=[];

  killStreak = 0; streakMult = 1;
  activeEvent = null; eventCooldown = 0; eventBgTint = null;
  waveVariant = null;

  Object.assign(wave, {
    current:1, spawnInterval:1.4, spawnTimer:0,
    enemiesPerWave:8, spawned:0,
    bossSpawned:false, betweenWaves:false, betweenTimer:0,
  });

  currentWeapon   = 'pistol';
  unlockedWeapons = ['pistol'];
  ammo            = WEAPONS.pistol.maxAmmo;
  reloading       = false; reloadTimer = 0;
  shootTimer      = 0;
  currentBoss     = null;
  cameraShake     = 0;
  paused          = false;
  gameRunning     = true;

  ui.levelBadge.textContent = 'Lv 1';
  ui.killsBadge.textContent = 'Kills 0';
  ui.scoreBadge.textContent = 'Score 0';
  ui.waveBadge.textContent  = 'Wave 1';
  if (ui.hiBadge) ui.hiBadge.textContent = `Best ${hiScore}`;

  updateHPBar(); updateXPBar(); updateAmmoBar();
  updateJoyCenter();
  startNextWaveSpawn();

  for (let i = 0; i < 4; i++) {
    const pos = getSpawnPos();
    spawnEnemyType('basic', pos.x, pos.y);
    wave.spawned++;
  }
}

ui.startBtn.addEventListener('click', startGame);
ui.startBtn.addEventListener('touchend', e => { e.preventDefault(); startGame(); }, { passive:false });

/* Service worker — offline / installable PWA */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

requestAnimationFrame(gameLoop);
