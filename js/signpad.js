// DOM for the sign-drawing overlay. Scoring lives in sign.js.
// Flow: WATCH (the sign is drawn point by point) -> the sign vanishes ->
// DRAW (from memory, against a level-based timer) -> RESULT.
import { SIGN, BAND, scoreDrawing, scoreToMultiplier, drawTimeMs } from './sign.js';

const RESULT_MS = 1100;
const MIN_POINTS = 8;
const DEMO_MS = 2600; // pen travels the whole sign in this long
const HOLD_MS = 450; // finished sign stays visible this long...
const FADE_MS = 600; // ...then fades out

const PAD = 40;

// Points along the sign's strokes, with cumulative arc length, for the demo pen.
function buildPath(S) {
  const pts = [];
  for (const st of SIGN.strokes) {
    for (const p of st) pts.push({ x: PAD + p.x * (S - 2 * PAD), y: PAD + p.y * (S - 2 * PAD) });
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, total: cum[cum.length - 1] };
}

// Pen position + the polyline drawn so far at arc length d.
function penAt(path, d) {
  const trail = [path.pts[0]];
  for (let i = 1; i < path.pts.length; i++) {
    if (d >= path.cum[i]) { trail.push(path.pts[i]); continue; }
    const t = (d - path.cum[i - 1]) / (path.cum[i] - path.cum[i - 1]);
    const a = path.pts[i - 1], b = path.pts[i];
    trail.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    break;
  }
  return trail;
}

// Calls onDone(multiplier, score) once the player has drawn (or time ran out).
// There is no cancel: once a cast starts, it ends in a cast (auto-cast when the
// timer runs out). Only one pad can be open at a time.
export function openSignPad({ title, level = 1, onDone }) {
  if (document.getElementById('sign-pad')) return;
  const drawMs = drawTimeMs(level);
  const el = document.createElement('div');
  el.id = 'sign-pad';
  el.className = 'sign-pad';
  el.innerHTML = `
    <div class="sign-card">
      <div class="sign-title">${title}</div>
      <div class="sign-hint"></div>
      <canvas class="sign-canvas" width="300" height="300"></canvas>
      <div class="sign-result" aria-live="polite">&nbsp;</div>
      <div class="sign-actions">
        <button type="button" class="sign-btn" data-act="clear" disabled>↺ Clear</button>
        <button type="button" class="sign-btn primary" data-act="cast" disabled>✨ Cast</button>
      </div>
    </div>`;
  document.getElementById('screen-game').appendChild(el);

  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const hintEl = el.querySelector('.sign-hint');
  const resultEl = el.querySelector('.sign-result');
  const clearBtn = el.querySelector('[data-act=clear]');
  const castBtn = el.querySelector('[data-act=cast]');
  const S = canvas.width;
  const path = buildPath(S);
  const bandPx = 2 * BAND * (S - 2 * PAD);

  let phase = 'watch'; // watch | draw | result
  let phaseStart = performance.now();
  let strokes = [];
  let current = null;
  let raf = 0;
  let closed = false;

  function strokePath(points, widthPx, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (points.length === 1) ctx.lineTo(points[0].x + 0.1, points[0].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function render(now) {
    ctx.clearRect(0, 0, S, S);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const t = now - phaseStart;
    if (phase === 'watch') {
      const d = Math.min(1, t / DEMO_MS) * path.total;
      const trail = penAt(path, d);
      // Fade out once the pen is done and the hold has passed.
      const alpha = t <= DEMO_MS + HOLD_MS ? 1 : Math.max(0, 1 - (t - DEMO_MS - HOLD_MS) / FADE_MS);
      // The wide band is the real tolerance (BAND each side of the line): ink
      // anywhere inside it counts as on the sign.
      strokePath(trail, bandPx, 'rgba(255, 214, 102, 0.35)', alpha);
      strokePath(trail, 4, '#ffd666', alpha);
      if (t <= DEMO_MS + HOLD_MS) {
        const pen = trail[trail.length - 1];
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(pen.x, pen.y, 7, 0, Math.PI * 2); ctx.fill();
      }
      if (t >= DEMO_MS + HOLD_MS + FADE_MS) startDraw(now);
    } else {
      for (const st of strokes) strokePath(st, 6, '#8ff');
      if (phase === 'draw') {
        const left = Math.max(0, drawMs - t);
        // The Cast button is the countdown: green -> yellow -> red as the
        // auto-cast approaches, with the seconds left on its label.
        const r = left / drawMs;
        castBtn.style.background = `hsl(${Math.round(120 * r)}, 78%, 52%)`;
        castBtn.style.borderColor = 'transparent';
        castBtn.textContent = `✨ Cast · ${Math.ceil(left / 1000)}s`;
        if (left <= 0) finish(true);
      }
    }
  }

  function loop(now) {
    if (closed) return;
    render(now);
    raf = requestAnimationFrame(loop);
  }

  function startDraw(now) {
    phase = 'draw';
    phaseStart = now;
    hintEl.textContent = `Draw the ${SIGN.name} from memory!`;
    clearBtn.disabled = false;
    castBtn.disabled = false;
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * S, y: ((e.clientY - r.top) / r.height) * S };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (phase !== 'draw') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    current = [pos(e)];
    strokes.push(current);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (current && phase === 'draw') current.push(pos(e));
  });
  const end = () => { current = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function close() {
    closed = true;
    cancelAnimationFrame(raf);
    el.remove();
  }

  function finish(timedOut) {
    if (phase !== 'draw') return;
    phase = 'result';
    current = null;
    clearBtn.disabled = true;
    castBtn.disabled = true;
    const pts = strokes.reduce((n, s) => n + s.length, 0);
    const score = pts < MIN_POINTS ? 0 : scoreDrawing(strokes);
    const mult = scoreToMultiplier(score);
    resultEl.textContent = pts < MIN_POINTS
      ? `${timedOut ? "Time's up! " : ''}Nothing drawn → ×${mult.toFixed(2)} power`
      : `${timedOut ? "Time's up! " : ''}Accuracy ${Math.round(score * 100)}% → ×${mult.toFixed(2)} power`;
    setTimeout(() => { close(); onDone(mult, score); }, RESULT_MS);
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || phase === 'result') return;
    if (phase !== 'draw') return;
    if (act === 'clear') strokes = [];
    else if (act === 'cast') finish(false);
  });

  hintEl.textContent = `Watch the ${SIGN.name} — you'll draw it from memory in ${Math.round(drawMs / 1000)}s.`;
  raf = requestAnimationFrame((now) => { phaseStart = now; loop(now); });
}
