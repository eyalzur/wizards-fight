// Sign drawing: pure scoring logic (no DOM). The player redraws a sign and the
// similarity (0..1) becomes a power multiplier for attack and defense spells.

// One-stroke pentagram in a unit box, y down.
const PENTAGRAM = [0, 2, 4, 1, 3, 0].map((i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) };
});

export const SIGN = { id: 'pentagram', name: 'Star Sigil', strokes: [PENTAGRAM] };

// Time to draw from memory once the sign has vanished: starts generous and
// tightens with level (10s at Lv.1, -0.5s per level, never below 4s).
export function drawTimeMs(level = 1) {
  return Math.max(4000, 10000 - 500 * (Math.max(1, level) - 1));
}

export const MIN_MULT = 0.5;
export const MAX_MULT = 1.5;
// Multiplier at/above which a Counterspell lands (score 0.5).
export const COUNTER_MIN_MULT = 1.0;

const SAMPLES = 64;
// Mean shape distance (in sign-sized units): at or below GOOD_DIST the score is
// 1, at or above BAD_DIST it is 0, linear in between. Tuned so careful tracing
// lands ~85-100%, an average hand ~55%, and a sloppy scribble under 25%.
const GOOD_DIST = 0.025;
const BAD_DIST = 0.075;

export function scoreToMultiplier(score) {
  return MIN_MULT + (MAX_MULT - MIN_MULT) * Math.max(0, Math.min(1, score));
}

function resample(strokes, n) {
  const segs = [];
  let total = 0;
  for (const s of strokes) {
    for (let i = 1; i < s.length; i++) {
      const len = Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
      if (len > 0) { segs.push({ a: s[i - 1], b: s[i], len }); total += len; }
    }
  }
  if (!total) return [];
  const out = [];
  let si = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    while (si < segs.length - 1 && acc + segs[si].len < d) { acc += segs[si].len; si++; }
    const { a, b, len } = segs[si];
    const t = Math.min(1, Math.max(0, (d - acc) / len));
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

// Center on the bounding box and scale uniformly so the longest side is 1.
function normalize(pts) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY);
  if (size < 1e-6) return null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return pts.map((p) => ({ x: (p.x - cx) / size, y: (p.y - cy) / size }));
}

function meanNearest(from, to) {
  let sum = 0;
  for (const p of from) {
    let best = Infinity;
    for (const q of to) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    sum += best;
  }
  return sum / from.length;
}

// strokes: array of arrays of {x, y} in any pixel space. Returns 0..1.
// Position, size and drawing direction/start don't matter; only the shape.
// Both directions are checked, so missing parts of the sign or stray extra
// lines both lower the score.
export function distanceToScore(d) {
  return Math.max(0, Math.min(1, (BAD_DIST - d) / (BAD_DIST - GOOD_DIST)));
}

export function drawingDistance(strokes, sign = SIGN) {
  const drawn = normalize(resample(strokes, SAMPLES));
  const ref = normalize(resample(sign.strokes, SAMPLES));
  if (!drawn || !ref) return Infinity;
  return (meanNearest(drawn, ref) + meanNearest(ref, drawn)) / 2;
}

export function scoreDrawing(strokes, sign = SIGN) {
  return distanceToScore(drawingDistance(strokes, sign));
}
