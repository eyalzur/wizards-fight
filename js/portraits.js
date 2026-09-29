// Turns a wizard's `avatar` field into portrait <svg> markup that references
// the inline sprite `<symbol>`s defined near the top of index.html's <body>.
// Pure string building, no DOM access — shared by ui.js and map.js so both
// render avatars identically without duplicating the parse/flip logic in
// each (see docs/ARCHITECTURE.md for why this is its own small module
// instead of living in one of them).
//
// `avatar` is serialized as "portrait-hood-a" or "portrait-hood-a:flip" (the
// `:flip` suffix mirrors the artwork via CSS instead of needing separate
// art). Anything unrecognized (e.g. a pre-theme-change save with an old
// emoji avatar) falls back to the first portrait rather than rendering a
// broken <use> reference.
const KNOWN_SYMBOLS = ['portrait-hood-a', 'portrait-hood-b', 'portrait-hood-c', 'portrait-hood-d', 'portrait-hood-e'];
const DEFAULT_SYMBOL = 'portrait-hood-a';

export function parseAvatar(avatar) {
  const [symbolRaw, flag] = (avatar || '').split(':');
  const symbol = KNOWN_SYMBOLS.includes(symbolRaw) ? symbolRaw : DEFAULT_SYMBOL;
  return { symbol, flip: flag === 'flip' };
}

// `elColor` tints the (currently featureless) hood via `currentColor` inside
// the sprite; the colored ring around the avatar's container is what
// actually encodes identity (self/NPC/selected) — this tint is just flavor.
export function avatarSvg(avatar, elColor) {
  const { symbol, flip } = parseAvatar(avatar);
  const style = `width:100%;height:100%;${elColor ? `color:${elColor};` : ''}${flip ? 'transform:scaleX(-1);' : ''}`;
  return `<svg class="portrait" style="${style}"><use href="#${symbol}"></use></svg>`;
}

// ---------- Identity+HP ring wrapper ----------
// Every place an avatar appears in-game (map marker, HUD, wizard sheet) now
// wraps the portrait in the same 48px ring: a dim full-circle "track" plus a
// colored arc whose length is hp/maxHP (an actual HP gauge, not just mood
// lighting) and whose color is the existing identity signal (self = mana
// blue, NPC = pink/garnet, selected NPC = gold) — same job the old static
// border did, now doing double duty. `ringColor` is passed as a CSS custom-
// property token string (e.g. 'var(--mana)') so the caller decides identity
// colors and this module stays a dumb renderer, matching how `casterColor`
// is threaded into renderProjectiles rather than looked up here.
//
// A translucent pulsing "shield-bubble" layer (Ward Shield's map-visible
// effect) is included when `shieldActive` is true; it sits behind the ring
// in DOM order so it reads as a bubble enclosing the wizard rather than
// competing with the HP arc.
const RING_SIZE = 48; // overall wrap: avatar (40px, set in CSS) + gauge ring
const RING_RADIUS = 21; // sits ~2-3px outside the 40px avatar's edge; stroke-width (3) is set in CSS (.hp-ring-track/.hp-ring-arc)
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function avatarWithRing(avatar, elColor, opts = {}) {
  const {
    hp = 1,
    maxHP = 1,
    ringColor = 'var(--gold)',
    shieldActive = false,
    avatarClass = '',
    wrapClass = '',
  } = opts;
  const frac = maxHP > 0 ? Math.max(0, Math.min(1, hp / maxHP)) : 0;
  const dashoffset = (RING_CIRCUMFERENCE * (1 - frac)).toFixed(2);
  const c = RING_SIZE / 2;
  return `
    <div class="marker-ring-wrap${wrapClass ? ` ${wrapClass}` : ''}">
      ${shieldActive ? '<div class="shield-bubble"></div>' : ''}
      <svg class="hp-ring" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}" width="${RING_SIZE}" height="${RING_SIZE}" aria-hidden="true">
        <circle class="hp-ring-track" cx="${c}" cy="${c}" r="${RING_RADIUS}"/>
        <circle class="hp-ring-arc" cx="${c}" cy="${c}" r="${RING_RADIUS}" style="stroke:${ringColor};stroke-dasharray:${RING_CIRCUMFERENCE.toFixed(2)};stroke-dashoffset:${dashoffset};"/>
      </svg>
      <div class="marker-avatar${avatarClass ? ` ${avatarClass}` : ''}">${avatarSvg(avatar, elColor)}</div>
    </div>`;
}
