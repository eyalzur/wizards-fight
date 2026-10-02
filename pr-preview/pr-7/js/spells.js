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
    // Proactive stance: raise it ahead of time, it softens every hit that
    // lands while it's up, and it isn't used up by any single hit.
    id: 'ward_shield', name: 'Ward Shield', icon: '🛡️', type: 'shield',
    manaCost: 18, buffDuration: 120000, mitigation: 0.5, cooldown: 25,
    description: 'Raise a ward that softens every hit for as long as it holds.',
  },
  {
    // Reactive counter: cast it in the moment you see a specific curse
    // incoming to negate that one spell outright, before it lands.
    id: 'counterspell', name: 'Counterspell', icon: '🌀', type: 'dispel',
    manaCost: 14, cooldown: 20,
    description: 'Shatter one incoming curse the instant you see it coming.',
  },
];

const BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

export function getSpell(id) {
  return BY_ID[id];
}
