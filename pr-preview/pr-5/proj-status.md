# Wizards Fight — Project Status

Last updated: 2026-09-29

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
- **Runes & Powers** — a second, ongoing earn-and-spend currency (🔮
  Runes) alongside XP: every NPC kill grants Runes using the same formula
  as XP. Runes buy permanent, capped, non-refundable upgrades to two
  attributes — Spell Power (+5%/level Spark Bolt damage, cap Lv.3/+15%)
  and Spell Recovery (−0.1s/level Spark Bolt cooldown, cap Lv.3/1.2s) —
  from a new "🔮 Runes & Powers" bottom sheet (☰ menu). Player-only; NPCs
  don't earn or spend Runes. See `docs/FEATURES.md` for exact numbers.
- **Persistence** — wizard (including Runes balance and Powers levels) +
  NPCs + spawn point + speed setting saved to `localStorage`. No
  accounts, nothing leaves the browser except the optional multiplayer
  sync below.
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
