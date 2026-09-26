import { getSpell } from './spells.js';

const AVATARS = ['🧙‍♂️', '🧙‍♀️', '🧙', '🧝‍♂️', '🧝‍♀️'];
const handlers = {};

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

export function bindHud({ onLocate, onMenu, onSpellSelect, onLogToggle, onCancelTarget, onFullscreen, onSpeedToggle }) {
  document.getElementById('btn-locate').addEventListener('click', onLocate);
  document.getElementById('btn-menu').addEventListener('click', onMenu);
  document.getElementById('btn-log-toggle').addEventListener('click', onLogToggle);
  document.getElementById('btn-fullscreen').addEventListener('click', onFullscreen);
  document.getElementById('btn-speed').addEventListener('click', onSpeedToggle);
  handlers.onSpellSelect = onSpellSelect;
  handlers.onCancelTarget = onCancelTarget;
}

export function setSpeedLabel(text) {
  const el = document.getElementById('btn-speed');
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
  if (el) el.style.width = `${Math.max(0, Math.min(100, (val / max) * 100))}%`;
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

export function renderSpellbook(player, now, targetId) {
  const wrap = document.getElementById('spellbook');
  wrap.innerHTML = '';
  player.spells.forEach((spellId) => {
    const spell = getSpell(spellId);
    const cdReady = (player.cooldowns[spellId] || 0) <= now;
    const canAfford = player.mana >= spell.manaCost;
    const needsTarget = spell.type === 'attack' && !targetId;
    const disabled = !cdReady || !canAfford || needsTarget;
    const btn = document.createElement('button');
    btn.className = `spell-btn spell-${spell.type}${disabled ? ' disabled' : ''}`;
    btn.innerHTML = `<span class="spell-icon">${spell.icon}</span><span class="spell-cost">${spell.manaCost}💧</span>${
      !cdReady ? `<span class="spell-cd">${Math.ceil(((player.cooldowns[spellId] || 0) - now) / 1000)}s</span>` : ''
    }`;
    btn.title = `${spell.name} — ${spell.description}`;
    btn.addEventListener('click', () => {
      if (!disabled) handlers.onSpellSelect(spellId);
      else if (needsTarget) toast('Choose a wizard on the map to target first! 🎯');
    });
    wrap.appendChild(btn);
  });
}

export function renderTargetCard(npc) {
  const card = document.getElementById('target-card');
  if (!npc) {
    card.classList.add('hidden');
    card.innerHTML = '';
    return;
  }
  card.classList.remove('hidden');
  card.innerHTML = `
    <div class="target-row">
      <span class="target-avatar">${npc.avatar}</span>
      <div class="target-info">
        <div class="target-name">${npc.name} <small>Lv.${npc.level}</small></div>
        <div class="bar hp-bar small"><div class="bar-fill hp-fill" style="width:${Math.max(0, (npc.hp / npc.maxHP) * 100)}%"></div></div>
      </div>
      <button id="target-cancel" title="Cancel target">✕</button>
    </div>`;
  document.getElementById('target-cancel').addEventListener('click', () => {
    handlers.onCancelTarget && handlers.onCancelTarget();
  });
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

export function renderDefendPrompts(incoming, player, now, onDefendCast) {
  const overlay = document.getElementById('defend-overlay');
  if (!incoming.length) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    return;
  }
  overlay.classList.remove('hidden');
  overlay.innerHTML = incoming
    .map((p) => {
      const spell = getSpell(p.spellId);
      const msLeft = Math.max(0, p.impactTime - now);
      const totalMs = Math.max(1, p.impactTime - p.travelStart);
      const pct = Math.max(0, Math.min(100, (msLeft / totalMs) * 100));
      const defendBtns = player.spells
        .map(getSpell)
        .filter((s) => s.type === 'defend')
        .map((s) => {
          const ready = (player.cooldowns[s.id] || 0) <= now && player.mana >= s.manaCost;
          return `<button data-spell="${s.id}" class="defend-btn${ready ? '' : ' disabled'}">${s.icon} ${s.name}</button>`;
        })
        .join('');
      return `<div class="defend-card" data-proj="${p.id}">
        <div class="defend-title">⚠️ Incoming ${spell.icon} ${spell.name}!</div>
        <div class="defend-timer"><div class="defend-timer-fill" style="width:${pct}%"></div></div>
        <div class="defend-actions">${defendBtns}</div>
      </div>`;
    })
    .join('');
  overlay.querySelectorAll('.defend-btn:not(.disabled)').forEach((btn) => {
    btn.addEventListener('click', () => onDefendCast(btn.dataset.spell));
  });
}
