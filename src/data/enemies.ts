import { weightedPick } from '../utils/math';

export interface EnemyDef {
  type:          string;
  name:          string;
  color:         number;
  radius:        number;
  hp:            (wave: number) => number;
  speed:         (wave: number) => number;
  xp:            number;
  score:         number;
  contactDamage: number;
  // optional behaviours
  ranged?:           boolean;
  shootInterval?:    number;
  shootRange?:       number;
  projDamage?:       number;
  healer?:           boolean;
  healRadius?:       number;
  healRate?:         number;
  screamer?:         boolean;
  slowRadius?:       number;
  berserker?:        boolean;
  rageMult?:         number;
  rageThreshold?:    number;
  explodes?:         boolean;
  explosionRadius?:  number;
  armored?:          boolean;
  armorMult?:        number;
  ghost?:            boolean;
  dodgeChance?:      number;
  alpha?:            number;
}

export const ENEMY_TYPES: Record<string, EnemyDef> = {
  basic:    { type:'basic',    name:'Zombie',    color:0x66aa44, radius:16, hp:w=>40+w*8,   speed:w=>55+w*2,   xp:10, score:10, contactDamage:10 },
  fast:     { type:'fast',     name:'Runner',    color:0xaadd22, radius:13, hp:w=>25+w*5,   speed:w=>95+w*3,   xp:12, score:15, contactDamage:8  },
  tank:     { type:'tank',     name:'Brute',     color:0x886644, radius:22, hp:w=>120+w*22, speed:w=>38+w*1,   xp:20, score:25, contactDamage:18, armored:true, armorMult:0.5 },
  spitter:  { type:'spitter',  name:'Spitter',   color:0x44bb44, radius:14, hp:w=>35+w*6,   speed:w=>45+w*1.5, xp:15, score:20, contactDamage:8,  ranged:true, shootInterval:2.2, shootRange:340, projDamage:12 },
  exploder: { type:'exploder', name:'Kamikaze',  color:0xdd6633, radius:15, hp:w=>30+w*5,   speed:w=>70+w*3,   xp:14, score:18, contactDamage:5,  explodes:true, explosionRadius:80 },
  shaman:   { type:'shaman',   name:'Shaman',    color:0x9955cc, radius:14, hp:w=>45+w*7,   speed:w=>40+w*1,   xp:18, score:30, contactDamage:8,  healer:true, healRadius:110, healRate:3 },
  crawler:  { type:'crawler',  name:'Crawler',   color:0x55cc55, radius:10, hp:w=>18+w*3,   speed:w=>75+w*3.5, xp:6,  score:8,  contactDamage:6  },
  screamer: { type:'screamer', name:'Screamer',  color:0xcc44cc, radius:15, hp:w=>40+w*6,   speed:w=>48+w*1.5, xp:15, score:20, contactDamage:8,  screamer:true, slowRadius:120 },
  berserker:{ type:'berserker',name:'Berserker', color:0xff3333, radius:17, hp:w=>70+w*12,  speed:w=>60+w*2,   xp:18, score:25, contactDamage:15, berserker:true, rageMult:1.8, rageThreshold:0.4 },
  ghost:    { type:'ghost',    name:'Ghost',     color:0xaaccff, radius:15, hp:w=>35+w*6,   speed:w=>65+w*2,   xp:16, score:22, contactDamage:8,  ghost:true, dodgeChance:0.45, alpha:0.5 },
  elite:    { type:'elite',    name:'Elite',     color:0xff8800, radius:20, hp:w=>200+w*30, speed:w=>65+w*2.5, xp:40, score:50, contactDamage:20, armored:true, armorMult:0.4 },
};

type SpawnTable = [string, number][];

export function buildSpawnTable(wave: number): SpawnTable {
  const t: SpawnTable = [['basic', 50]];
  if (wave >= 2)  t.push(['fast',      25]);
  if (wave >= 3)  t.push(['spitter',   15]);
  if (wave >= 4)  t.push(['tank',      10]);
  if (wave >= 5)  t.push(['exploder',  12]);
  if (wave >= 6)  t.push(['shaman',    8]);
  if (wave >= 7)  t.push(['crawler',   20]);
  if (wave >= 8)  t.push(['screamer',  10]);
  if (wave >= 10) t.push(['berserker', 8]);
  if (wave >= 12) t.push(['ghost',     8]);
  if (wave >= 14) t.push(['elite',     5]);
  return t;
}

export function pickEnemyType(wave: number): EnemyDef {
  const table = buildSpawnTable(wave);
  const type = weightedPick(table);
  return ENEMY_TYPES[type] ?? ENEMY_TYPES['basic'];
}
