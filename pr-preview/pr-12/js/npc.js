import { createWizard, ELEMENTS } from './wizard.js';
import { randomPointInAnnulus } from './geo.js';
import { uid, pick, randInt } from './utils.js';

// NPCs don't go through the create-screen avatar picker, so they get a
// portrait assigned directly here instead: one of the 5 distinct hood
// artworks — the same serialized `wizard.avatar` format js/ui.js's AVATARS
// choices produce (see js/portraits.js), picked at random per NPC rather
// than tied to their element.
const NPC_AVATARS = ['portrait-hood-a', 'portrait-hood-b', 'portrait-hood-c', 'portrait-hood-d', 'portrait-hood-e'];

const FIRST = [
  'Zed', 'Miro', 'Talon', 'Fenn', 'Iggy', 'Puck', 'Ravi', 'Suri', 'Milo', 'Nix',
  'Ozzy', 'Fable', 'Juno', 'Wren', 'Dash', 'Kiko', 'Bex', 'Orin', 'Lux', 'Sable',
];
const TITLES = [
  'the Sparkwing', 'the Grim', 'the Swift', 'Emberheart', 'Frostwhisper', 'Stormcaller',
  'Thornback', 'the Bold', 'Moonshade', 'the Clumsy', 'Nightbrew', 'the Curious',
  'Sunforge', 'the Wanderer', 'Puddlejump', 'the Fearless', 'Shadowquill', 'the Loud',
];

export function generateNpcName() {
  return `${pick(FIRST)} ${pick(TITLES)}`;
}

const TEMPERAMENTS = ['passive', 'passive', 'neutral', 'neutral', 'neutral', 'aggressive'];

export function createNpc({ id, center, minR, maxR, playerLevel }) {
  const element = pick(ELEMENTS).id;
  const level = Math.max(1, playerLevel + randInt(-1, 1));
  const npc = createWizard({ id: id || uid(), name: generateNpcName(), element, isNPC: true, level });
  npc.avatar = pick(NPC_AVATARS);
  npc.position = randomPointInAnnulus(center.lat, center.lng, minR, maxR);
  npc.temperament = pick(TEMPERAMENTS);
  npc.nextAiCheck = 0;
  npc.defeated = false;
  npc.respawnAt = null;
  return npc;
}

// ---------- Nemesis System ----------
// Whichever NPC most recently defeated the player becomes their "Nemesis"
// (world.player.nemesisId, set/cleared in combat.js:handleDefeat). It gets a
// modest combat edge while it holds the title, and — unlike every other NPC,
// which keeps its spawn-time level forever across respawns — it re-syncs its
// level toward the player's current level each time it respawns, so it stays
// a relevant rival instead of falling behind.
//
// Both the boost and the level stats are recomputed fresh from the NPC's
// element + current level (via createWizard, the same math createNpc uses at
// first spawn) rather than stored as a separate delta on the NPC. That keeps
// this to one new persisted field (nemesisId) instead of two, and makes
// applying/clearing the boost idempotent — calling either twice in a row
// (e.g. the same NPC re-confirming its title) can't double-stack or drift.
const NEMESIS_HP_MULT = 1.2; // +20% max HP while holding the title
const NEMESIS_POWER_MULT = 1.15; // +15% power while holding the title
const NEMESIS_DEFENSE_BONUS = 2; // flat +2 defense while holding the title

function baseStatsAtCurrentLevel(npc) {
  return createWizard({ element: npc.element, isNPC: true, level: npc.level });
}

export function applyNemesisBoost(npc) {
  const base = baseStatsAtCurrentLevel(npc);
  npc.maxHP = Math.round(base.maxHP * NEMESIS_HP_MULT);
  npc.maxMana = base.maxMana;
  npc.power = +(base.power * NEMESIS_POWER_MULT).toFixed(2);
  npc.defense = +(base.defense + NEMESIS_DEFENSE_BONUS).toFixed(2);
  npc.hp = npc.maxHP;
  npc.mana = npc.maxMana;
}

export function clearNemesisBoost(npc) {
  const base = baseStatsAtCurrentLevel(npc);
  npc.maxHP = base.maxHP;
  npc.maxMana = base.maxMana;
  npc.power = base.power;
  npc.defense = base.defense;
  npc.hp = Math.min(npc.hp, npc.maxHP);
  npc.mana = Math.min(npc.mana, npc.maxMana);
}

// `nemesis`, when passed as `{ playerLevel }`, means this NPC currently holds
// the Nemesis title: instead of just refilling HP/mana at its original
// level, it re-rolls its level toward the player's current one (the same
// +/-1 spread createNpc uses at first spawn) and re-applies its boost for
// that new level — see the Nemesis System comment above.
export function respawnNpc(npc, center, minR, maxR, nemesis) {
  npc.position = randomPointInAnnulus(center.lat, center.lng, minR, maxR);
  npc.defeated = false;
  npc.respawnAt = null;
  npc.cooldowns = {};
  npc.shieldBuff = null;
  if (nemesis) {
    npc.level = Math.max(1, nemesis.playerLevel + randInt(-1, 1));
    applyNemesisBoost(npc); // also syncs hp/mana to the new level's maxima
  } else {
    npc.hp = npc.maxHP;
    npc.mana = npc.maxMana;
  }
}
