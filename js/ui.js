import { getSpell } from './spells.js';

const AVATARS = ['🧙‍♂️', '🧙‍♀️', '🧙', '🧝‍♂️', '🧝‍♀️'];

export function initCreateScreen(elements, onSubmit) {
  const avatarWrap = document.getElementById('avatar-options');
  avatarWrap.innerHTML = AVATARS.map(
    (a, i) => `<label class="avatar-choice"><input type="radio" name="avatar" value="${a}" ${i === 0 ? 'checked' : ''}><span>${a}</span></label>`
  ).join('');

  const elWrap = document.getElementById('element-options');
  elWrap.innerHTML = elements
    .map(
      (e, i) => `<label class="element-choice" style="--el-color:${e.color}">
        <input type="radio" name="element" value="${e.id}" ${i === 0 ? 'checked' : ''}>
        <span class="element-icon">${e.icon}</span>
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
    const avatar = fd.get('avatar') || '🧙';
    const elementId = fd.get('element') || 'fire';
    onSubmit({ name, avatar, elementId });
  });
}

export function showGameScreen() {
  document.getElementById('screen-create').classList.remove('active');
  document.getElementById('screen-game').classList.add('active');
}

export function bindHud({ onLocate, onFullscreen, onSpeedToggle, onLogToggle, onReset, onShop, onGemsTap }) {
  document.getElementById('btn-locate').addEventListener('click', onLocate);

  const menuPanel = document.getElementById('menu-panel');
  menuPanel.innerHTML = `
    <button id="menu-fullscreen">⛶ Fullscreen</button>
    <button id="menu-shop">💎 Shop</button>
    <button id="menu-speed">⚡ Fast</button>
    <button id="menu-log">📜 Spell Log</button>
    <button id="menu-reset" class="menu-danger">🔄 New Wizard</button>
  `;
  document.getElementById('btn-menu').addEventListener('click', () => menuPanel.classList.toggle('hidden'));
  document.getElementById('menu-fullscreen').addEventListener('click', () => {
    onFullscreen();
    menuPanel.classList.add('hidden');
  });
  document.getElementById('menu-shop').addEventListener('click', () => {
    onShop();
    menuPanel.classList.add('hidden');
  });
  document.getElementById('hud-gems').addEventListener('click', onGemsTap);
  document.getElementById('menu-speed').addEventListener('click', onSpeedToggle);
  document.getElementById('menu-log').addEventListener('click', () => {
    onLogToggle();
    menuPanel.classList.add('hidden');
  });
  document.getElementById('menu-reset').addEventListener('click', () => {
    onReset();
    menuPanel.classList.add('hidden');
  });
  document.getElementById('btn-log-close').addEventListener('click', () => {
    document.getElementById('log-panel').classList.add('hidden');
  });
}

export function setSpeedLabel(text) {
  const el = document.getElementById('menu-speed');
  if (el) el.textContent = text;
}

export function toggleLog() {
  document.getElementById('log-panel').classList.toggle('hidden');
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

export function renderHud(player, { potReady = false, fast = false } = {}) {
  document.getElementById('hud-avatar').textContent = player.avatar;
  document.getElementById('hud-name').textContent = player.name;
  document.getElementById('hud-level').textContent = `Lv.${player.level}`;
  setBar('hp-bar-fill', player.hp, player.maxHP);
  document.getElementById('hp-text').textContent = `${player.hp}/${player.maxHP}`;
  setBar('mana-bar-fill', player.mana, player.maxMana);
  document.getElementById('mana-text').textContent = `${player.mana}/${player.maxMana}`;
  setBar('xp-bar-fill', player.xp, player.xpToNext);
  document.getElementById('hud-gems-n').textContent = player.gems;
  document.getElementById('hud-gems-dot').classList.toggle('hidden', !potReady);
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
        <button class="sheet-close" id="sheet-close">✕</button>
        <div class="sheet-header">
          <span class="sheet-avatar self">${w.avatar}</span>
          <div>
            <div class="sheet-name">${w.name} <small>Lv.${w.level}</small></div>
            <div class="sheet-sub">Your Wizard</div>
          </div>
        </div>
        <div class="sheet-stats">
          <div class="bar hp-bar"><div id="sheet-hp-fill" class="bar-fill hp-fill" style="width:${live.hpPct}%"></div><span id="sheet-hp-text" class="bar-text">${live.hp}</span></div>
          <div class="bar mana-bar"><div id="sheet-mp-fill" class="bar-fill mana-fill" style="width:${live.mpPct}%"></div><span id="sheet-mp-text" class="bar-text">${live.mp}</span></div>
        </div>
        <div class="sheet-gear">${gear.wand ? `${gear.wand.icon} ${gear.wand.name}` : '🪄 No wand'} · ${gear.robe ? `${gear.robe.icon} ${gear.robe.name}` : '🧥 No robe'}</div>
        <div class="treasury">
          <div class="treasury-top"><span class="treasury-label">Treasury</span><span class="treasury-amount">💎 <b id="sheet-pot">${live.pot}</b> ready</span></div>
          <div class="treasury-rate${treasury.fast ? ' fast' : ''}">${treasury.fast ? `⚡ ×${treasury.scale} Fast · +${fmtRate(treasury.ratePerMin)} 💎/min` : `+${fmtRate(treasury.ratePerMin)} 💎/min`}</div>
          <button id="sheet-collect" class="sheet-btn collect${treasury.canCollect ? '' : ' disabled'}">${treasury.canCollect ? '💎 Collect' : 'Filling…'}</button>
        </div>
        <div class="sheet-shield-status${shieldActive ? ' active' : ''}" id="sheet-shield-status">${live.shield}</div>
        <div class="sheet-actions">
          <button id="sheet-shield" class="sheet-btn shield${shieldReady ? '' : ' disabled'}">
            <span class="sheet-btn-icon">${shieldSpell.icon}</span> ${shieldActive ? 'Refresh' : 'Raise'} Ward Shield
            <span class="sheet-btn-cost">${shieldSpell.manaCost}💧</span>
          </button>
        </div>
        ${!shieldReady && shieldReason ? `<div class="sheet-reason">${shieldReason}</div>` : ''}
        <div class="sheet-actions sheet-actions-2">
          <button id="sheet-shop" class="sheet-btn secondary">🛍️ Crystal Shop</button>
        </div>
      </div>`;
  const live = {
    hp: `${w.hp}/${w.maxHP} HP`,
    mp: `${w.mana}/${w.maxMana} MP`,
    hpPct: pct(w.hp, w.maxHP),
    mpPct: pct(w.mana, w.maxMana),
    pot: treasury.potWhole,
    shield: shieldActive ? `🛡️ Ward active — ${data.shieldRemainingS}s left` : 'No ward raised',
  };
  // Structure key: same markup with every live number blanked. The shield
  // status text is live, but its active/idle flag is part of the key via the
  // markup (class + button label).
  const key = build({ hp: '', mp: '', hpPct: 0, mpPct: 0, pot: '', shield: '' });
  if (key !== sheetKey || !el.firstElementChild) {
    sheetKey = key;
    el.innerHTML = build(live);
    document.getElementById('sheet-close').addEventListener('click', callbacks.onClose);
    document.getElementById('sheet-shop').addEventListener('click', callbacks.onOpenShop);
    if (treasury.canCollect) document.getElementById('sheet-collect').addEventListener('click', callbacks.onCollect);
    if (shieldReady) document.getElementById('sheet-shield').addEventListener('click', callbacks.onShield);
    return;
  }
  setText('sheet-pot', String(live.pot));
  setText('sheet-hp-text', live.hp);
  setText('sheet-mp-text', live.mp);
  setText('sheet-shield-status', live.shield);
  document.getElementById('sheet-hp-fill').style.width = `${live.hpPct}%`;
  document.getElementById('sheet-mp-fill').style.width = `${live.mpPct}%`;
}

function shopRowHtml(r) {
  const { item, state } = r;
  const pips = Array.from({ length: r.tiers }, (_, i) => (i < item.tier ? '●' : '○')).join('');
  let note = '';
  let right = '';
  if (state === 'equipped') right = '<span class="shop-tag">Equipped</span>';
  else if (state === 'owned') right = '<span class="shop-tag dim">Owned</span>';
  else if (state === 'locked') {
    note = `<div class="shop-note">Buy ${r.requires.name} first</div>`;
    right = '<span class="shop-tag dim">🔒</span>';
  } else {
    if (r.over && Object.keys(r.delta).length) note = `<div class="shop-note">${fmtMods(r.delta)} over your ${r.over.name}</div>`;
    if (state === 'unaffordable') {
      note += `<div class="shop-note need">Need ${r.needMore} more 💎</div><div class="shop-progress"><div style="width:${Math.min(100, (100 * (item.price - r.needMore)) / item.price)}%"></div></div>`;
    }
    right = `<button class="shop-price${state === 'unaffordable' ? ' poor' : ''}${r.confirming ? ' confirm' : ''}" data-buy="${item.id}"${state === 'unaffordable' ? ' disabled' : ''}>${r.confirming ? 'Tap again to buy' : `${item.price} 💎`}</button>`;
  }
  return `<div class="shop-row ${state}${r.flash ? ' flash' : ''}" data-tier="${item.tier}">
      <span class="shop-icon">${item.icon}</span>
      <div class="shop-info">
        <div class="shop-name">${item.name} <span class="shop-pips">${pips}</span></div>
        <div class="shop-stats">${fmtMods(item.mods)}</div>
        ${note}
      </div>
      ${right}
    </div>`;
}

function renderShopSheet(el, data, callbacks) {
  const html = `
      <div class="sheet-panel shop">
        <button class="sheet-close" id="sheet-close">✕</button>
        <div class="shop-head"><div class="sheet-name">🛍️ Crystal Shop</div><div class="shop-balance">💎 ${data.balance}</div></div>
        ${data.intro ? '<div class="shop-intro">Spend Mana Crystals on gear. Whatever you buy is equipped right away.</div>' : ''}
        <div class="shop-slots" role="tablist">
          ${data.slots.map((s) => `<button role="tab" class="shop-slot${s.id === data.slot ? ' active' : ''}" data-slot="${s.id}" aria-selected="${s.id === data.slot}">${s.icon} ${s.label}</button>`).join('')}
        </div>
        <div class="shop-list">${data.rows.map(shopRowHtml).join('')}</div>
      </div>`;
  if (html === sheetKey && el.firstElementChild) return;
  sheetKey = html;
  el.innerHTML = html;
  document.getElementById('sheet-close').addEventListener('click', callbacks.onClose);
  el.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => callbacks.onShopSlot(b.dataset.slot)));
  el.querySelectorAll('[data-buy]:not([disabled])').forEach((b) => b.addEventListener('click', () => callbacks.onShopBuy(b.dataset.buy)));
}

// Tapping a wizard (yourself or an NPC) opens this sheet in place of the old
// always-on spellbook — casting is contextual to whoever you tapped.
//
// render() runs every 250ms. Rebuilding innerHTML that often swallows taps
// (the button under your finger is replaced between press and release), so the
// self and shop sheets only rebuild when their *structure* changes (sheetKey);
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
  if (data.kind === 'shop') {
    renderShopSheet(el, data, callbacks);
    return;
  }
  sheetKey = null;

  const { wizard: npc, atkSpell, canAttack, reason, dist } = data;
  el.innerHTML = `
    <div class="sheet-panel">
      <button class="sheet-close" id="sheet-close">✕</button>
      <div class="sheet-header">
        <span class="sheet-avatar">${npc.avatar}</span>
        <div>
          <div class="sheet-name">${npc.name} <small>Lv.${npc.level}</small></div>
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
      ${!canAttack ? `<div class="sheet-reason">${reason}</div>` : ''}
    </div>`;
  document.getElementById('sheet-close').addEventListener('click', callbacks.onClose);
  if (canAttack) document.getElementById('sheet-attack').addEventListener('click', callbacks.onAttack);
}

// The reactive counter: shown only while a specific curse is incoming, so the
// player can negate that exact spell before it lands.
export function renderDefendPrompts(incoming, player, now, onCounter) {
  const overlay = document.getElementById('defend-overlay');
  if (!incoming.length) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    return;
  }
  overlay.classList.remove('hidden');
  const counterSpell = getSpell('counterspell');
  overlay.innerHTML = incoming
    .map((p) => {
      const spell = getSpell(p.spellId);
      const msLeft = Math.max(0, p.impactTime - now);
      const totalMs = Math.max(1, p.impactTime - p.travelStart);
      const barPct = pct(msLeft, totalMs);
      const ready = (player.cooldowns[counterSpell.id] || 0) <= now && player.mana >= counterSpell.manaCost;
      return `<div class="defend-card">
        <div class="defend-title">⚠️ Incoming ${spell.icon} ${spell.name}! (${formatCountdown(msLeft)})</div>
        <div class="defend-timer"><div class="defend-timer-fill" style="width:${barPct}%"></div></div>
        <div class="defend-actions">
          <button data-proj="${p.id}" class="defend-btn${ready ? '' : ' disabled'}">
            ${counterSpell.icon} Counterspell <span class="sheet-btn-cost">${counterSpell.manaCost}💧</span>
          </button>
        </div>
      </div>`;
    })
    .join('');
  overlay.querySelectorAll('.defend-btn:not(.disabled)').forEach((btn) => {
    btn.addEventListener('click', () => onCounter(btn.dataset.proj));
  });
}
