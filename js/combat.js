import { getSpell } from './spells.js';
import { distanceMeters } from './geo.js';
import { growLevel } from './wizard.js';
import { respawnNpc } from './npc.js';
import { uid, log, pick, randRange } from './utils.js';

const TEMPERAMENT_AGGRO = { passive: 0.06, neutral: 0.16, aggressive: 0.32 };
const TEMPERAMENT_DEFEND = { passive: 0.7, neutral: 0.45, aggressive: 0.2 };

function findWizard(world, id) {
  if (world.player.id === id) return world.player;
  return world.npcs.find((n) => n.id === id);
}

export function canCastSpell(wizard, spell, now) {
  if (!wizard.spells.includes(spell.id)) return { ok: false, reason: `You don't know ${spell.name}.` };
  if (wizard.mana < spell.manaCost) return { ok: false, reason: `Not enough mana for ${spell.name}.` };
  if ((wizard.cooldowns[spell.id] || 0) > now) return { ok: false, reason: `${spell.name} is still recharging.` };
  return { ok: true };
}

export function castAttack(caster, target, spellId, world, now) {
  const spell = getSpell(spellId);
  if (!spell || spell.type !== 'attack') return { ok: false, reason: 'That spell cannot be used to attack.' };
  const chk = canCastSpell(caster, spell, now);
  if (!chk.ok) return chk;
  if (target.hp <= 0) return { ok: false, reason: `${target.name} is already defeated.` };
  const dist = distanceMeters(caster.position, target.position);
  if (dist > Math.min(spell.range, caster.senseRange)) {
    return { ok: false, reason: `${target.name} is out of range for ${spell.name}.` };
  }
  caster.mana -= spell.manaCost;
  caster.cooldowns[spell.id] = now + spell.cooldown * 1000;
  const castMs = spell.castTime * 1000 * (caster.castTimeMult || 1);
  const travelMs = (dist / spell.speed) * 1000;
  const projectile = {
    id: uid(),
    casterId: caster.id,
    targetId: target.id,
    spellId,
    startPos: { ...caster.position },
    endPos: { ...target.position },
    castStart: now,
    travelStart: now + castMs,
    impactTime: now + castMs + travelMs,
    resolved: false,
  };
  world.projectiles.push(projectile);
  log(world, `${caster.avatar} ${caster.name} hurls ${spell.icon} ${spell.name} at ${target.name}!`);
  if (target.isNPC) maybeNpcDefend(target, now);
  return { ok: true, projectile };
}

export function castDefend(wizard, spellId, now) {
  const spell = getSpell(spellId);
  if (!spell || spell.type !== 'defend') return { ok: false, reason: 'That spell cannot defend.' };
  const chk = canCastSpell(wizard, spell, now);
  if (!chk.ok) return chk;
  wizard.mana -= spell.manaCost;
  wizard.cooldowns[spell.id] = now + spell.cooldown * 1000;
  wizard.activeBuffs.push({
    id: uid(),
    type: spell.dodgeChance ? 'dodge' : 'mitigate',
    mitigation: spell.mitigation,
    dodgeChance: spell.dodgeChance,
    expiresAt: now + (spell.buffDuration || 6000),
  });
  return { ok: true };
}

export function castHeal(wizard, spellId, now) {
  const spell = getSpell(spellId);
  if (!spell || spell.type !== 'heal') return { ok: false, reason: 'That spell cannot heal.' };
  const chk = canCastSpell(wizard, spell, now);
  if (!chk.ok) return chk;
  wizard.mana -= spell.manaCost;
  wizard.cooldowns[spell.id] = now + spell.cooldown * 1000;
  wizard.hp = Math.min(wizard.maxHP, wizard.hp + spell.healAmount);
  return { ok: true };
}

function consumeActiveBuff(wizard, now) {
  wizard.activeBuffs = wizard.activeBuffs.filter((b) => b.expiresAt > now);
  if (!wizard.activeBuffs.length) return null;
  return wizard.activeBuffs.shift();
}

function maybeNpcDefend(npc, now) {
  const chance = TEMPERAMENT_DEFEND[npc.temperament] ?? 0.4;
  const options = npc.spells
    .map(getSpell)
    .filter((s) => s && s.type === 'defend' && npc.mana >= s.manaCost && (npc.cooldowns[s.id] || 0) <= now);
  if (options.length && Math.random() < chance) {
    const s = pick(options);
    castDefend(npc, s.id, now);
  }
}

function resolveImpact(world, projectile, now) {
  const caster = findWizard(world, projectile.casterId);
  const target = findWizard(world, projectile.targetId);
  const spell = getSpell(projectile.spellId);
  if (!target || target.hp <= 0) {
    log(world, `The ${spell.name} fizzles out — no one left to strike.`);
    return;
  }
  let dmg = Math.max(1, Math.round(spell.power * (caster ? caster.power : 1) - (target.defense || 0)));
  const buff = consumeActiveBuff(target, now);
  let note = '';
  if (buff) {
    if (buff.type === 'mitigate') {
      dmg = Math.round(dmg * (1 - buff.mitigation));
      note = ` 🛡️ Blunted by ${target.name}'s ward!`;
    } else if (buff.type === 'dodge') {
      if (Math.random() < buff.dodgeChance) {
        dmg = 0;
        note = ` 💨 ${target.name} dodges completely!`;
      } else {
        note = ` 💨 ${target.name} tries to dodge but is caught!`;
      }
    }
  }
  target.hp = Math.max(0, target.hp - dmg);
  log(world, `${spell.icon} ${spell.name} strikes ${target.name} for ${dmg} damage!${note}`);
  if (target.hp <= 0) handleDefeat(world, target, caster, now);
}

function handleDefeat(world, wizard, killer, now) {
  if (wizard.isNPC) {
    wizard.defeated = true;
    wizard.respawnAt = now + 30000 + Math.random() * 20000;
    log(world, `💀 ${wizard.name} has been defeated!`);
    if (killer && !killer.isNPC) {
      const xpGain = 15 + wizard.level * 5;
      killer.xp += xpGain;
      log(world, `⭐ You gain ${xpGain} XP.`);
      checkLevelUp(world, killer);
    }
  } else {
    world.playerDown = true;
    world.playerRespawnAt = now + 4000;
    log(world, `💀 You have been defeated! Recovering your strength...`);
  }
}

function checkLevelUp(world, wizard) {
  let leveled = false;
  while (wizard.xp >= wizard.xpToNext) {
    wizard.xp -= wizard.xpToNext;
    growLevel(wizard);
    leveled = true;
  }
  if (leveled) {
    wizard.hp = wizard.maxHP;
    wizard.mana = wizard.maxMana;
    log(world, `🌟 ${wizard.name} reached level ${wizard.level}!`);
  }
}

export function tick(world, now) {
  for (const w of [world.player, ...world.npcs]) {
    if (w.hp <= 0) continue;
    if (now >= w.nextManaRegen) {
      w.mana = Math.min(w.maxMana, w.mana + 1);
      w.nextManaRegen = now + (w.manaRegenMs || 2000);
    }
    if (now >= w.nextHpRegen) {
      w.hp = Math.min(w.maxHP, w.hp + 1);
      w.nextHpRegen = now + 4000;
    }
  }

  if (world.player.hp > 0 && !world.playerDown) {
    for (const npc of world.npcs) {
      if (npc.hp <= 0) continue;
      if (now < (npc.nextAiCheck || 0)) continue;
      npc.nextAiCheck = now + randRange(2500, 5000);
      const chance = TEMPERAMENT_AGGRO[npc.temperament] ?? 0.15;
      if (Math.random() > chance) continue;
      const dist = distanceMeters(npc.position, world.player.position);
      const usable = npc.spells
        .map(getSpell)
        .filter((s) => s && s.type === 'attack' && dist <= s.range && npc.mana >= s.manaCost && (npc.cooldowns[s.id] || 0) <= now);
      if (usable.length) castAttack(npc, world.player, pick(usable).id, world, now);
    }
  }

  for (const p of world.projectiles) {
    if (!p.resolved && now >= p.impactTime) {
      resolveImpact(world, p, now);
      p.resolved = true;
    }
  }
  world.projectiles = world.projectiles.filter((p) => !p.resolved);

  const center = world.spawnCenter || world.player.position;
  for (const npc of world.npcs) {
    if (npc.defeated && npc.respawnAt && now >= npc.respawnAt) {
      respawnNpc(npc, center, 60, world.player.senseRange * 2);
      log(world, `🔮 ${npc.name} returns, magic restored.`);
    }
  }

  if (world.playerDown && world.playerRespawnAt && now >= world.playerRespawnAt) {
    world.player.hp = Math.round(world.player.maxHP * 0.6);
    world.player.mana = Math.round(world.player.maxMana * 0.6);
    world.playerDown = false;
    world.playerRespawnAt = null;
    log(world, `✨ You catch your breath and rejoin the fray.`);
  }
}
