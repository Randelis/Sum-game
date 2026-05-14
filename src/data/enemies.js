// hp/spd are functions of wave number
// Special flags: ranged, healer, screamer, berserker, bouncer, ghost, explodes, armored, crawler
export const ENEMY_TYPES = {
  basic:     { name:'Zombie',    color:0x66aa44, radius:16, hp: w=>40+w*8,   spd: w=>55+w*2,   xp:10, score:10 },
  fast:      { name:'Runner',    color:0xaadd22, radius:13, hp: w=>25+w*5,   spd: w=>95+w*3,   xp:12, score:15 },
  tank:      { name:'Brute',     color:0x886644, radius:22, hp: w=>120+w*22, spd: w=>38+w*1,   xp:20, score:25, armored:true },
  spitter:   { name:'Spitter',   color:0x44bb44, radius:14, hp: w=>35+w*6,   spd: w=>45+w*1.5, xp:15, score:20, ranged:true, shootInterval:2.2, shootRange:340, projDmg:0.4 },
  exploder:  { name:'Kamikaze',  color:0xdd6633, radius:15, hp: w=>30+w*5,   spd: w=>70+w*3,   xp:14, score:18, explodes:true, aoeRadius:80 },
  armored:   { name:'Armored',   color:0x888888, radius:18, hp: w=>80+w*14,  spd: w=>42+w*1.2, xp:18, score:22, armorMult:0.4 },
  shaman:    { name:'Shaman',    color:0x9955cc, radius:14, hp: w=>45+w*7,   spd: w=>40+w*1,   xp:18, score:30, healer:true, healRate:3, healRadius:110 },
  crawler:   { name:'Crawler',   color:0x55cc55, radius:10, hp: w=>18+w*3,   spd: w=>75+w*3.5, xp:6,  score:8 },
  bomber:    { name:'Bomber',    color:0xcc8833, radius:16, hp: w=>50+w*8,   spd: w=>50+w*1.5, xp:16, score:22, ranged:true, shootInterval:3.0, shootRange:380, projDmg:0.6, projAoe:60 },
  screamer:  { name:'Screamer',  color:0xcc44cc, radius:15, hp: w=>40+w*6,   spd: w=>48+w*1.5, xp:15, score:20, screamer:true, slowRadius:120, slowMult:0.5 },
  berserker: { name:'Berserker', color:0xff3333, radius:17, hp: w=>70+w*12,  spd: w=>60+w*2,   xp:18, score:25, berserker:true, rageSpdMult:1.8, rageHpPct:0.4 },
  ghost:     { name:'Ghost',     color:0xaaccff, radius:15, hp: w=>35+w*6,   spd: w=>65+w*2,   xp:16, score:22, ghost:true, dodgeChance:0.45, alpha:0.55 },
  bouncer:   { name:'Bouncer',   color:0xffdd44, radius:14, hp: w=>45+w*7,   spd: w=>65+w*2,   xp:15, score:20, bouncer:true },
  elite:     { name:'Elite',     color:0xff8800, radius:20, hp: w=>200+w*30, spd: w=>65+w*2.5, xp:40, score:50, armored:true, armorMult:0.6 },
};

// Wave spawn table: wave → array of [type, weight]
export function getSpawnTable(wave) {
  const table = [['basic', 50]];
  if (wave >= 2)  table.push(['fast',      25]);
  if (wave >= 3)  table.push(['spitter',   15]);
  if (wave >= 4)  table.push(['tank',      10]);
  if (wave >= 5)  table.push(['exploder',  12]);
  if (wave >= 6)  table.push(['armored',   10]);
  if (wave >= 7)  table.push(['shaman',    8]);
  if (wave >= 8)  table.push(['crawler',   20]);
  if (wave >= 9)  table.push(['bomber',    10]);
  if (wave >= 10) table.push(['screamer',  10]);
  if (wave >= 11) table.push(['berserker', 8]);
  if (wave >= 12) table.push(['ghost',     8]);
  if (wave >= 13) table.push(['bouncer',   8]);
  if (wave >= 14) table.push(['elite',     5]);
  return table;
}

export function pickEnemyType(wave) {
  const table = getSpawnTable(wave);
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [type, weight] of table) {
    r -= weight;
    if (r <= 0) return type;
  }
  return 'basic';
}
