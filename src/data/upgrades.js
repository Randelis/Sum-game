export const UPGRADES = [
  { id:'damage',      icon:'⚔️',  name:'Damage',       desc:'+20% bullet damage',        max:10 },
  { id:'fireRate',    icon:'🔥',  name:'Fire Rate',    desc:'+18% fire rate',             max:10 },
  { id:'bulletCount', icon:'💫',  name:'Multifire',    desc:'+1 bullet per shot',         max:4  },
  { id:'bulletSpeed', icon:'💨',  name:'Velocity',     desc:'+18% bullet speed',          max:8  },
  { id:'pierce',      icon:'🗡️',  name:'Pierce',       desc:'+1 pierce through enemies',  max:5  },
  { id:'range',       icon:'🎯',  name:'Range',        desc:'+20% bullet range',          max:8  },
  { id:'aoe',         icon:'💥',  name:'AOE',          desc:'+12 explosion radius',       max:5  },
  { id:'regen',       icon:'💚',  name:'Regen',        desc:'+0.5 HP/sec',                max:6  },
  { id:'maxHp',       icon:'❤️',  name:'Vitality',     desc:'+30 max HP',                 max:8  },
  { id:'speed',       icon:'👟',  name:'Agility',      desc:'+12% move speed',            max:8  },
  { id:'magnet',      icon:'🧲',  name:'Magnet',       desc:'+35% XP pickup radius',      max:5  },
  { id:'multishot',   icon:'↗️',  name:'Multishot',    desc:'Fire in extra directions',   max:3  },
  { id:'critChance',  icon:'⚡',  name:'Crit Chance',  desc:'+10% crit chance',           max:10 },
  { id:'critMult',    icon:'💢',  name:'Crit Power',   desc:'+0.5x crit multiplier',      max:5  },
  { id:'shield',      icon:'🛡️',  name:'Shield',       desc:'+1 shield charge',           max:3  },
  { id:'vampirism',   icon:'🩸',  name:'Vampirism',    desc:'+1% HP drain on hit',        max:5  },
  { id:'napalm',      icon:'🔥',  name:'Napalm',       desc:'AOE leaves ground fire',     max:4  },
  { id:'ammoMax',     icon:'📦',  name:'Ammo Max',     desc:'+30% magazine size',         max:5  },
  { id:'reloadSpd',   icon:'🔄',  name:'Reload Speed', desc:'-15% reload time',           max:5  },
  { id:'deathTouch',  icon:'💀',  name:'Death Touch',  desc:'+5% instant kill chance',    max:3  },
  { id:'dashCd',      icon:'💨',  name:'Dash CD',      desc:'-25% dash cooldown',         max:4  },
];

export function pickRandomUpgrades(playerUpgrades, count = 3) {
  const available = UPGRADES.filter(u => (playerUpgrades[u.id] || 0) < u.max);
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function applyUpgrade(player, upgradeId) {
  const lvl = (player.upgrades[upgradeId] || 0) + 1;
  player.upgrades[upgradeId] = lvl;
  switch (upgradeId) {
    case 'maxHp':      player.maxHp += 30; player.hp = Math.min(player.hp + 30, player.maxHp); break;
    case 'shield':     player.shieldCharges += 1; break;
    default: break; // stats computed dynamically from upgrade levels
  }
}
