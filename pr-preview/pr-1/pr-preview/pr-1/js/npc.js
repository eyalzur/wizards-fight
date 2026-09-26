import { createWizard, ELEMENTS, getElement } from './wizard.js';
import { randomPointInAnnulus } from './geo.js';
import { uid, pick, randInt } from './utils.js';

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
  npc.avatar = getElement(element).icon;
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
