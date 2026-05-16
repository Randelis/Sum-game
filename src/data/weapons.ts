export interface WeaponDef {
  id:          string;
  name:        string;
  icon:        string;
  damage:      number;
  fireRate:    number;   // shots / second
  bulletSpeed: number;
  range:       number;   // max travel pixels
  spread:      number;   // radians half-angle
  bulletCount: number;
  pierce:      number;
  aoe:         number;   // explosion radius, 0 = none
  ammoMax:     number;
  reloadTime:  number;   // seconds
  unlockLevel: number;
}

export const WEAPONS: WeaponDef[] = [
  { id:'pistol',  name:'Pistol',  icon:'🔫', damage:18,  fireRate:2.5, bulletSpeed:520,  range:420, spread:0.06, bulletCount:1, pierce:0, aoe:0,  ammoMax:16, reloadTime:1.5, unlockLevel:1  },
  { id:'smg',     name:'SMG',     icon:'🔫', damage:10,  fireRate:8,   bulletSpeed:560,  range:370, spread:0.14, bulletCount:1, pierce:0, aoe:0,  ammoMax:30, reloadTime:1.8, unlockLevel:3  },
  { id:'shotgun', name:'Shotgun', icon:'🔫', damage:22,  fireRate:1.2, bulletSpeed:480,  range:280, spread:0.45, bulletCount:7, pierce:0, aoe:0,  ammoMax:6,  reloadTime:2.0, unlockLevel:4  },
  { id:'rifle',   name:'Rifle',   icon:'🔫', damage:38,  fireRate:3.5, bulletSpeed:620,  range:520, spread:0.04, bulletCount:1, pierce:1, aoe:0,  ammoMax:20, reloadTime:1.6, unlockLevel:6  },
  { id:'sniper',  name:'Sniper',  icon:'🔫', damage:95,  fireRate:0.8, bulletSpeed:900,  range:750, spread:0.01, bulletCount:1, pierce:2, aoe:0,  ammoMax:5,  reloadTime:2.5, unlockLevel:8  },
  { id:'rpg',     name:'RPG',     icon:'💥', damage:65,  fireRate:0.7, bulletSpeed:380,  range:500, spread:0.03, bulletCount:1, pierce:0, aoe:90, ammoMax:4,  reloadTime:2.8, unlockLevel:10 },
  { id:'minigun', name:'Minigun', icon:'🔫', damage:8,   fireRate:15,  bulletSpeed:500,  range:350, spread:0.22, bulletCount:1, pierce:0, aoe:0,  ammoMax:60, reloadTime:2.2, unlockLevel:12 },
  { id:'plasma',  name:'Plasma',  icon:'⚡', damage:45,  fireRate:2.0, bulletSpeed:600,  range:480, spread:0.05, bulletCount:1, pierce:3, aoe:0,  ammoMax:12, reloadTime:1.8, unlockLevel:14 },
  { id:'napalm',  name:'Napalm',  icon:'🔥', damage:40,  fireRate:1.5, bulletSpeed:420,  range:450, spread:0.10, bulletCount:1, pierce:0, aoe:80, ammoMax:8,  reloadTime:2.2, unlockLevel:16 },
  { id:'railgun', name:'Railgun', icon:'🔫', damage:150, fireRate:0.5, bulletSpeed:1100, range:900, spread:0.00, bulletCount:1, pierce:5, aoe:0,  ammoMax:3,  reloadTime:3.0, unlockLevel:20 },
];

export function getWeapon(id: string): WeaponDef {
  return WEAPONS.find(w => w.id === id) ?? WEAPONS[0];
}

export function unlockedWeapons(level: number): WeaponDef[] {
  return WEAPONS.filter(w => w.unlockLevel <= level);
}
