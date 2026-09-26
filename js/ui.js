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

export function bindHud({ onLocate, onFullscreen, onSpeedToggle, onLogToggle, onReset }) {
  document.getElementById('btn-locate').addEventListener('click', onLocate);

  const menuPanel = document.getElementById('menu-panel');
  menuPanel.innerHTML = `
    <button id="menu-fullscreen">⛶ Fullscreen</button>
    <button id="menu-speed">⚡ Fast</button>
    <button id="menu-log">📜 Spell Log</button>
    <button id="menu-reset" class="menu-danger">🔄 New Wizard</button>
  `;
  document.getElementById('btn-menu').addEventListener('click', () => menuPanel.classList.toggle('hidden'));
  document.getElementById('menu-fullscreen').addEventListener('click', () => {
    onFullscreen();
    menuPanel.classList.add('hidden');
  });
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

export function renderHud(player) {
  document.getElementById('hud-avatar').textContent = player.avatar;
  document.getElementById('hud-name').textContent = player.name;
  document.getElementById('hud-level').textContent = `Lv.${player.level}`;
  setBar('hp-bar-fill', player.hp, player.maxHP);
  document.getElementById('hp-text').textContent = `${player.hp}/${player.maxHP}`;
  setBar('mana-bar-fill', player.mana, player.maxMana);
  document.getElementById('mana-text').textContent = `${player.mana}/${player.maxMana}`;
  setBar('xp-bar-fill', player.xp, player.xpToNext);
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

// Tapping a wizard (yourself or an NPC) opens this sheet in place of the old
// always-on spellbook — casting is contextual to whoever you tapped.
export function renderWizardSheet(data, callbacks) {
  const el = document.getElementById('wizard-sheet');
  if (!data) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');

  if (data.kind === 'self') {
    const { wizard: w, shieldSpell, shieldActive, shieldRemainingS, shieldReady, shieldReason } = data;
    el.innerHTML = `
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
          <div class="bar hp-bar"><div class="bar-fill hp-fill" style="width:${pct(w.hp, w.maxHP)}%"></div><span class="bar-text">${w.hp}/${w.maxHP} HP</span></div>
          <div class="bar mana-bar"><div class="bar-fill mana-fill" style="width:${pct(w.mana, w.maxMana)}%"></div><span class="bar-text">${w.mana}/${w.maxMana} MP</span></div>
        </div>
        <div class="sheet-shield-status${shieldActive ? ' active' : ''}">${shieldActive ? `🛡️ Ward active — ${shieldRemainingS}s left` : 'No ward raised'}</div>
        <div class="sheet-actions">
          <button id="sheet-shield" class="sheet-btn shield${shieldReady ? '' : ' disabled'}">
            <span class="sheet-btn-icon">${shieldSpell.icon}</span> ${shieldActive ? 'Refresh' : 'Raise'} Ward Shield
            <span class="sheet-btn-cost">${shieldSpell.manaCost}💧</span>
          </button>
        </div>
        ${!shieldReady && shieldReason ? `<div class="sheet-reason">${shieldReason}</div>` : ''}
      </div>`;
    document.getElementById('sheet-close').addEventListener('click', callbacks.onClose);
    if (shieldReady) document.getElementById('sheet-shield').addEventListener('click', callbacks.onShield);
    return;
  }

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
