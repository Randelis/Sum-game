// Boss definitions. abilities are ids handled by Boss.js.
// Each ability: { id, cd (s), isHard, windupMs }
export const BOSSES = [
  {
    id: 'zombieKing',
    name: 'Zombie King',
    subtitle: 'Ruler of the Undead',
    color: 0xcc4444,
    glowColor: 0xff6666,
    hp: w => 800 + w * 120,
    spd: 70,
    contactDmg: 25,
    abilities: [
      { id:'slam',    cd:3.5, isHard:true,  windupMs:550 },
      { id:'summon',  cd:5.0, isHard:false, windupMs:700 },
      { id:'roar',    cd:6.0, isHard:false, windupMs:400 },
    ],
    combos: [
      { name:'👑 Royal Fury',   steps:['slam','slam','roar'] },
      { name:'👑 Dark Summons', steps:['summon','roar','slam'] },
    ],
    ultimate: { id:'ultimateStomp', windupMs:2000 },
  },
  {
    id: 'toxicMutant',
    name: 'Toxic Mutant',
    subtitle: 'Harbinger of Plague',
    color: 0x44cc44,
    glowColor: 0x88ff88,
    hp: w => 700 + w * 100,
    spd: 85,
    contactDmg: 22,
    abilities: [
      { id:'poisonCloud', cd:3.0, isHard:false, windupMs:600 },
      { id:'spitVolley',  cd:2.5, isHard:false, windupMs:400 },
      { id:'charge',      cd:5.0, isHard:true,  windupMs:700 },
    ],
    combos: [
      { name:'☠️ Plague Burst', steps:['poisonCloud','spitVolley','spitVolley'] },
      { name:'☠️ Toxic Rush',   steps:['charge','poisonCloud'] },
    ],
    ultimate: { id:'ultimatePestilence', windupMs:2000 },
  },
  {
    id: 'ironGolem',
    name: 'Iron Golem',
    subtitle: 'Unstoppable Force',
    color: 0x888888,
    glowColor: 0xaaaaaa,
    hp: w => 1200 + w * 160,
    spd: 55,
    contactDmg: 35,
    abilities: [
      { id:'charge',      cd:4.0, isHard:true,  windupMs:800 },
      { id:'shockwave',   cd:4.5, isHard:true,  windupMs:600 },
      { id:'slam',        cd:3.0, isHard:false, windupMs:500 },
    ],
    combos: [
      { name:'⚙️ Iron Crush', steps:['charge','shockwave'] },
      { name:'⚙️ Quake',     steps:['slam','shockwave','slam'] },
    ],
    ultimate: { id:'ultimateEarthquake', windupMs:2000 },
  },
  {
    id: 'necromancer',
    name: 'Necromancer',
    subtitle: 'Lord of Death',
    color: 0x6633cc,
    glowColor: 0xaa66ff,
    hp: w => 750 + w * 110,
    spd: 75,
    contactDmg: 20,
    abilities: [
      { id:'teleport',  cd:3.5, isHard:false, windupMs:500 },
      { id:'deathRay',  cd:4.5, isHard:true,  windupMs:900 },
      { id:'summon',    cd:5.0, isHard:false, windupMs:600 },
    ],
    combos: [
      { name:'💀 Shadow Strike', steps:['teleport','deathRay'] },
      { name:'💀 Dark Ritual',   steps:['summon','summon','deathRay'] },
    ],
    ultimate: { id:'ultimateDeathField', windupMs:2000 },
  },
  {
    id: 'hellfireDemon',
    name: 'Hellfire Demon',
    subtitle: 'Bringer of Inferno',
    color: 0xff4400,
    glowColor: 0xff8844,
    hp: w => 900 + w * 130,
    spd: 80,
    contactDmg: 28,
    abilities: [
      { id:'fireRing',    cd:3.5, isHard:false, windupMs:500 },
      { id:'firePillars', cd:5.0, isHard:true,  windupMs:700 },
      { id:'charge',      cd:4.0, isHard:true,  windupMs:600 },
    ],
    combos: [
      { name:'🔥 Hellstorm', steps:['fireRing','firePillars'] },
      { name:'🔥 Inferno',   steps:['charge','fireRing','fireRing'] },
    ],
    ultimate: { id:'ultimateInferno', windupMs:2000 },
  },
  {
    id: 'spiderQueen',
    name: 'Spider Queen',
    subtitle: 'Mother of Swarms',
    color: 0x883333,
    glowColor: 0xcc6666,
    hp: w => 850 + w * 115,
    spd: 90,
    contactDmg: 24,
    abilities: [
      { id:'webSnare',    cd:3.5, isHard:false, windupMs:450 },
      { id:'spiderSpawn', cd:5.0, isHard:false, windupMs:600 },
      { id:'poisonSpit',  cd:2.5, isHard:false, windupMs:400 },
    ],
    combos: [
      { name:'🕷️ Web Trap',   steps:['webSnare','spiderSpawn'] },
      { name:'🕷️ Swarm Rush', steps:['spiderSpawn','spiderSpawn','poisonSpit'] },
    ],
    ultimate: { id:'ultimateSwarm', windupMs:2000 },
  },
];

export function getBossForWave(wave) {
  const idx = Math.floor(wave / 5) - 1;
  return BOSSES[idx % BOSSES.length];
}
