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
};

// slot ids, in the order the shop shows them
export const GEAR_SLOTS = [
  { id: 'wand', label: 'Wand', icon: '🪄' },
  { id: 'robe', label: 'Robe', icon: '🧥' },
];

// mods are ADDITIVE on top of element + level stats. Keys: power, maxHP,
// defense. Defense is subtracted from every hit (damage = round(10 x power -
// defense), min 1) so keep it tiny and put the value into maxHP.
// A slot's items form a strict ladder: tier N is only buyable once tier N-1 is
// owned. To add tiers 3-5 (or a new slot/kind) append rows here — nothing else
// needs to change.
export const GEAR = [
  { id: 'willow_wand', slot: 'wand', tier: 1, name: 'Willow Wand', icon: '🪄', price: 100, mods: { power: 0.08 } },
  { id: 'moonstone_wand', slot: 'wand', tier: 2, name: 'Moonstone Wand', icon: '🪄', price: 350, mods: { power: 0.18 } },
  { id: 'apprentice_robe', slot: 'robe', tier: 1, name: 'Apprentice Robe', icon: '🧥', price: 100, mods: { maxHP: 15, defense: 1 } },
  { id: 'moonweave_robe', slot: 'robe', tier: 2, name: 'Moonweave Robe', icon: '🧥', price: 350, mods: { maxHP: 30, defense: 1 } },
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

export function gearBonus(equipment) {
  const total = { power: 0, maxHP: 0, defense: 0 };
  for (const slot of GEAR_SLOTS) {
    const item = getGear(equipment?.[slot.id]);
    if (!item) continue;
    for (const k of Object.keys(total)) total[k] += item.mods[k] || 0;
  }
  total.power = +total.power.toFixed(2);
  return total;
}

// wizard.power / maxHP / defense hold the EFFECTIVE values (so combat.js needs
// no changes) and wizard.gearApplied records how much of them is gear. Syncing
// swaps the old bonus for the new one, so it is idempotent and survives
// growLevel (which just adds to the same fields).
export function syncGear(wizard) {
  const prev = wizard.gearApplied || { power: 0, maxHP: 0, defense: 0 };
  const next = gearBonus(wizard.equipment);
  wizard.power = +(wizard.power - prev.power + next.power).toFixed(2);
  const dHP = next.maxHP - prev.maxHP;
  wizard.maxHP += dHP;
  if (wizard.hp > 0) wizard.hp = Math.min(wizard.maxHP, Math.max(1, wizard.hp + Math.max(0, dHP)));
  wizard.defense = wizard.defense - prev.defense + next.defense;
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

// What `item` adds over `over` (the currently equipped item in the same slot).
export function gearDelta(item, over) {
  const d = {};
  for (const k of ['power', 'maxHP', 'defense']) {
    const v = (item.mods[k] || 0) - (over?.mods[k] || 0);
    if (v) d[k] = +v.toFixed(2);
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
  wizard.seenPotHint = !!wizard.seenPotHint;
  // gearApplied must be a plain object of finite numbers, else treat it as
  // (a brand-new wizard has none, and gets {0,0,0} here since equipment is empty)
  // already-applied (recomputed from equipment) so syncGear can never produce
  // NaN and never double-counts gear into power/maxHP/defense.
  const ga = wizard.gearApplied;
  const gaOk =
    ga && typeof ga === 'object' && !Array.isArray(ga) &&
    ['power', 'maxHP', 'defense'].every((k) => Number.isFinite(ga[k]));
  if (!gaOk) wizard.gearApplied = gearBonus(wizard.equipment);
  syncGear(wizard);
  if (!hadAnchor) wizard.lastAccrualAt = now;
  accrue(wizard, now, 1);
}
