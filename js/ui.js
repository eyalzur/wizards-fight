import { getSpell } from './spells.js';
import { getElement } from './wizard.js';
import { avatarSvg, avatarWithRing } from './portraits.js';

// 5 selectable looks, now 5 genuinely distinct hood artworks (see
// index.html's sprite sheet) — this used to be only 3 distinct pieces of
// art with 2 of the 5 choices being a `scaleX(-1)` mirror of another; that
// read as a thin trick rather than 5 real choices, so d/e were added as
// their own silhouettes instead. `id` is what's actually stored as
// `wizard.avatar` (see js/portraits.js for the serialization).
const AVATARS = [
  { id: 'portrait-hood-a', symbol: 'portrait-hood-a', flip: false },
  { id: 'portrait-hood-b', symbol: 'portrait-hood-b', flip: false },
  { id: 'portrait-hood-c', symbol: 'portrait-hood-c', flip: false },
  { id: 'portrait-hood-d', symbol: 'portrait-hood-d', flip: false },
  { id: 'portrait-hood-e', symbol: 'portrait-hood-e', flip: false },
];

export function initCreateScreen(elements, onSubmit) {
  const avatarWrap = document.getElementById('avatar-options');
  avatarWrap.innerHTML = AVATARS.map(
    (a, i) => `<label class="avatar-choice"><input type="radio" name="avatar" value="${a.id}" ${i === 0 ? 'checked' : ''}><span>${avatarSvg(a.id)}</span></label>`
  ).join('');

  const elWrap = document.getElementById('element-options');
  elWrap.innerHTML = elements
    .map(
      (e, i) => `<label class="element-choice" style="--el-color:${e.color}">
        <input type="radio" name="element" value="${e.id}" ${i === 0 ? 'checked' : ''}>
        <svg class="element-icon"><use href="#${e.symbolId}"></use></svg>
        <span class="element-label">${e.label}</span>
        <span class="element-desc">${e.desc}</span>
      </label>`
    )
    .join('');

  document.getElementById('create-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    // Request fullscreen synchronously, inside the click gesture, or some
    // browsers refuse it once an async step (geolocation) breaks the chain.
    document.documentElement.requestFullscreen?.().catch(() => {});
    const fd = new FormData(ev.target);
    const name = (fd.get('name') || '').toString().trim().slice(0, 16) || 'Wizard';
    const avatar = fd.get('avatar') || 'portrait-hood-a';
    const elementId = fd.get('element') || 'fire';
    onSubmit({ name, avatar, elementId });
  });
}

// All top-level screens (create / game / the 3 menu-driven subscreens) share
// one show/hide mechanism: exactly one `.screen` has `.active` at a time.
// See docs/ARCHITECTURE.md "Screen layout and layering".
const SCREEN_IDS = ['screen-create', 'screen-game', 'screen-shop', 'screen-inventory', 'screen-character'];

export function showScreen(id) {
  for (const s of SCREEN_IDS) {
    document.getElementById(s)?.classList.toggle('active', s === id);
  }
}

export function showGameScreen() {
  showScreen('screen-game');
}

// Wires the "← Back to Map" button and the incoming-curse banner (see
// renderOffMapAlert) on all 3 subscreens to one callback — same handler
// either way, since tapping the alert should get you back to the map just
// as fast as the explicit back button.
export function initSubscreens(onBackToMap) {
  document.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', onBackToMap));
  document.querySelectorAll('.offmap-alert').forEach((el) => el.addEventListener('click', onBackToMap));
}

// Surfaces the same "something's incoming" signal the defend strip shows on
// the map, on the Shop/Inventory/Character screens too — so a player
// browsing one of them isn't blindsided by a curse they had no way to react
// to (see docs/ARCHITECTURE.md). `incoming` is the same array main.js already
// builds for ui.renderDefendPrompts; this only ever reads it, never the raw
// projectile shape. There's one `.offmap-alert` element per subscreen (only
// one is ever visible, since only one screen is `.active`), so patching all
// of them is cheap.
export function renderOffMapAlert(incoming, now) {
  const els = document.querySelectorAll('.offmap-alert');
  if (!incoming.length) {
    els.forEach((el) => el.classList.add('hidden'));
    return;
  }
  const sorted = [...incoming].sort((a, b) => a.impactTime - b.impactTime);
  const p = sorted[0];
  const spell = getSpell(p.spellId);
  const msLeft = Math.max(0, p.impactTime - now);
  const more = sorted.length - 1;
  const who = p.isNemesisCaster ? `😈 Nemesis ${p.casterName}` : (p.casterName || 'A rival wizard');
  const text = `⚠️ ${who}'s ${spell.icon} ${spell.name} incoming in ${formatCountdown(msLeft)}${more ? ` (+${more} more)` : ''} — tap to defend!`;
  els.forEach((el) => {
    el.classList.remove('hidden');
    if (el.textContent !== text) el.textContent = text;
  });
}

// Overlay rule: only ONE transient overlay is open at a time. "Transient"
// means the ☰ menu (+ its scrim), the log, the Runes & Powers panel and the QA
// panel; the docked wizard/shop sheet counts too, but its state lives in
// main.js's `world.openSheet`, so main hands bindHud an `onBeforeOverlay`
// hook that closes it. Opening any overlay closes the others.
let beforeOverlay = () => {};

function menuEls() {
  return {
    panel: document.getElementById('menu-panel'),
    scrim: document.getElementById('menu-scrim'),
    btn: document.getElementById('btn-menu'),
  };
}

function setMenuOpen(open) {
  const { panel, scrim, btn } = menuEls();
  panel.classList.toggle('hidden', !open);
  scrim.classList.toggle('hidden', !open);
  btn.setAttribute('aria-expanded', String(open));
}

export function closeMenu() {
  setMenuOpen(false);
}

export function isMenuOpen() {
  return !document.getElementById('menu-panel').classList.contains('hidden');
}

export function bindHud({ onLocate, onFullscreen, onSpeedToggle, onLogToggle, onReset, onGoShop, onGoInventory, onGoCharacter, onGemsTap, onBeforeOverlay }) {
  beforeOverlay = onBeforeOverlay || beforeOverlay;
  document.getElementById('btn-locate').addEventListener('click', onLocate);

  // Shop/Inventory/Character replaced the old "💎 Crystal Shop" and
  // "🔮 Runes & Powers" bottom-sheet entries — those panels' content moved
  // onto the 3 full screens these buttons navigate to (see
  // docs/ARCHITECTURE.md "Screen layout and layering").
  const menuPanel = document.getElementById('menu-panel');
  menuPanel.innerHTML = `
    <button id="menu-fullscreen">⛶ Fullscreen</button>
    <button id="menu-goshop">🛒 Shop</button>
    <button id="menu-goinventory">🎒 Inventory</button>
    <button id="menu-gocharacter">🧙 Character · 0</button>
    <button id="menu-speed">⚡ Speed: Fast</button>
    <button id="menu-log">📜 Spell Log</button>
    <div id="menu-sep" class="menu-sep" role="separator"></div>
    <button id="menu-reset" class="menu-danger">🔄 New Wizard</button>
  `;
  document.getElementById('btn-menu').addEventListener('click', () => {
    if (isMenuOpen()) {
      closeMenu();
      return;
    }
    beforeOverlay();
    closeAllBottomPanels();
    setMenuOpen(true);
  });
  // Scrim and Esc only dismiss; the scrim also swallows the tap so it can
  // never fall through to the map and walk the wizard.
  document.getElementById('menu-scrim').addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlays();
  });
  document.getElementById('menu-fullscreen').addEventListener('click', () => {
    onFullscreen();
    closeMenu();
  });
  document.getElementById('menu-goshop').addEventListener('click', () => {
    closeMenu();
    onGoShop();
  });
  document.getElementById('menu-goinventory').addEventListener('click', () => {
    closeMenu();
    onGoInventory();
  });
  document.getElementById('menu-gocharacter').addEventListener('click', () => {
    closeMenu();
    onGoCharacter();
  });
  document.getElementById('hud-gems').addEventListener('click', onGemsTap);
  // Speed is a setting you want to see change, so the menu stays open.
  document.getElementById('menu-speed').addEventListener('click', onSpeedToggle);
  document.getElementById('menu-log').addEventListener('click', () => {
    closeMenu();
    onLogToggle();
  });
  document.getElementById('menu-reset').addEventListener('click', () => {
    closeMenu();
    onReset();
  });
  document.getElementById('btn-log-close').addEventListener('click', () => {
    document.getElementById('log-panel').classList.add('hidden');
  });
}

export function setSpeedLabel(text) {
  const el = document.getElementById('menu-speed');
  if (el) el.textContent = text;
}

export function setCharacterMenuLabel(n) {
  const el = document.getElementById('menu-gocharacter');
  if (el) el.textContent = `🧙 Character · ${n}🔮`;
}

// The bottom panels (log, and — QA-mode-only — qa) sit in the same stage
// area at the same z-index, so leaving one open while opening another would
// visually stack them and let the hidden one's DOM intercept clicks meant
// for the one on top. Only one is ever shown at a time; `qa-panel` is looked
// up defensively since it doesn't exist outside ?qa=1.
function closeAllBottomPanels() {
  document.getElementById('log-panel').classList.add('hidden');
  document.getElementById('qa-panel')?.classList.add('hidden');
}

function toggleBottomPanel(id) {
  const panel = document.getElementById(id);
  const wasHidden = panel.classList.contains('hidden');
  if (wasHidden) {
    beforeOverlay(); // closes the docked sheet
    closeMenu();
  }
  closeAllBottomPanels();
  if (wasHidden) panel.classList.remove('hidden');
}

// Closes the menu and every bottom panel (not the docked sheet — that is
// main.js's state). Called when a sheet opens and when the map is tapped.
export function closeOverlays() {
  closeMenu();
  closeAllBottomPanels();
}

export function hasOverlayOpen() {
  return (
    isMenuOpen() ||
    ['log-panel', 'qa-panel'].some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    })
  );
}

export function toggleLog() {
  toggleBottomPanel('log-panel');
}

// ---------- Character screen ----------
// Consolidates what used to be scattered across the HUD/self-sheet (avatar,
// name, element, level/XP, final stats) and the old "🔮 Runes & Powers"
// bottom sheet (the two upgrade cards) onto one full screen. `data` is
// plain numbers/strings computed by main.js from wizard.js's helpers — this
// function only renders and wires clicks. Rebuilt every render() tick, same
// as the old Runes & Powers panel was — these buttons are plain "buy now"
// actions with no tap-again timing to protect, unlike the shop's two-tap
// confirm (see renderShopScreen).
export function renderCharacterScreen(data, callbacks) {
  const el = document.getElementById('character-content');
  if (!el) return;
  const { wizard: w, element } = data;
  el.innerHTML = `
    <div class="char-card">
      <div class="char-header">
        <span class="char-avatar">${avatarWithRing(w.avatar, element.color, { hp: w.hp, maxHP: w.maxHP, ringColor: 'var(--mana)', shieldActive: !!data.shieldActive })}</span>
        <div style="min-width:0">
          <div class="char-name">${w.name} <small>Lv.${w.level}</small></div>
          <div class="char-element" style="color:${element.color}">${element.icon} ${element.label}</div>
        </div>
      </div>
      <div class="bar xp-bar" title="Experience"><div class="bar-fill xp-fill" style="width:${pct(w.xp, w.xpToNext)}%"></div></div>
      <div class="char-xp-label">${w.xp}/${w.xpToNext} XP</div>
      <div class="char-stats-grid">
        <div class="char-stat"><span class="char-stat-label">❤️ HP</span><span class="char-stat-value">${w.hp}/${w.maxHP}</span></div>
        <div class="char-stat"><span class="char-stat-label">💧 Mana</span><span class="char-stat-value">${w.mana}/${w.maxMana}</span></div>
        <div class="char-stat"><span class="char-stat-label">💥 Power</span><span class="char-stat-value">${data.effectivePower}</span></div>
        <div class="char-stat"><span class="char-stat-label">🛡️ Defense</span><span class="char-stat-value">${w.defense}</span></div>
        <div class="char-stat"><span class="char-stat-label">👁️ Sense Range</span><span class="char-stat-value">${w.senseRange}m</span></div>
        <div class="char-stat"><span class="char-stat-label">⏱️ Bolt Cooldown</span><span class="char-stat-value">${data.cooldownS}s</span></div>
      </div>
    </div>
    <div class="char-powers">
      <div class="powers-balance">Balance: <strong>${data.runes}</strong> 🔮 Runes</div>
      <div class="powers-cards">${renderPowerCard(data.power, 'btn-buy-power')}${renderPowerCard(data.recovery, 'btn-buy-recovery')}</div>
    </div>`;
  if (!data.power.maxed && data.power.canAfford) {
    document.getElementById('btn-buy-power').addEventListener('click', callbacks.onBuyPower);
  }
  if (!data.recovery.maxed && data.recovery.canAfford) {
    document.getElementById('btn-buy-recovery').addEventListener('click', callbacks.onBuyRecovery);
  }
}

// ---------- Inventory screen ----------
// Deliberately just today's equipped-loadout view (2 gear slots, see
// economy.js:GEAR_SLOTS) — there's no owned-but-unequipped concept yet
// (buying gear replaces and auto-equips), so this is not a multi-item grid.
// Becomes the natural home for Phase 3 potions etc. later.
export function renderInventoryScreen(data, callbacks) {
  const el = document.getElementById('inventory-content');
  if (!el) return;
  el.innerHTML = `<div class="inv-grid">${data.slots.map((s) => inventoryRowHtml(s)).join('')}</div>`;
  el.querySelectorAll('[data-goshop]').forEach((b) => b.addEventListener('click', () => callbacks.onGoShop(b.dataset.goshop)));
}

function inventoryRowHtml(s) {
  if (!s.item) {
    return `<div class="inv-row empty">
      <span class="shop-icon">${s.slotIcon}</span>
      <div class="inv-info">
        <div class="inv-name">No ${s.slotLabel.toLowerCase()} equipped</div>
        <div class="inv-empty-note">Visit the Shop to gear up.</div>
      </div>
      <button class="inv-goshop" data-goshop="${s.slotId}">🛒 Shop</button>
    </div>`;
  }
  return `<div class="inv-row">
    <span class="shop-icon">${s.item.icon}</span>
    <div class="inv-info">
      <div class="inv-name">${s.item.name}${s.level ? ` +${s.level}` : ''}</div>
      <div class="inv-stats">${fmtMods(s.totalMods)}</div>
    </div>
    <button class="inv-goshop" data-goshop="${s.slotId}">🛒 Upgrade</button>
  </div>`;
}

function renderPowerCard(card, btnId) {
  return `
    <div class="power-card">
      <div class="power-card-head">
        <span class="power-icon">${card.icon}</span>
        <div>
          <div class="power-name">${card.name}</div>
          <div class="power-desc">${card.desc}</div>
        </div>
      </div>
      <div class="power-status">Lv.${card.level}/${card.maxLevel} · ${card.effectText}</div>
      ${
        card.maxed
          ? `<div class="power-maxed">✨ Maxed</div>`
          : `<button id="${btnId}" class="power-buy${card.canAfford ? '' : ' disabled'}">⬆ Upgrade ${card.cost}🔮</button>
             ${!card.canAfford ? `<div class="power-reason">Need ${card.shortfall} more Runes</div>` : ''}`
      }
    </div>`;
}

// ---------- QA/dev tooling (?qa=1 only — see docs/ARCHITECTURE.md) ----------
// initQaTools is only ever called by main.js when the ?qa=1 flag is set, so
// when it isn't, none of this DOM ever gets created — no menu entry, no
// panel, nothing to find by inspecting the page.
export function initQaTools(callbacks) {
  const menuPanel = document.getElementById('menu-panel');
  const menuBtn = document.createElement('button');
  menuBtn.id = 'menu-qa';
  menuBtn.textContent = '🧪 QA Tools';
  menuPanel.insertBefore(menuBtn, document.getElementById('menu-sep')); // keeps New Wizard last, separated
  menuBtn.addEventListener('click', () => {
    closeMenu();
    toggleBottomPanel('qa-panel');
  });

  const panel = document.createElement('div');
  panel.id = 'qa-panel';
  panel.className = 'powers-panel hidden';
  panel.innerHTML = `
    <div class="powers-header">🧪 QA Tools <button id="qa-close" class="powers-close">✕</button></div>
    <div class="qa-current-runes" id="qa-current-runes"></div>
    <div class="qa-section">
      <label class="qa-label">Set Runes to exactly</label>
      <div class="qa-row">
        <input id="qa-runes-input" type="number" min="0" step="1" placeholder="e.g. 500" />
        <button id="qa-runes-set" class="power-buy">Set</button>
      </div>
      <div class="qa-row">
        <button id="qa-runes-add-100" class="power-buy">+100</button>
        <button id="qa-runes-add-1000" class="power-buy">+1000</button>
        <button id="qa-runes-infinite" class="power-buy">♾️ Infinite</button>
      </div>
    </div>
    <div class="qa-section" id="qa-power-row"></div>
    <div class="qa-section" id="qa-recovery-row"></div>
  `;
  document.getElementById('stage').appendChild(panel);

  document.getElementById('qa-close').addEventListener('click', () => panel.classList.add('hidden'));
  document.getElementById('qa-runes-set').addEventListener('click', () => {
    const raw = document.getElementById('qa-runes-input').value;
    callbacks.onSetRunes(Number(raw));
  });
  document.getElementById('qa-runes-add-100').addEventListener('click', () => callbacks.onAddRunes(100));
  document.getElementById('qa-runes-add-1000').addEventListener('click', () => callbacks.onAddRunes(1000));
  document.getElementById('qa-runes-infinite').addEventListener('click', () => callbacks.onSetInfiniteRunes());
}

// Rebuilds the current-balance text and the two level-stepper rows every
// render (like renderCharacterScreen does for its buy buttons) — deliberately
// does NOT touch #qa-runes-input so the player's in-progress typing in that
// field survives the game loop's 250ms re-renders.
export function renderQaPanel(data, callbacks) {
  const panel = document.getElementById('qa-panel');
  if (!panel) return; // ?qa=1 not set — nothing was ever created
  document.getElementById('qa-current-runes').textContent = `Current: ${data.runes} 🔮 Runes`;
  renderQaLevelRow('qa-power-row', 'qa-power', data.power, callbacks.onSetPowerLevel);
  renderQaLevelRow('qa-recovery-row', 'qa-recovery', data.recovery, callbacks.onSetRecoveryLevel);
}

function renderQaLevelRow(sectionId, idPrefix, info, onSet) {
  const el = document.getElementById(sectionId);
  el.innerHTML = `
    <label class="qa-label">${info.icon} ${info.label} level</label>
    <div class="qa-row">
      <button id="${idPrefix}-minus" class="qa-step${info.level <= 0 ? ' disabled' : ''}">−</button>
      <span class="qa-level-value">Lv.${info.level}/${info.maxLevel}</span>
      <button id="${idPrefix}-plus" class="qa-step${info.level >= info.maxLevel ? ' disabled' : ''}">+</button>
    </div>
  `;
  if (info.level > 0) document.getElementById(`${idPrefix}-minus`).addEventListener('click', () => onSet(info.level - 1));
  if (info.level < info.maxLevel) document.getElementById(`${idPrefix}-plus`).addEventListener('click', () => onSet(info.level + 1));
}

export function toast(msg) {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

function setBar(id, val, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct(val, max)}%`;
}

function pct(val, max) {
  return Math.max(0, Math.min(100, (val / max) * 100));
}

function formatCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatAgo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return 'moments ago';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function renderHud(player, { potReady = false, fast = false } = {}) {
  document.getElementById('hud-avatar').innerHTML = avatarWithRing(player.avatar, getElement(player.element).color, {
    hp: player.hp,
    maxHP: player.maxHP,
    ringColor: 'var(--mana)',
    shieldActive: !!player.shieldActive,
  });
  document.getElementById('hud-name').textContent = player.name;
  document.getElementById('hud-level').textContent = `Lv.${player.level}`;
  setBar('hp-bar-fill', player.hp, player.maxHP);
  document.getElementById('hp-text').textContent = `${player.hp}/${player.maxHP}`;
  setBar('mana-bar-fill', player.mana, player.maxMana);
  document.getElementById('mana-text').textContent = `${player.mana}/${player.maxMana}`;
  setBar('xp-bar-fill', player.xp, player.xpToNext);
  document.getElementById('hud-gems-n').textContent = player.gems;
  document.getElementById('hud-gems-dot').classList.toggle('hidden', !potReady);
  document.getElementById('hud-gems').classList.toggle('ready', !!potReady);
  document.getElementById('hud-gems-fast').classList.toggle('hidden', !fast);
}

// Floating "+N 💎" that rises from the HUD chip, and a bump on the chip itself.
export function showGemPop(n) {
  const chip = document.getElementById('hud-gems');
  const screen = document.getElementById('screen-game');
  if (!chip || !screen || n <= 0) return;
  chip.classList.remove('bump');
  void chip.offsetWidth;
  chip.classList.add('bump');
  const c = chip.getBoundingClientRect();
  const s = screen.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'gem-pop';
  pop.textContent = `+${n} 💎`;
  pop.style.left = `${c.left - s.left + c.width / 2}px`;
  pop.style.top = `${c.bottom - s.top}px`;
  screen.appendChild(pop);
  setTimeout(() => pop.remove(), 1400);
}

export function renderLog(logArr) {
  const list = document.getElementById('log-list');
  list.innerHTML = logArr.slice(0, 50).map((m) => `<div class="log-entry">${m}</div>`).join('');
}

export function showDownOverlay() {
  document.getElementById('down-overlay').classList.remove('hidden');
}
export function hideDownOverlay() {
  document.getElementById('down-overlay').classList.add('hidden');
}


function fmtMods(mods) {
  const out = [];
  if (mods.power) out.push(`${mods.power > 0 ? '+' : ''}${mods.power.toFixed(2)} power`);
  if (mods.maxHP) out.push(`${mods.maxHP > 0 ? '+' : ''}${mods.maxHP} max HP`);
  if (mods.defense) out.push(`${mods.defense > 0 ? '+' : ''}${mods.defense} def`);
  return out.join(', ');
}

export function describeMods(mods) {
  return fmtMods(mods);
}

function fmtRate(n) {
  return n >= 10 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toString();
}

function setText(id, text) {
  const n = document.getElementById(id);
  if (n && n.textContent !== text) n.textContent = text;
}

function renderSelfSheet(el, data, callbacks) {
  const { wizard: w, shieldSpell, shieldActive, shieldReady, shieldReason, treasury, gear } = data;
  const build = (live) => `
      <div class="sheet-panel">
        <button class="sheet-close" id="sheet-close" aria-label="Close">✕</button>
        <div class="sheet-header">
          <span class="sheet-avatar self" id="sheet-avatar"></span>
          <div style="min-width:0">
            <div class="sheet-name">${w.name} <small>Lv.${w.level}</small></div>
            <div class="sheet-sub sheet-gear">${gear.wand ? `${gear.wand.icon} ${gear.wand.name}${gear.wand.level ? ` +${gear.wand.level}` : ''}` : '🪄 No wand'} · ${gear.robe ? `${gear.robe.icon} ${gear.robe.name}${gear.robe.level ? ` +${gear.robe.level}` : ''}` : '🧥 No robe'}</div>
          </div>
        </div>
        <div class="sheet-stats">
          <div class="bar hp-bar"><div id="sheet-hp-fill" class="bar-fill hp-fill" style="width:${live.hpPct}%"></div><span id="sheet-hp-text" class="bar-text">${live.hp}</span></div>
          <div class="bar mana-bar"><div id="sheet-mp-fill" class="bar-fill mana-fill" style="width:${live.mpPct}%"></div><span id="sheet-mp-text" class="bar-text">${live.mp}</span></div>
        </div>
        <div class="treasury">
          <div class="treasury-info">
            <div class="treasury-amount">💎 <b id="sheet-pot">${live.pot}</b> ready</div>
            <div class="treasury-rate${treasury.fast ? ' fast' : ''}">${treasury.fast ? `⚡ ×${treasury.scale} Fast · +${fmtRate(treasury.ratePerMin)} 💎/min` : `+${fmtRate(treasury.ratePerMin)} 💎/min`}</div>
          </div>
          <button id="sheet-collect" class="sheet-btn collect${treasury.canCollect ? '' : ' disabled'}">${treasury.canCollect ? '💎 Collect' : 'Filling…'}</button>
          </div>
        <div class="sheet-shield-status${shieldActive ? ' active' : ''}" id="sheet-shield-status">${live.shield}</div>
        <div class="sheet-actions">
          <button id="sheet-shield" class="sheet-btn shield${shieldReady ? '' : ' disabled'}">
            <span class="sheet-btn-icon">${shieldSpell.icon}</span> ${shieldActive ? 'Refresh' : 'Raise'} Ward Shield
            <span class="sheet-btn-cost">${shieldSpell.manaCost}💧</span>
          </button>
          <button id="sheet-shop" class="sheet-btn secondary shop-open" title="Crystal Shop">🛍️ Shop</button>
        </div>
        ${!shieldReady && shieldReason ? `<div class="sheet-reason">${shieldReason}</div>` : ''}
      </div>`;
  const live = {
    hp: `${w.hp}/${w.maxHP} HP`,
    mp: `${w.mana}/${w.maxMana} MP`,
    hpPct: pct(w.hp, w.maxHP),
    mpPct: pct(w.mana, w.maxMana),
    pot: treasury.potWhole,
    avatar: avatarWithRing(w.avatar, getElement(w.element).color, { hp: w.hp, maxHP: w.maxHP, ringColor: 'var(--mana)', shieldActive }),
    shield: shieldActive ? `🛡️ Ward active — ${data.shieldRemainingS}s left` : 'No ward raised',
  };
  // Structure key: same markup with every live number blanked. The shield
  // status text is live, but its active/idle flag is part of the key via the
  // markup (class + button label).
  const key = build({ hp: '', mp: '', hpPct: 0, mpPct: 0, pot: '', shield: '', avatar: '' });
  if (key !== sheetKey || !el.firstElementChild) {
    sheetKey = key;
    el.innerHTML = build(live);
    document.getElementById('sheet-avatar').innerHTML = live.avatar;
    document.getElementById('sheet-close').addEventListener('click', callbacks.onClose);
    document.getElementById('sheet-shop').addEventListener('click', callbacks.onOpenShop);
    if (treasury.canCollect) document.getElementById('sheet-collect').addEventListener('click', callbacks.onCollect);
    if (shieldReady) document.getElementById('sheet-shield').addEventListener('click', callbacks.onShield);
    return;
  }
  document.getElementById('sheet-avatar').innerHTML = live.avatar;
  setText('sheet-pot', String(live.pot));
  setText('sheet-hp-text', live.hp);
  setText('sheet-mp-text', live.mp);
  setText('sheet-shield-status', live.shield);
  document.getElementById('sheet-hp-fill').style.width = `${live.hpPct}%`;
  document.getElementById('sheet-mp-fill').style.width = `${live.mpPct}%`;
}

// The per-item upgrade strip on the equipped row: level, what the next level
// adds, and one button (price / "Tap again to upgrade" / disabled / MAX).
function upgradeHtml(r) {
  const u = r.up;
  const slot = r.item.slot;
  const pipsOn = Array.from({ length: u.max }, (_, i) => `<i${i < u.level ? ' class="on"' : ''}></i>`).join('');
  if (u.maxed) {
    return `<div class="shop-upgrade maxed"><div class="up-info"><div class="up-title">Upgrade +${u.level}/${u.max}</div><div class="up-pips">${pipsOn}</div></div><span class="shop-tag up-max">MAX</span></div>`;
  }
  const next = `<div class="up-next">Next +${u.level + 1}: ${fmtMods(u.step)}</div>`;
  const need = u.affordable ? '' : `<div class="shop-progress"><div style="width:${Math.min(100, (100 * (u.cost - u.needMore)) / u.cost)}%"></div></div>`;
  const btn = `<button class="shop-price up-btn${u.affordable ? '' : ' poor'}${r.upConfirming ? ' confirm' : ''}" data-upgrade="${slot}"${u.affordable ? '' : ' disabled'}>${r.upConfirming ? 'Tap again to upgrade' : `⬆ ${u.cost} 💎`}</button>`;
  return `<div class="shop-upgrade"><div class="up-info"><div class="up-title">Upgrade +${u.level}/${u.max}</div>${next}<div class="up-pips">${pipsOn}</div>${need}</div>${btn}</div>`;
}

function shopRowHtml(r) {
  const { item, state } = r;
  const pips = Array.from({ length: r.tiers }, (_, i) => (i < item.tier ? '●' : '○')).join('');
  let note = '';
  let right = '';
  let upgrade = '';
  if (state === 'equipped') {
    right = '<span class="shop-tag">Equipped</span>';
    upgrade = upgradeHtml(r);
  }
  else if (state === 'owned') right = '<span class="shop-tag dim">Owned</span>';
  else if (state === 'locked') {
    note = `<div class="shop-note">Buy ${r.requires.name} first</div>`;
    right = '<span class="shop-tag dim">🔒</span>';
  } else {
    if (r.over && Object.keys(r.delta).length) note = `<div class="shop-note">${fmtMods(r.delta)} vs your ${r.over.name}${r.overLevel ? ` +${r.overLevel}` : ''}</div>`;
    if (state === 'unaffordable') {
      note += `<div class="shop-note need">Need ${r.needMore} more 💎</div><div class="shop-progress"><div style="width:${Math.min(100, (100 * (item.price - r.needMore)) / item.price)}%"></div></div>`;
    }
    right = `<button class="shop-price${state === 'unaffordable' ? ' poor' : ''}${r.confirming ? ' confirm' : ''}" data-buy="${item.id}"${state === 'unaffordable' ? ' disabled' : ''}>${r.confirming ? 'Tap again to buy' : `${item.price} 💎`}</button>`;
  }
  return `<div class="shop-row ${state}${r.flash ? ' flash' : ''}" data-tier="${item.tier}">
      <span class="shop-icon">${item.icon}</span>
      <div class="shop-info">
        <div class="shop-name">${item.name}${r.up && r.up.level ? ` +${r.up.level}` : ''} <span class="shop-pips">${pips}</span></div>
        <div class="shop-stats">${fmtMods(r.totalMods || item.mods)}</div>
        ${note}
      </div>
      ${right}
      ${upgrade}
    </div>`;
}

// ---------- Shop screen ----------
// Promoted from the old docked "🛍️ Crystal Shop" sheet into its own full
// screen (same economy.js data, same row/upgrade markup, just a bigger
// non-cramped container — see docs/ARCHITECTURE.md). render() runs every
// 250ms, and rebuilding this list's innerHTML that often would swallow the
// "tap again to buy/upgrade" confirm taps (same reason the old sheet guarded
// against it), so this keeps the same structure-key rebuild guard.
let shopScreenKey = null;
let shopScreenSlotShown = null; // which slot's list is currently shown

export function renderShopScreen(data, callbacks) {
  const el = document.getElementById('shop-content');
  if (!el) return;
  const html = `
      <div class="shop-screen">
        <div class="shop-head"><div class="sheet-name">💎 Balance</div><div class="shop-balance">💎 ${data.balance}</div></div>
        ${data.intro ? '<div class="shop-intro">Spend Mana Crystals on gear. Whatever you buy is equipped right away.</div>' : ''}
        <div class="shop-slots" role="tablist">
          ${data.slots.map((s) => `<button role="tab" class="shop-slot${s.id === data.slot ? ' active' : ''}" data-slot="${s.id}" aria-selected="${s.id === data.slot}">${s.icon} ${s.label}</button>`).join('')}
        </div>
        <div class="shop-list">${data.rows.map(shopRowHtml).join('')}</div>
      </div>`;
  if (html === shopScreenKey && el.firstElementChild) return;
  // Rebuilding replaces the scrolling list, so carry its scroll position over;
  // on first open / tab switch, bring the equipped (or next) row into view.
  const oldList = el.querySelector('.shop-list');
  const keepScroll = oldList && shopScreenSlotShown === data.slot ? oldList.scrollTop : null;
  shopScreenKey = html;
  el.innerHTML = html;
  const list = el.querySelector('.shop-list');
  if (keepScroll !== null) list.scrollTop = keepScroll;
  else {
    const focus = list.querySelector('.shop-row.equipped') || list.querySelector('.shop-row.affordable, .shop-row.unaffordable');
    if (focus) list.scrollTop = Math.max(0, focus.getBoundingClientRect().top - list.getBoundingClientRect().top - 4);
  }
  shopScreenSlotShown = data.slot;
  el.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => callbacks.onShopSlot(b.dataset.slot)));
  el.querySelectorAll('[data-buy]:not([disabled])').forEach((b) => b.addEventListener('click', () => callbacks.onShopBuy(b.dataset.buy)));
  el.querySelectorAll('[data-upgrade]:not([disabled])').forEach((b) => b.addEventListener('click', () => callbacks.onShopUpgrade(b.dataset.upgrade)));
}

// Tapping a wizard (yourself or an NPC) opens this sheet in place of the old
// always-on spellbook — casting is contextual to whoever you tapped. The
// shop used to be a third kind here ('shop'); it's now the full Shop screen
// (renderShopScreen above) instead, so this only ever handles 'self',
// 'npc' and 'remote'.
//
// render() runs every 250ms. Rebuilding innerHTML that often swallows taps
// (the button under your finger is replaced between press and release), so the
// self sheet only rebuilds when its *structure* changes (sheetKey);
// fast-changing numbers are patched in place with textContent / style.
let sheetKey = null;

export function renderWizardSheet(data, callbacks) {
  const el = document.getElementById('wizard-sheet');
  if (!data) {
    el.classList.add('hidden');
    el.innerHTML = '';
    sheetKey = null;
    return;
  }
  el.classList.remove('hidden');

  if (data.kind === 'self') {
    renderSelfSheet(el, data, callbacks);
    return;
  }
  // NPC / remote sheets: the shell is only (re)created when the target
  // changes so its entrance animation doesn't replay every tick.
  const key = data.kind === 'remote' ? `remote:${data.wizard.id}` : `npc:${data.wizard.id}`;
  if (key !== sheetKey || !el.firstElementChild) {
    sheetKey = key;
    el.innerHTML = `
      <div class="sheet-panel">
        <button class="sheet-close" id="sheet-close" aria-label="Close">✕</button>
        <div id="sheet-body"></div>
      </div>`;
    document.getElementById('sheet-close').addEventListener('click', callbacks.onClose);
  }
  const body = document.getElementById('sheet-body');

  // A real player's sheet is otherwise identical to an NPC's (same
  // structure, same Cast Spark Bolt action) but adds a "synced Xm ago" line
  // and a callout explaining they may be offline — the NPC branch below is
  // left untouched on purpose, only the real-player case is the surprising
  // one that needs the explanation. Ring color (purple) carries the
  // "real player" identity signal now that avatars use the shared ring
  // component; shieldActive is always false here — this device has no live
  // visibility into a remote player's shield state (see combat.js).
  if (data.kind === 'remote') {
    const { wizard: rp, atkSpell, canAttack, reason, dist, syncedAgoMs } = data;
    body.innerHTML = `
      <div class="sheet-header">
        <span class="sheet-avatar">${avatarWithRing(rp.avatar, getElement(rp.element).color, { hp: rp.hp, maxHP: rp.maxHP, ringColor: 'var(--purple)', shieldActive: false })}</span>
        <div>
          <div class="sheet-name">${rp.name} <small>Lv.${rp.level}</small></div>
          <div class="sheet-sub">${dist}m away</div>
          <div class="sheet-sub sheet-sub-synced">synced ${formatAgo(syncedAgoMs)}</div>
        </div>
      </div>
      <div class="sheet-stats">
        <div class="bar hp-bar"><div class="bar-fill hp-fill" style="width:${pct(rp.hp, rp.maxHP)}%"></div><span class="bar-text">${rp.hp}/${rp.maxHP} HP</span></div>
      </div>
      <div class="sheet-remote-note">🌐 A real player — they may be offline. Spark Bolt still travels in real time.</div>
      <div class="sheet-actions">
        <button id="sheet-attack" class="sheet-btn attack${canAttack ? '' : ' disabled'}">
          <span class="sheet-btn-icon">${atkSpell.icon}</span> Cast ${atkSpell.name}
          <span class="sheet-btn-cost">${atkSpell.manaCost}💧</span>
        </button>
      </div>
      ${!canAttack ? `<div class="sheet-reason">${reason}</div>` : ''}`;
    if (canAttack) document.getElementById('sheet-attack').addEventListener('click', callbacks.onAttack);
    return;
  }

  const { wizard: npc, atkSpell, canAttack, reason, dist, shieldActive, isNemesis } = data;
  body.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-avatar">${avatarWithRing(npc.avatar, getElement(npc.element).color, { hp: npc.hp, maxHP: npc.maxHP, ringColor: 'var(--pink)', shieldActive: !!shieldActive })}</span>
      <div>
        <div class="sheet-name">${npc.name} <small>Lv.${npc.level}</small>${isNemesis ? ' <span class="nemesis-badge">😈 Nemesis</span>' : ''}</div>
        <div class="sheet-sub">${dist}m away</div>
      </div>
    </div>
    <div class="sheet-stats">
      <div class="bar hp-bar"><div class="bar-fill hp-fill" style="width:${pct(npc.hp, npc.maxHP)}%"></div><span class="bar-text">${npc.hp}/${npc.maxHP} HP</span></div>
    </div>
    <div class="sheet-actions">
      <button id="sheet-attack" class="sheet-btn attack${canAttack ? '' : ' disabled'}">
        <span class="sheet-btn-icon">${atkSpell.icon}</span> Cast ${atkSpell.name}
        <span class="sheet-btn-cost">${atkSpell.manaCost}💧</span>
      </button>
    </div>
    ${!canAttack ? `<div class="sheet-reason">${reason}</div>` : ''}`;
  if (canAttack) document.getElementById('sheet-attack').addEventListener('click', callbacks.onAttack);
}

// The reactive counter, shown in the defend strip (its own lane under the HUD)
// only while a curse is incoming, so the player can negate the one that lands
// soonest before it hits. However many are in flight there is ONE fixed-size
// card plus a "+N more incoming" line.
//
// render() runs every 250ms, and replacing the Counter button that often
// swallows taps (the node under the finger is gone by touchend). So the card is
// built ONCE when the strip first appears; every later render only patches its
// text, ring, button state and the button's data-proj in place. The click
// handler is delegated and reads data-proj at click time.
const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;
let counterHandler = null;

function buildDefendCard(strip) {
  const counterSpell = getSpell('counterspell');
  strip.innerHTML = `<div class="defend-card" role="alert">
      <div class="defend-ring" aria-hidden="true">
        <svg viewBox="0 0 44 44" width="44" height="44"><circle class="defend-ring-track" cx="22" cy="22" r="${RING_R}"/><circle class="defend-ring-arc" cx="22" cy="22" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}"/></svg>
        <span class="defend-eta"></span>
      </div>
      <div class="defend-text">
        <div class="defend-title"></div>
        <div class="defend-sub"><span class="defend-more"></span><span class="defend-sep"> · </span><span class="defend-reason"></span></div>
      </div>
      <button type="button" class="defend-btn">${counterSpell.icon} Counter <small>${counterSpell.manaCost}💧</small></button>
    </div>`;
  strip.querySelector('.defend-btn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!btn.classList.contains('disabled') && counterHandler) counterHandler(btn.dataset.proj);
  });
}

function patchText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export function renderDefendPrompts(incoming, player, now, onCounter) {
  const strip = document.getElementById('defend-overlay');
  if (!incoming.length) {
    strip.classList.add('hidden');
    strip.innerHTML = '';
    return;
  }
  counterHandler = onCounter;
  strip.classList.remove('hidden');
  if (!strip.firstElementChild) buildDefendCard(strip);
  const counterSpell = getSpell('counterspell');
  const sorted = [...incoming].sort((x, y) => x.impactTime - y.impactTime);
  const p = sorted[0];
  const spell = getSpell(p.spellId);
  const msLeft = Math.max(0, p.impactTime - now);
  const totalMs = Math.max(1, p.impactTime - p.travelStart);
  const onCooldown = (player.cooldowns[counterSpell.id] || 0) > now;
  const lowMana = player.mana < counterSpell.manaCost;
  const ready = !onCooldown && !lowMana;
  const reason = lowMana ? 'Not enough mana' : onCooldown ? 'Recharging' : '';
  const more = sorted.length - 1;

  // Nemesis System: main.js resolves the caster's name/Nemesis status (see
  // casterNameFor there) and hands it over as plain fields — ui.js never
  // looks wizards up by id itself.
  const titleText = p.isNemesisCaster
    ? `😈 Nemesis ${p.casterName}'s ${spell.name} incoming!`
    : `${spell.icon} ${spell.name} incoming!`;
  patchText(strip.querySelector('.defend-title'), titleText);
  patchText(strip.querySelector('.defend-more'), more ? `+${more} more incoming` : '');
  patchText(strip.querySelector('.defend-reason'), reason);
  strip.querySelector('.defend-sub').classList.toggle('hidden', !more && !reason);
  strip.querySelector('.defend-sep').classList.toggle('hidden', !more || !reason);
  const btn = strip.querySelector('.defend-btn');
  btn.dataset.proj = p.id;
  btn.classList.toggle('disabled', !ready);
  btn.setAttribute('aria-disabled', String(!ready));
  strip.querySelector('.defend-ring-arc').style.strokeDashoffset = (RING_C * (1 - pct(msLeft, totalMs) / 100)).toFixed(2);
  patchText(strip.querySelector('.defend-eta'), formatCountdown(msLeft));
}
