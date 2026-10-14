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

export function respawnNpc(npc, center, minR, maxR) {
  npc.hp = npc.maxHP;
  npc.mana = npc.maxMana;
  npc.position = randomPointInAnnulus(center.lat, center.lng, minR, maxR);
  npc.defeated = false;
  npc.respawnAt = null;
  npc.cooldowns = {};
  npc.shieldBuff = null;
}
