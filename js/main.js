import { loadState, saveState, clearState } from './state.js';
import { ELEMENTS, createWizard } from './wizard.js';
import { createNpc } from './npc.js';
import { getSpell } from './spells.js';
import * as geo from './geo.js';
import * as combat from './combat.js';
import * as map from './map.js';
import * as ui from './ui.js';
import { uid } from './utils.js';

const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 }; // fallback demo spot if location is denied
const NPC_COUNT = 9;

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
    projectiles: [],
    log: [],
    selectedTargetId: null,
    playerDown: false,
    playerRespawnAt: null,
    spawnCenter: { ...center },
    maxWalkMeters: 250,
    timeScale: combat.TIME_SCALES.fast,
  };
  for (let i = 0; i < NPC_COUNT; i++) {
    world.npcs.push(createNpc({ id: uid(), center, minR: 60, maxR: player.senseRange * 2, playerLevel: player.level }));
  }
  world.log.push(`✨ ${player.name} arrives, cloak swirling, ready to test their magic.`);
  boot();
}

function resumeGame(saved) {
  world = {
    player: saved.player,
    npcs: saved.npcs || [],
    projectiles: [],
    log: [],
    selectedTargetId: null,
    playerDown: saved.player.hp <= 0,
    playerRespawnAt: saved.player.hp <= 0 ? Date.now() + 3000 : null,
    spawnCenter: saved.spawnCenter || saved.player.position,
    maxWalkMeters: 250,
    timeScale: saved.timeScale || combat.TIME_SCALES.fast,
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
    onMenu: onMenu,
    onSpellSelect,
    onLogToggle: ui.toggleLog,
    onCancelTarget: () => {
      world.selectedTargetId = null;
      render();
    },
    onFullscreen: toggleFullscreen,
    onSpeedToggle: () => {
      world.timeScale = world.timeScale > combat.TIME_SCALES.real ? combat.TIME_SCALES.real : combat.TIME_SCALES.fast;
      saveState(world);
      render();
    },
  });
  setInterval(gameTick, 250);
  render();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.().catch(() => {});
}

function onMapClick(lat, lng) {
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

function onSpellSelect(spellId) {
  const spell = getSpell(spellId);
  const now = Date.now();
  const player = world.player;
  if (spell.type === 'attack') {
    if (!world.selectedTargetId) {
      ui.toast('Choose a wizard on the map to target first! 🎯');
      return;
    }
    const target = world.npcs.find((n) => n.id === world.selectedTargetId);
    if (!target || target.hp <= 0) {
      ui.toast('That wizard is gone. Pick another target.');
      world.selectedTargetId = null;
      render();
      return;
    }
    const res = combat.castAttack(player, target, spellId, world, now);
    if (!res.ok) ui.toast(res.reason);
  } else if (spell.type === 'defend') {
    const res = combat.castDefend(player, spellId, now);
    if (!res.ok) ui.toast(res.reason);
    else ui.toast(`${spell.icon} You raise your guard!`);
  }
  saveState(world);
  render();
}

function onMenu() {
  const ok = window.confirm('Start over with a brand new wizard? This erases your current wizard.');
  if (ok) {
    clearState();
    location.reload();
  }
}

function gameTick() {
  if (!world) return;
  const now = Date.now();
  combat.tick(world, now);
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

  if (world.selectedTargetId) {
    const t = world.npcs.find((n) => n.id === world.selectedTargetId);
    const visible = t && t.hp > 0 && geo.distanceMeters(player.position, t.position) <= player.senseRange;
    if (!visible) world.selectedTargetId = null;
  }

  map.updatePlayer(player.position, player);
  map.updateSenseCircle(player.position, player.senseRange);
  map.renderNpcs(visibleNpcs, onNpcClick, world.selectedTargetId);
  map.renderProjectiles(world.projectiles, now);

  ui.renderHud(player);
  ui.setSpeedLabel(world.timeScale > combat.TIME_SCALES.real ? '⚡ Fast' : '🐢 Real');
  ui.renderSpellbook(player, now, world.selectedTargetId);
  ui.renderTargetCard(world.selectedTargetId ? world.npcs.find((n) => n.id === world.selectedTargetId) : null);
  ui.renderLog(world.log);

  const incoming = world.projectiles.filter((p) => !p.resolved && p.targetId === player.id && p.casterId !== player.id);
  ui.renderDefendPrompts(incoming, player, now, (spellId) => {
    const res = combat.castDefend(player, spellId, Date.now());
    if (!res.ok) ui.toast(res.reason);
    render();
  });

  if (world.playerDown) ui.showDownOverlay();
  else ui.hideDownOverlay();
}

function onNpcClick(npcId) {
  if (world.playerDown) return;
  world.selectedTargetId = npcId;
  render();
}
