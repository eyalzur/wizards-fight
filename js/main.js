import { loadState, saveState, clearState } from './state.js';
import { ELEMENTS, createWizard, getElement, POWER_UPGRADE, RECOVERY_UPGRADE, upgradeCost, canUpgrade, buyUpgrade, spellCooldownSeconds, setUpgradeLevel } from './wizard.js';
import { createNpc } from './npc.js';
import { getSpell } from './spells.js';
import * as geo from './geo.js';
import * as combat from './combat.js';
import * as map from './map.js';
import * as ui from './ui.js';
import * as multiplayer from './multiplayer.js';
import { uid } from './utils.js';

const REMOTE_SYNC_MS = 6000; // how often we push our own position/HP up
const REMOTE_REFRESH_MS = 15000; // how often we re-fetch nearby players
const PENDING_HIT_POLL_MS = 15000; // how often we check for hits that landed

const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 }; // fallback demo spot if location is denied
const NPC_COUNT = 9;
const ATTACK_SPELL = getSpell('spark_bolt');
const SHIELD_SPELL = getSpell('ward_shield');

// Dev/testing tool, gated behind a URL flag, checked once at boot — never
// persisted, so it only applies to the page load it was requested on (see
// docs/ARCHITECTURE.md "Dev/testing tooling: ?qa=1").
const QA_MODE = new URLSearchParams(location.search).has('qa');

let world = null;
let lastSaveAt = 0;

init();

function init() {
  ui.initCreateScreen(ELEMENTS, onCreateWizard);
  const saved = loadState();
  if (saved && saved.player && saved.player.position) {
    resumeGame(saved);
  }
}

function locate(onOk, onFail) {
  if (!navigator.geolocation) {
    onFail();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => onOk({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => onFail(),
    { timeout: 8000 }
  );
}

function onCreateWizard({ name, avatar, elementId }) {
  const player = createWizard({ id: uid(), name, avatar, element: elementId, isNPC: false });
  locate(
    (pos) => {
      player.position = pos;
      startGame(player, pos);
    },
    () => {
      player.position = { ...DEFAULT_CENTER };
      startGame(player, DEFAULT_CENTER);
      ui.toast('📍 Using a demo location — allow location access for the full experience!');
    }
  );
}

function startGame(player, center) {
  world = {
    player,
    npcs: [],
    remotePlayers: [],
    projectiles: [],
    outgoingHits: [],
    log: [],
    openSheet: null,
    playerDown: false,
    playerRespawnAt: null,
    spawnCenter: { ...center },
    maxWalkMeters: 250,
    timeScale: combat.TIME_SCALES.fast,
    multiplayerEnabled: false,
    myUid: null,
  };
  for (let i = 0; i < NPC_COUNT; i++) {
    world.npcs.push(createNpc({ id: uid(), center, minR: 60, maxR: player.senseRange * 2, playerLevel: player.level }));
  }
  world.log.push(`✨ ${player.name} arrives, cloak swirling, ready to test their magic.`);
  boot();
}

function resumeGame(saved) {
  // Defensive defaults for saves written before Runes & Powers existed.
  saved.player.runes = saved.player.runes || 0;
  saved.player.spellPowerLevel = saved.player.spellPowerLevel || 0;
  saved.player.spellRecoveryLevel = saved.player.spellRecoveryLevel || 0;
  world = {
    player: saved.player,
    npcs: saved.npcs || [],
    remotePlayers: [],
    projectiles: [],
    outgoingHits: [],
    log: [],
    openSheet: null,
    playerDown: saved.player.hp <= 0,
    playerRespawnAt: saved.player.hp <= 0 ? Date.now() + 3000 : null,
    spawnCenter: saved.spawnCenter || saved.player.position,
    maxWalkMeters: 250,
    timeScale: saved.timeScale || combat.TIME_SCALES.fast,
    multiplayerEnabled: false,
    myUid: null,
  };
  world.log.push(`🌙 Welcome back, ${world.player.name}.`);
  boot();
}

function boot() {
  ui.showGameScreen();
  map.initMap(world.player.position, onMapClick);
  ui.bindHud({
    onLocate: () =>
      locate(
        (pos) => {
          world.player.position = pos;
          map.recenter(pos);
          ui.toast('📍 Location updated!');
        },
        () => ui.toast('Could not get your location.')
      ),
    onFullscreen: toggleFullscreen,
    onSpeedToggle: () => {
      world.timeScale = world.timeScale > combat.TIME_SCALES.real ? combat.TIME_SCALES.real : combat.TIME_SCALES.fast;
      saveState(world);
      render();
    },
    onPowersToggle: ui.togglePowersPanel,
    onLogToggle: ui.toggleLog,
    onReset: () => {
      if (window.confirm('Start over with a brand new wizard? This erases your current wizard.')) {
        clearState();
        location.reload();
      }
    },
  });
  if (QA_MODE) {
    ui.initQaTools({
      onSetRunes: onQaSetRunes,
      onAddRunes: onQaAddRunes,
      onSetPowerLevel: onQaSetPowerLevel,
      onSetRecoveryLevel: onQaSetRecoveryLevel,
    });
  }
  setInterval(gameTick, 250);
  render();
  bootstrapMultiplayer();
}

// Multiplayer bootstrap runs after the single-player game is already up and
// rendering, and never blocks it — if there's no Firebase config, no
// network, or anything else goes wrong, initMultiplayer() resolves to
// { enabled: false } and everything below simply never runs again.
async function bootstrapMultiplayer() {
  const res = await multiplayer.initMultiplayer();
  world.multiplayerEnabled = res.enabled;
  world.myUid = res.uid;
  if (!res.enabled) return;

  await multiplayer.syncSelf(world.player);
  await refreshRemotePlayers();
  await checkForAwayHits();
  render();

  setInterval(() => multiplayer.syncSelf(world.player), REMOTE_SYNC_MS);
  setInterval(refreshRemotePlayers, REMOTE_REFRESH_MS);
  setInterval(checkForIncomingHits, PENDING_HIT_POLL_MS);
}

async function refreshRemotePlayers() {
  world.remotePlayers = await multiplayer.fetchNearbyPlayers();
  render();
}

// Batches any hits that landed while this device wasn't running into one
// summary toast pointing at the log for detail, per the "attacked while
// away" surfacing spec — this only fires from the boot path, not the live
// poll below, since a player actively watching already sees each hit land
// in the log/HUD in real time and doesn't need a toast repeating it.
async function checkForAwayHits() {
  const now = Date.now();
  const hits = await multiplayer.fetchAndClearDueHits(now);
  if (!hits.length) return;
  let total = 0;
  const names = new Set();
  for (const hit of hits) {
    const { dmg } = combat.applyPendingHit(world, hit, now);
    total += dmg;
    names.add(hit.casterName || 'an NPC');
  }
  if (total > 0) {
    ui.toast(`⚔️ While you were away, ${[...names].join(', ')} hit you for ${total} damage total. See the Spell Log for details.`);
  }
  saveState(world);
}

// Live poll while the app stays open: applies any hit whose travel timer has
// now elapsed. No toast here (see checkForAwayHits) — the log entry
// combat.applyPendingHit already writes is enough for someone watching.
async function checkForIncomingHits() {
  const now = Date.now();
  const hits = await multiplayer.fetchAndClearDueHits(now);
  if (!hits.length) return;
  for (const hit of hits) combat.applyPendingHit(world, hit, now);
  saveState(world);
  render();
}

function syncSelfIfEnabled() {
  if (world.multiplayerEnabled) multiplayer.syncSelf(world.player);
}

function drainOutgoingHits() {
  if (!world.outgoingHits || !world.outgoingHits.length) return;
  const hits = world.outgoingHits;
  world.outgoingHits = [];
  for (const hit of hits) multiplayer.sendPendingHit(hit.targetId, hit);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.().catch(() => {});
}

function onMapClick(lat, lng) {
  if (world.openSheet) {
    world.openSheet = null;
    render();
    return;
  }
  if (world.playerDown) {
    ui.toast("You're recovering — can't move yet!");
    return;
  }
  const dest = { lat, lng };
  const dist = geo.distanceMeters(world.player.position, dest);
  if (dist > world.maxWalkMeters) {
    ui.toast(`Too far to walk in one step (${Math.round(dist)}m). Try somewhere closer.`);
    return;
  }
  animateWalk(world.player, dest);
}

function animateWalk(wizard, dest) {
  const start = { ...wizard.position };
  const t0 = performance.now();
  const durationMs = Math.min(1600, 400 + geo.distanceMeters(start, dest) * 3);
  function step(now) {
    const f = Math.min(1, (now - t0) / durationMs);
    wizard.position = { lat: start.lat + (dest.lat - start.lat) * f, lng: start.lng + (dest.lng - start.lng) * f };
    if (f < 1) requestAnimationFrame(step);
    else {
      saveState(world);
      syncSelfIfEnabled();
    }
  }
  requestAnimationFrame(step);
}

function onPlayerClick() {
  world.openSheet = world.openSheet?.kind === 'self' ? null : { kind: 'self' };
  render();
}

function onNpcClick(npcId) {
  if (world.playerDown) return;
  world.openSheet = world.openSheet?.kind === 'npc' && world.openSheet.id === npcId ? null : { kind: 'npc', id: npcId };
  render();
}

function onRemoteClick(remoteId) {
  if (world.playerDown) return;
  world.openSheet = world.openSheet?.kind === 'remote' && world.openSheet.id === remoteId ? null : { kind: 'remote', id: remoteId };
  render();
}

function onSheetAttack(npc) {
  const res = combat.castAttack(world.player, npc, ATTACK_SPELL.id, world, Date.now());
  if (!res.ok) ui.toast(res.reason);
  else world.openSheet = null;
  saveState(world);
  syncSelfIfEnabled();
  render();
}

function onSheetShield() {
  const res = combat.castShield(world.player, SHIELD_SPELL.id, Date.now());
  if (!res.ok) ui.toast(res.reason);
  else ui.toast(`${SHIELD_SPELL.icon} Your ward shimmers to life.`);
  saveState(world);
  syncSelfIfEnabled();
  render();
}

function onCounterspell(projectileId) {
  const projectile = world.projectiles.find((p) => p.id === projectileId);
  const res = combat.castCounterspell(world.player, projectile, 'counterspell', world, Date.now());
  if (!res.ok) ui.toast(res.reason);
  saveState(world);
  syncSelfIfEnabled();
  render();
}

function onBuyPower() {
  const res = buyUpgrade(POWER_UPGRADE, world.player);
  ui.toast(res.ok ? '💥 Spell Power increased!' : res.reason);
  saveState(world);
  render();
}

function onBuyRecovery() {
  const res = buyUpgrade(RECOVERY_UPGRADE, world.player);
  ui.toast(res.ok ? '⏳ Spell Recovery increased!' : res.reason);
  saveState(world);
  render();
}

// ---------- QA/dev tooling (?qa=1 only) ----------
// Sets the exact value typed/clicked, still going through the same
// saveState/render path as a normal purchase — no separate storage.
function onQaSetRunes(n) {
  world.player.runes = Math.max(0, Math.round(n) || 0);
  saveState(world);
  render();
}

function onQaAddRunes(n) {
  world.player.runes = Math.max(0, (world.player.runes || 0) + n);
  saveState(world);
  render();
}

function onQaSetPowerLevel(level) {
  setUpgradeLevel(POWER_UPGRADE, world.player, level);
  saveState(world);
  render();
}

function onQaSetRecoveryLevel(level) {
  setUpgradeLevel(RECOVERY_UPGRADE, world.player, level);
  saveState(world);
  render();
}

function buildQaData() {
  const player = world.player;
  return {
    runes: player.runes || 0,
    power: { level: player.spellPowerLevel || 0, maxLevel: POWER_UPGRADE.maxLevel, label: POWER_UPGRADE.label, icon: POWER_UPGRADE.icon },
    recovery: { level: player.spellRecoveryLevel || 0, maxLevel: RECOVERY_UPGRADE.maxLevel, label: RECOVERY_UPGRADE.label, icon: RECOVERY_UPGRADE.icon },
  };
}

function buildUpgradeCardData(upgrade, effectText) {
  const player = world.player;
  const maxed = !canUpgrade(upgrade, player);
  const cost = maxed ? null : upgradeCost(upgrade, player);
  const canAfford = !maxed && (player.runes || 0) >= cost;
  return {
    icon: upgrade.icon,
    name: upgrade.label,
    desc: upgrade.desc,
    level: player[upgrade.field] || 0,
    maxLevel: upgrade.maxLevel,
    effectText,
    maxed,
    cost,
    canAfford,
    shortfall: maxed ? 0 : Math.max(0, cost - (player.runes || 0)),
  };
}

function buildPowersData() {
  const player = world.player;
  const powerPct = Math.round((player.spellPowerLevel || 0) * POWER_UPGRADE.perLevelBonus * 100);
  const cooldownS = +spellCooldownSeconds(ATTACK_SPELL.cooldown, player).toFixed(1);
  return {
    runes: player.runes || 0,
    power: buildUpgradeCardData(POWER_UPGRADE, `+${powerPct}% damage`),
    recovery: buildUpgradeCardData(RECOVERY_UPGRADE, `${cooldownS}s cooldown`),
  };
}

function buildSelfSheetData(now) {
  const p = world.player;
  const shieldActive = combat.isShieldActive(p, now);
  const shieldReady = (p.cooldowns[SHIELD_SPELL.id] || 0) <= now && p.mana >= SHIELD_SPELL.manaCost;
  let shieldReason = '';
  if (!shieldReady) {
    shieldReason = p.mana < SHIELD_SPELL.manaCost ? 'Not enough mana.' : 'Still recharging.';
  }
  return {
    kind: 'self',
    wizard: p,
    shieldSpell: SHIELD_SPELL,
    shieldActive,
    shieldRemainingS: shieldActive ? Math.ceil((p.shieldBuff.expiresAt - now) / 1000) : 0,
    shieldReady,
    shieldReason,
  };
}

function buildNpcSheetData(npc, now) {
  const player = world.player;
  const dist = geo.distanceMeters(player.position, npc.position);
  const inRange = dist <= Math.min(ATTACK_SPELL.range, player.senseRange);
  const cdReady = (player.cooldowns[ATTACK_SPELL.id] || 0) <= now;
  const canAfford = player.mana >= ATTACK_SPELL.manaCost;
  const canAttack = npc.hp > 0 && !world.playerDown && inRange && cdReady && canAfford;
  let reason = '';
  if (npc.hp <= 0) reason = 'Defeated — regrouping...';
  else if (!inRange) reason = `Out of range (${Math.round(dist)}m away).`;
  else if (!cdReady) reason = 'Recharging.';
  else if (!canAfford) reason = 'Not enough mana.';
  return {
    kind: 'npc',
    wizard: npc,
    atkSpell: ATTACK_SPELL,
    canAttack,
    reason,
    dist: Math.round(dist),
    shieldActive: combat.isShieldActive(npc, now),
  };
}

function casterColorFor(casterId) {
  if (world.player.id === casterId) return getElement(world.player.element).color;
  const npc = world.npcs.find((n) => n.id === casterId);
  return npc ? getElement(npc.element).color : '#b9903f';
}

function buildRemoteSheetData(remote, now) {
  const player = world.player;
  const dist = geo.distanceMeters(player.position, remote.position);
  const inRange = dist <= Math.min(ATTACK_SPELL.range, player.senseRange);
  const cdReady = (player.cooldowns[ATTACK_SPELL.id] || 0) <= now;
  const canAfford = player.mana >= ATTACK_SPELL.manaCost;
  const canAttack = remote.hp > 0 && !world.playerDown && inRange && cdReady && canAfford;
  let reason = '';
  if (remote.hp <= 0) reason = 'Defeated (on their end) — try again later.';
  else if (!inRange) reason = `Out of range (${Math.round(dist)}m away).`;
  else if (!cdReady) reason = 'Recharging.';
  else if (!canAfford) reason = 'Not enough mana.';
  return {
    kind: 'remote',
    wizard: remote,
    atkSpell: ATTACK_SPELL,
    canAttack,
    reason,
    dist: Math.round(dist),
    syncedAgoMs: now - (remote.lastSyncedAt || now),
  };
}

function gameTick() {
  if (!world) return;
  const now = Date.now();
  combat.tick(world, now);
  drainOutgoingHits();
  render();
  if (now - lastSaveAt > 2000) {
    saveState(world);
    lastSaveAt = now;
  }
}

function render() {
  const now = Date.now();
  const player = world.player;

  const visibleNpcs = world.npcs.filter((n) => geo.distanceMeters(player.position, n.position) <= player.senseRange);
  const visibleRemotePlayers = (world.remotePlayers || []).filter(
    (r) => r.position && geo.distanceMeters(player.position, r.position) <= player.senseRange
  );

  if (world.openSheet?.kind === 'npc') {
    const t = world.npcs.find((n) => n.id === world.openSheet.id);
    const visible = t && t.hp > 0 && geo.distanceMeters(player.position, t.position) <= player.senseRange;
    if (!visible) world.openSheet = null;
  }
  if (world.openSheet?.kind === 'remote') {
    const t = (world.remotePlayers || []).find((r) => r.id === world.openSheet.id);
    const visible = t && t.position && geo.distanceMeters(player.position, t.position) <= player.senseRange;
    if (!visible) world.openSheet = null;
  }

  // `shieldActive` is derived fresh every render, not stored on world.player/
  // npc directly — those objects get saveState()'d every 2s, so mutating them
  // would persist a stale boolean. Same pattern as `casterColor` below.
  const playerForDisplay = { ...player, shieldActive: combat.isShieldActive(player, now) };
  map.updatePlayer(player.position, playerForDisplay, onPlayerClick);
  map.updateSenseCircle(player.position, player.senseRange);
  map.renderNpcs(
    visibleNpcs.map((n) => ({ ...n, shieldActive: combat.isShieldActive(n, now) })),
    onNpcClick,
    world.openSheet?.kind === 'npc' ? world.openSheet.id : null
  );
  map.renderRemotePlayers(visibleRemotePlayers, onRemoteClick, world.openSheet?.kind === 'remote' ? world.openSheet.id : null);
  // map.js only renders — it doesn't look up wizards by id — so projectiles
  // get a `casterColor` field attached here (rendering-only, not part of
  // combat.js's persisted projectile shape) before being handed off.
  map.renderProjectiles(world.projectiles.map((p) => ({ ...p, casterColor: casterColorFor(p.casterId) })), now);

  ui.renderHud(playerForDisplay);
  ui.setSpeedLabel(world.timeScale > combat.TIME_SCALES.real ? '⚡ Fast' : '🐢 Real');
  ui.setRunesLabel(player.runes || 0);
  ui.renderLog(world.log);
  ui.renderPowersPanel(buildPowersData(), { onBuyPower, onBuyRecovery });
  if (QA_MODE) {
    ui.renderQaPanel(buildQaData(), { onSetPowerLevel: onQaSetPowerLevel, onSetRecoveryLevel: onQaSetRecoveryLevel });
  }

  let sheetData = null;
  if (world.openSheet?.kind === 'self') sheetData = buildSelfSheetData(now);
  else if (world.openSheet?.kind === 'npc') {
    const npc = world.npcs.find((n) => n.id === world.openSheet.id);
    if (npc) sheetData = buildNpcSheetData(npc, now);
  } else if (world.openSheet?.kind === 'remote') {
    const remote = (world.remotePlayers || []).find((r) => r.id === world.openSheet.id);
    if (remote) sheetData = buildRemoteSheetData(remote, now);
  }
  ui.renderWizardSheet(sheetData, {
    onClose: () => {
      world.openSheet = null;
      render();
    },
    onAttack: sheetData?.kind === 'npc' || sheetData?.kind === 'remote' ? () => onSheetAttack(sheetData.wizard) : null,
    onShield: onSheetShield,
  });

  const incoming = world.projectiles.filter((p) => !p.resolved && p.targetId === player.id && p.casterId !== player.id);
  ui.renderDefendPrompts(incoming, player, now, onCounterspell);

  if (world.playerDown) ui.showDownOverlay();
  else ui.hideDownOverlay();
}
