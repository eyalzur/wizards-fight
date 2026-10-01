// DOM for the sign-drawing overlay. Scoring lives in sign.js.
import { SIGN, scoreDrawing, scoreToMultiplier } from './sign.js';

const RESULT_MS = 1100;
const MIN_POINTS = 8;

// Shows the sign, lets the player draw it, then calls onDone(multiplier, score).
// onCancel() fires if they back out. Only one pad can be open at a time.
export function openSignPad({ title, onDone, onCancel }) {
  if (document.getElementById('sign-pad')) return;
  const el = document.createElement('div');
  el.id = 'sign-pad';
  el.className = 'sign-pad';
  el.innerHTML = `
    <div class="sign-card">
      <div class="sign-title">${title}</div>
      <div class="sign-hint">Trace the ${SIGN.name} — the closer, the stronger.</div>
      <canvas class="sign-canvas" width="300" height="300"></canvas>
      <div class="sign-result" aria-live="polite">&nbsp;</div>
      <div class="sign-actions">
        <button type="button" class="sign-btn" data-act="cancel">✕ Cancel</button>
        <button type="button" class="sign-btn" data-act="clear">↺ Clear</button>
        <button type="button" class="sign-btn primary" data-act="cast">✨ Cast</button>
      </div>
    </div>`;
  document.getElementById('screen-game').appendChild(el);

  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const resultEl = el.querySelector('.sign-result');
  const S = canvas.width;
  const PAD = 40;
  let strokes = [];
  let current = null;
  let locked = false;

  function draw() {
    ctx.clearRect(0, 0, S, S);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Ghost guide
    ctx.strokeStyle = 'rgba(255, 214, 102, 0.3)';
    ctx.lineWidth = 8;
    ctx.setLineDash([2, 12]);
    for (const st of SIGN.strokes) {
      ctx.beginPath();
      st.forEach((p, i) => {
        const x = PAD + p.x * (S - 2 * PAD), y = PAD + p.y * (S - 2 * PAD);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Player's strokes
    ctx.strokeStyle = '#8ff';
    ctx.lineWidth = 6;
    for (const st of strokes) {
      ctx.beginPath();
      st.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (st.length === 1) ctx.lineTo(st[0].x + 0.1, st[0].y);
      ctx.stroke();
    }
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * S, y: ((e.clientY - r.top) / r.height) * S };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (locked) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    current = [pos(e)];
    strokes.push(current);
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    current.push(pos(e));
    draw();
  });
  const end = () => { current = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function close() { el.remove(); }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || locked) return;
    if (act === 'cancel') { close(); onCancel?.(); }
    else if (act === 'clear') { strokes = []; resultEl.innerHTML = '&nbsp;'; draw(); }
    else if (act === 'cast') {
      const pts = strokes.reduce((n, s) => n + s.length, 0);
      if (pts < MIN_POINTS) { resultEl.textContent = 'Draw the sign first!'; return; }
      const score = scoreDrawing(strokes);
      const mult = scoreToMultiplier(score);
      locked = true;
      resultEl.textContent = `Accuracy ${Math.round(score * 100)}% → ×${mult.toFixed(2)} power`;
      setTimeout(() => { close(); onDone(mult, score); }, RESULT_MS);
    }
  });

  draw();
}
