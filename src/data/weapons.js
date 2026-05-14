// Each weapon: id, name, icon, damage, fireRate (shots/sec), bulletSpd, range,
// spread (radians), bulletCount, pierce, aoe (radius), chain, unlock (wave)
export const WEAPONS = [
  { id:'pistol',    name:'Pistol',      icon:'🔫', damage:18,  fireRate:2.5, bulletSpd:520, range:420, spread:0.06, bulletCount:1, pierce:0, aoe:0,  chain:0, unlock:0 },
  { id:'smg',       name:'SMG',         icon:'🔫', damage:10,  fireRate:8,   bulletSpd:560, range:370, spread:0.14, bulletCount:1, pierce:0, aoe:0,  chain:0, unlock:2 },
  { id:'shotgun',   name:'Shotgun',     icon:'🔫', damage:22,  fireRate:1.2, bulletSpd:480, range:280, spread:0.45, bulletCount:7, pierce:0, aoe:0,  chain:0, unlock:3 },
  { id:'rifle',     name:'Rifle',       icon:'🔫', damage:38,  fireRate:3.5, bulletSpd:620, range:520, spread:0.04, bulletCount:1, pierce:1, aoe:0,  chain:0, unlock:5 },
  { id:'sniper',    name:'Sniper',      icon:'🔫', damage:95,  fireRate:0.8, bulletSpd:900, range:750, spread:0.01, bulletCount:1, pierce:2, aoe:0,  chain:0, unlock:7 },
  { id:'rpg',       name:'RPG',         icon:'💥', damage:65,  fireRate:0.7, bulletSpd:380, range:500, spread:0.03, bulletCount:1, pierce:0, aoe:90, chain:0, unlock:8 },
  { id:'minigun',   name:'Minigun',     icon:'🔫', damage:8,   fireRate:15,  bulletSpd:500, range:350, spread:0.22, bulletCount:1, pierce:0, aoe:0,  chain:0, unlock:9 },
  { id:'plasma',    name:'Plasma',      icon:'⚡', damage:45,  fireRate:2.0, bulletSpd:600, range:480, spread:0.05, bulletCount:1, pierce:3, aoe:0,  chain:0, unlock:11 },
  { id:'lightning', name:'Lightning',   icon:'⚡', damage:30,  fireRate:2.5, bulletSpd:700, range:400, spread:0.08, bulletCount:1, pierce:0, aoe:0,  chain:3, unlock:13 },
  { id:'napalm',    name:'Napalm',      icon:'🔥', damage:40,  fireRate:1.5, bulletSpd:420, range:450, spread:0.10, bulletCount:1, pierce:0, aoe:80, chain:0, unlock:15 },
  { id:'railgun',   name:'Railgun',     icon:'🔫', damage:150, fireRate:0.5, bulletSpd:1100,range:900, spread:0.00, bulletCount:1, pierce:5, aoe:0,  chain:0, unlock:18 },
  { id:'dualsmg',   name:'Dual SMG',    icon:'🔫', damage:12,  fireRate:10,  bulletSpd:540, range:360, spread:0.18, bulletCount:2, pierce:0, aoe:0,  chain:0, unlock:20 },
];

export function getWeapon(id) {
  return WEAPONS.find(w => w.id === id);
}

export function unlockedWeapons(wave) {
  return WEAPONS.filter(w => w.unlock <= wave);
}
