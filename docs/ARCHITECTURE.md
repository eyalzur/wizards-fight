# Architecture

How the game is built. Read this before touching `js/`.

## Stack

Plain HTML/CSS/JS, ES modules, **no build step, no framework**. This is
deliberate: it deploys as-is to GitHub Pages, anyone can open
`index.html` through a static file server and see exactly what ships,
and there's no toolchain to keep working. Don't introduce a bundler or
TypeScript without a product/tech-design conversation first — it's a
real cost against the project's "static site, no build step" constraint.

As of the 2026-09-26 multiplayer work, the project **does** have a
backend: Firebase (Realtime Database + Anonymous Auth), for the reasons
in `proj-status.md`'s Decisions Log. This ends the former "no backend"
constraint but not the "no build step" one — Firebase's modular SDK is
loaded the same way as everything else here, via a plain `import` of a
CDN URL from inside `js/multiplayer.js`, no bundler involved. See
"Multiplayer" below.

External dependencies, all loaded via CDN, no local copies:
- **Leaflet** 1.9.4 (`cdnjs`) — the map engine, loaded as a classic
  global-`L` script tag (see `index.html`) since that's how Leaflet
  ships.
- **CartoDB Dark Matter tiles** (`basemaps.cartocdn.com`) — the actual
  map imagery (real OpenStreetMap data).
- Google Fonts: Cinzel (headings), Nunito (body).
- **Firebase modular SDK** (`gstatic.com`, v10) — loaded as native ESM
  `import()` statements from inside `js/multiplayer.js`, not a
  `<script>` tag in `index.html`. Firebase's modular SDK is ESM-native
  (unlike Leaflet), and `js/multiplayer.js` is itself only ever loaded
  as an ES module by `main.js`, so importing it the same way is the
  better fit here — see `js/multiplayer.js`'s header comment. This
  import is dynamic (`await import(...)`, not a static top-level
  `import`) specifically so a missing/placeholder `js/firebase-config.js`
  degrades to single-player instead of breaking the whole module graph.

## Module map

```
index.html        Screens (create / game), all static DOM structure
css/style.css      Theme (CSS custom properties) + all layout/visual rules
js/
  utils.js         uid(), log(), pick(), randRange/randInt(), clamp()
  geo.js           distanceMeters() [haversine], randomPointInAnnulus()
  spells.js        SPELLS array + getSpell(id) — the only place spell
                   numbers live
  wizard.js        ELEMENTS, stat math, createWizard(), growLevel()
  npc.js           NPC name/temperament generation, createNpc(),
                   respawnNpc()
  combat.js        castAttack/castShield/castCounterspell, tick() —
                   the actual duel simulation, independent of any DOM
  map.js           All Leaflet calls: markers, sense circle, projectile
                   animation. No game logic — pure rendering of whatever
                   state it's handed
  ui.js            All non-map DOM: HUD, wizard sheet, defend alert, menu,
                   log, toasts. Also pure rendering — takes data, wires
                   callbacks, no game logic
  state.js         localStorage save/load (trimmed subset of world state)
  multiplayer.js   Firebase Realtime Database + Anonymous Auth — the
                   remote-persistence counterpart to state.js's local
                   persistence. Reads/writes plain data (player snapshots,
                   pending hits); has no game rules of its own and never
                   imports combat.js/map.js/ui.js. Fails soft to a set of
                   no-ops if Firebase isn't configured or reachable — see
                   "Multiplayer" below
  main.js          The only module that owns game state (`world`). Wires
                   input (map clicks, sheet buttons) to combat.js, and
                   drives map.js/ui.js from the result
```

The dependency direction is one-way: `main.js` imports and orchestrates
everything else; `combat.js`, `wizard.js`, `npc.js`, `geo.js`, `spells.js`
never import `map.js`, `ui.js`, or `multiplayer.js` (game logic doesn't
know about the DOM or the network). `map.js` and `ui.js` never import
`combat.js` or `multiplayer.js` (rendering doesn't know game rules or
where data came from, only the shapes of data it's handed). Keep it that
way — it's what makes the combat logic testable without a browser (see
`docs/QA-CHECKLIST.md`).

The one deliberate, narrow exception: `combat.js` reads two plain fields
off `world` that it doesn't own — `world.timeScale` (pre-existing) and
now `world.myUid`/`world.outgoingHits` (multiplayer) — the same way it
already reads `world.spawnCenter`. This is reading data it's handed, not
a new coupling to Firebase; `combat.js` still has no import of
`multiplayer.js` and doesn't know Firebase exists.

## Data shapes

**`world`** (owned by `main.js`, not persisted as a whole — see State):
```js
{
  player,               // a wizard (see below), isNPC: false
  npcs: [wizard, ...],  // isNPC: true — always local/private, never synced
  remotePlayers: [remoteWizard, ...],  // isRemote: true — see Multiplayer
  projectiles: [...],   // in-flight spells, see below
  outgoingHits: [...],  // pending Firebase writes, drained every tick — see Multiplayer
  log: [string, ...],   // newest first, capped at 60
  openSheet: null | { kind: 'self' } | { kind: 'npc', id } | { kind: 'remote', id },
  playerDown: bool, playerRespawnAt: timestamp | null,
  spawnCenter: {lat, lng},  // original spawn point, used for NPC respawns
  maxWalkMeters: 250,
  timeScale: 1 | 30,    // see combat.js TIME_SCALES
  multiplayerEnabled: bool,  // false if no/invalid Firebase config — see Multiplayer
  myUid: string | null,      // this device's Firebase anonymous-auth uid
}
```

**wizard** (player or NPC — same shape, `createWizard()` in `wizard.js`):
```js
{
  id, name, avatar, element, isNPC, level, xp, xpToNext,
  maxHP, hp, maxMana, mana, power, defense, senseRange,
  manaRegenMs, castTimeMult,
  spells: ['spark_bolt', 'ward_shield', 'counterspell'],  // always these 3
  cooldowns: { [spellId]: readyAtTimestamp },
  shieldBuff: null | { mitigation, expiresAt },
  position: {lat, lng} | null,
  nextManaRegen, nextHpRegen,          // internal tick bookkeeping
  // NPC only:
  temperament, nextAiCheck, defeated, respawnAt,
}
```

**remoteWizard** (another real player, fetched from Firebase — see
Multiplayer; a read-only snapshot, never ticked/simulated locally the way
NPCs are):
```js
{
  id,          // the OTHER player's Firebase anonymous-auth uid
  isRemote: true, isNPC: false,
  name, avatar, element, level,
  hp, maxHP, mana, maxMana, power, defense, senseRange,
  position: {lat, lng},
  lastSyncedAt,  // epoch ms, when that player's device last wrote this record
}
```

**projectile** (`combat.js:castAttack`):
```js
{
  id, casterId, targetId, spellId,
  startPos, endPos,                    // positions at cast time (no homing)
  castStart, travelStart, impactTime,  // all epoch ms
  resolved: bool,
}
```

## The game loop

`main.js` runs `combat.tick(world, now)` every 250ms, then re-renders. A
tick, in order (`combat.js:tick`):

1. **Regen** — mana/HP trickle for every living wizard, gated by
   per-wizard `nextManaRegen`/`nextHpRegen` timestamps.
2. **NPC aggression** — for each NPC off its own `nextAiCheck` cooldown,
   roll temperament-weighted odds; if it hits and an attack spell is
   affordable/in-range/off-cooldown, cast it at the player.
3. **Projectile resolution** — any projectile past its `impactTime` gets
   resolved (damage computed, shield mitigation applied, defeat handled)
   and removed.
4. **NPC respawns** — defeated NPCs past their `respawnAt` come back at a
   fresh random point.
5. **Player respawn** — if down and past `playerRespawnAt`, restore to
   60% HP/mana.

Rendering (`main.js:render()`) is a full re-derive from `world` on every
tick: recompute which NPCs are within sense range, update every map
marker, rebuild the HUD bars, rebuild the wizard sheet's HTML if one is
open, rebuild the defend-alert overlay if a projectile targets the
player. There's no diffing — `ui.js`/`map.js` functions are cheap enough
(a handful of DOM nodes) that this is simpler than tracking dirty state,
and it means UI can never drift from `world`. If a future feature makes
this expensive (e.g. many more NPCs), reach for `docs/WORKFLOW.md`'s tech
design step before optimizing — don't just start micro-caching.
`renderRemotePlayers` (map.js) does the same for `world.remotePlayers`.

## Multiplayer (real players alongside NPCs)

Other real players' wizards appear on the map exactly where NPCs do —
positioned by last-synced location, gated by the same sense-range check —
but they're a genuinely different data source (`world.remotePlayers`,
fetched from Firebase) from NPCs (`world.npcs`, simulated locally), so
they get their own array, their own marker registry in `map.js`
(`renderRemotePlayers`/`remoteMarkers`), and their own `openSheet` kind
(`'remote'`) rather than being merged into the NPC path. **NPCs are not
shared or synced between devices** — each player has their own private
set of 9 NPCs; only wizards (players) go through Firebase.

**Identity.** Firebase Anonymous Auth gives each device a stable `uid`
with no account/email/password (`world.myUid`, set once
`multiplayer.js:initMultiplayer()` resolves). This `uid` is unrelated to
a wizard's local `id` (still a `crypto.randomUUID()` from `utils.js`,
unchanged) — the uid only matters for Firebase paths and security-rule
checks, never for local game logic.

**What gets synced, and how often** (`js/multiplayer.js`, called from
`main.js`): the local player's own wizard snapshot is written to
`players/{myUid}` in Realtime Database on every meaningful action (walk
finished, cast, shield raised — same call sites as `saveState`) and every
6s while playing. The list of all other players is re-fetched every 15s
and filtered to sense range client-side in `render()`, the same way NPCs
already are. There's no live listener/presence — this is deliberate (see
`proj-status.md` Decisions Log): a periodic poll is enough for "other
wizards visible on the map," and avoids the "who's online now" feature
this project explicitly isn't building in v1.

**Casting at a real player.** From the caster's side, this goes through
the exact same `combat.castAttack()` as an NPC target — same mana cost,
cast time, cooldown, projectile animation — with one difference: the
travel-time calculation always uses real time (`TIME_SCALES.real`),
ignoring the local Fast/Real testing toggle, so a device's own speed
preference can never let it cheat another player's travel-time window.

**Resolving the hit — who's authoritative.** This is the one place
casting a real player genuinely differs from an NPC, and it's a direct
consequence of there being no server-side code (Firebase's free tier has
no Cloud Functions in this setup): the caster's device does **not**
compute damage against a real player, because it has no authoritative
knowledge of that player's live defense/shield state — only their own
device does. Instead, when the caster's local projectile reaches its
`impactTime`, `combat.js:resolveImpact` pushes a plain descriptor —
`{ targetId, casterId, casterName, spellId, casterPower, impactAt }` —
onto `world.outgoingHits` instead of touching HP. `main.js` drains that
queue every tick and hands each entry to
`multiplayer.js:sendPendingHit()`, which appends it under
`pendingHits/{targetUid}/` in Firebase. The **target's own device**
periodically (every 15s, and once on boot) calls
`fetchAndClearDueHits()`, which returns and deletes every pending hit
whose `impactAt` has already passed, and applies each one via
`combat.js:applyPendingHit()` — the same damage formula as
`resolveImpact`, but evaluated against the target's own live `defense`/
`shieldBuff` at the moment it's applied. This is why Ward Shield still
mitigates a remote hit correctly (it's the target's own current shield
state doing the mitigating) while Counterspell does not apply to
remote-originated hits in v1 — there's no live "incoming spell" warning
for a cross-device cast (that would need a live listener, which v1
deliberately doesn't have), so the target never gets the reactive window
Counterspell needs. This asymmetry is a real v1 limitation, not an
oversight — see `proj-status.md` Roadmap.

**"Attacked while away."** On boot, before the map even matters, the
local player's due pending hits are applied (see above) and, if any
landed, summarized into one toast ("While you were away, X, Y hit you for
N damage total. See the Spell Log for details.") rather than one toast
per hit — this is the fix for the general "did something hit me while I
wasn't looking" gap; see the note below on why NPCs don't currently need
the same treatment. Hits that land while the app stays open are applied
by the same periodic poll but don't get a toast — the log entry
`applyPendingHit` already writes is enough for someone actively watching.

**Why NPCs didn't already have this gap.** NPCs only ever act inside
`combat.tick()`, which only runs while the tab is open (`setInterval` in
`main.js`); a projectile in flight when the tab closes simply ceases to
exist on reload (see State persistence, below) rather than resolving
late. So under the pre-multiplayer model there was no way for an NPC hit
to land "while you were away" — the scenario didn't exist yet. Real
players introduced it, because their attacks are recorded durably in
Firebase and can resolve on a schedule independent of whether either
device is running. The away-hit toast above is written generically
(falls back to "an NPC" if `casterName` is absent) in case that ever
changes, but no NPC-side pending-hit machinery was built for this
change — that would be speculative for a gap that doesn't exist.

**Setup.** Multiplayer needs a Firebase project the repo owner creates
themselves (see `js/firebase-config.example.js` and `firebase-rules.json`
for the exact steps) — this is the same category of "only the repo owner
can do this" step as the Google Maps API key mentioned in the Decisions
Log, just for a feature that's actually shipping instead of one that got
swapped out. Without that setup, `js/firebase-config.js` doesn't exist,
`multiplayer.js` fails soft, and the game is single-player exactly as
before — this fallback is load-bearing, not incidental, since most
clones/forks of this repo won't have a Firebase project configured.

## Casting flow (why it's split the way it is)

`castAttack`/`castShield`/`castCounterspell` are three separate exported
functions in `combat.js` rather than one generic `cast(spell)`, because
they have genuinely different shapes: an attack creates a projectile that
resolves later; a shield sets a buff with no target; a counterspell needs
an existing projectile to act on and resolves *immediately*, out of band
from the normal tick-based impact resolution. Resist collapsing these
into one dispatcher — the last time spells were more generic
(`castDefend` handling both mitigate and dodge types), it produced dead
code paths once the spell roster changed. See `proj-status.md` Decisions
Log.

## State persistence

`state.js` saves/loads a **trimmed** subset of `world` — `player`, `npcs`,
`spawnCenter`, `timeScale` — not the whole object. `projectiles`, `log`,
`openSheet`, `remotePlayers`, `outgoingHits`, `multiplayerEnabled`, and
`myUid` are all intentionally transient: a projectile in flight when the
tab closes simply doesn't exist on reload (the attacker doesn't get their
mana refunded, but nothing crashes — `resolveImpact` only ever looks up
wizards, never assumes a specific projectile history); `remotePlayers` is
always freshly re-fetched from Firebase on next boot; `myUid` is
re-derived from Firebase Anonymous Auth (which itself persists the
device's identity in the browser, independent of this project's own
`localStorage` key). None of this is `state.js`'s concern to persist.
This is a known simplification, not a bug; revisit only if it becomes a
real player complaint (real-minutes travel times make "close the tab
mid-cast" plausible).

Multiplayer's own durability lives entirely in Firebase, not
`localStorage`: a pending hit against a real player survives a closed tab
on *either* device (that's the whole point — see "Multiplayer" above),
which is different from the local-only projectile simplification just
described.

## Testing so far

No automated tests are checked into the repo yet (see `proj-status.md`
Known gaps). Development so far has been verified with disposable
Playwright scripts (headless Chromium, driving the actual page through
real DOM interactions — click marker, cast spell, assert log output)
written to a scratch directory outside the repo per change, not
committed. `docs/QA-CHECKLIST.md` captures what those scripts checked, in
a form a human can run by hand. Turning that into a real committed test
suite is on the roadmap.

## Deployment

Static site, GitHub Pages, **Source: Deploy from a branch → `main` →
`/root`** (Settings → Pages). Every push to `main` is live within a
minute or two, no build step.

`.github/workflows/deploy-pages.yml` also exists as an alternative
Actions-based deploy path (for if the repo ever switches Pages Source to
"GitHub Actions" instead of branch-based). It's currently not the active
path — if you see it fail in the Actions tab, that's expected as long as
Pages Source is set to "Deploy from a branch"; it isn't touching
anything.
