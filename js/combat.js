import { getSpell } from './spells.js';
import { distanceMeters } from './geo.js';
import { growLevel, spellPowerMultiplier, spellCooldownSeconds } from './wizard.js';
import { respawnNpc, applyNemesisBoost, clearNemesisBoost } from './npc.js';
import { awardKillBonus } from './economy.js';
import { COUNTER_MIN_MULT } from './sign.js';
import { uid, log, pick, randRange } from './utils.js';

const TEMPERAMENT_AGGRO = { passive: 0.06, neutral: 0.16, aggressive: 0.32 };
const TEMPERAMENT_DEFEND = { passive: 0.7, neutral: 0.45, aggressive: 0.2 };

// Nemesis System (see npc.js for the stat-boost/releveling half): defeating
// your own Nemesis back grants a one-time bonus on that kill's XP/Runes/
// Crystals. 1.75x — inside the "noticeable but not economy-breaking" 1.5-2x
// range considered — picked as the midpoint since there's no play data yet
// to tune off of.
const NEMESIS_DEFEAT_BONUS_MULT = 1.75;

// A spell's `speed` in spells.js is tuned for real time (a cast takes real
// minutes to land). world.timeScale divides travel time so testing doesn't
// require waiting minutes per cast — real play should use TIME_SCALES.real.
export const TIME_SCALES = { real: 1, fast: 30 };

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

// powerMult comes from the sign drawing (see sign.js); NPCs cast at 1.
export function castAttack(caster, target, spellId, world, now, powerMult = 1) {
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
  // Spell Recovery (Runes & Powers, see wizard.js) permanently shaves time
  // off the caster's own cooldown for whatever attack spell they cast.
  caster.cooldowns[spell.id] = now + spellCooldownSeconds(spell.cooldown, caster) * 1000;
  const castMs = spell.castTime * 1000 * (caster.castTimeMult || 1);
  // Casts against a real player always travel at real speed, regardless of
  // the local Fast/Real testing toggle — a device's own speed preference
  // shouldn't let it cheat another player's travel-time window.
  const scale = target.isRemote ? TIME_SCALES.real : (world.timeScale || TIME_SCALES.real);
  const travelMs = ((dist / spell.speed) * 1000) / scale;
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
    powerMult,
    resolved: false,
    isRemoteTarget: !!target.isRemote,
    targetName: target.isRemote ? target.name : undefined,
  };
  world.projectiles.push(projectile);
  // No caster.avatar prefix here (unlike before the v1 theme pass): avatar
  // is now a portrait symbol id, not something with a plain-text form.
  log(world, `${caster.name} hurls ${spell.icon} ${spell.name} at ${target.name}!`);
  if (target.isNPC) maybeNpcDefend(target, projectile, now, world);
  return { ok: true, projectile };
}

// Proactive stance: raise it ahead of time; it's not consumed by any single
// hit, only by its own expiry (see isShieldActive).
export function castShield(wizard, spellId, now, powerMult = 1) {
  const spell = getSpell(spellId);
  if (!spell || spell.type !== 'shield') return { ok: false, reason: 'That spell cannot shield you.' };
  const chk = canCastSpell(wizard, spell, now);
  if (!chk.ok) return chk;
  wizard.mana -= spell.manaCost;
  wizard.cooldowns[spell.id] = now + spell.cooldown * 1000;
  wizard.shieldBuff = { mitigation: Math.min(0.9, spell.mitigation * powerMult), expiresAt: now + spell.buffDuration };
  return { ok: true };
}

export function isShieldActive(wizard, now) {
  return !!wizard.shieldBuff && wizard.shieldBuff.expiresAt > now;
}

// Reactive counter: negates one specific incoming projectile outright,
// resolved immediately rather than waiting for its scheduled impact.
// A sloppy sign (powerMult below COUNTER_MIN_MULT) spends the mana but fizzles.
export function castCounterspell(wizard, projectile, spellId, world, now, powerMult = 1) {
  const spell = getSpell(spellId);
  if (!spell || spell.type !== 'dispel') return { ok: false, reason: 'That spell cannot counter a curse.' };
  if (!projectile || projectile.resolved || projectile.targetId !== wizard.id) {
    return { ok: false, reason: 'Nothing to counter.' };
  }
  const chk = canCastSpell(wizard, spell, now);
  if (!chk.ok) return chk;
  wizard.mana -= spell.manaCost;
  wizard.cooldowns[spell.id] = now + spell.cooldown * 1000;
  if (powerMult < COUNTER_MIN_MULT) {
    log(world, `🌀 ${wizard.name}'s Counterspell fizzles — the sign was too sloppy!`);
    return { ok: true, fizzled: true };
  }
  projectile.resolved = true;
  const caster = findWizard(world, projectile.casterId);
  const atkSpell = getSpell(projectile.spellId);
  log(world, `🌀 ${wizard.name} shatters ${caster ? caster.name + "'s" : 'the'} ${atkSpell.icon} ${atkSpell.name} before it lands!`);
  world.projectiles = world.projectiles.filter((p) => p.id !== projectile.id);
  return { ok: true };
}

function maybeNpcDefend(npc, projectile, now, world) {
  const chance = TEMPERAMENT_DEFEND[npc.temperament] ?? 0.4;
  if (Math.random() >= chance) return;
  const dispel = npc.spells
    .map(getSpell)
    .find((s) => s && s.type === 'dispel' && npc.mana >= s.manaCost && (npc.cooldowns[s.id] || 0) <= now);
  if (dispel) {
    castCounterspell(npc, projectile, dispel.id, world, now);
    return;
  }
  const shield = npc.spells
    .map(getSpell)
    .find((s) => s && s.type === 'shield' && npc.mana >= s.manaCost && (npc.cooldowns[s.id] || 0) <= now);
  if (shield && !isShieldActive(npc, now)) castShield(npc, shield.id, now);
}

// A cast against a real player can't be resolved here: this device doesn't
// have authoritative knowledge of the target's live defense/shield state
// (that only exists on their own device), and there's no server to ask.
// Instead, record what the *target's own client* needs to work out the
// damage itself next time it's running (see applyPendingHit below) — this
// keeps combat.js free of any network code; main.js does the actual
// Firebase write by draining world.outgoingHits after each tick.
function resolveImpact(world, projectile, now) {
  const spell = getSpell(projectile.spellId);
  if (projectile.isRemoteTarget) {
    const caster = findWizard(world, projectile.casterId);
    if (!world.outgoingHits) world.outgoingHits = [];
    world.outgoingHits.push({
      targetId: projectile.targetId,
      casterId: world.myUid || (caster ? caster.id : 'unknown'),
      casterName: caster ? caster.name : 'A rival wizard',
      spellId: projectile.spellId,
      // Includes the caster's Spell Power Rune bonus (see spellPowerMultiplier
      // in wizard.js) — only the caster's own device knows that multiplier,
      // so it has to be baked in here rather than recomputed by the target.
      // The sign-drawing multiplier (sign.js) is baked in for the same reason.
      casterPower: (caster ? caster.power * spellPowerMultiplier(caster) : 1) * (projectile.powerMult ?? 1),
      impactAt: now,
    });
    log(world, `${spell.icon} ${spell.name} rockets into the distance toward ${projectile.targetName || 'your rival'} — it should strike home any moment now.`);
    return;
  }
  const caster = findWizard(world, projectile.casterId);
  const target = findWizard(world, projectile.targetId);
  if (!target || target.hp <= 0) {
    log(world, `The ${spell.name} fizzles out — no one left to strike.`);
    return;
  }
  // Spell Power (Runes & Powers, see wizard.js) permanently multiplies the
  // caster's own `power` stat; the sign-drawing multiplier (sign.js) scales
  // this one cast on top of that.
  const powerMult = (caster ? caster.power * spellPowerMultiplier(caster) : 1) * (projectile.powerMult ?? 1);
  let dmg = Math.max(1, Math.round(spell.power * powerMult - (target.defense || 0)));
  let note = '';
  if (isShieldActive(target, now)) {
    dmg = Math.max(1, Math.round(dmg * (1 - target.shieldBuff.mitigation))); // a hit never drops below 1, even through a ward
    note = ` 🛡️ Softened by ${target.name}'s ward!`;
  }
  target.hp = Math.max(0, target.hp - dmg);
  log(world, `${spell.icon} ${spell.name} strikes ${target.name} for ${dmg} damage!${note}`);
  if (target.hp <= 0) handleDefeat(world, target, caster, now);
}

// The other half of the remote-attack flow: this device is the target, and
// is applying a hit that was recorded (by the attacker's device, via
// resolveImpact above) against world.player at some earlier, possibly much
// earlier, real time. Uses the *target's own* live defense/shieldBuff at
// `now`, exactly like a local resolveImpact would — the target's device is
// the only one with authoritative knowledge of that state, which is the
// whole reason this isn't resolved on the attacker's side.
export function applyPendingHit(world, hit, now) {
  const target = world.player;
  const spell = getSpell(hit.spellId);
  const icon = spell ? spell.icon : '✨';
  const name = spell ? spell.name : 'a spell';
  const power = spell ? spell.power : 8;
  const casterName = hit.casterName || 'A rival wizard';
  if (target.hp <= 0) {
    log(world, `${icon} ${casterName}'s ${name} fizzles — you're already down.`);
    return { dmg: 0 };
  }
  let dmg = Math.max(1, Math.round(power * (hit.casterPower || 1) - (target.defense || 0)));
  let note = '';
  if (isShieldActive(target, now)) {
    dmg = Math.max(1, Math.round(dmg * (1 - target.shieldBuff.mitigation))); // a hit never drops below 1, even through a ward
    note = ` 🛡️ Softened by your ward!`;
  }
  target.hp = Math.max(0, target.hp - dmg);
  log(world, `${icon} ${casterName}'s ${name} strikes you for ${dmg} damage!${note}`);
  if (target.hp <= 0) handleDefeat(world, target, null, now);
  return { dmg };
}

function handleDefeat(world, wizard, killer, now) {
  if (wizard.isNPC) {
    // Nemesis System: `killer` is always the player here (NPCs never attack
    // each other), so this is "did the player just defeat their own Nemesis."
    const wasNemesis = !!(killer && !killer.isNPC && wizard.id === killer.nemesisId);
    wizard.defeated = true;
    wizard.respawnAt = now + 30000 + Math.random() * 20000;
    log(world, `💀 ${wizard.name} has been defeated!`);
    if (wasNemesis) {
      killer.nemesisId = null;
      clearNemesisBoost(wizard);
      log(world, `🏆 You've defeated your Nemesis, ${wizard.name}!`);
    }
    if (killer && !killer.isNPC) {
      const bonusMult = wasNemesis ? NEMESIS_DEFEAT_BONUS_MULT : 1;
      const xpGain = Math.round((15 + wizard.level * 5) * bonusMult);
      killer.xp += xpGain;
      log(world, `⭐ You gain ${xpGain} XP.`);
      const gemsBase = awardKillBonus(killer, wizard.level);
      let gems = gemsBase;
      if (wasNemesis) {
        // awardKillBonus already added the unboosted amount; top up the
        // difference rather than changing economy.js's own formula.
        const bonusGems = Math.round(gemsBase * (NEMESIS_DEFEAT_BONUS_MULT - 1));
        killer.gems += bonusGems;
        gems += bonusGems;
      }
      log(world, `💎 You find ${gems} Mana Crystals.`);
      // Runes mirror the XP formula exactly (same defeated-NPC level,
      // nemesis bonus already baked into xpGain) — see docs/FEATURES.md
      // "Runes & Powers" for why they're a separate track.
      const runeGain = xpGain;
      killer.runes = (killer.runes || 0) + runeGain;
      log(world, `🔮 You gain ${runeGain} Runes.`);
      checkLevelUp(world, killer);
    }
  } else {
    world.playerDown = true;
    world.playerRespawnAt = now + 4000;
    log(world, `💀 You have been defeated! Recovering your strength...`);
    // Nemesis System: only a local NPC kill can set/refresh the Nemesis —
    // `killer` is null here when a remote player's pending hit defeated you
    // (see applyPendingHit/combat.js header), and that case is explicitly
    // out of scope for this pass (no full attacker identity on this device).
    if (killer && killer.isNPC) {
      const isNewNemesis = world.player.nemesisId !== killer.id;
      if (isNewNemesis) {
        const prevNemesis = world.npcs.find((n) => n.id === world.player.nemesisId);
        if (prevNemesis) clearNemesisBoost(prevNemesis);
        world.player.nemesisId = killer.id;
        log(world, `😈 ${killer.name} marks you — they are now your Nemesis.`);
      }
      applyNemesisBoost(killer); // idempotent — safe even if already your Nemesis
    }
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
  if (!world.outgoingHits) world.outgoingHits = [];
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
      const isNemesis = npc.id === world.player.nemesisId;
      respawnNpc(npc, center, 60, world.player.senseRange * 2, isNemesis ? { playerLevel: world.player.level } : null);
      log(world, isNemesis ? `😈 ${npc.name} returns, your Nemesis stronger than before.` : `🔮 ${npc.name} returns, magic restored.`);
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
