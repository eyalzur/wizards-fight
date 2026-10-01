import { loadState, saveState, clearState } from './state.js';
import { ELEMENTS, createWizard } from './wizard.js';
import { createNpc } from './npc.js';
import { getSpell } from './spells.js';
import * as geo from './geo.js';
import * as combat from './combat.js';
import * as map from './map.js';
import * as ui from './ui.js';
import * as economy from './economy.js';
import { openSignPad } from './signpad.js';
import { uid } from './utils.js';

const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 }; // fallback demo spot if location is denied
const NPC_COUNT = 9;
const ATTACK_SPELL = getSpell('spark_bolt');
const SHIELD_SPELL = getSpell('ward_shield');
const BUY_CONFIRM_MS = 3000;
const FLASH_MS = 800;

let shopConfirm = null; // { itemId, expiresAt } — the "tap again to buy" state lives here, not in the DOM
let shopFlash = null; // { itemId, until }
let lastGems = 0;

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
    projectiles: [],
    log: [],
    openSheet: null,
    playerDown: false,
    playerRespawnAt: null,
    spawnCenter: { ...center },
    maxWalkMeters: 250,
    timeScale: combat.TIME_SCALES.real,
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
  world = {
    player: saved.player,
    npcs: saved.npcs || [],
    projectiles: [],
    log: [],
    openSheet: null,
    playerDown: saved.player.hp <= 0,
    playerRespawnAt: saved.player.hp <= 0 ? Date.now() + 3000 : null,
    spawnCenter: saved.spawnCenter || saved.player.position,
    maxWalkMeters: 250,
    timeScale: saved.timeScale || combat.TIME_SCALES.real,
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
    onLogToggle: ui.toggleLog,
    onShop: () => openShop(),
    onGemsTap: () => {
      world.openSheet = { kind: 'self' };
      render();
    },
    onReset: () => {
      if (window.confirm('Start over with a brand new wizard? This erases your current wizard.')) {
        clearState();
        location.reload();
      }
    },
  });
  lastGems = world.player.gems;
  setInterval(gameTick, 250);
  render();
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
    else saveState(world);
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

function onSheetAttack(npc) {
  const spell = ATTACK_SPELL;
  const chk = combat.canCastSpell(world.player, spell, Date.now());
  if (!chk.ok) { ui.toast(chk.reason); return; }
  openSignPad({
    title: `${spell.icon} ${spell.name}`,
    onDone: (mult) => {
      const res = combat.castAttack(world.player, npc, spell.id, world, Date.now(), mult);
      if (!res.ok) ui.toast(res.reason);
      else world.openSheet = null;
      saveState(world);
      render();
    },
  });
}

function onSheetShield() {
  const chk = combat.canCastSpell(world.player, SHIELD_SPELL, Date.now());
  if (!chk.ok) { ui.toast(chk.reason); return; }
  openSignPad({
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
  world.openSheet = { kind: 'shop', slot };
  render();
}

function onCollect() {
  const n = economy.collectPot(world.player);
  if (n > 0) {
    lastGems = world.player.gems;
    ui.showGemPop(n);
  }
  saveState(world);
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
      return {
        item,
        ...st,
        delta: st.over ? economy.gearDelta(item, st.over) : {},
        tiers: items.length,
        confirming: confirmId === item.id,
        flash: flashId === item.id,
      };
    }),
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
    gear: { wand: economy.equippedGear(p, 'wand'), robe: economy.equippedGear(p, 'robe') },
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
  return { kind: 'npc', wizard: npc, atkSpell: ATTACK_SPELL, canAttack, reason, dist: Math.round(dist) };
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

  if (world.openSheet?.kind === 'npc') {
    const t = world.npcs.find((n) => n.id === world.openSheet.id);
    const visible = t && t.hp > 0 && geo.distanceMeters(player.position, t.position) <= player.senseRange;
    if (!visible) world.openSheet = null;
  }

  map.updatePlayer(player.position, player, onPlayerClick);
  map.updateSenseCircle(player.position, player.senseRange);
  map.renderNpcs(visibleNpcs, onNpcClick, world.openSheet?.kind === 'npc' ? world.openSheet.id : null);
  map.renderProjectiles(world.projectiles, now);

  ui.renderHud(player, { potReady: economy.potWhole(player) >= 1, fast: world.timeScale > combat.TIME_SCALES.real });
  ui.setSpeedLabel(world.timeScale > combat.TIME_SCALES.real ? '⚡ Fast' : '🐢 Real');
  ui.renderLog(world.log);

  let sheetData = null;
  if (world.openSheet?.kind === 'self') sheetData = buildSelfSheetData(now);
  else if (world.openSheet?.kind === 'shop') sheetData = buildShopData(now);
  else if (world.openSheet?.kind === 'npc') {
    const npc = world.npcs.find((n) => n.id === world.openSheet.id);
    if (npc) sheetData = buildNpcSheetData(npc, now);
  }
  ui.renderWizardSheet(sheetData, {
    onClose: () => {
      world.openSheet = null;
      render();
    },
    onAttack: sheetData?.kind === 'npc' ? () => onSheetAttack(sheetData.wizard) : null,
    onShield: onSheetShield,
    onCollect,
    onOpenShop: () => openShop(),
    onShopSlot,
    onShopBuy,
  });

  const incoming = world.projectiles.filter((p) => !p.resolved && p.targetId === player.id && p.casterId !== player.id);
  ui.renderDefendPrompts(incoming, player, now, onCounterspell);

  if (world.playerDown) ui.showDownOverlay();
  else ui.hideDownOverlay();
}
