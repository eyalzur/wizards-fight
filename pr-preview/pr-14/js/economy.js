// Mana Crystals economy: passive income into a Treasury pot, a kill bonus, and
// the gear catalog. Pure game logic — no DOM. This file is the only place the
// economy and gear numbers live (like spells.js for spells).
//
// ALL NUMBERS BELOW ARE FIRST GUESSES, not tuned from play data.

export const ECONOMY = {
  potBasePerMin: 8,       // crystals per real minute at Real (1x) speed...
  potPerLevelPerMin: 1.5, // ...plus this much per wizard level
  // The Fast multiplier only applies to a tick delta this small (a live,
  // foreground page ticks every 250ms). Any longer gap (closed page, sleeping
  // laptop, throttled background tab) accrues at the Real 1x rate.
  liveGapCapMs: 2000,
  maxOfflineMs: 30 * 24 * 3600 * 1000, // an anchor older than this is treated as corrupted: no credit
  killBonusBase: 3,      // kill bonus = base + npcLevel, straight to balance, never scaled
  // Item upgrades ("enhancing"): the equipped item of each slot can be raised
  // +1..+upgradeMaxLevel with 💎. Fully deterministic: no failure chance, no
  // randomness. Cost of the step from level n to n+1 is
  // round(item.price x upgradeCostFrac x upgradeCostGrowth^n).
  upgradeMaxLevel: 10,
  upgradeCostFrac: 0.06,
  upgradeCostGrowth: 1.4,
};

// slot ids, in the order the shop shows them
export const GEAR_SLOTS = [
  { id: 'wand', label: 'Wand', icon: '🪄' },
  { id: 'robe', label: 'Robe', icon: '🧥' },
];

// mods are ADDITIVE on top of element + level stats. Keys: power, maxHP,
// defense. Defense is subtracted from every hit (damage = round(10 x power -
// defense), min 1) so it stays modest next to the big maxHP numbers; combat.js
// never lets a hit (even through Ward Shield) drop below 1.
// `upgrade` is what EACH upgrade level adds on top of `mods` (same keys), so an
// item at +n gives mods + n x upgrade. A slot's items form a strict ladder:
// tier N is only buyable once tier N-1 is owned. Upgrade levels belong to the
// equipped item of a slot and reset to 0 when a higher tier replaces it. To add
// tiers or a new slot/kind append rows here — nothing else needs to change.
// ALL first guesses. Fully maxed (+10) tier 5 gear: wand +15.5 power, robe
// +580 max HP and +9 defense.
export const GEAR = [
  { id: 'willow_wand', slot: 'wand', tier: 1, name: 'Willow Wand', icon: '🪄', price: 100, mods: { power: 0.08 }, upgrade: { power: 0.02 } },
  { id: 'moonstone_wand', slot: 'wand', tier: 2, name: 'Moonstone Wand', icon: '🪄', price: 350, mods: { power: 0.18 }, upgrade: { power: 0.05 } },
  { id: 'starwood_wand', slot: 'wand', tier: 3, name: 'Starwood Wand', icon: '🪄', price: 900, mods: { power: 0.4 }, upgrade: { power: 0.15 } },
  { id: 'aurora_wand', slot: 'wand', tier: 4, name: 'Aurora Wand', icon: '🪄', price: 2200, mods: { power: 0.8 }, upgrade: { power: 0.5 } },
  { id: 'archmage_scepter', slot: 'wand', tier: 5, name: "Archmage's Scepter", icon: '🪄', price: 5000, mods: { power: 1.5 }, upgrade: { power: 1.4 } },
  { id: 'apprentice_robe', slot: 'robe', tier: 1, name: 'Apprentice Robe', icon: '🧥', price: 100, mods: { maxHP: 15, defense: 1 }, upgrade: { maxHP: 1 } },
  { id: 'moonweave_robe', slot: 'robe', tier: 2, name: 'Moonweave Robe', icon: '🧥', price: 350, mods: { maxHP: 30, defense: 1 }, upgrade: { maxHP: 2 } },
  { id: 'starsilk_robe', slot: 'robe', tier: 3, name: 'Starsilk Robe', icon: '🧥', price: 900, mods: { maxHP: 60, defense: 2 }, upgrade: { maxHP: 6, defense: 0.1 } },
  { id: 'aurora_mantle', slot: 'robe', tier: 4, name: 'Aurora Mantle', icon: '🧥', price: 2200, mods: { maxHP: 110, defense: 3 }, upgrade: { maxHP: 15, defense: 0.25 } },
  { id: 'archmage_vestments', slot: 'robe', tier: 5, name: 'Archmage Vestments', icon: '🧥', price: 5000, mods: { maxHP: 180, defense: 4 }, upgrade: { maxHP: 40, defense: 0.5 } },
];

const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export function getGear(id) {
  return GEAR_BY_ID[id] || null;
}

export function gearInSlot(slot) {
  return GEAR.filter((g) => g.slot === slot).sort((a, b) => a.tier - b.tier);
}

export function equippedGear(wizard, slot) {
  return getGear(wizard.equipment?.[slot]);
}

// Upgrade level (0..upgradeMaxLevel) of the item equipped in `slot`.
export function gearLevel(wizard, slot) {
  if (!equippedGear(wizard, slot)) return 0;
  return cleanLevel(wizard.gearLevels?.[slot]);
}

function cleanLevel(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(ECONOMY.upgradeMaxLevel, n)) : 0;
}

// ---------- income ----------

export function potRatePerMin(level) {
  return ECONOMY.potBasePerMin + ECONOMY.potPerLevelPerMin * level;
}

// Pure: crystals earned over liveMs of foreground time (scaled by timeScale)
// plus idleMs of closed/throttled time (always 1x). The multiplier is applied
// here, at accrual time, so changing Fast later can never rewrite the past.
export function potIncome(level, liveMs, idleMs, timeScale) {
  const perMs = potRatePerMin(level) / 60000;
  return perMs * (Math.max(0, liveMs) * Math.max(1, timeScale || 1) + Math.max(0, idleMs));
}

// Advance the pot to `now`. Negative deltas (clock set backwards) earn nothing
// and re-anchor lastAccrualAt to now.
export function accrue(wizard, now, timeScale) {
  const dt = now - wizard.lastAccrualAt;
  wizard.lastAccrualAt = now;
  if (!(dt > 0)) return 0;
  const live = Math.min(dt, ECONOMY.liveGapCapMs);
  const gained = potIncome(wizard.level, live, dt - live, timeScale);
  wizard.pot += gained;
  return gained;
}

export function potWhole(wizard) {
  return Math.floor(wizard.pot + 1e-9);
}

export function collectPot(wizard) {
  const n = potWhole(wizard);
  if (n <= 0) return 0;
  wizard.pot -= n;
  wizard.gems += n;
  return n;
}

export function killBonus(npcLevel) {
  return ECONOMY.killBonusBase + npcLevel;
}

export function awardKillBonus(wizard, npcLevel) {
  const n = killBonus(npcLevel);
  wizard.gems += n;
  return n;
}

// ---------- gear ----------

// Total gear bonus for an equipment + upgrade-level map ({ wand: n, robe: n }).
export function gearBonus(equipment, levels) {
  const total = { power: 0, maxHP: 0, defense: 0 };
  for (const slot of GEAR_SLOTS) {
    const item = getGear(equipment?.[slot.id]);
    if (!item) continue;
    const lvl = cleanLevel(levels?.[slot.id]);
    for (const k of Object.keys(total)) total[k] += (item.mods[k] || 0) + lvl * ((item.upgrade && item.upgrade[k]) || 0);
  }
  total.power = +total.power.toFixed(2);
  total.defense = +total.defense.toFixed(2);
  total.maxHP = Math.round(total.maxHP);
  return total;
}

// wizard.power / maxHP / defense hold the EFFECTIVE values (so combat.js needs
// no changes) and wizard.gearApplied records how much of them is gear. Syncing
// swaps the old bonus for the new one, so it is idempotent and survives
// growLevel (which just adds to the same fields).
export function syncGear(wizard) {
  const prev = wizard.gearApplied || { power: 0, maxHP: 0, defense: 0 };
  const next = gearBonus(wizard.equipment, wizard.gearLevels);
  wizard.power = +(wizard.power - prev.power + next.power).toFixed(2);
  const dHP = next.maxHP - prev.maxHP;
  wizard.maxHP += dHP;
  if (wizard.hp > 0) wizard.hp = Math.min(wizard.maxHP, Math.max(1, wizard.hp + Math.max(0, dHP)));
  wizard.defense = +(wizard.defense - prev.defense + next.defense).toFixed(2);
  wizard.gearApplied = next;
}

// State of one catalog item for this wizard:
// 'equipped' | 'owned' (lower tier, superseded) | 'locked' | 'affordable' | 'unaffordable'
export function gearState(wizard, item) {
  const cur = equippedGear(wizard, item.slot);
  const curTier = cur ? cur.tier : 0;
  if (item.tier === curTier) return { state: 'equipped' };
  if (item.tier < curTier) return { state: 'owned' };
  if (item.tier > curTier + 1) {
    const prereq = gearInSlot(item.slot).find((g) => g.tier === item.tier - 1);
    return { state: 'locked', requires: prereq };
  }
  if (wizard.gems >= item.price) return { state: 'affordable', over: cur };
  return { state: 'unaffordable', needMore: item.price - wizard.gems, over: cur };
}

// Upgrade info for the item equipped in `slot` (null if none): current level,
// max, cost of the next level, per-level bonus and whether it is affordable.
export function upgradeState(wizard, slot) {
  const item = equippedGear(wizard, slot);
  if (!item) return null;
  const level = gearLevel(wizard, slot);
  const max = ECONOMY.upgradeMaxLevel;
  if (level >= max) return { item, level, max, maxed: true };
  const cost = upgradeCost(item, level);
  const affordable = wizard.gems >= cost;
  return { item, level, max, maxed: false, cost, affordable, needMore: affordable ? 0 : cost - wizard.gems, step: item.upgrade || {} };
}

export function upgradeCost(item, level) {
  return Math.round(item.price * ECONOMY.upgradeCostFrac * Math.pow(ECONOMY.upgradeCostGrowth, level));
}

export function upgradeGear(wizard, slot) {
  const st = upgradeState(wizard, slot);
  if (!st) return { ok: false, reason: 'Nothing equipped there.' };
  if (st.maxed) return { ok: false, reason: `${st.item.name} is already +${st.max}.` };
  if (!st.affordable) return { ok: false, reason: `Need ${st.needMore} more 💎.` };
  wizard.gems -= st.cost;
  wizard.gearLevels = { wand: 0, robe: 0, ...(wizard.gearLevels || {}), [slot]: st.level + 1 };
  syncGear(wizard);
  return { ok: true, item: st.item, level: st.level + 1, cost: st.cost };
}

// What `item` (at +0, as bought) changes versus `over`, the currently equipped
// item in the same slot, INCLUDING its upgrade levels — so a heavily upgraded
// lower tier can show a negative delta against a fresh higher tier.
export function gearDelta(item, over, overLevel = 0) {
  const d = {};
  const lvl = cleanLevel(overLevel);
  for (const k of ['power', 'maxHP', 'defense']) {
    const cur = over ? (over.mods[k] || 0) + lvl * ((over.upgrade && over.upgrade[k]) || 0) : 0;
    const v = (item.mods[k] || 0) - cur;
    if (Math.abs(v) > 1e-9) d[k] = +v.toFixed(2);
  }
  return d;
}

export function buyGear(wizard, itemId) {
  const item = getGear(itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };
  const st = gearState(wizard, item);
  if (st.state === 'equipped' || st.state === 'owned') return { ok: false, reason: 'You already own that.' };
  if (st.state === 'locked') return { ok: false, reason: `Buy ${st.requires.name} first.` };
  if (st.state === 'unaffordable') return { ok: false, reason: `Need ${st.needMore} more 💎.` };
  wizard.gems -= item.price;
  wizard.equipment[item.slot] = item.id;
  wizard.gearLevels = { wand: 0, robe: 0, ...(wizard.gearLevels || {}), [item.slot]: 0 };
  syncGear(wizard);
  return { ok: true, item };
}

// ---------- save compatibility ----------

// Called for a brand-new player and for every loaded save. Fills in missing
// fields (old saves have none of them) so existing wizards load with 0 💎 and
// no gear. Offline time accrues at the Real 1x rate only.
export function normalizeEconomy(wizard, now) {
  const gems = Number(wizard.gems); // numeric strings like "50" are kept
  wizard.gems = Number.isFinite(gems) ? Math.max(0, Math.floor(gems)) : 0;
  const pot = Number(wizard.pot);
  wizard.pot = Number.isFinite(pot) ? Math.max(0, pot) : 0;
  // A missing, non-positive or implausibly old anchor is treated as corrupted:
  // re-anchor to now with no credit.
  const hadAnchor =
    Number.isFinite(wizard.lastAccrualAt) &&
    wizard.lastAccrualAt > 0 &&
    now - wizard.lastAccrualAt <= ECONOMY.maxOfflineMs;
  wizard.equipment = { wand: null, robe: null, ...(wizard.equipment || {}) };
  for (const slot of GEAR_SLOTS) {
    const item = getGear(wizard.equipment[slot.id]);
    if (!item || item.slot !== slot.id) wizard.equipment[slot.id] = null;
  }
  // Upgrade levels (new field): old saves have none -> 0. Corrupt values
  // (strings, NaN, negatives, > max) are clamped; an empty slot is always 0.
  const rawLevels = wizard.gearLevels && typeof wizard.gearLevels === 'object' ? wizard.gearLevels : {};
  wizard.gearLevels = {};
  for (const slot of GEAR_SLOTS) {
    wizard.gearLevels[slot.id] = wizard.equipment[slot.id] ? cleanLevel(rawLevels[slot.id]) : 0;
  }
  wizard.seenPotHint = !!wizard.seenPotHint;
  // gearApplied must be a plain object of finite numbers, else treat it as
  // (a brand-new wizard has none, and gets {0,0,0} here since equipment is empty)
  // already-applied (recomputed from equipment) so syncGear can never produce
  // NaN and never double-counts gear into power/maxHP/defense.
  const ga = wizard.gearApplied;
  const gaOk =
    ga && typeof ga === 'object' && !Array.isArray(ga) &&
    ['power', 'maxHP', 'defense'].every((k) => Number.isFinite(ga[k]));
  if (!gaOk) wizard.gearApplied = gearBonus(wizard.equipment, wizard.gearLevels);
  syncGear(wizard);
  if (!hadAnchor) wizard.lastAccrualAt = now;
  accrue(wizard, now, 1);
}
