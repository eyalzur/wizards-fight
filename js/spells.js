// range/speed in meters and meters-per-second. castTime/cooldown in seconds.
export const SPELLS = [
  {
    id: 'spark_bolt', name: 'Spark Bolt', icon: '✨', element: 'arcane', type: 'attack',
    manaCost: 5, castTime: 0.4, speed: 55, power: 10, range: 260, cooldown: 1.5,
    description: "A quick mote of raw magic. Every wizard's first trick.",
  },
  {
    id: 'fireball', name: 'Fireball', icon: '🔥', element: 'fire', type: 'attack',
    manaCost: 14, castTime: 0.9, speed: 35, power: 24, range: 300, cooldown: 3.5,
    description: 'A blazing orb that scorches on impact.',
  },
  {
    id: 'frost_shard', name: 'Frost Shard', icon: '❄️', element: 'ice', type: 'attack',
    manaCost: 11, castTime: 0.6, speed: 42, power: 18, range: 280, cooldown: 2.5,
    description: 'A shard of enchanted ice, sharp and cold.',
  },
  {
    id: 'thunder_jab', name: 'Thunder Jab', icon: '⚡', element: 'lightning', type: 'attack',
    manaCost: 15, castTime: 0.2, speed: 130, power: 20, range: 220, cooldown: 3.5,
    description: 'A crackling bolt that streaks almost too fast to dodge.',
  },
  {
    id: 'thornwhip', name: 'Thornwhip', icon: '🌿', element: 'nature', type: 'attack',
    manaCost: 10, castTime: 0.5, speed: 38, power: 16, range: 250, cooldown: 2,
    description: 'Living vines lash out at your foe.',
  },
  {
    id: 'arcane_missile', name: 'Arcane Missile', icon: '🔮', element: 'arcane', type: 'attack',
    manaCost: 12, castTime: 0.4, speed: 48, power: 19, range: 280, cooldown: 2.5,
    description: 'A homing mote of pure arcane force.',
  },
  {
    id: 'ward_shield', name: 'Ward Shield', icon: '🛡️', element: 'arcane', type: 'defend',
    manaCost: 9, buffDuration: 6000, mitigation: 0.6, cooldown: 5,
    description: 'Raises a shimmering ward that blunts the next hit.',
  },
  {
    id: 'swift_step', name: 'Swift Step', icon: '💨', element: 'arcane', type: 'defend',
    manaCost: 12, buffDuration: 5000, dodgeChance: 0.7, cooldown: 7,
    description: 'A burst of speed to slip past incoming magic.',
  },
  {
    id: 'minor_renewal', name: 'Minor Renewal', icon: '💚', element: 'nature', type: 'heal',
    manaCost: 16, healAmount: 24, cooldown: 9,
    description: 'A gentle pulse of restorative nature magic.',
  },
];

const BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

export function getSpell(id) {
  return BY_ID[id];
}
