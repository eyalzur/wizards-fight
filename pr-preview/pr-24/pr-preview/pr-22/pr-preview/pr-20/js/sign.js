// Sign drawing: pure scoring logic (no DOM). The player redraws a sign and the
// similarity (0..1) becomes a power multiplier for attack and defense spells.

// One-stroke pentagram in a unit box, y down.
const PENTAGRAM = [0, 2, 4, 1, 3, 0].map((i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) };
});

export const SIGN = { id: 'pentagram', name: 'Star Sigil', strokes: [PENTAGRAM] };

// Closed hexagon in a unit box, y down — reads as a shield/crest outline.
// Ward Shield's sign.
const HEXAGON = [
  { x: 0.5, y: 0.05 },
  { x: 0.9, y: 0.3 },
  { x: 0.9, y: 0.7 },
  { x: 0.5, y: 0.95 },
  { x: 0.1, y: 0.7 },
  { x: 0.1, y: 0.3 },
  { x: 0.5, y: 0.05 },
];

export const WARD_RUNE = { id: 'ward_rune', name: 'Ward Rune', strokes: [HEXAGON] };

// Open jagged zigzag ("lightning crack") in a unit box, y down, a single
// open stroke (not closed). Counterspell's sign.
const CRACK = [
  { x: 0.7, y: 0.05 },
  { x: 0.3, y: 0.4 },
  { x: 0.6, y: 0.45 },
  { x: 0.2, y: 0.8 },
  { x: 0.55, y: 0.6 },
  { x: 0.35, y: 0.95 },
];

export const BREAK_SIGIL = { id: 'break_sigil', name: 'Break Sigil', strokes: [CRACK] };

// Time to draw from memory once the sign has vanished: starts generous and
// tightens with level (10s at Lv.1, -0.5s per level, never below 4s).
export function drawTimeMs(level = 1) {
  return Math.max(4000, 10000 - 500 * (Math.max(1, level) - 1));
}

export const MIN_MULT = 0.5;
export const MAX_MULT = 1.5;
// Multiplier at/above which a Counterspell lands (score 0.5).
export const COUNTER_MIN_MULT = 1.0;

// Half-width of the sign's "road" (sign-sized units): ink within this distance
// of the true line counts as exactly on it, so you don't have to hit a hairline.
// signpad.js draws the demo stroke this wide so the player can see the margin.
export const BAND = 0.04;

const SAMPLES = 64;
// Mean shape distance (in sign-sized units): at or below GOOD_DIST the score is
// 1, at or above BAD_DIST it is 0, linear in between. Tuned so careful tracing
// lands ~90-100%, a hasty hand ~70-80%, and a sloppy scribble under 30%.
const GOOD_DIST = 0.002;
const BAD_DIST = 0.035;

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
    sum += Math.max(0, best - BAND);
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
