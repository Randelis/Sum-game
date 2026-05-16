export interface WaveEventDef {
  id:          string;
  name:        string;
  description: string;
  weight:      number;
  minWave:     number;
  apply:       (ctx: WaveEventContext) => void;
}

export interface WaveEventContext {
  wave:          number;
  requestSpawn:  (type: string, count: number) => void;
  addEventTimer: (ms: number, fn: () => void) => void;
  showAnnounce:  (text: string, durationMs?: number) => void;
}

export const WAVE_EVENTS: WaveEventDef[] = [
  {
    id:'horde', name:'HORDE!', description:'A massive wave of zombies appears!',
    weight:30, minWave:2,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      const count = 8 + Math.floor(wave * 0.8);
      requestSpawn('basic', count);
      showAnnounce('HORDE!');
    },
  },
  {
    id:'runnerRush', name:'RUNNER RUSH', description:'Fast zombies incoming!',
    weight:25, minWave:3,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      requestSpawn('fast', 6 + Math.floor(wave * 0.5));
      showAnnounce('RUNNER RUSH!');
    },
  },
  {
    id:'healerSupport', name:'HEALER SQUAD', description:'Shamans are protecting the horde!',
    weight:15, minWave:6,
    apply:({ requestSpawn, showAnnounce }) => {
      requestSpawn('shaman', 3);
      requestSpawn('basic', 5);
      showAnnounce('HEALER SQUAD!');
    },
  },
  {
    id:'tanksAdvance', name:'TANK ADVANCE', description:'Heavy brutes charge forward!',
    weight:20, minWave:5,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      requestSpawn('tank', 3 + Math.floor(wave * 0.2));
      showAnnounce('TANK ADVANCE!');
    },
  },
  {
    id:'spitterRain', name:'ACID RAIN', description:'Spitters take up positions!',
    weight:18, minWave:4,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      requestSpawn('spitter', 5 + Math.floor(wave * 0.3));
      showAnnounce('ACID RAIN!');
    },
  },
  {
    id:'kamikazePack', name:'KAMIKAZE PACK', description:'Exploders are rushing in!',
    weight:20, minWave:5,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      requestSpawn('exploder', 6 + Math.floor(wave * 0.4));
      showAnnounce('KAMIKAZE PACK!');
    },
  },
  {
    id:'ghostInvasion', name:'GHOST INVASION', description:'Ethereal forms phase through walls!',
    weight:12, minWave:12,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      requestSpawn('ghost', 5 + Math.floor(wave * 0.3));
      showAnnounce('GHOST INVASION!');
    },
  },
  {
    id:'berserkerRampage', name:'BERSERKER RAMPAGE', description:'Raging monsters charge!',
    weight:14, minWave:10,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      requestSpawn('berserker', 4 + Math.floor(wave * 0.2));
      showAnnounce('BERSERKER RAMPAGE!');
    },
  },
  {
    id:'eliteSquad', name:'ELITE SQUAD', description:'Elite enemies have arrived!',
    weight:8, minWave:15,
    apply:({ requestSpawn, showAnnounce }) => {
      requestSpawn('elite', 2);
      requestSpawn('fast', 4);
      showAnnounce('ELITE SQUAD!');
    },
  },
  {
    id:'mixedAssault', name:'MIXED ASSAULT', description:'Coordinated attack from all sides!',
    weight:22, minWave:7,
    apply:({ wave, requestSpawn, showAnnounce }) => {
      requestSpawn('basic', 4);
      requestSpawn('fast', 3);
      requestSpawn('tank', 2);
      if (wave >= 8) requestSpawn('spitter', 2);
      showAnnounce('MIXED ASSAULT!');
    },
  },
];

export function pickWaveEvent(wave: number): WaveEventDef | null {
  const eligible = WAVE_EVENTS.filter(e => e.minWave <= wave);
  if (eligible.length === 0) return null;
  let total = eligible.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const ev of eligible) {
    r -= ev.weight;
    if (r <= 0) return ev;
  }
  return eligible[eligible.length - 1];
}
