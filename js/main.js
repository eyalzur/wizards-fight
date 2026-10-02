import { loadState, saveState, clearState } from './state.js';
import { ELEMENTS, createWizard, getElement, POWER_UPGRADE, RECOVERY_UPGRADE, upgradeCost, canUpgrade, buyUpgrade, spellCooldownSeconds, setUpgradeLevel } from './wizard.js';
import { createNpc } from './npc.js';
import { getSpell } from './spells.js';
import * as geo from './geo.js';
import * as combat from './combat.js';
import * as map from './map.js';
import * as ui from './ui.js';
import * as economy from './economy.js';
import { openSignPad } from './signpad.js';
import * as multiplayer from './multiplayer.js';
import { uid } from './utils.js';

const REMOTE_SYNC_MS = 6000; // how often we push our own position/HP up
const REMOTE_REFRESH_MS = 15000; // how often we re-fetch nearby players
const PENDING_HIT_POLL_MS = 15000; // how often we check for hits that landed

const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 }; // fallback demo spot if location is denied
const NPC_COUNT = 9;
const ATTACK_SPELL = getSpell('spark_bolt');
const SHIELD_SPELL = getSpell('ward_shield');
const BUY_CONFIRM_MS = 3000;
const FLASH_MS = 800;

let shopConfirm = null; // { itemId, expiresAt } — the "tap again to buy" state lives here, not in the DOM
let shopFlash = null; // { itemId, until }
let lastGems = 0;
const seenIncoming = new Set(); // incoming projectile ids already announced to the UI

// Dev/testing tool, gated behind a URL flag, checked once at boot — never
// persisted, so it only applies to the page load it was requested on (see
// docs/ARCHITECTURE.md "Dev/testing tooling: ?qa=1").
const QA_MODE = new URLSearchParams(location.search).has('qa');
// Not literal Infinity — a plain number keeps every existing cost/affordability
// check (`>=`, subtraction, display formatting) working unchanged, and this is
// far beyond what any current or planned upgrade could ever cost.
const QA_INFINITE_RUNES = 999999999;

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
  economy.normalizeEconomy(player, Date.now());
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
    timeScale: combat.TIME_SCALES.real,
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
  // Old saves lack the economy fields; this fills them in and credits time the
  // page was closed at the Real (1x) rate only.
  economy.normalizeEconomy(saved.player, Date.now());
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
    timeScale: saved.timeScale || combat.TIME_SCALES.real,
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
    onShop: () => openShop(),
    onGemsTap: () => showSheet({ kind: 'self' }),
    // Opening the menu/log/powers closes the docked sheet (one overlay at a time).
    onBeforeOverlay: () => {
      if (world.openSheet) {
        world.openSheet = null;
        map.reveal(null);
        render();
      }
    },
    onReset: () => {
      if (window.confirm('Start over with a brand new wizard? This erases your current wizard.')) {
        clearState();
        location.reload();
      }
    },
  });
  lastGems = world.player.gems;
  if (QA_MODE) {
    ui.initQaTools({
      onSetRunes: onQaSetRunes,
      onAddRunes: onQaAddRunes,
      onSetInfiniteRunes: onQaSetInfiniteRunes,
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

// Every user-initiated sheet open goes through here: one transient overlay at
// a time, so the menu/log/powers close, and the map pans the tapped wizard into
// the (now shorter) visible area.
function showSheet(sheet, focusPos = null) {
  ui.closeOverlays();
  world.openSheet = sheet;
  render();
  map.reveal(focusPos);
}

function closeSheet() {
  world.openSheet = null;
  render();
  map.reveal(null);
}

function onMapClick(lat, lng) {
  // A tap on the map while the menu/log is open only dismisses it.
  if (ui.hasOverlayOpen()) {
    ui.closeOverlays();
    return;
  }
  if (world.openSheet) {
    closeSheet();
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
  if (world.openSheet?.kind === 'self') closeSheet();
  else showSheet({ kind: 'self' });
}

function onNpcClick(npcId) {
  if (world.playerDown) return;
  if (world.openSheet?.kind === 'npc' && world.openSheet.id === npcId) {
    closeSheet();
    return;
  }
  const npc = world.npcs.find((n) => n.id === npcId);
  showSheet({ kind: 'npc', id: npcId }, npc?.position);
}

function onRemoteClick(remoteId) {
  if (world.playerDown) return;
  if (world.openSheet?.kind === 'remote' && world.openSheet.id === remoteId) {
    closeSheet();
    return;
  }
  const remote = (world.remotePlayers || []).find((r) => r.id === remoteId);
  showSheet({ kind: 'remote', id: remoteId }, remote?.position);
}

function onSheetAttack(npc) {
  const spell = ATTACK_SPELL;
  const chk = combat.canCastSpell(world.player, spell, Date.now());
  if (!chk.ok) { ui.toast(chk.reason); return; }
  openSignPad({
    level: world.player.level,
    title: `${spell.icon} ${spell.name}`,
    onDone: (mult) => {
      const res = combat.castAttack(world.player, npc, spell.id, world, Date.now(), mult);
      if (!res.ok) ui.toast(res.reason);
      else world.openSheet = null;
      saveState(world);
      syncSelfIfEnabled();
      render();
    },
  });
}

function onSheetShield() {
  const chk = combat.canCastSpell(world.player, SHIELD_SPELL, Date.now());
  if (!chk.ok) { ui.toast(chk.reason); return; }
  openSignPad({
    level: world.player.level,
    title: `${SHIELD_SPELL.icon} ${SHIELD_SPELL.name}`,
    onDone: (mult) => {
      const res = combat.castShield(world.player, SHIELD_SPELL.id, Date.now(), mult);
      if (!res.ok) ui.toast(res.reason);
      else ui.toast(`${SHIELD_SPELL.icon} Your ward shimmers to life.`);
      saveState(world);
      render();
    },
  });
}

function onCounterspell(projectileId) {
  const spell = getSpell('counterspell');
  const chk = combat.canCastSpell(world.player, spell, Date.now());
  if (!chk.ok) { ui.toast(chk.reason); return; }
  openSignPad({
    level: world.player.level,
    title: `${spell.icon} ${spell.name}`,
    onDone: (mult) => {
      const projectile = world.projectiles.find((p) => p.id === projectileId);
      const res = combat.castCounterspell(world.player, projectile, spell.id, world, Date.now(), mult);
      if (!res.ok) ui.toast(res.reason);
      else if (res.fizzled) ui.toast('🌀 Counterspell fizzled — sloppy sign!');
      saveState(world);
      render();
    },
  });
}

function openShop(slot = 'wand') {
  shopConfirm = null;
  showSheet({ kind: 'shop', slot });
}

function onCollect() {
  const n = economy.collectPot(world.player);
  if (n > 0) {
    lastGems = world.player.gems;
    ui.showGemPop(n);
  }
  saveState(world);
  syncSelfIfEnabled();
  render();
}

function onShopSlot(slot) {
  shopConfirm = null;
  world.openSheet = { kind: 'shop', slot };
  render();
}

function onShopBuy(itemId) {
  const now = Date.now();
  if (!(shopConfirm && shopConfirm.itemId === itemId && now < shopConfirm.expiresAt)) {
    shopConfirm = { itemId, expiresAt: now + BUY_CONFIRM_MS };
    render();
    return;
  }
  shopConfirm = null;
  const res = economy.buyGear(world.player, itemId);
  if (!res.ok) {
    ui.toast(res.reason);
  } else {
    lastGems = world.player.gems;
    shopFlash = { itemId, until: now + FLASH_MS };
    ui.toast(`${res.item.icon} ${res.item.name} equipped · ${ui.describeMods(res.item.mods)}`);
    world.log.unshift(`🛍️ You buy ${res.item.icon} ${res.item.name}.`);
  }
  saveState(world);
  syncSelfIfEnabled();
  render();
}

function onShopUpgrade(slot) {
  const now = Date.now();
  const key = `up:${slot}`;
  if (!(shopConfirm && shopConfirm.itemId === key && now < shopConfirm.expiresAt)) {
    shopConfirm = { itemId: key, expiresAt: now + BUY_CONFIRM_MS };
    render();
    return;
  }
  shopConfirm = null;
  const res = economy.upgradeGear(world.player, slot);
  if (!res.ok) {
    ui.toast(res.reason);
  } else {
    lastGems = world.player.gems;
    shopFlash = { itemId: res.item.id, until: now + FLASH_MS };
    ui.toast(`${res.item.icon} ${res.item.name} +${res.level} · ${ui.describeMods(res.item.upgrade)}`);
    world.log.unshift(`⬆️ You upgrade ${res.item.icon} ${res.item.name} to +${res.level}.`);
  }
  saveState(world);
  syncSelfIfEnabled();
  render();
}

function buildShopData(now) {
  const p = world.player;
  const slot = world.openSheet.slot;
  const items = economy.gearInSlot(slot);
  const confirmId = shopConfirm && now < shopConfirm.expiresAt ? shopConfirm.itemId : null;
  const flashId = shopFlash && now < shopFlash.until ? shopFlash.itemId : null;
  return {
    kind: 'shop',
    balance: p.gems,
    slot,
    slots: economy.GEAR_SLOTS,
    intro: !p.equipment.wand && !p.equipment.robe,
    rows: items.map((item) => {
      const st = economy.gearState(p, item);
      const isEquipped = st.state === 'equipped';
      const up = isEquipped ? economy.upgradeState(p, slot) : null;
      return {
        item,
        ...st,
        up,
        upConfirming: !!up && confirmId === `up:${slot}`,
        // current total (base + upgrades) for the equipped row
        totalMods: isEquipped ? economy.gearBonus({ [slot]: item.id }, { [slot]: up.level }) : null,
        delta: st.over ? economy.gearDelta(item, st.over, economy.gearLevel(p, slot)) : {},
        overLevel: economy.gearLevel(p, slot),
        tiers: items.length,
        confirming: confirmId === item.id,
        flash: flashId === item.id,
      };
    }),
  };
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

function onQaSetInfiniteRunes() {
  world.player.runes = QA_INFINITE_RUNES;
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
    gear: {
      wand: economy.equippedGear(p, 'wand') && { ...economy.equippedGear(p, 'wand'), level: economy.gearLevel(p, 'wand') },
      robe: economy.equippedGear(p, 'robe') && { ...economy.equippedGear(p, 'robe'), level: economy.gearLevel(p, 'robe') },
    },
    treasury: {
      potWhole: economy.potWhole(p),
      canCollect: economy.potWhole(p) >= 1,
      ratePerMin: economy.potRatePerMin(p.level) * world.timeScale,
      fast: world.timeScale > combat.TIME_SCALES.real,
      scale: world.timeScale,
    },
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
  economy.accrue(world.player, now, world.timeScale);
  const p = world.player;
  if (!p.seenPotHint && economy.potWhole(p) >= 1) {
    p.seenPotHint = true;
    ui.toast('💎 Mana Crystals are gathering! Tap 💎 to collect.');
  }
  if (p.gems > lastGems) ui.showGemPop(p.gems - lastGems); // kill bonus
  lastGems = p.gems;
  drainOutgoingHits();
  render();
  if (Math.abs(now - lastSaveAt) > 2000) {
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

  ui.renderHud(playerForDisplay, { potReady: economy.potWhole(player) >= 1, fast: world.timeScale > combat.TIME_SCALES.real });
  ui.setSpeedLabel(world.timeScale > combat.TIME_SCALES.real ? '⚡ Speed: Fast' : '🐢 Speed: Real');
  ui.setRunesLabel(player.runes || 0);
  ui.renderLog(world.log);
  ui.renderPowersPanel(buildPowersData(), { onBuyPower, onBuyRecovery });
  if (QA_MODE) {
    ui.renderQaPanel(buildQaData(), { onSetPowerLevel: onQaSetPowerLevel, onSetRecoveryLevel: onQaSetRecoveryLevel });
  }

  let sheetData = null;
  if (world.openSheet?.kind === 'self') sheetData = buildSelfSheetData(now);
  else if (world.openSheet?.kind === 'shop') sheetData = buildShopData(now);
  else if (world.openSheet?.kind === 'npc') {
    const npc = world.npcs.find((n) => n.id === world.openSheet.id);
    if (npc) sheetData = buildNpcSheetData(npc, now);
  } else if (world.openSheet?.kind === 'remote') {
    const remote = (world.remotePlayers || []).find((r) => r.id === world.openSheet.id);
    if (remote) sheetData = buildRemoteSheetData(remote, now);
  }
  ui.renderWizardSheet(sheetData, {
    onClose: closeSheet,
    onAttack: sheetData?.kind === 'npc' || sheetData?.kind === 'remote' ? () => onSheetAttack(sheetData.wizard) : null,
    onShield: onSheetShield,
    onCollect,
    onOpenShop: () => openShop(),
    onShopSlot,
    onShopBuy,
    onShopUpgrade,
  });

  const incoming = world.projectiles.filter((p) => !p.resolved && p.targetId === player.id && p.casterId !== player.id);
  ui.renderDefendPrompts(incoming, player, now, onCounterspell);
  // A NEW incoming attack dismisses the ☰ menu once (the strip must be
  // reachable); sheets, the shop and other panels are left alone.
  let hasNew = false;
  for (const p of incoming) {
    if (!seenIncoming.has(p.id)) {
      seenIncoming.add(p.id);
      hasNew = true;
    }
  }
  for (const id of seenIncoming) if (!incoming.some((p) => p.id === id)) seenIncoming.delete(id);
  if (hasNew) ui.closeMenu();

  if (world.playerDown) ui.showDownOverlay();
  else ui.hideDownOverlay();
}
