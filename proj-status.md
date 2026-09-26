# Wizards Fight — Project Status

Last updated: 2026-09-26

This file is the single source of truth for "what exists, what's next, and
why we made the calls we made." Run `/check-proj` to get a suggested next
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
  `localStorage`. No accounts, nothing leaves the browser except the
  optional multiplayer sync below.
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

## Roadmap (unordered backlog — `/check-proj` helps prioritize)

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

## Decisions log

Short-form history of calls that shaped the current build, newest first.
Keeps future planning from accidentally re-litigating settled questions
without knowing why they were settled.

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
