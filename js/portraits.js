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
const KNOWN_SYMBOLS = ['portrait-hood-a', 'portrait-hood-b', 'portrait-hood-c'];
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
