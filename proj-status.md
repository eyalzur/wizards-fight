# Wizards Fight — Project Status

Last updated: 2026-10-09

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
- **The map** — real streets and city labels via Leaflet + CartoDB Dark
  Matter tiles (not Google Maps — see Decisions Log). Tap-to-walk (max
  250m per tap, animated), a 📍 button to sync your real location, and a
  dotted circle showing your **sense range**: NPCs outside it are not
  shown at all.
- **Spells (3 total, same for everyone)**:
  - **Spark Bolt** (attack) — travels at a real 1 m/s, so a cast takes
    real minutes to land at "Real" time scale. A ⚡/🐢 toggle in the ☰
    menu speeds this up 30x for testing.
  - **Ward Shield** (defend) — a proactive stance, raised ahead of time,
    lasts 2 real minutes, softens every hit while it holds (not consumed
    per-hit).
  - **Counterspell** (defend) — reactive: cast during the incoming-curse
    alert to negate that *specific* spell outright.
- **Sign drawing** — every cast opens a pad that draws that spell's sign
  point by point, then makes it vanish; the player redraws it from memory
  against a timer (10s at Lv.1, −0.5s per level, floor 4s) — the sign is
  shown as a wide band (±4% of its size) and ink anywhere inside it counts
  as on the line — only Clear and Cast buttons, the Cast button turns
  green→red with the seconds left and auto-casts at zero and similarity
  (position/size/direction-independent) maps to a ×0.5–×1.5 power
  multiplier (attack damage, shield mitigation). A Counterspell needs
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
- **Fixed map zoom** — no zoom buttons or gestures (map stays at zoom 17;
  distances are tuned for it). Panning still works.
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
  from the 🧙 Character screen (☰ menu; see "Shop, Inventory, Character
  screens" below — this used to be a separate "🔮 Runes & Powers" bottom
  sheet). Player-only; NPCs don't earn or spend Runes. See
  `docs/FEATURES.md` for exact numbers.
- **Persistence** — wizard (including Runes balance and Powers levels) +
  NPCs + spawn point + speed setting saved to `localStorage`. No
  accounts, nothing leaves the browser except the optional multiplayer
  sync below.
- **Mana Crystals economy (Phase 1)** — 💎 passive income into an uncapped
  Treasury pot (scaled by ⚡ Fast while the page is open), a small kill
  bonus, and a Shop screen (☰ menu) selling 5 wand tiers and 5 robe tiers,
  each upgradable +1..+10 with 💎 (deterministic, no gambling), so a maxed
  avatar is overwhelmingly stronger than same-level NPCs. Numbers in
  `docs/FEATURES.md` are first guesses.
- **Shop, Inventory, Character screens (2026-10-09)** — the old "💎 Crystal
  Shop" docked sheet and "🔮 Runes & Powers" bottom panel were replaced by 3
  full, non-map screens reached from the ☰ menu (🛒 Shop, 🎒 Inventory, 🧙
  Character), each with a "← Back to Map" button. Inventory is a new
  (deliberately minimal) equipped-loadout view of the 2 gear slots; the
  other two just promote existing content to more room. Spells keep
  traveling while any of the 3 is open (the game loop never pauses), so
  each carries an off-map incoming-curse banner that jumps back to the map.
  See `docs/FEATURES.md` "Shop, Inventory and Character screens" and the
  Decisions Log entry below.
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
  a real player's incoming attack (only Ward Shield's passive mitigation
  applies) — that would need live syncing this v1 deliberately doesn't do.
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
