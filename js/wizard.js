import { uid } from './utils.js';

export const ELEMENTS = [
  { id: 'fire', label: 'Fire', icon: '🔥', color: '#ff6b4a', desc: 'Blazing power and bold offense.' },
  { id: 'ice', label: 'Ice', icon: '❄️', color: '#6fd8ff', desc: 'Cold resilience and steady defense.' },
  { id: 'lightning', label: 'Lightning', icon: '⚡', color: '#ffe066', desc: 'Sharp reflexes and keen senses.' },
  { id: 'nature', label: 'Nature', icon: '🌿', color: '#6bff8f', desc: 'Deep reserves and healing magic.' },
  { id: 'arcane', label: 'Arcane', icon: '🔮', color: '#b98bff', desc: 'Swift casting and clever tricks.' },
];

export function getElement(id) {
  return ELEMENTS.find((e) => e.id === id) || ELEMENTS[0];
}

const BASE_STATS = { maxHP: 100, maxMana: 60, power: 1.0, defense: 0, senseRange: 170, manaRegenMs: 2000 };

const ELEMENT_MODS = {
  fire: { power: 1.15, maxMana: -10 },
  ice: { maxHP: 20, defense: 3 },
  lightning: { senseRange: 40, maxHP: -10 },
  nature: { maxMana: 15, manaRegenMs: -500 },
  arcane: { castTimeMult: -0.15 },
};

const ELEMENT_BONUS_SPELLS = {
  fire: ['fireball'],
  ice: ['frost_shard'],
  lightning: ['thunder_jab'],
  nature: ['thornwhip', 'minor_renewal'],
  arcane: ['arcane_missile', 'swift_step'],
};

export function baseStatsFor(elementId) {
  const mods = ELEMENT_MODS[elementId] || {};
  const stats = { ...BASE_STATS };
  if (mods.power) stats.power = +(stats.power * mods.power).toFixed(2);
  if (mods.maxMana) stats.maxMana += mods.maxMana;
  if (mods.maxHP) stats.maxHP += mods.maxHP;
  if (mods.defense) stats.defense += mods.defense;
  if (mods.senseRange) stats.senseRange += mods.senseRange;
  if (mods.manaRegenMs) stats.manaRegenMs += mods.manaRegenMs;
  stats.maxMana = Math.max(20, stats.maxMana);
  stats.castTimeMult = 1 + (mods.castTimeMult || 0);
  return stats;
}

export function startingSpellsFor(elementId) {
  return ['spark_bolt', 'ward_shield', ...(ELEMENT_BONUS_SPELLS[elementId] || [])];
}

export function createWizard({ id, name, avatar, element, isNPC = false, level = 1 }) {
  const stats = baseStatsFor(element);
  const wizard = {
    id: id || uid(),
    name: name || 'Wizard',
    avatar: avatar || '🧙',
    element,
    isNPC,
    level: 1,
    xp: 0,
    xpToNext: 50,
    maxHP: stats.maxHP,
    hp: stats.maxHP,
    maxMana: stats.maxMana,
    mana: stats.maxMana,
    power: stats.power,
    defense: stats.defense,
    senseRange: stats.senseRange,
    manaRegenMs: stats.manaRegenMs,
    castTimeMult: stats.castTimeMult,
    spells: startingSpellsFor(element),
    cooldowns: {},
    activeBuffs: [],
    position: null,
    nextManaRegen: 0,
    nextHpRegen: 0,
  };
  for (let i = 1; i < level; i++) growLevel(wizard);
  wizard.hp = wizard.maxHP;
  wizard.mana = wizard.maxMana;
  return wizard;
}

export function growLevel(wizard) {
  wizard.level += 1;
  wizard.maxHP += 12;
  wizard.maxMana += 6;
  wizard.power = +(wizard.power + 0.05).toFixed(2);
  wizard.xpToNext = Math.round(wizard.xpToNext * 1.35);
}
