import { BOSS_WAVE } from '../utils/constants';

export interface BossAbility {
  id:        string;
  cooldown:  number;   // seconds
  isHard:    boolean;  // triggers exhaustion window
  windupMs:  number;
}

export interface BossDef {
  id:            string;
  name:          string;
  subtitle:      string;
  color:         number;
  hp:            (wave: number) => number;
  speed:         number;
  contactDamage: number;
  abilities:     BossAbility[];
  ultimateMs:    number;
}

export const BOSSES: BossDef[] = [
  {
    id:'zombieKing', name:'Zombie King', subtitle:'Ruler of the Undead',
    color:0xcc4444, hp:w=>800+w*120, speed:70, contactDamage:25, ultimateMs:2000,
    abilities:[
      { id:'slam',   cooldown:3.5, isHard:true,  windupMs:550 },
      { id:'summon', cooldown:5.0, isHard:false, windupMs:700 },
      { id:'roar',   cooldown:6.0, isHard:false, windupMs:400 },
    ],
  },
  {
    id:'toxicMutant', name:'Toxic Mutant', subtitle:'Harbinger of Plague',
    color:0x44cc44, hp:w=>700+w*100, speed:85, contactDamage:22, ultimateMs:2000,
    abilities:[
      { id:'poisonCloud', cooldown:3.0, isHard:false, windupMs:600 },
      { id:'spitVolley',  cooldown:2.5, isHard:false, windupMs:400 },
      { id:'charge',      cooldown:5.0, isHard:true,  windupMs:700 },
    ],
  },
  {
    id:'ironGolem', name:'Iron Golem', subtitle:'Unstoppable Force',
    color:0x888888, hp:w=>1200+w*160, speed:55, contactDamage:35, ultimateMs:2000,
    abilities:[
      { id:'charge',    cooldown:4.0, isHard:true,  windupMs:800 },
      { id:'shockwave', cooldown:4.5, isHard:true,  windupMs:600 },
      { id:'slam',      cooldown:3.0, isHard:false, windupMs:500 },
    ],
  },
  {
    id:'necromancer', name:'Necromancer', subtitle:'Lord of Death',
    color:0x6633cc, hp:w=>750+w*110, speed:75, contactDamage:20, ultimateMs:2000,
    abilities:[
      { id:'teleport', cooldown:3.5, isHard:false, windupMs:500 },
      { id:'deathRay', cooldown:4.5, isHard:true,  windupMs:900 },
      { id:'summon',   cooldown:5.0, isHard:false, windupMs:600 },
    ],
  },
  {
    id:'hellfireDemon', name:'Hellfire Demon', subtitle:'Bringer of Inferno',
    color:0xff4400, hp:w=>900+w*130, speed:80, contactDamage:28, ultimateMs:2000,
    abilities:[
      { id:'fireRing',    cooldown:3.5, isHard:false, windupMs:500 },
      { id:'firePillars', cooldown:5.0, isHard:true,  windupMs:700 },
      { id:'charge',      cooldown:4.0, isHard:true,  windupMs:600 },
    ],
  },
  {
    id:'spiderQueen', name:'Spider Queen', subtitle:'Mother of Swarms',
    color:0x883333, hp:w=>850+w*115, speed:90, contactDamage:24, ultimateMs:2000,
    abilities:[
      { id:'webSnare',    cooldown:3.5, isHard:false, windupMs:450 },
      { id:'spiderSpawn', cooldown:5.0, isHard:false, windupMs:600 },
      { id:'poisonSpit',  cooldown:2.5, isHard:false, windupMs:400 },
    ],
  },
];

export function getBossForWave(wave: number): BossDef {
  const idx = Math.max(0, Math.floor(wave / BOSS_WAVE) - 1);
  return BOSSES[idx % BOSSES.length];
}
