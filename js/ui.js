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

export function showGameScreen() {
  document.getElementById('screen-create').classList.remove('active');
  document.getElementById('screen-game').classList.add('active');
}

export function bindHud({ onLocate, onFullscreen, onSpeedToggle, onPowersToggle, onLogToggle, onReset }) {
  document.getElementById('btn-locate').addEventListener('click', onLocate);

  const menuPanel = document.getElementById('menu-panel');
  menuPanel.innerHTML = `
    <button id="menu-fullscreen">⛶ Fullscreen</button>
    <button id="menu-speed">⚡ Fast</button>
    <button id="menu-powers">🔮 Runes: 0</button>
    <button id="menu-log">📜 Spell Log</button>
    <button id="menu-reset" class="menu-danger">🔄 New Wizard</button>
  `;
  document.getElementById('btn-menu').addEventListener('click', () => menuPanel.classList.toggle('hidden'));
  document.getElementById('menu-fullscreen').addEventListener('click', () => {
    onFullscreen();
    menuPanel.classList.add('hidden');
  });
  document.getElementById('menu-speed').addEventListener('click', onSpeedToggle);
  document.getElementById('menu-powers').addEventListener('click', () => {
    onPowersToggle();
    menuPanel.classList.add('hidden');
  });
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
  document.getElementById('btn-powers-close').addEventListener('click', () => {
    document.getElementById('powers-panel').classList.add('hidden');
  });
}

export function setSpeedLabel(text) {
  const el = document.getElementById('menu-speed');
  if (el) el.textContent = text;
}

export function setRunesLabel(n) {
  const el = document.getElementById('menu-powers');
  if (el) el.textContent = `🔮 Runes: ${n}`;
}

// The bottom-sheet panels (log, powers, and — QA-mode-only — qa) all sit in
// the same screen area at the same z-index, so leaving one open while
// opening another would visually stack them and let the hidden one's DOM
// intercept clicks meant for the one on top. Only one is ever shown at a
// time; `qa-panel` is looked up defensively since it doesn't exist outside
// ?qa=1.
function closeAllBottomPanels() {
  document.getElementById('log-panel').classList.add('hidden');
  document.getElementById('powers-panel').classList.add('hidden');
  document.getElementById('qa-panel')?.classList.add('hidden');
}

function toggleBottomPanel(id) {
  const panel = document.getElementById(id);
  const wasHidden = panel.classList.contains('hidden');
  closeAllBottomPanels();
  if (wasHidden) panel.classList.remove('hidden');
}

export function toggleLog() {
  toggleBottomPanel('log-panel');
}

export function togglePowersPanel() {
  toggleBottomPanel('powers-panel');
}

// Two stacked power-cards (Spell Power, Spell Recovery) inside #powers-panel.
// `data` is plain numbers/strings computed by main.js from wizard.js's
// upgrade helpers — this function only renders and wires clicks.
export function renderPowersPanel(data, callbacks) {
  document.getElementById('powers-balance').innerHTML = `Balance: <strong>${data.runes}</strong> 🔮 Runes`;
  const cardsEl = document.getElementById('powers-cards');
  cardsEl.innerHTML = renderPowerCard(data.power, 'btn-buy-power') + renderPowerCard(data.recovery, 'btn-buy-recovery');
  if (!data.power.maxed && data.power.canAfford) {
    document.getElementById('btn-buy-power').addEventListener('click', callbacks.onBuyPower);
  }
  if (!data.recovery.maxed && data.recovery.canAfford) {
    document.getElementById('btn-buy-recovery').addEventListener('click', callbacks.onBuyRecovery);
  }
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
  menuPanel.appendChild(menuBtn);
  menuBtn.addEventListener('click', () => {
    toggleBottomPanel('qa-panel');
    menuPanel.classList.add('hidden');
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
      </div>
    </div>
    <div class="qa-section" id="qa-power-row"></div>
    <div class="qa-section" id="qa-recovery-row"></div>
  `;
  document.getElementById('screen-game').appendChild(panel);

  document.getElementById('qa-close').addEventListener('click', () => panel.classList.add('hidden'));
  document.getElementById('qa-runes-set').addEventListener('click', () => {
    const raw = document.getElementById('qa-runes-input').value;
    callbacks.onSetRunes(Number(raw));
  });
  document.getElementById('qa-runes-add-100').addEventListener('click', () => callbacks.onAddRunes(100));
  document.getElementById('qa-runes-add-1000').addEventListener('click', () => callbacks.onAddRunes(1000));
}

// Rebuilds the current-balance text and the two level-stepper rows every
// render (like renderPowersPanel does for its buy buttons) — deliberately
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

export function renderHud(player) {
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
// The game loop re-renders this every tick to keep HP/mana/cooldowns live,
// so the animated `.sheet-panel` shell is only (re)created when the open
// target changes, not on every tick — otherwise its entrance animation
// would replay every 250ms and the sheet would visibly jump.
let currentSheetKey = null;

export function renderWizardSheet(data, callbacks) {
  const el = document.getElementById('wizard-sheet');
  if (!data) {
    currentSheetKey = null;
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');

  const key = data.kind === 'self' ? 'self' : `npc:${data.wizard.id}`;
  if (key !== currentSheetKey) {
    currentSheetKey = key;
    el.innerHTML = `
      <div class="sheet-panel">
        <button class="sheet-close" id="sheet-close">✕</button>
        <div id="sheet-body"></div>
      </div>`;
    document.getElementById('sheet-close').addEventListener('click', callbacks.onClose);
  }
  const body = document.getElementById('sheet-body');

  if (data.kind === 'self') {
    const { wizard: w, shieldSpell, shieldActive, shieldRemainingS, shieldReady, shieldReason } = data;
    body.innerHTML = `
      <div class="sheet-header">
        <span class="sheet-avatar">${avatarWithRing(w.avatar, getElement(w.element).color, { hp: w.hp, maxHP: w.maxHP, ringColor: 'var(--mana)', shieldActive })}</span>
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
      ${!shieldReady && shieldReason ? `<div class="sheet-reason">${shieldReason}</div>` : ''}`;
    if (shieldReady) document.getElementById('sheet-shield').addEventListener('click', callbacks.onShield);
    return;
  }

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

  const { wizard: npc, atkSpell, canAttack, reason, dist, shieldActive } = data;
  body.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-avatar">${avatarWithRing(npc.avatar, getElement(npc.element).color, { hp: npc.hp, maxHP: npc.maxHP, ringColor: 'var(--pink)', shieldActive: !!shieldActive })}</span>
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
    ${!canAttack ? `<div class="sheet-reason">${reason}</div>` : ''}`;
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
      const onCooldown = (player.cooldowns[counterSpell.id] || 0) > now;
      const lowMana = player.mana < counterSpell.manaCost;
      const ready = !onCooldown && !lowMana;
      const reason = lowMana ? 'Not enough mana.' : onCooldown ? 'Still recharging.' : '';
      return `<div class="defend-card">
        <div class="defend-title">⚠️ Incoming ${spell.icon} ${spell.name}! (${formatCountdown(msLeft)})</div>
        <div class="defend-timer"><div class="defend-timer-fill" style="width:${barPct}%"></div></div>
        <div class="defend-actions">
          <button data-proj="${p.id}" class="defend-btn${ready ? '' : ' disabled'}">
            ${counterSpell.icon} Counterspell <span class="sheet-btn-cost">${counterSpell.manaCost}💧</span>
          </button>
        </div>
        ${!ready ? `<div class="defend-reason">${reason}</div>` : ''}
      </div>`;
    })
    .join('');
  overlay.querySelectorAll('.defend-btn:not(.disabled)').forEach((btn) => {
    btn.addEventListener('click', () => onCounter(btn.dataset.proj));
  });
}
