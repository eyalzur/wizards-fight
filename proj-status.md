# Wizards Fight — Project Status

Last updated: 2026-10-01

This file is the single source of truth for "what exists, what's next, and
why we made the calls we made." Run `/check-proj` to get a suggested next
task based on this file plus any open GitHub issues.

See also: [`docs/FEATURES.md`](docs/FEATURES.md) (what the game does),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (how it's built),
[`docs/WORKFLOW.md`](docs/WORKFLOW.md) (how we build it),
[`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md) (how we verify it).

## Snapshot

A browser wizard-duel game on a real street map, built for kids/teens
(roughly 13–25, boys-skewing). No backend, no accounts — everything is a
static site on GitHub Pages, state lives in the browser's `localStorage`.
Currently single-player against NPCs (multiplayer is explicitly deferred,
see Roadmap).

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
- **Sign drawing** — every cast (Spark Bolt, Ward Shield, Counterspell) opens
  a pad showing the ⭐ Star Sigil (a one-stroke pentagram); the player redraws
  it and similarity (position/size/direction-independent) maps to a ×0.5–×1.5
  power multiplier (attack damage, shield mitigation). A Counterspell needs
  ×1.0+ or it fizzles (mana still spent). NPCs cast at ×1. Scoring in
  `js/sign.js`, overlay in `js/signpad.js`. Only one sign so far; thresholds
  are first guesses.
- **Combat UX** — tapping any wizard (yourself or an NPC) opens a
  contextual bottom sheet with their stats and the one relevant action
  (Attack for NPCs, Raise Shield for yourself). No always-on spellbook.
- **NPCs** — 9 spawned per game around the player, random element/level/
  name/temperament (passive/neutral/aggressive, which drives how often
  they attack and how readily they shield/counter). Respawn 30–50s after
  defeat.
- **Progression** — XP on NPC kill, leveling grows stats and heals you.
  Player defeat is a soft penalty (4s downtime, respawn at 60% HP/mana) —
  no permadeath.
- **Persistence** — wizard + NPCs + spawn point + speed setting saved to
  `localStorage`. No server, no accounts, nothing leaves the browser.
- **Mana Crystals economy (Phase 1)** — 💎 passive income into an uncapped
  Treasury pot (scaled by ⚡ Fast while the page is open), a small kill
  bonus, and a Crystal Shop selling 2 wand tiers and 2 robe tiers that make
  you stronger than same-level NPCs. Numbers in `docs/FEATURES.md` are
  first guesses.
- **Deploy** — static site, GitHub Pages, deploys from `main`.

## Known gaps / not yet built

- No automated test suite committed to the repo. Verification so far has
  been manual Playwright smoke tests run ad hoc during development (see
  `docs/QA-CHECKLIST.md` for what to check by hand until this changes).
- No sound, no animations beyond the projectile flight and sheet slide-up.
- No real multiplayer — "other wizards" are always NPCs.
- Balance (spell numbers, XP curve, NPC aggression rates) is a first
  guess, not tuned from real play data.
- No accessibility pass (screen reader labels, focus order, contrast
  check beyond the design's own dark palette).
- Real map speed (spells take real minutes) has not been validated with
  an actual multi-minute play session end-to-end — only under the Fast
  test multiplier.

## Roadmap (unordered backlog — `/check-proj` helps prioritize)

Mana Crystals economy phases (Phase 1 is live, see above):
- **Phase 2** — 📍 walk income (crystals for really moving around) and the
  full 5-tier ladder per slot (Starwood, Aurora, Archmage's Scepter /
  Starsilk, Aurora Mantle, Archmage Vestments) with level gates. Also decide
  whether to default new wizards to Real speed (see Decisions log).
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
- A true multiplayer backend (would end the "no backend" constraint —
  big decision, needs its own product-design pass first).

## Decisions log

Short-form history of calls that shaped the current build, newest first.
Keeps future planning from accidentally re-litigating settled questions
without knowing why they were settled.

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
  accepted risk (no backend to check against). OPEN: Fast is still the
  default speed, so new wizards earn at ×30 until someone flips it.
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
  (30x) multiplier for testing. Default is Fast while we're actively
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
