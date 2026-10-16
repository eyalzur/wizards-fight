# Wizards Fight — Project Status

Last updated: 2026-10-14

This file is the single source of truth for "what exists, what's next, and
why we made the calls we made." Run `/resume-proj` to get a suggested next
task based on this file plus any open GitHub issues.

See also: [`docs/FEATURES.md`](docs/FEATURES.md) (what the game does),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (how it's built),
[`docs/WORKFLOW.md`](docs/WORKFLOW.md) (how we build it),
[`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md) (how we verify it).

## Snapshot

A browser wizard-duel game on a real street map, built for kids/teens
(roughly 13–25, boys-skewing). Still a static site on GitHub Pages with
no accounts (anonymous device identity only) — but as of 2026-09-26 it
has a backend, Firebase, specifically to support lightweight async
multiplayer (see Decisions Log). Single-player against NPCs remains the
core, always-available experience; real players are an optional overlay
on top of it when the repo owner has a Firebase project configured (see
`docs/ARCHITECTURE.md` "Multiplayer" and "Setup").

**Live:** https://eyalzur.github.io/wizards-fight/
**Deploy branch:** `main` (GitHub Pages → Settings → Pages → Branch: `main`)

## What's live now

- **Wizard creation** — name, one of 5 avatars, one of 5 elements (Fire,
  Ice, Lightning, Nature, Arcane). Element sets stat flavor only (power,
  HP, defense, sense range, mana, cast speed) — it does not change which
  spells you get.
- **The map** — real streets and city labels via Leaflet + Esri World Light
  Gray Canvas tiles (not Google Maps — see Decisions Log; light tiles as of
  the 2026-10-14 "Watercolor Ghibli" theme pass, dark before that).
  Tap-to-walk (max 250m per tap, animated), a 📍 button to sync your real
  location, and a dotted circle showing your **sense range**: NPCs outside
  it are not shown at all.
- **Spells (3 total, same for everyone)**:
  - **Spark Bolt** (attack) — travels at a real 1 m/s, so a cast takes
    real minutes to land at "Real" time scale. A ⚡/🐢 toggle in the ☰
    menu speeds this up 30x for testing.
  - **Ward Shield** (defend) — a proactive stance, raised ahead of time.
    Gives an absorb pool sized off your own max HP (`shieldFraction: 0.35`
    × sign-mult — a first guess, see Decisions log); hits subtract from the
    pool (full absorb = 0 real damage) until it breaks (overflow gets
    through), or it expires after a 2-minute backstop timer if never
    broken.
  - **Counterspell** (defend) — reactive: cast during the incoming-curse
    alert to negate that *specific* spell outright.
- **Sign drawing** — every cast opens a pad that draws that spell's sign
  point by point, then makes it vanish; the player redraws it from memory
  against a timer (10s at Lv.1, −0.5s per level, floor 4s) — the sign is
  shown as a wide band (±4% of its size) and ink anywhere inside it counts
  as on the line — only Clear and Cast buttons, the Cast button turns
  green→red with the seconds left and auto-casts at zero and similarity
  (position/size/direction-independent) maps to a ×0.5–×1.5 power
  multiplier (attack damage, shield pool size). A Counterspell needs
  ×1.0+ or it fizzles (mana still spent). NPCs cast at ×1. Scoring in
  `js/sign.js`, overlay in `js/signpad.js`. Each spell has its own fixed
  sign, no player choice: Spark Bolt draws the ⭐ Star Sigil (a one-stroke
  pentagram), Ward Shield draws the 🛡️ Ward Rune (a closed hexagon/shield
  outline), Counterspell draws the 🌀 Break Sigil (an open jagged
  zigzag/lightning-crack). All three score against the same thresholds —
  this is shape variety, not per-sign difficulty tuning; thresholds are
  first guesses.
- **Incoming-curse alert** — however many curses are in flight, one slim card
  shows the one landing soonest (name, countdown, "+N more" chip) with a
  single Counterspell button that targets it; countering reveals the next.
- **Zoomable map, bounded 14–19** — reversed 2026-10-11 from the original
  "fixed at zoom 17" decision, by direct user request (see Decisions Log).
  Zoom buttons, pinch, double-tap and scroll wheel all work; the 14–19
  bound is a first guess, not tuned from play. Every gameplay distance
  (sense range, the 250m tap-to-walk cap, NPC spawn radius) is real-meters
  math (`js/geo.js`), independent of zoom, so nothing needed to change
  there. Panning still works, as before.
- **Combat UX** — tapping any wizard (yourself or an NPC) opens a
  contextual docked bottom sheet (the map shrinks above it; one overlay at
  a time; incoming attacks get their own strip under the HUD) with their stats and the one relevant action
  (Attack for NPCs, Raise Shield for yourself). No always-on spellbook.
- **NPCs** — 9 spawned per game around the player, random element/level/
  name/temperament (passive/neutral/aggressive, which drives how often
  they attack and how readily they shield/counter). Respawn 30–50s after
  defeat.
- **Progression** — XP on NPC kill, leveling grows stats and heals you.
  Player defeat is a soft penalty (4s downtime, respawn at 60% HP/mana) —
  no permadeath.
- **Runes & Powers** — a second, ongoing earn-and-spend currency (🔮
  Runes) alongside XP: every NPC kill grants Runes using the same formula
  as XP. Runes buy permanent, capped, non-refundable upgrades to two
  attributes — Spell Power (+5%/level Spark Bolt damage, cap Lv.3/+15%)
  and Spell Recovery (−0.1s/level Spark Bolt cooldown, cap Lv.3/1.2s) —
  from the 🧙 Character screen (bottom tab bar; see "Shop, Inventory,
  Character and Missions screens" below — this used to be a separate
  "🔮 Runes & Powers" bottom sheet). Player-only; NPCs don't earn or spend
  Runes. See `docs/FEATURES.md` for exact numbers.
- **Persistence** — wizard (including Runes balance and Powers levels) +
  NPCs + spawn point + speed setting saved to `localStorage`. No
  accounts, nothing leaves the browser except the optional multiplayer
  sync below.
- **Mana Crystals economy (Phase 1)** — 💎 passive income into an uncapped
  Treasury pot (scaled by ⚡ Fast while the page is open), a small kill
  bonus, and a Shop screen (bottom tab bar) selling 5 wand tiers and 5 robe
  tiers, each upgradable +1..+10 with 💎 (deterministic, no gambling), so a
  maxed avatar is overwhelmingly stronger than same-level NPCs. Numbers in
  `docs/FEATURES.md` are first guesses.
- **Shop, Inventory, Character, Missions screens + persistent bottom tab
  bar (2026-10-09, menu→tab-bar nav change 2026-10-10)** — the old "💎
  Crystal Shop" docked sheet and "🔮 Runes & Powers" bottom panel were
  replaced by full, non-map screens; reached via a persistent 5-tab bottom
  bar (🗺️ Map / 🛒 Shop / 🎒 Inventory / 🧙 Character / 📜 Missions, visible
  on every screen except wizard creation), not the ☰ menu or a per-screen
  "← Back to Map" button any more. Inventory is a new (deliberately
  minimal) equipped-loadout view of the 2 gear slots; Shop/Character just
  promote existing content to more room; **Missions is a static
  placeholder, not a built feature** — see Decisions Log and the Roadmap
  entry below. Spells keep traveling while any of these 4 screens is open
  (the game loop never pauses), so each carries an off-map incoming-curse
  banner that jumps back to the map. See `docs/FEATURES.md` "Shop,
  Inventory, Character and Missions screens" and the Decisions Log entries
  below.
- **Nemesis System** — whichever NPC most recently defeated you becomes
  your "Nemesis" (one field, `nemesisId`, on your own wizard): called out
  by name in the incoming-curse alert and with a badge on its wizard sheet,
  +20% max HP/+15% power/+2 defense while it holds the title, and it levels
  alongside you (re-syncs toward your level on respawn, unlike every other
  NPC). Defeating it back clears the title and pays a 1.75x XP/Rune/Crystal
  bonus on that kill. Local-NPC-kills only — a real player's hit can't set
  it (see Decisions Log). See `docs/FEATURES.md` "Nemesis System" for the
  exact numbers.
- **Multiplayer (optional, needs the repo owner's own Firebase project)**
  — real players' wizards appear on the map like NPCs (last-synced
  position, sense-range gated, distinct purple-badge marker), with a
  wizard sheet showing "synced Xm ago" and a note that they may be
  offline. Casting Spark Bolt at one works like casting at an NPC (same
  cost/cooldown/UI) but always travels at real speed and resolves on the
  *target's* device — even much later, even if neither device was online
  at the exact impact moment — using anonymous device identity (Firebase
  Anonymous Auth), no accounts. NPCs are not replaced or reduced by this;
  they remain the reliable fallback everywhere real-player density is
  low. Any hits that landed while you were away are surfaced as one
  summary toast on reload. See `docs/FEATURES.md` "Multiplayer" and
  `docs/ARCHITECTURE.md` "Multiplayer" for the full mechanics.
- **Deploy** — static site, GitHub Pages, deploys from `main`.

## Known gaps / not yet built

- No automated test suite committed to the repo. Verification so far has
  been manual Playwright smoke tests run ad hoc during development (see
  `docs/QA-CHECKLIST.md` for what to check by hand until this changes).
- No sound, no animations beyond the projectile flight and sheet slide-up.
- Multiplayer (see "What's live now") has no live presence indicators, no
  matchmaking, and no chat — deferred by design for v1, not an oversight
  (see Decisions Log). It also has no reactive Counterspell window against
  a real player's incoming attack (only Ward Shield's absorb pool, if one
  is up, applies) — that would need live syncing this v1 deliberately
  doesn't do.
- Real-player density is expected to be near zero in most areas for a
  while (this is a small hobby project, not a live service with a user
  base) — NPCs staying as the primary opponent is intentional, not a
  fallback that's expected to disappear soon.
- Balance (spell numbers, XP curve, NPC aggression rates) is a first
  guess, not tuned from real play data.
- No accessibility pass (screen reader labels, focus order, contrast
  check beyond the design's own dark palette).
- Real map speed (spells take real minutes) has not been validated with
  an actual multi-minute play session end-to-end — only under the Fast
  test multiplier.

## Roadmap (unordered backlog — `/resume-proj` helps prioritize)

Mana Crystals economy phases (Phase 1 is live, see above):
- **Phase 2** — 📍 walk income (crystals for really moving around). The
  5-tier ladder per slot and item upgrades are DONE (2026-10-02); level
  gates for the ladder were not added. New wizards already default to Real.
- PvP scaling — DECIDED 2026-10-03: gear stays fully active against real
  players (see Decisions log). Revisit if real players report it unfun.
- **Phase 3** — potion slots (heal, mana, power boost).
- **Phase 4** — element-specific gear and wands that unlock element spells.
  Also tune numbers from real play data.
- Deferred: map-marker gear glyphs.

- **📜 Missions tab is a placeholder (added 2026-10-10, see Decisions
  log)** — points at Future feature concept #1 (Bounty Board) below. Pull
  that concept up here and scope it before building anything behind the
  tab; until then it stays static "Coming soon" copy.

- **Avatar face redraw** — give the 5+ hood looks simple expressive faces
  (Pixar-shorts-simplicity, not full rigging), legibility-tested at the
  ~40px map-marker scale, possibly reworking the mirrored-variant trick
  since asymmetric faces can't mirror as cleanly as the current sash hack.
  Scoped but not started. Deliberately deferred out of the 2026-10-11
  "Pixar" theme pass (see Decisions Log) — that pass intentionally left
  the hooded avatars faceless, same as every pass before it.

- Reintroduce element-specific attack spells (Fireball, Frost Shard,
  Thunder Jab, Thornwhip) and a heal spell (Minor Renewal), now that the
  1-attack/2-defend baseline is proven — see Decisions Log for why they
  were cut.
- Elemental strengths/weaknesses (e.g. fire beats nature).
- Point-buy stat allocation at character creation instead of fixed
  per-element stats.
- Spell unlocks tied to leveling, not just stat growth.
- Sound effects and hit/impact animation.
- A real automated test suite (the Playwright smoke-test pattern used
  during manual development is a natural starting point).
- PWA install support for a more app-like mobile feel.
- Guilds/covens or a simple leaderboard.
- Revisit whether the real street map is pulling its weight once played
  at Real speed for a while, vs. a simpler abstract "nearby" view (the
  map was speculative from the start — see Decisions Log).
- Live presence / "who's online now," matchmaking, and chat for
  multiplayer — all explicitly deferred in the 2026-09-26 multiplayer
  work, not ruled out forever; each is its own product-design
  conversation before being built.
- If real-player density ever grows enough to matter, `multiplayer.js`
  currently fetches *all* players from Firebase and filters client-side
  by distance — fine at hobby-project scale, worth revisiting (geohash
  bucketing or similar) before it isn't.

## Future feature concepts (unprioritized)

Brainstormed 2026-10-09 in a PM-style pass, deliberately aimed past "add
more content" and toward mechanics that lean on what's actually distinct
about this game (real GPS map, real-time spell travel, async multiplayer,
sign-drawing skill check, dual-currency economy). Not yet product-designed
or sequenced into the Roadmap above — pull an item up into the Roadmap
proper once it's actually being scoped. **Nemesis System (was #1) shipped
2026-10-09** — see "What's live now" above and the Decisions Log.

Lower risk, builds on existing systems:
1. **Bounty Board** — passive quest list (kill N of an element, land N
   counterspells, walk N km) paying Rune/Crystal bonuses; gives session
   goals without touching combat math.
2. **Sigil Variants** — unlockable alternate signs with different
   risk/reward (easier sign, lower power cap vs. harder sign, higher cap)
   instead of one Star Sigil for everyone forever.
3. **Spell Drift (Channeling)** — airborne spells lose some accuracy/power
   unless the caster taps in occasionally, rewarding active attention over
   leave-the-tab-open spam.
4. **Weather & Time-of-Day Magic** — local time (and optionally weather)
   modifies spell potency by element (storms boost Lightning, night boosts
   Arcane), deepening the real-world tie-in.

New systems, moderate scope, still fits the no-extra-backend constraint:
5. **Ley Lines / Territory Control** — real-landmark zones a wizard can
   claim by standing in them and casting; claimed zones grant a passive
   buff until someone else claims them. First system giving the map
   actual stakes beyond "where NPCs spawn."
6. **Dueling Gloves** — drop an async challenge object at your real
   location; the next wizard who walks by gets a duel invite resolved
   whenever both are next online — player-initiated version of the
   existing pending-hit multiplayer model.
7. **Familiar Companion** — a permanent scouting pet chosen at creation;
   extends sense range, can scout ahead, or be sacrificed to auto-block
   one curse. Progression axis orthogonal to gear/Runes.
8. **Memory Echoes** — every duel leaves a replay at that map location;
   other players can watch it or fight a weak AI ghost that mimics the
   recorded moves. Reusable content generated automatically, no new art.
9. **Rival Guild Ley-Line Network** — once Ley Lines (#5) exist, let
   players loosely link claimed zones into a named network for a shared
   bonus — social structure without building a social feature.

Bigger bets, needs validation first:
10. **Ritual Circles** — multiple real players converging on one location
    and co-casting together can summon a rare boss or unlock a buffed
    zone; needs real player density to ever trigger.
11. **Seasonal Rift Events** — a weekly time-boxed event alters a random
    real-world area's rules (2x spell speed, element-swap, double
    Crystals) for 48h, giving a reason to check in without a specific goal.
12. **Augmented Reality Sense Mode** — camera + compass overlay showing
    incoming-curse direction on the real-world camera view. Highest
    novelty, biggest technical lift (camera/AR permissions, device
    testing) on this list.
13. **Spell Fusion** — two casters hitting the same target within a tight
    sync window combine into an amplified fused effect; needs tighter
    multiplayer timing than the current async pending-hit model has.
14. **Rune-Reading Divination** — spend Runes to divine hidden info (an
    NPC's true temperament, whether a target is likely online, a Ley Line
    about to flip) — a soft information-economy layer instead of a third
    currency.

## Decisions log

- **2026-10-15 — Reversed the "real players look visually distinct from
  NPCs" decision from the original Multiplayer feature: by explicit user
  request, a player should not be able to tell a real opponent from an NPC,
  before or after tapping.** Three concrete tells removed: (1) the remote
  player marker's identity ring was a dedicated purple (`var(--purple)`,
  always, regardless of selection) — now uses the exact same logic as an
  NPC marker (`var(--pink)`, `var(--gold)` when selected), in
  `js/map.js:renderRemotePlayers`; (2) the remote wizard sheet
  (`js/ui.js`) had a "synced Xm ago" line and a permanent
  "🌐 A real player — they may be offline. Spark Bolt still travels in real
  time." callout, plus the same purple ring — all three removed, and the
  sheet is now built with the exact same markup shape as an NPC's (the now-
  unused `formatAgo` helper and `.sheet-sub-synced`/`.sheet-remote-note` CSS
  were deleted rather than left dead); (3) the remote sheet's "already
  defeated" reason text read "Defeated (on their end) — try again later."
  vs. an NPC's "Defeated — regrouping..." — unified to the NPC wording in
  `js/main.js:buildRemoteSheetData`. Also fixed, while in the area: the
  "attacked while away" toast's fallback caster name was the literal string
  `'an NPC'` (`js/main.js:checkForAwayHits`) — this path only ever fires
  for *queued remote hits* (see `js/combat.js:applyPendingHit`'s header; an
  NPC's attack always resolves live on your own device, so it never needs
  the "while you were away" queue), so that fallback was not just a tell
  but factually wrong; changed to `'A rival wizard'`, matching the fallback
  `combat.js` itself already uses in two other spots for the same case.
  **Deliberately NOT changed, flagged instead**: `js/combat.js:resolveImpact`
  still shows a different cast-time message for a remote target ("rockets
  into the distance... should strike home any moment now", no damage
  number) vs. a local one ("strikes X for N damage!", immediate). This is
  not a cosmetic choice — a damage number for a remote cast would have to be
  a guess (this device has no authoritative view of the target's live
  defense/shield; only their own device can resolve it, see
  `applyPendingHit`), and showing one anyway would be actively misleading
  rather than just "not a tell." Fully equalizing this would mean either
  showing a knowingly-wrong number for remote casts or making local casts
  against NPCs *also* defer their damage reveal to match — both real
  trade-offs, not a quick fix, so this was left as-is pending a product call
  rather than decided unilaterally here. Also NOT changed: Nemesis badges
  (still NPC-exclusive, a genuine recurring-rival mechanic, not an identity
  cue) and the remote sheet's lack of a shield-status line (this device
  still has no live visibility into a remote player's Ward Shield state —
  it already simply doesn't render, same as an NPC with no shield up, so
  there was no visible asymmetry to fix there).
- **2026-10-15 — Two small display-only fixes: the player/NPC/remote-player
  map marker's `iconAnchor` was wrong, and the create screen's title now
  stays sticky while scrolling.** (1) `js/map.js`'s divIcon markers
  (player/NPC/remote, all three kept in sync) used `iconAnchor: [32, 74]`
  on a 64x84 box — but the icon's actual visual content
  (`js/portraits.js:avatarWithRing`'s 48x48 `.marker-ring-wrap`) is the
  *first* child, flowing from box-local y=0, with `.marker-label` below it;
  anchoring near the box's bottom (y=74) put the ring's true visual center
  (box-local y=24) about 50px above the geo-coordinate Leaflet actually
  draws there — visible as the avatar sitting above-and-off-center from its
  own sense-range circle (a real `L.circle` centered on the same point).
  Fixed by anchoring at `[32, 24]`, the ring's real center, in all three
  marker-creation call sites. `keepInView()`'s pixel-margin `BOX` constant
  mirrors the anchor and moved in lockstep: `up` 74→32 (ring-top-to-anchor
  24px + the shield-bubble's 8px `inset:-8px` overhang), `down` 10→60
  (`iconSize.height - iconAnchor.y`, same invariant as before). Verified
  with a disposable Playwright script against a locally-vendored Leaflet
  build (this sandbox blocks the real cdnjs/arcgisonline hosts) measuring
  `getBoundingClientRect()` on the live DOM: the ring's center now lands
  within a sub-pixel of the sense circle's center, with and without an
  active Ward Shield, and `keepInView()` still keeps the marker fully
  inside the stage when a sheet opens. (2) `index.html`'s `#screen-create`
  title+subtitle now live in a new `.create-card-header` wrapper,
  `position: sticky; top: -16px` within `.create-card`, so they stay
  visible at the top while a tall form scrolls underneath — matching the
  app's existing header/scrollable-body pattern
  (`.subscreen-header`/`.subscreen-content`). The `top: -16px` (not `0`) is
  load-bearing, not a stylistic choice: `#screen-create` itself has 16px
  padding, and Chromium's sticky positioning keeps an ancestor's own
  padding visible above a stuck child by default — a plain `top: 0` left a
  16px strip at the very top of the screen where scrolled-past form
  content was still paintable underneath (confirmed via
  `elementFromPoint()` in the same verification script before this value
  was corrected), defeating the point of the fix. If `#screen-create`'s own
  top padding value ever changes, this offset must change with it (noted
  in the CSS comment). Verified visually at both a short/overflowing
  viewport (header pins at the very top, no bleed-through, rest of the form
  scrolls underneath) and a tall/non-overflowing one (pixel-identical to
  before, no seam).
- **2026-10-14 — `js/wizard.js`'s per-element colors (`ELEMENTS[].color`)
  retuned for the Watercolor Ghibli theme, closing the contrast gap the
  theme pass below flagged but deliberately left unfixed as out of its
  CSS-only scope.** Fire (`#a3523c`) and Nature (`#567151`) simply reuse the
  shipped `--pink`/`--gold` hexes exactly — both already independently
  verified ≥4.5:1 against `--bg-deep`/`--bg-panel` in the theme pass's own
  contrast work. Arcane (`#7f6aa0`) reuses `--purple` the same way. Ice
  (`#3d6680`) and Lightning (`#7d6420`) are new, darker-than-their-token-fill
  shades — `--mana`/`--xp`'s own shipped values are only used as borders/
  fills elsewhere in the CSS, not dark enough to double as text — chosen by
  computing real WCAG contrast ratios (not eyeballed) against both cream
  backgrounds until each cleared 4.5:1. No change to combat math or any
  other data on the wizard object — purely the display-tint hex used by the
  create screen's element picker and element labels.
- **2026-10-14 — Visual theme replaced with "Watercolor Ghibli — Painted
  Nature Magic," the user's pick from 5 reviewed mockup directions; this is
  a deliberate reversal of BOTH the 2026-10-11 Disney/Pixar pass below AND
  the 2026-09-26 "map tiles switched from CartoDB to Esri" entry's "dark
  tiles to match the dark theme" reasoning — now light tiles to match this
  light theme. Not assumed final: the user said another theme round may
  follow.** Same scope as the Pixar pass it replaces (CSS/HTML/font/tile-URL
  only, no game logic, no data-shape change, same token names/identity-color
  meanings throughout — self=mana blue, NPC=pink, selected=gold, HP=red).
  Three concrete changes: (1) **the page went light** — a full `:root`
  palette swap from the Pixar pass's saturated dark-theme hex values to a
  warm cream/parchment palette (`--bg-deep #f7f1e3`, `--bg-panel #fffdf7`,
  `--bg-panel-2 #e8d9b8`, `--gold #567151`/`--gold-soft #8fae8b` — the
  single biggest semantic shift, "gold" is now sage green but the token
  keeps its name per the brief, same as every past palette swap — `--pink
  #a3523c`, `--purple #7f6aa0`, `--mana #5f85a0`, `--hp #b73d47`, `--xp
  #ab8a30`, `--text #4a4336`, `--text-dim #706754`; `--parchment`/
  `--parchment-ink` left unchanged since they already read as "paper" and
  don't need to chase the general palette); (2) **map tiles switched light**
  — `js/map.js` now loads Esri's `World_Light_Gray_Base`/`_Reference`
  instead of `World_Dark_Gray_*` (same keyless service family, same
  base+reference split), and every marker/ring/circle style that assumed a
  dark backdrop was rechecked and recolored for the light one (marker-avatar
  border/shadow and the HP-ring track moved from a near-invisible
  `rgba(255,255,255,...)` hairline to a dark-ink-tinted one; the wizard-name
  map label flipped from white-text/black-halo to dark-text/light-halo; the
  sense circle's hardcoded Leaflet color literal — vector layers can't read
  a CSS custom property — was updated to match the new `--purple`); (3)
  **shape language went organic** — alternating asymmetric corner radii on
  repeated card grids/lists (element-choice, shop-row, inv-row, char-stat)
  instead of one uniform radius, a pronounced irregular-circle wobble on the
  avatar-choice frames specifically, and the create screen's old
  radial-gradient "bloom" glows replaced by two actual blob shapes (CSS
  `::before`/`::after` pseudo-elements, organic `border-radius`, ~0.2
  opacity, blurred edges) — Primary CTA buttons (`--radius-pill`) were left
  pill-shaped on purpose, the organic treatment is for cards/frames only.
  Typography: Quicksand (headings/buttons) and Lora (body), replacing
  Fredoka/Nunito. Element icon strokes thinned from 2.2 to 1.8 for a more
  ink-brush feel, keeping the same rounded-cap/badge-circle treatment.
  **Shadows softened, and this forced one implementation-judgment change
  beyond the brief's literal ask**: the Pixar pass's "jelly button" shadow
  (a hard offset shadow mixed toward black, plus a two-tone diagonal
  gradient background) reads as a dark-theme technique and looked muddy on
  cream, so every primary/secondary button (`.btn-primary`, `.sheet-btn`
  incl. `.attack`/`.shield`, `.defend-btn`, `.shop-price` incl. `.confirm`,
  `.power-buy`, `.inv-goshop`, `.qa-step`, `.sign-btn.primary`) was changed
  to a **flat** fill (`background: var(--gold|pink|purple)`) with a single
  soft `color-mix`-based drop-shadow, softer on `:active` instead of a
  matching hard offset ledge. The flat-fill change wasn't optional once the
  contrast math was run: computed WCAG contrast for the old dark-navy button
  text (`#241448`) against a light-to-dark gradient spanning this theme's
  muted mid-tones came out below 3:1 at the gradient's dark end for every
  one of gold/pink/purple (e.g. 3.06-4.13), and no single text color (dark
  navy, near-black, or near-white) could clear 4.5:1 against *both* ends of
  any of the three gradients — a light pastel end and a muted mid-tone end
  are too far apart in lightness for one text color to read well at both,
  unlike the Pixar pass's bright-saturated gold where dark text had ~10.5:1
  headroom. Switched to one flat background value (the darker/more
  saturated anchor) with near-white text (`var(--bg-panel)`), which clears
  4.5:1 against gold (5.33) and pink (5.39); purple came out at 4.62 after
  nudging `--purple` slightly darker than its first concept anchor
  (`#8a76a8` → `#7f6aa0`) specifically to clear that bar. `--ease-bounce`
  and the spring-press motion are explicitly unchanged — only shadow
  *rendering* and the gradient-vs-flat fill changed, not the press feel —
  and `.defend-overlay`'s `pulse-red` incoming-curse animation keeps its
  non-bouncy, urgent character, just recolored to the new `--hp` value.
  **Contrast verified by computing actual WCAG ratios, not eyeballed**:
  `--text`/`--text-dim` against both `--bg-deep` and `--bg-panel` (the two
  backgrounds the brief named) — `--text` 8.68/9.61, `--text-dim` 4.96/5.50,
  both comfortably ≥4.5. `--gold`, `--pink` and `--hp` (the three accent
  tokens actually used as literal small/body text somewhere — `.field-label`/
  headings, `.nemesis-badge`/`.treasury-rate.fast`, and `.menu-danger`
  respectively) were independently darkened from their first concept
  anchors until they also cleared 4.5:1 against `--bg-deep` (the harder of
  the two mandated backgrounds, since it's the less-light of the two): gold
  4.81, pink 4.87, hp 4.94. `--purple`, `--mana` and `--xp` were confirmed
  (by grepping every `color:`/`var(...)` use site in `css/style.css`) to
  never appear as literal foreground text — only as borders, decorative
  tier accents, or gradient/fill stops — so they were left closer to their
  original pastel concept anchors rather than over-darkened for a contrast
  bar they don't actually need to clear; `--hp` and `--pink`'s hues were
  deliberately spread further apart (355° vs 13°) than the brief's own
  anchors (6° vs 13°) while darkening them, specifically so HP and
  Fire-flavored UI stay visually distinguishable, per the brief's own
  explicit ask. `--bg-panel-2` (used for nested surfaces like shop rows) is
  darker than the other two backgrounds and wasn't part of the brief's
  mandated pair; small dim/accent text sitting directly on it (e.g.
  `.shop-note`) lands around 3.3-4.0:1 — below the 4.5 small-text bar, a
  known, honestly-disclosed soft spot rather than a silent gap, consistent
  with the Pixar pass's own contrast note only checking two of the three
  backgrounds. **Flagged, not fixed, as out of this pass's CSS-only
  scope**: `js/wizard.js`'s per-element accent colors (`ELEMENTS[].color`,
  e.g. Lightning `#ffe066`, Nature `#6bff8f`) are pale pastels tuned for the
  old dark backdrop; against the new light cream they read low-contrast on
  the create screen's element labels (confirmed visually) and wherever else
  `el-color` tints text. Touching them would mean editing `wizard.js` (game
  data, not CSS/HTML/font/tile-URL) and is a product/visual call, not an
  implementation one — a follow-up for the ui-designer, not done here.
  Verified with a throwaway Playwright script (local static server, a
  locally-cached Leaflet build substituted for the sandbox's blocked cdnjs/
  arcgisonline egress — same recurring workaround as every prior pass's
  Decisions Log entry, unrelated to the app itself): screenshotted the
  create screen (default and with Fire/Lightning selected, confirming the
  two background blobs render with the right colors/opacity/radius via
  `getComputedStyle(el, '::before'/'::after')`, not just assumed from the
  CSS source), the HUD/map at a default and a zoomed-out level (marker
  rings/avatar borders/sense circle all visibly legible against the
  tile-less fallback background, since this sandbox can't reach
  arcgisonline.com either), the self sheet, an NPC cluster sheet, the ☰
  menu, all 4 tab-bar screens, the sign-pad, and — by toggling ⚡ Fast and
  waiting for a real NPC aggression roll rather than mocking the state — a
  live incoming-curse defend strip with its countdown ring and Counter
  button; also read computed `font-family` on both a heading and a
  body-text element to confirm Quicksand/Lora actually apply (not just
  declared in the CSS source), and ran `node --check` on `js/map.js` (the
  only changed `.js` file).
- **2026-10-11 — Player-facing `power` numbers now shown at a ×100 "power
  points" display scale, not the raw internal float.** `power` is a small
  float internally (player base ~4.5, gear bonuses like 0.08-1.5 — see
  `js/wizard.js`/`js/economy.js`) so it reads as meaningless decimals
  wherever shown directly (Shop gear rows, Character screen's Power stat).
  Added `js/wizard.js:formatPower`/`POWER_DISPLAY_SCALE` (×100) as the one
  named place that scale is defined, used by `js/ui.js` (Shop rows) and
  `js/main.js` (Character screen); `js/signpad.js`'s unrelated sign-draw
  multiplier (a ratio, 0.5x-1.5x, not the `power` stat) was separately
  changed from "×0.73 power" to "73% power" for the same reason. Display
  only — `combat.js`/`economy.js`/`wizard.js`'s actual math is untouched; a
  future reader seeing "+8 power" in the UI next to `mods: { power: 0.08 }`
  in `economy.js` should look here instead of re-deriving it.
- **2026-10-11 — Map zoom unlocked, reversing the original "fixed zoom"
  decision, by direct user request.** The map used to launch with
  `minZoom: maxZoom: 17` and every zoom gesture explicitly off
  (`zoomControl: false, scrollWheelZoom: false, doubleClickZoom: false,
  touchZoom: false, boxZoom: false, keyboard: false`), reasoned at the time
  as "gameplay distances are tuned for this one view." The user asked to be
  able to zoom; this reverses that call, not a bug fix. Shipped
  `minZoom: 14, maxZoom: 19` (zoomControl/scrollWheelZoom/doubleClickZoom/
  touchZoom on; boxZoom/keyboard stay off, not useful gestures for a
  touch-first game) — the 14–19 range is a first guess, same "tune from
  play later" spirit as every other number in this project, not derived
  from testing every level. **Verified the thing this reversal depended on
  rather than assuming it**: every gameplay distance (sense range, the
  250m tap-to-walk cap, NPC spawn annulus) already runs through
  `js/geo.js:distanceMeters` — plain lat/lng haversine, no pixel or zoom
  term anywhere in it (confirmed by reading every call site, not just the
  function itself) — so none of it needed a code change; only the on-screen
  pixel size of the sense-range circle and markers changes with zoom
  (marker *icons* stay fixed pixel size, same as a Google Maps pin, by
  design, not a gap). **The touch-action interaction flagged as a risk
  turned out not to be a real bug in this app's actual config, verified
  empirically rather than assumed either way**: the `html,body { touch-
  action: pan-x pan-y }` rule (added for page-level pinch-zoom blocking)
  could in theory also starve Leaflet's own pinch/double-tap handling on
  the map, since the browser's actual gesture routing intersects
  touch-action across an element and its ancestors — but Leaflet's own
  bundled `leaflet.css` already sets `touch-action: none` directly on the
  map container once both `dragging` (on by default) and the newly-enabled
  `touchZoom` are active, via its `.leaflet-touch-drag.leaflet-touch-zoom`
  combo rule, and `none` is the most restrictive value an intersection can
  produce, so the ancestor rule can't undo it. Added `#map.leaflet-container
  { touch-action: none }` in `css/style.css` anyway, not because it's
  currently load-bearing (an A/B Playwright test — same pinch gesture with
  that rule stripped out via response interception — confirmed pinch still
  worked without it) but because it pins the correct value at higher (ID)
  specificity than Leaflet's own class-based rule, so it stays correct even
  if a future change (e.g. disabling `dragging`) stops Leaflet's own
  classes from combining into the same value. Verified with a throwaway
  Playwright script (local static server, the same locally-cached Leaflet
  1.9.4 build substituted in for the sandbox's blocked cdnjs egress as in
  prior entries): zoom +/- buttons change zoom and correctly disable at the
  14/19 bounds; a real two-finger pinch gesture dispatched via CDP
  `Input.dispatchTouchEvent` (not a mocked API call) changed `getZoom()`
  both directions; `getComputedStyle` confirmed `touch-action: none` on
  `#map` and unchanged `pan-x pan-y` on `body`/HUD; HUD and tab-bar
  bounding rects were pixel-identical before/after zooming (only the map
  layer zooms, not page chrome); the sense circle's `getRadius()` (meters)
  was identical at zoom 17 and zoom 14; and, the key distance-independence
  check, the *same fixed pixel offset* from the player was tapped at
  different zoom levels and produced genuinely different real-world
  distances matching an independently-computed haversine value almost
  exactly (e.g. 280px ≈ 2021m at zoom 14 vs ≈253m at zoom 17; a 150px tap
  was rejected as too-far at zoom 14 but accepted at zoom 19) — proof the
  cap is real lat/lng distance, not a pixel-based measurement that would
  have behaved identically at every zoom.
- **2026-10-11 — Visual theme reversed from "mature/aged" toward Disney/
  Pixar-leaning, by explicit user request.** The 2026-09-27 "v1 mature"
  pass (desaturated palette, Cinzel/Inter, smaller radii, muted glows —
  see that entry below) was a deliberate first iteration framed at the
  time as something to revisit; the user has now explicitly asked to
  pivot the tone toward saturated, rounded, bouncy "jelly" UI chrome —
  this is a tonal pivot, not an audience-age or mechanics change (still
  built for the same 13–25 skewing-boys audience, no gameplay numbers
  touched). Three decisions were made by the user up front, not left to
  this pass's judgment: (1) **font** — Cinzel is gone everywhere,
  including the "Wizards Fight" title itself (no "epic fantasy" anchor
  left); `--font-head` is now Fredoka (400/500/600/700), `--font-body` is
  back to Nunito (a literal revert of the 09-27 Nunito→Inter swap); (2)
  **backdrop stays dark** — the CartoDB/Esri map tile source and
  `js/map.js` were explicitly untouched; the Pixar read comes from
  saturation/roundness/bounce in the UI chrome sitting on top of the
  existing dark "magic-hour" map, not from going to a light theme; (3)
  **avatar faces stay faceless this pass** — the hooded portraits are a
  separate, bigger future task (new Roadmap line above), not attempted
  here; no new avatar art was drawn. Shipped, same token names/identity-
  color meanings throughout (self=mana blue, NPC=pink, selected=gold,
  HP=red) so nothing that reads meaning by color broke: (a) a full
  `:root` palette swap to saturated hex values (see the token list in
  `css/style.css`'s top comment); (b) a 4-step radius scale
  (`--radius-sm`/`--radius`/`--radius-lg`/`--radius-pill`, replacing the
  single flat `--radius: 10px`) swept across the file's hardcoded
  `border-radius` values by bucket (small ~8-10px, medium ~14-16px, full
  circles left alone, and every "obviously a button/chip" rounding —
  `.sheet-btn`, `.tab-btn.active`, `.shop-price`, `.power-buy`,
  `.inv-goshop`, `.btn-primary`, `.defend-btn`, HP/mana/XP bars, badges —
  promoted to the new fully-rounded `--radius-pill`); (c) a
  `--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)` spring easing applied
  to button press/release states, the wizard-sheet slide-up (now
  overshoots slightly before settling instead of a flat fade+slide), and
  `.toast.show` (pop-and-settle instead of flat translateY fade); (d) a
  "jelly button" two-part box-shadow (a hard offset shadow in
  `color-mix(in srgb, <token> 65%, black)` plus a soft ambient blur,
  sinking via `translateY` on `:active`) on every primary action button,
  colored per the button's own existing gradient token (gold/pink/
  purple); (e) the HP ring gets a quick scale-bump (`.marker-ring-wrap.
  hp-bump`, reusing the existing `gem-bump` keyframe shape rather than a
  new one) on the HUD avatar specifically when HP actually changes since
  the last render — tracked via a small `lastHudHp` module-level variable
  in `js/ui.js:renderHud`, the same "remember what I last rendered to
  avoid redoing an animation every 250ms tick" idiom `shopScreenKey`/
  `sheetKey` already use in that file, not a new architectural pattern;
  (f) the create-screen element icons got thicker rounded-cap/round-join
  strokes plus a filled tinted badge circle behind each
  (`.element-icon-badge`, using the element's own existing `color` field
  from `js/wizard.js:ELEMENTS` via `color-mix`), instead of bare thin line
  art. **Deliberately NOT bounced**: the HP/mana/XP bar width transitions,
  the HP ring's own `stroke-dashoffset` transition, and
  `.defend-overlay`'s `pulse-red` incoming-curse alert (recolored to the
  new `--hp` value, but kept as a plain non-bouncy pulse — it's a warning,
  not a toy). **Contrast check performed, no changes needed**: the new
  `--text-dim` (`#c3b3e8`) against `--bg-deep`/`--bg-panel-2` computes
  well above WCAG AA even for the small `.shop-note`/`.power-desc` text
  (it's lighter than the old mature-theme value, not darker); the
  hardcoded `#241448` button-text color (used against gold-gradient
  buttons throughout) computes to roughly 10.5:1 contrast against the new,
  brighter `--gold`/`--gold-soft` — comfortably higher than the old muted
  gold, so it was left as-is rather than swapped. Verified with a
  throwaway Playwright script (local static server, a locally-cached
  Leaflet build substituted in for the sandbox's blocked cdnjs egress,
  same workaround as the 2026-10-10 entry below): screenshotted the create
  screen (default and with a non-default avatar/element selected), the
  HUD with a real "demo location" toast and the self sheet (including a
  captured `:active` pressed frame on the Raise Shield button), an NPC
  sheet with a live incoming-curse defend strip and attack button, all 4
  tab screens (Shop with a captured `:active` price-button frame,
  Inventory, Character, Missions) and the ☰ menu; measured `#tab-bar`/
  `#screens` bounding boxes to confirm the 2026-10-10 stacked-layout work
  still holds (no overlap, exact edge-to-edge handoff); and drove
  `js/ui.js:renderHud` directly through 3 synthetic renders (same HP, then
  changed HP) to confirm `.hp-bump` is added only on the render where HP
  actually changes, not every tick.
- **2026-10-10 — Shop/Inventory/Character's ☰ menu entries replaced by a
  persistent bottom tab bar; Missions added as an explicit placeholder,
  not a built feature.** The 3 menu entries (and each subscreen's own
  "← Back to Map" button) are gone, replaced by a 5-tab bar — 🗺️ Map / 🛒
  Shop / 🎒 Inventory / 🧙 Character / 📜 Missions — fixed to the bottom of
  every screen except wizard creation (no wizard yet to navigate with).
  **The structural catch, and why this is a Decisions Log entry and not
  just a menu tweak** (see the 2026-10-02 "UI layering redesign" entry
  below for the same class of mistake): you can't just drop an
  always-visible bottom bar as another sibling of the `.screen` elements
  inside `#app` — the active `.screen` already claims `height:100%` of
  `#app`'s *full* height (`.screen.active { display:flex }`,
  `#app { height:100dvh }`), so a bar sibling would either get pushed off
  the bottom edge or cause overflow, never actually share space with the
  screen above it. Fixed by wrapping all 6 `.screen` sections in a new
  `#screens` div (`flex:1;min-height:0`, the same idiom `.subscreen-content`
  already used) and making `#tab-bar` `#app`'s *other* child
  (`flex:none`) — now `.screen{height:100%}` resolves against `#screens`'
  computed height (full height minus the bar), not `#app`'s. See
  `docs/ARCHITECTURE.md` "Screen layout and layering" for the full
  breakdown. The iOS safe-area-inset-bottom padding that used to be
  duplicated on `#screen-game` and `.subscreen` (each padding its own
  bottom edge, back when each was `#app`'s bottom-most visible element) was
  removed from both and now lives only on `.tab-bar`, the actual bottom-most
  element whenever it's visible — verified it isn't double-applied (both
  are computed `0px` padding now; the bar carries the one `env()` rule).
  **Missions is deliberately not a real feature**: there is no Bounty Board
  / session-goals system built anywhere in this codebase, only the
  brainstormed "Future feature concepts" #1 entry below; `#screen-missions`
  is static copy ("Coming soon — this will be a bounty board with session
  goals. Nothing to do here yet.") with no `*-content` div for `main.js` to
  populate, so nobody mistakes the tab for a shipped system. Verified with
  a throwaway Playwright script (local static server, a locally-cached
  Leaflet build substituted in since this sandbox's egress proxy blocks
  cdnjs.cloudflare.com — unrelated to the app): clicked through all 5 tabs
  from multiple starting points, measured `#screens`/`.tab-bar`/HUD/stage
  bounding rects on every screen to confirm no overlap and no viewport
  overflow, confirmed the active-tab highlight matches the active screen on
  every tab including Missions, confirmed tap targets are ≥44px, and
  confirmed the ☰ menu/back-buttons/`.offmap-alert` wiring changed exactly
  as intended (4 `.offmap-alert` elements now, 0 leftover back buttons).
- **2026-10-09 — Ward Shield redesigned from flat-% mitigation to an absorb
  pool; QA Tools gets a Mana Crystals setter.** Ward Shield used to set
  `shieldBuff = { mitigation, expiresAt }` and quietly shave a flat % off
  every hit for its whole 2-minute duration — invisible and not very
  game-like (no concept of the shield itself being "used up"). Redesigned
  so casting it gives `shieldBuff = { hp, maxHP, expiresAt }`: a pool sized
  off the **caster's own** `maxHP × shieldFraction × sign-mult`
  (`shieldFraction: 0.35` in `spells.js`'s `ward_shield`, replacing the old
  `mitigation` field) — off the defender's own HP investment, not the
  attacker's power, since the defender can't know the attacker's stats in
  this async real-time-travel game. Each hit now subtracts from the pool:
  fully covered → a true 0 damage to real HP (the old "never below 1" rule
  doesn't apply here — that rule only existed to stop % rounding from
  giving a free pass, not to protect a pool that genuinely covers the hit);
  not covered → the shield breaks (pool to 0, `expiresAt` set to `now` so
  `isShieldActive` reads false immediately) and the overflow, still floored
  at 1, reaches real HP. The 2-minute `buffDuration` stays as a backstop
  expiry. The duplicate absorb math that used to live separately in
  `resolveImpact` (local hits) and `applyPendingHit` (remote hits) is now
  one shared `combat.js:resolveShieldedDamage` helper. `shieldFraction:
  0.35` is a first guess like every other number in `docs/FEATURES.md`'s
  economy — picked so a sloppy sign gives a shield worth ~17.5% of max HP
  and a well-drawn one ~52.5%, pending real playtest, not tuned from data.
  Verified with a throwaway Playwright script: drove the real
  `combat.js`/`spells.js` module functions in-browser for the pool-size,
  full-absorb and shield-break math (including the log lines and
  `isShieldActive` flipping false immediately on break), then drove the
  actual UI to raise a shield through the real sign-pad flow and confirm
  the self sheet shows the live pool ("🛡️ Warded — 18/18 (120s left)"), not
  just a binary flag. Alongside this, QA Tools (`?qa=1`) gets a "Set Mana
  Crystals to exactly" section mirroring the existing Runes control exactly
  (same +100/+1000/♾️ Infinite pattern, `QA_INFINITE_GEMS` in `main.js`) —
  new wizards still start at 0 💎 by design, this just makes the Shop's
  higher gear tiers reachable for testing without a grind. Verified via the
  same Playwright pass: set/added gems through the QA panel and confirmed
  both the panel's own balance text and the Shop screen's balance updated,
  then bought a gear item and confirmed the balance actually decremented.
- **2026-10-09 — Shop/Inventory/Character promoted from bottom sheets to 3
  full screens.** Follow-up to an earlier in-session product discussion:
  with a Crystal Shop, a Runes & Powers panel, gear, and more (potions,
  etc.) coming, "stack more sheets over the live map" stopped scaling, so
  the old "💎 Crystal Shop" docked sheet and "🔮 Runes & Powers" bottom panel
  were retired in favor of 3 new top-level screens (`#screen-shop`,
  `#screen-inventory`, `#screen-character`, siblings of
  `#screen-create`/`#screen-game`, same `.screen`/`.active` toggle) reached
  from 3 new ☰ menu entries, each with a "← Back to Map" button. No
  game-logic or data-shape change — same `economy.js`/`wizard.js` data,
  just promoted to bigger, non-cramped containers; `world.openSheet` lost
  its `'shop'` kind (the Shop screen's active slot tab is now a plain
  module-level variable in `main.js`, not persisted — it never needed to
  be). Content moves: Shop's full gear catalog + two-tap buy/upgrade
  confirm moved as-is; Inventory is a new (but deliberately minimal)
  equipped-loadout view — just today's 2 gear slots, explicitly **not** a
  multi-item inventory grid, since there's still no owned-but-unequipped
  concept; Character consolidates the avatar/name/element/level/XP that
  used to live only in the HUD/self-sheet with final effective combat
  stats (HP/mana/power-including-Runes/defense/sense-range/cooldown) and
  the Spell Power/Spell Recovery upgrade cards that used to be the Runes &
  Powers panel. **Handled the "blindsided while shopping" risk directly**
  (the brief flagged it as a must-think-about, not optional): spells keep
  traveling in real time regardless of screen, since the game loop
  (`combat.tick`/`render()`) never pauses when a screen other than the map
  is active — only DOM visibility changes. Rather than rebuild the full
  reactive Counterspell flow (sign-pad, etc.) on 3 more screens, each
  screen's header carries an `.offmap-alert` banner fed the same
  `incoming`-projectiles data the map's defend strip already uses, showing
  the soonest incoming spell's caster/countdown; tapping it (or the
  explicit back button) jumps straight back to the map, where the real
  defend strip and Counterspell are. Verified end-to-end with a throwaway
  Playwright script (bought/upgraded gear in Shop and confirmed it showed
  in Inventory, spent Runes on the Character screen and confirmed the
  upgrade level/cost updated, and — the harder case — waited for a live
  NPC attack, confirmed the off-map alert surfaced the correct spell/caster/
  countdown on the Character screen, and confirmed tapping it returned to
  the map) — not committed, per the project's current testing approach.
  This was an IA/UI execution task with the layout/content decisions
  already made in the brief; no new product or visual-design call was
  made here beyond ordinary implementation judgment (CSS details, exact
  wording).
- **2026-10-09 — Sign drawing: each spell gets its own sign.** All three
  spells used to make the player draw the same ⭐ Star Sigil (pentagram) on
  every cast, which got repetitive. Now Spark Bolt keeps the pentagram,
  Ward Shield draws a new 🛡️ Ward Rune (closed hexagon/shield outline, fits
  a proactive protective stance), and Counterspell draws a new 🌀 Break
  Sigil (open jagged zigzag/lightning-crack, matching its existing "shatter
  one incoming curse" flavor text). `js/sign.js` exports `WARD_RUNE` and
  `BREAK_SIGIL` alongside the existing `SIGN` (pentagram) — same scoring
  math, no per-sign tuning; `js/signpad.js:openSignPad` gained a `sign`
  option (defaults to the pentagram) instead of hardcoding one shape, and
  `js/main.js`'s three `openSignPad` call sites each pass their spell's own
  sign. No player choice, no unlock system — this is purely "which fixed
  shape goes with which spell," not the variants-with-caps idea logged
  under Future feature concepts.
- **2026-10-09 — Nemesis System shipped, NPC-only in this pass.** Whichever
  NPC most recently defeated the player is remembered (`wizard.nemesisId`,
  one new field, no history list) and gets a modest combat edge (+20% max
  HP, +15% power, +2 defense) plus a "levels alongside you" re-sync on
  respawn (every other NPC keeps its spawn-time level forever); defeating
  it back clears the title and pays a 1.75x XP/Rune/Crystal bonus on that
  kill. The boost and the Nemesis's level are recomputed fresh from
  element+level each time (via the same math `createWizard` uses at spawn)
  rather than stored as a separate delta, specifically so there's exactly
  one new persisted field and applying/clearing the boost twice can never
  double-stack. **Deliberately NPC-only**: `combat.js:applyPendingHit`
  passes `killer = null` to `handleDefeat` when a remote player's pending
  hit defeats you, because the target device has no full attacker object
  for a remote caster (see "Multiplayer" in `docs/ARCHITECTURE.md`) — Nemesis
  for real players would need that identity threaded through the pending-hit
  shape, which is a bigger change than this pass scoped. The 1.75x bonus
  multiplier and the +20%/+15%/+2 boost numbers are first guesses (picked
  within the "slight boost" / "1.5-2x bonus" ranges the brief suggested),
  not tuned from play data. Verified end-to-end with a throwaway Playwright
  script (seeded a co-located aggressive NPC via `localStorage`, confirmed
  the title set/clear, the incoming-curse alert's and wizard sheet's Nemesis
  tags, and the bonus log line) — not committed, per the project's current
  testing approach.
- **2026-10-03 — Gear stays fully active in PvP.** The user chose "fully
  active" over capping or ignoring gear against real players, so a maxed
  avatar can one-shot real players (about 200 damage per bolt vs roughly
  100-300 HP). Recommended alternative was a PvP cap, because one-shotting
  other players may drive them away; revisit if that shows up in play.

Short-form history of calls that shaped the current build, newest first.
Keeps future planning from accidentally re-litigating settled questions
without knowing why they were settled.

- **2026-10-02 — Item upgrades added; the user wants a dominant avatar.**
  The 5-tier gear ladder (Phase 2) is complete and each equipped item can be
  upgraded +1..+10 with 💎 (cost `price x 0.06 x 1.4^n`). The user explicitly
  asked to "make my avatar very very strong", which SUPERSEDES the earlier
  tuning target (clearly stronger, ~75-85% win rate, never above ~+60%): a
  maxed T5 wand + robe (+15.5 power, +580 max HP, +9 defense) kills same-level
  NPCs in 1-2 bolts and takes about 0-3 damage per fight. Upgrades are
  deterministic: no failure chance, no randomness, no gambling (kids/teens
  audience). Defense stays modest (max +9) next to the damage formula, value
  goes into max HP; every hit still does at least 1 (combat.js now also
  clamps shielded hits to 1, previously a strong ward could round 1 to 0).
  No level gates were added (kept trivial). Income unchanged: max grind is
  roughly 40+ hours at Real speed (see FEATURES). **Open PvP issue, not
  changed:** gear feeds `power`, which is what a remote Spark Bolt carries
  (`casterPower`), so a maxed avatar (about 200 damage per bolt) one-shots
  real players (about 100-300 HP); the target's defense is their own. Needs
  a product decision (cap/ignore gear vs real players) before multiplayer
  is used with strong gear.

- **2026-10-02 — UI layering redesign (stack, not float).** A phone
  screenshot showed the ☰ menu open over the incoming-spell banner, which
  covered the HUD, while the self sheet squeezed the map until the player
  marker vanished and the menu clipped at the right edge. Cause: every
  panel was `position:absolute` with its own hardcoded z-index, so any two
  could overlap. Fix: `#screen-game` is now a flex stack (HUD / defend strip /
  map stage / docked sheet / safe-area gap), so urgent UI lives in flow and
  can't be covered; z-order is a token list in `:root`. Rules adopted:
  **one transient overlay at a time** (menu, log, Runes panel and the sheet
  close each other; map/scrim taps only dismiss and never walk; a new
  incoming attack closes the menu once but leaves sheets alone); the **sheet
  is docked** and shrinks the map (the map re-pans to keep the player and
  tapped wizard visible, attribution stays above it); the **defend strip
  gets its own lane** under the HUD instead of floating, with a 44px
  Counter, and is patched in place (never rebuilt per tick) so taps aren't
  swallowed. Toasts moved to the top of the map so bottom panels can't hide
  them. No game rules or numbers changed.
- **2026-10-01 — Sign drawing powers every cast; merged with Runes & Powers
  and multiplayer.** Spark Bolt, Ward Shield and Counterspell each open a
  pad where the player redraws the ⭐ Star Sigil; similarity sets a ×0.5–×1.5
  multiplier (Counterspell fizzles below ×1.0). It stacks multiplicatively
  with gear, level and Spell Power, and is baked into the pending-hit
  `casterPower` for remote targets (so a real player's hit reflects the
  drawing). The branch carrying the Mana Crystals economy was merged into
  `main` after `main` had gained Runes & Powers, multiplayer and the theme
  pass, by explicit user choice to keep **both** economies: 💎 buys gear,
  🔮 Runes buy permanent Spell Power / Recovery. Whether two currencies is
  one too many is an open product question once both can be played together.
- **2026-10-01 — Mana Crystals economy (Phase 1).** Added a 💎 currency so
  the player gets stronger through bought gear (wand = power, robe = max HP
  plus +1 defense) rather than only level; income is passive (Treasury pot)
  plus a small kill bonus (`3 + npcLevel`). Two calls were made by the user
  **against the product-designer's recommendation**: (1) ⚡ Fast scales
  income (the designer wanted income independent of the testing toggle,
  because a debug speed multiplier that is also the default makes the
  economy trivially fast and hides real pacing; mitigated by applying the
  multiplier at accrual time, 1x for closed-page time, and surfacing "×30"
  in the Treasury card), and (2) the pot is uncapped (the designer wanted a
  cap so the pot rewards returning regularly and doesn't pile up unbounded;
  with Fast on, an idle open tab accrues quickly). Flat defense is kept
  small (+1) because damage is `round(10 × power − defense)`; value goes
  into max HP instead. Editing the device clock to farm income is a known,
  accepted risk (no backend to check against). RESOLVED (same
  day): the user approved defaulting new wizards to Real (1x) so the first
  wand takes about 10 minutes; Fast remains a toggle and existing saves
  keep their stored setting. Corrupted saves are also sanitized on load
  (bad `gearApplied` recomputed, numeric-string gems coerced, an offline
  anchor of 0 or older than 30 days earns no credit).
- **2026-09-29 — Theme iteration 2: real 5th/6th avatar art, HP-as-ring,
  Ward Shield map VFX, smaller popups.** Direct follow-up feedback on the
  v1 pass above. (1) The 2 mirrored avatar slots from v1 were replaced with
  2 new hand-authored hood artworks (`portrait-hood-d`/`-e`) — all 5
  create-screen choices are now genuinely distinct art, no more
  `scaleX(-1)` trick (user explicitly chose "more distinct artwork" over
  "make it a separate screen" when asked). (2) Avatar-choice thumbnails on
  the create screen grew 56px → 72px. (3) The colored identity ring around
  every avatar (map marker, HUD, wizard sheet) now doubles as an HP gauge —
  an SVG arc (`stroke-dasharray`/`stroke-dashoffset` sized to `hp/maxHP`)
  drawn on top of a dim track, arc color still carrying the old identity
  signal (self/NPC/selected); the NPC marker's separate `.marker-hp` sliver
  bar was removed as redundant now that the ring does that job. (4) Ward
  Shield now has a map-visible effect — a soft pulsing translucent bubble
  behind the ring while `isShieldActive`, in the same purple the shield
  button already uses, pure CSS (no extra render-loop work). (5) The wizard
  sheet and incoming-attack (defend/counterspell) cards were both shrunk
  further, on both the attack and defend flows, per explicit user ask — text
  size floor held at 0.68rem so nothing in the actual attack/defend decision
  path (countdown, reason, cost) got too small to read. Also fixed two
  leftover pre-desaturation literals the v1 token pass missed because they
  were hardcoded rather than reading a `:root` token: the create-screen
  background bloom and the map's sense-range circle color.

- **2026-09-27 — v1 "mature" visual theme pass, deliberately a first
  iteration.** User asked for a UI theme that "feels more mature," shows
  "characters, not just icons," and reads more realistic, framed explicitly
  as something to iterate on later, not a final redesign. Shipped: (1) a
  full desaturation pass on every existing CSS custom property (same
  tokens, aged/muted hex values) plus halved glow-`box-shadow` opacities and
  smaller corner radii, so borders read as candlelit metal instead of neon
  halo; (2) body font swapped Nunito → Inter (headings stay Cinzel); (3)
  wizard avatars became inline SVG hooded-figure portraits (no facial
  features, by design — avoids needing per-avatar face art while still
  reading as "a character") instead of emoji, tinted by element color, with
  the existing colored ring around each avatar's container still doing the
  identity encoding (self/NPC/selected); (4) element icons on the create
  screen became single-stroke SVG line art instead of emoji; (5) flying
  spell projectiles became a small colored glow-orb instead of a flying
  emoji. Scope cut on purpose: spell icons (✨🛡️🌀) were left as emoji —
  lower priority per the design brief, deferred rather than rushed. Only 3
  distinct hood artworks exist; the create screen still offers 5 choices by
  mirroring 2 of them (`transform: scaleX(-1)`), per an explicit user call
  to keep 5 visible options without commissioning 5 pieces of art — the
  hood art had to get an asymmetric sash detail added so the mirrored
  variants are actually visually distinguishable, not identical. NPCs,
  which previously reused their *element's* emoji as their avatar, now get
  a portrait randomly assigned from the same 5 looks, independent of
  element. Map tiles, the tap-to-open-sheet interaction, and all combat
  math/logic were explicitly out of scope and untouched.
- **2026-09-26 — Multiplayer added; Firebase ends the "no backend"
  constraint.** Real players' wizards now appear on the map alongside
  NPCs, positioned by last-synced location and gated by the existing
  sense-range circle; casting Spark Bolt at one works like casting at an
  NPC, resolving on the normal real-time travel timer whether or not the
  other player is online. This explicitly and intentionally ends the
  project's former "no backend" rule — accepted as the cost of real
  multiplayer, not a workaround or an oversight. **Firebase** (Realtime
  Database + Anonymous Auth) was chosen over Firestore because the data
  shape here — a flat per-player record plus small per-target
  append-only "pending hit" lists — maps directly onto a JSON tree, and
  RTDB's rule syntax is simpler to hand-write correctly for "write your
  own record, append-only to someone else's" than Firestore's would be
  for the same access pattern; both have a workable free tier for a
  hobby project's expected scale. **Identity is anonymous and
  device-generated** (Firebase Anonymous Auth uid) plus the player's
  existing chosen display name — no email/password, no real accounts,
  consistent with the game's existing no-accounts stance elsewhere.
  **NPCs are not replaced** — they coexist as the reliable fallback,
  since real-player density near any given player will often be zero.
  Damage resolution is asymmetric by necessity: the attacker's device
  can't compute damage against a real player (it doesn't have that
  player's live defense/shield state), so a hit is recorded as a
  "pending hit" and applied by the **target's own device**, whenever it
  next runs — this avoids needing any server-side code on a backend
  with no Cloud Functions. One consequence: there's no live "incoming
  spell" warning (and so no Counterspell option) against a real player's
  attack in v1 — only Ward Shield's passive mitigation carries over. Live
  presence, matchmaking, and chat were all explicitly scoped out of v1
  (see Known gaps/Roadmap) — this is a minimal extension of the existing
  async-combat feel, not a social layer. **Setup step only the repo
  owner can do:** create a Firebase project, enable Anonymous
  Authentication and a Realtime Database, and paste real config into
  `js/firebase-config.js` (gitignored — copy from
  `js/firebase-config.example.js`) and the rules from
  `firebase-rules.json` into the console — the same category of step as
  the Google Maps API key below, just for a feature that's shipping
  instead of one that got swapped out. Without that setup the game runs
  exactly as it did before, single-player only.
- **2026-09-26 — Runes & Powers shipped as a deliberately narrow first
  iteration.** Added an ongoing earn-and-spend currency (Runes, on top of
  the existing one-time XP/level track) that buys permanent Spell Power/
  Spell Recovery upgrades. Scope was cut on purpose, not by oversight:
  **no equipment/inventory/carrying-capacity** (a bigger system that needs
  its own product pass, not something to bolt on here); **no sell-back or
  respec** (permanent purchases keep the mechanic simple — revisit only if
  players get stuck with buyer's-remorse complaints); **per-attribute
  caps, not a shared pool** (explicit call over a shared-pool alternative,
  so maxing one attribute never limits the other); **only 2 attributes**
  (Spell Power/Recovery), not range or Ward Shield timing (kept the first
  iteration's blast radius small — those are natural next attributes to
  add, not a signal they were rejected). Future planning on
  currency/progression should treat these as this iteration's intentional
  boundaries, not gaps to "finally" fix.
- **2026-09-26 — PR preview deploys added, not an external host.** Wanted
  a way to review a feature live before it hits `main`/production.
  Considered Netlify/Vercel-style deploy previews, but those need a new
  external account, which cuts against the "no backend, no extra
  services" constraint. Used `rossjrw/pr-preview-action` instead: each PR
  gets a real `eyalzur.github.io/wizards-fight/pr-preview/pr-<n>/` URL,
  commented on the PR, torn down on close — no new account, stays inside
  GitHub. Trade-off: it works by committing preview folders directly onto
  `main` (see `docs/ARCHITECTURE.md` PR previews), so `main`'s history now
  includes bot commits for preview deploy/teardown, not just feature work.
- **2026-09-26 — Map tiles switched from CartoDB to Esri (keyless).**
  CartoDB's free anonymous basemap tiles (`basemaps.cartocdn.com`) started
  requiring an API key partway through 2026, so the live map rendered
  with an "API KEY REQUIRED" watermark burned into every tile instead of
  real streets. Same problem this project already rejected Google Maps
  over (see the tile-provider decision below): a key only the repo owner
  can provision breaks the "static site, no backend, no accounts"
  constraint for anyone else running the code. Switched to Esri's World
  Dark Gray Canvas tiles (base + reference layers for labels), which are
  free and keyless. Visual style is close to the previous CartoDB Dark
  Matter look; not pixel-identical.
- **2026-09-26 — Combat UX rework.** Replaced the always-on spellbook
  dock + separate target-card with a single tap-to-open "wizard sheet"
  per wizard. Split defense into two mechanics (Ward Shield = proactive
  timed stance, Counterspell = reactive precise negation) instead of one
  generic defend spell, because the user described two genuinely
  different defense concepts, not variations on one.
- **2026-09-26 — Spell count cut to 1 attack + 2 defend.** Originally
  shipped with 6 attack spells (one universal + one per element) and a
  heal spell. Cut for simplicity per direct request; element-specific
  spells are the first roadmap item to reconsider, not a permanent cut.
- **2026-09-26 — Spell travel slowed to real minutes.** V1 had spells
  arrive in 1–10 seconds, which trivialized the defend mechanic. Speed
  is now tuned for real minutes at "Real" time scale, with a "Fast"
  (30x) multiplier for testing. Default was Fast while we're actively
  iterating; flip to Real to feel the intended pace.
- **2026-09-26 — Map tiles switched to CartoDB Dark Matter, not Google
  Maps.** Google Maps needs a billing-enabled API key that only the repo
  owner can provision; OpenStreetMap-based tiles are free and already
  show real streets/cities. CartoDB's dark style was chosen over stock
  OSM tiles because stock OSM is light-colored and clashed with the
  game's dark theme.
- **2026-09-26 — Deploy source is `main`, not the feature branch.** The
  repo had no `main` when work started; Pages was first pointed at the
  dev branch to get something live immediately, then `main` was created
  and Pages repointed once the user asked for the more conventional
  setup.
- **2026-09-26 — v1 shipped.** Wizard creation, real-map NPC combat with
  travel-time spells, XP/leveling, localStorage persistence, GitHub
  Pages deploy. See `docs/ARCHITECTURE.md` for the module layout that
  resulted.
