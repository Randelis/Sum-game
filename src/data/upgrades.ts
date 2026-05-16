export interface UpgradeDef {
  id:          string;
  name:        string;
  description: string;
  maxLevel:    number;
  apply:       (stats: PlayerStats, level: number) => void;
}

export interface PlayerStats {
  damageMult:    number;
  speedMult:     number;
  pierceMult:    number;     // additive pierce bonus
  maxHp:         number;
  vampirism:     number;     // 0-1 fraction of damage returned as HP
  aoeMult:       number;
  reloadMult:    number;
  fireRateMult:  number;
  bulletCount:   number;     // extra bullets per shot
  magnetRadius:  number;     // XP orb pickup radius
  dodgeChance:   number;     // 0-1
}

export function defaultStats(): PlayerStats {
  return {
    damageMult:   1,
    speedMult:    1,
    pierceMult:   0,
    maxHp:        100,
    vampirism:    0,
    aoeMult:      1,
    reloadMult:   1,
    fireRateMult: 1,
    bulletCount:  0,
    magnetRadius: 80,
    dodgeChance:  0,
  };
}

export const UPGRADES: UpgradeDef[] = [
  {
    id:'damage', name:'Stopping Power', description:'+20% weapon damage',
    maxLevel:5,
    apply:(s) => { s.damageMult += 0.2; },
  },
  {
    id:'speed', name:'Fleet Feet', description:'+12% movement speed',
    maxLevel:4,
    apply:(s) => { s.speedMult += 0.12; },
  },
  {
    id:'pierce', name:'Penetrator', description:'+1 bullet pierce',
    maxLevel:3,
    apply:(s) => { s.pierceMult += 1; },
  },
  {
    id:'maxHp', name:'Iron Will', description:'+25 max HP and full heal',
    maxLevel:4,
    apply:(s) => { s.maxHp += 25; },
  },
  {
    id:'vampirism', name:'Life Steal', description:'+8% life steal on hit',
    maxLevel:3,
    apply:(s) => { s.vampirism = Math.min(0.32, s.vampirism + 0.08); },
  },
  {
    id:'aoe', name:'Blast Radius', description:'+30% explosion/AoE radius',
    maxLevel:3,
    apply:(s) => { s.aoeMult += 0.3; },
  },
  {
    id:'reload', name:'Quick Hands', description:'-20% reload time',
    maxLevel:4,
    apply:(s) => { s.reloadMult = Math.max(0.2, s.reloadMult - 0.2); },
  },
  {
    id:'fireRate', name:'Trigger Happy', description:'+15% fire rate',
    maxLevel:4,
    apply:(s) => { s.fireRateMult += 0.15; },
  },
  {
    id:'bulletCount', name:'Buckshot', description:'+1 extra bullet per shot',
    maxLevel:3,
    apply:(s) => { s.bulletCount += 1; },
  },
  {
    id:'magnet', name:'Graviton', description:'+60px XP pickup radius',
    maxLevel:3,
    apply:(s) => { s.magnetRadius += 60; },
  },
  {
    id:'dodge', name:'Ghost Step', description:'+10% dodge chance',
    maxLevel:3,
    apply:(s) => { s.dodgeChance = Math.min(0.5, s.dodgeChance + 0.1); },
  },
];

export function pickUpgrades(
  currentLevels: Record<string, number>,
  count = 3,
): UpgradeDef[] {
  const available = UPGRADES.filter(
    u => (currentLevels[u.id] ?? 0) < u.maxLevel,
  );
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
