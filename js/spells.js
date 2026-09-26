// range in meters. speed in meters-per-second at REAL time scale (see combat.js
// TIME_SCALES) — this is deliberately slow so a cast takes real minutes to land.
// castTime/cooldown/buffDuration are always real-time (never scaled).
export const SPELLS = [
  {
    id: 'spark_bolt', name: 'Spark Bolt', icon: '✨', type: 'attack',
    manaCost: 5, castTime: 0.4, speed: 1.0, power: 10, range: 260, cooldown: 1.5,
    description: "A mote of raw magic. Slow, but every wizard knows it.",
  },
  {
    id: 'ward_shield', name: 'Ward Shield', icon: '🛡️', type: 'defend',
    manaCost: 9, buffDuration: 6000, mitigation: 0.6, cooldown: 5,
    description: 'Raises a shimmering ward that blunts the next hit.',
  },
];

const BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

export function getSpell(id) {
  return BY_ID[id];
}
