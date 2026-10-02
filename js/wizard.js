import { uid } from './utils.js';

// `icon` is kept as a plain-text emoji for places that render flavor text
// (toasts, log lines); `symbolId` points at the matching single-stroke SVG
// in index.html's sprite sheet, used anywhere an icon renders in its own
// box (the create screen's element picker) — see js/ui.js.
export const ELEMENTS = [
  { id: 'fire', label: 'Fire', icon: '🔥', symbolId: 'el-fire', color: '#ff6b4a', desc: 'Blazing power and bold offense.' },
  { id: 'ice', label: 'Ice', icon: '❄️', symbolId: 'el-ice', color: '#6fd8ff', desc: 'Cold resilience and steady defense.' },
  { id: 'lightning', label: 'Lightning', icon: '⚡', symbolId: 'el-lightning', color: '#ffe066', desc: 'Sharp reflexes and keen senses.' },
  { id: 'nature', label: 'Nature', icon: '🌿', symbolId: 'el-nature', color: '#6bff8f', desc: 'Deep reserves and healing magic.' },
  { id: 'arcane', label: 'Arcane', icon: '🔮', symbolId: 'el-arcane', color: '#b98bff', desc: 'Swift casting and clever tricks.' },
];

export function getElement(id) {
  return ELEMENTS.find((e) => e.id === id) || ELEMENTS[0];
}

const BASE_STATS = { maxHP: 100, maxMana: 60, power: 1.0, defense: 0, senseRange: 170, manaRegenMs: 2000 };

// Real wizards (player or a remote player) hit far harder than NPCs — NPCs
// are meant to go down in 2-3 Spark Bolts, not be a slow grind. Applied once
// at creation to `power`, not to spell.power directly, so NPC-vs-player
// damage (NPCs casting at you, or at each other conceptually) is untouched —
// only a non-NPC caster's own damage output is boosted.
const PLAYER_POWER_MULT = 4.5;

const ELEMENT_MODS = {
  fire: { power: 1.15, maxMana: -10 },
  ice: { maxHP: 20, defense: 3 },
  lightning: { senseRange: 40, maxHP: -10 },
  nature: { maxMana: 15, manaRegenMs: -500 },
  arcane: { castTimeMult: -0.15 },
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

// Every wizard starts with the same spells regardless of element: one attack,
// plus two distinct defenses (a proactive shield stance and a reactive
// counterspell). Element only flavors stats for now — more spells come later.
export function startingSpellsFor() {
  return ['spark_bolt', 'ward_shield', 'counterspell'];
}

export function createWizard({ id, name, avatar, element, isNPC = false, level = 1 }) {
  const stats = baseStatsFor(element);
  if (!isNPC) stats.power = +(stats.power * PLAYER_POWER_MULT).toFixed(2);
  const wizard = {
    id: id || uid(),
    name: name || 'Wizard',
    avatar: avatar || 'portrait-hood-a',
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
    spells: startingSpellsFor(),
    cooldowns: {},
    shieldBuff: null,
    position: null,
    nextManaRegen: 0,
    nextHpRegen: 0,
    // Runes & Powers (see below) — carried on every wizard for shape
    // consistency with xp/level (NPCs never earn or spend them; only
    // main.js's kill handling credits the player).
    runes: 0,
    spellPowerLevel: 0,
    spellRecoveryLevel: 0,
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

// ---------- Runes & Powers ----------
// Permanent, purchasable attribute upgrades bought with Runes (earned on NPC
// kills, see combat.js:handleDefeat). No sell-back/respec — level only goes
// up. Each upgrade caps at maxLevel so the total bonus stays in the same
// ballpark as one normal level-up's worth of the analogous stat (see
// docs/FEATURES.md for the exact numbers and reasoning).
export const POWER_UPGRADE = {
  field: 'spellPowerLevel',
  label: 'Spell Power',
  icon: '💥',
  desc: "Increases Spark Bolt's damage.",
  baseCost: 40,
  perLevelBonus: 0.05, // +5% Spark Bolt damage per level
  maxLevel: 3, // cap: +15% total damage
};

export const RECOVERY_UPGRADE = {
  field: 'spellRecoveryLevel',
  label: 'Spell Recovery',
  icon: '⏳',
  desc: "Reduces Spark Bolt's cooldown.",
  baseCost: 35,
  perLevelSeconds: 0.1, // -0.1s Spark Bolt cooldown per level
  maxLevel: 3, // cap: -0.3s total (1.5s -> 1.2s)
  floorSeconds: 0.5, // defensive floor; not reachable at current maxLevel, guards future tuning
};

function levelOf(upgrade, wizard) {
  return wizard[upgrade.field] || 0;
}

// cost = base * 1.5^purchasesSoFar — same exponential shape as the XP
// level-up curve (growLevel's `xpToNext * 1.35`), just its own base/rate.
export function upgradeCost(upgrade, wizard) {
  return Math.round(upgrade.baseCost * Math.pow(1.5, levelOf(upgrade, wizard)));
}

export function canUpgrade(upgrade, wizard) {
  return levelOf(upgrade, wizard) < upgrade.maxLevel;
}

export function buyUpgrade(upgrade, wizard) {
  if (!canUpgrade(upgrade, wizard)) return { ok: false, reason: `${upgrade.label} is already maxed.` };
  const cost = upgradeCost(upgrade, wizard);
  if ((wizard.runes || 0) < cost) {
    return { ok: false, reason: `Need ${cost - (wizard.runes || 0)} more Runes.` };
  }
  wizard.runes -= cost;
  wizard[upgrade.field] = levelOf(upgrade, wizard) + 1;
  return { ok: true };
}

// Dev tooling only (see docs/ARCHITECTURE.md "Dev/testing tooling: ?qa=1") —
// directly sets an upgrade's level, bypassing runes/cost entirely, but still
// clamped to [0, maxLevel] so QA can reach any *valid* level (including the
// maxed cap) and never an out-of-range one — the cap itself is what needs to
// stay testable as a real boundary.
export function setUpgradeLevel(upgrade, wizard, level) {
  const n = Math.round(Number(level));
  const clamped = Math.max(0, Math.min(upgrade.maxLevel, Number.isFinite(n) ? n : 0));
  wizard[upgrade.field] = clamped;
  return clamped;
}

// Applied at cast time in combat.js — multiplies the caster's existing
// `power` stat the same way spell.power already does, just gated behind a
// permanent purchase instead of an element/level bonus.
export function spellPowerMultiplier(wizard) {
  return 1 + levelOf(POWER_UPGRADE, wizard) * POWER_UPGRADE.perLevelBonus;
}

// Applied at cast time in combat.js in place of the spell's raw `cooldown`.
export function spellCooldownSeconds(baseCooldownSeconds, wizard) {
  const reduced = baseCooldownSeconds - levelOf(RECOVERY_UPGRADE, wizard) * RECOVERY_UPGRADE.perLevelSeconds;
  return Math.max(RECOVERY_UPGRADE.floorSeconds, reduced);
}
