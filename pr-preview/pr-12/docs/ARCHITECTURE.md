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
- **Esri World Dark Gray Canvas tiles** (`server.arcgisonline.com`, base +
  reference layers) — the actual map imagery (real OpenStreetMap-derived
  data). Chosen because it's keyless; CartoDB's basemaps started requiring
  an API key in 2026 (see `proj-status.md` Decisions Log).
- Google Fonts: Cinzel (headings), Inter (body — switched from Nunito in
  the v1 "mature" theme pass, see `proj-status.md` Decisions Log).
- **Firebase modular SDK** (`gstatic.com`, v12) — loaded as native ESM
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
  economy.js       Mana Crystals: the ECONOMY + GEAR number tables, pot
                   accrual, collect, kill bonus, buy/equip, save
                   normalization. Game logic, no DOM
  npc.js           NPC name/temperament generation, createNpc(),
                   respawnNpc()
  combat.js        castAttack/castShield/castCounterspell, tick() —
                   the actual duel simulation, independent of any DOM
  map.js           All Leaflet calls: markers, sense circle, projectile
                   animation. No game logic — pure rendering of whatever
                   state it's handed
  ui.js            All non-map DOM: HUD, wizard sheet, defend strip, menu,
                   log, toasts, and the Shop/Inventory/Character full
                   screens. Also pure rendering — takes data, wires
                   callbacks, no game logic
  portraits.js     Turns a wizard's `avatar` field into portrait <svg>
                   markup referencing index.html's sprite `<symbol>`s. Pure
                   string building, no DOM access, no game logic — shared by
                   ui.js and map.js so avatar rendering isn't duplicated
                   across both
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
everything else; `combat.js`, `wizard.js`, `npc.js`, `geo.js`, `spells.js`, `economy.js`
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
  // ^ the shop used to be a fourth kind here (`{ kind: 'shop', slot }`); it's
  // now its own top-level screen (#screen-shop) instead of a docked sheet —
  // see "Screen layout and layering" below. The shop's active slot tab lives
  // as a plain module-level variable in main.js (`shopSlot`), not on `world`,
  // since it's view-only UI state with nothing to persist.
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
  // `avatar` is a portrait symbol id, e.g. "portrait-hood-a" (5 distinct
  // hand-authored symbols, no mirroring) — see js/portraits.js and the
  // sprite `<symbol>`s in index.html. Rendered tinted by the wizard's
  // element color; the ring around the portrait (js/portraits.js:
  // avatarWithRing) encodes identity via its color (self/NPC/selected) AND
  // current HP via its arc length (hp/maxHP) — one component, two signals.
  spells: ['spark_bolt', 'ward_shield', 'counterspell'],  // always these 3
  cooldowns: { [spellId]: readyAtTimestamp },
  shieldBuff: null | { hp, maxHP, expiresAt }, // absorb pool, not a flat % — see docs/FEATURES.md "Ward Shield"
  position: {lat, lng} | null,
  nextManaRegen, nextHpRegen,          // internal tick bookkeeping
  // Player only (economy.js:normalizeEconomy fills these for old saves):
  gems,                                // Mana Crystal balance (integer)
  pot, lastAccrualAt,                  // Treasury (float) + epoch ms of last accrual
  equipment: { wand: id|null, robe: id|null },
  gearLevels: { wand: 0..10, robe: 0..10 }, // upgrade level of the equipped item per slot (0 if empty)
  gearApplied: { power, maxHP, defense }, // how much of the fields above is gear
  seenPotHint,                         // one-time "crystals are gathering" toast shown
  // Runes & Powers (see docs/FEATURES.md) — carried on every wizard for
  // shape consistency with xp/level, but only ever earned/spent by the
  // player; NPCs keep these at 0 forever.
  runes, spellPowerLevel, spellRecoveryLevel,
  // Player only:
  nemesisId,                           // Nemesis System — see below
  // NPC only:
  temperament, nextAiCheck, defeated, respawnAt,
}
```

**Nemesis System** (`world.player.nemesisId`, set/cleared/boosted entirely
in `combat.js:handleDefeat`, stat math in `npc.js`): whichever NPC most
recently defeated the player (via a local kill — see the scope note below)
is remembered by id on `world.player.nemesisId`, one field, no new array or
history. It's called out by name wherever it appears (the incoming-curse
alert, the NPC wizard sheet's badge — both resolved in `main.js` and handed
to `ui.js` as plain fields/booleans, never looked up by `ui.js` itself) and
gets a modest combat boost (`npc.js:applyNemesisBoost` — +20% max HP, +15%
power, +2 flat defense) while it holds the title. The boost, and the
Nemesis's level itself, are **recomputed fresh** from the NPC's element +
current level (via `createWizard`, the same math `createNpc` uses at first
spawn) every time they're applied or cleared, rather than stored as a
separate delta — so this stays one new persisted field, and re-applying or
clearing the boost twice in a row can't double-stack or drift. Defeating
your own Nemesis back clears the title, reverts the boost, and grants a
1.75x bonus on that kill's XP/Runes/Crystals (`combat.js`'s
`NEMESIS_DEFEAT_BONUS_MULT`). Unlike every other NPC — which keeps its
spawn-time level forever across respawns (see `npc.js`) — a Nemesis
re-syncs its level toward the player's current level each time it respawns
(`npc.js:respawnNpc`'s optional `nemesis` argument), so it stays a relevant
rival instead of falling behind. Scope cut, deliberate: only a local NPC
kill (the `resolveImpact` path, where `killer` is a real object) can set a
Nemesis — a remote player's pending hit defeating you passes `killer = null`
to `handleDefeat` (see `applyPendingHit`) because the target device doesn't
have full attacker identity for a remote caster; extending Nemesis to real
players is a future product decision, not built here.

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
`main.js:render()` attaches one more field, `casterColor` (the caster's
element color), to a shallow copy of each projectile before handing them to
`map.renderProjectiles` — a rendering-only addition, not part of the shape
combat.js owns or persists, so map.js can color the projectile's glow orb
without looking up wizards by id itself.

The same pattern is used for `shieldActive`: `main.js:render()` computes
`combat.isShieldActive(wizard, now)` fresh every render and attaches it to a
shallow display-only copy of `world.player`/each NPC before passing to
`map.updatePlayer`/`map.renderNpcs` and `ui.renderHud` — never written onto
the real wizard object, since that gets `saveState()`'d every 2s and a
derived boolean would otherwise persist as stale data. `js/portraits.js:
avatarWithRing` reads it to render (or omit) the pulsing shield-bubble.

## Screen layout and layering

**Top level: `#screens` + the bottom tab bar.** `#app` has exactly two
children: `#screens` (a plain wrapper around all 6 `.screen` sections,
`flex:1; min-height:0`) and `#tab-bar` (`flex:none`, the persistent 5-tab
nav — 🗺️ Map / 🛒 Shop / 🎒 Inventory / 🧙 Character / 📜 Missions). Added
2026-10-10, replacing the ☰ menu's Shop/Inventory/Character entries and
each subscreen's own "← Back to Map" button. This wrapper exists because
`.screen.active { height: 100% }` needs a parent with a real computed
height to resolve against — before `#tab-bar` existed, that parent was
`#app` itself (`100dvh`), which was correct; once `#tab-bar` became `#app`'s
*other* child, `.screen`'s `100%` would have resolved against `#app`'s full
height again and the bar would have either been pushed off-screen or caused
overflow, not actually shared space with the screen above it. Wrapping the
screens in `#screens` (`flex:1;min-height:0`, the same idiom
`.subscreen-content` already uses) makes `#screens`' own computed height —
full height minus the bar — the thing `.screen{height:100%}` resolves
against instead. `ui.js:showScreen(id)` toggles which `.screen` has
`.active` exactly as before, and now also updates the bar's active-tab
highlight in the same call (`SCREEN_TO_TAB` map), so there's no separate
call site to keep in sync. The bar itself is only wired up and unhidden by
`ui.js:initTabBar()`, called once from `main.js:boot()` — which only ever
runs after a wizard is created or resumed — so it's correctly absent for
`#screen-create` (no wizard yet to navigate with) without any extra
show/hide logic. Tapping a tab calls `main.js:goToScreen(name)`, the same
function the old back-button used. The iOS home-indicator safe-area inset
(`env(safe-area-inset-bottom)`) now lives on `.tab-bar` only — it was
previously duplicated on `#screen-game` and `.subscreen` (both padded their
own bottom edge because each was, at the time, the bottom-most element of
`#app`); now that the bar is the bottom-most element whenever it's visible,
those two rules were removed rather than left to double up.

**Missions is a placeholder, not a built feature.** `#screen-missions` is
static copy ("📜 Missions… Coming soon — this will be a bounty board with
session goals. Nothing to do here yet.") — there is no Bounty Board /
missions system implemented anywhere in this codebase; it's only a
brainstormed idea in `proj-status.md`'s "Future feature concepts". Unlike
the other 3 subscreens it has no `*-content` div for `main.js:render()` to
populate every tick, since there's no data to derive.

`#screen-game` is a vertical flex stack, in this order: `#hud` (in flow) /
`#defend-overlay` (the defend strip; in flow, shown only while attacked) /
`#stage` (`flex:1`, `isolation:isolate`) / `#wizard-sheet` (in flow; self,
NPC and remote sheets render here) / a safe-area gap
(`env(safe-area-inset-bottom)` padding on the screen). `#stage` contains
`#map`, `#menu-scrim` + `#menu-panel` (the ☰ popover), `#toast-container`,
`#log-panel` (and `#qa-panel` under `?qa=1`) and `#down-overlay`. Because
HUD, strip and sheet are siblings *around* the stage, nothing inside it can
cover them, and the sheet shrinks the map instead of overlaying it.
Floating-over-everything layers (`.gem-pop`, `.sign-pad`) are children of
`#screen-game` itself.

Z-order lives only as tokens in `:root`: map 0, toast 10, log/powers 20,
scrim 30, menu 31, down 40, strip 45, HUD 50, gem pop 60, sign pad 100.
Don't write a literal `z-index`.

**One transient overlay at a time.** Menu, log/QA panels and the docked
sheet are mutually exclusive. `ui.js` owns the menu/panel half
(`closeOverlays`, `hasOverlayOpen`, `closeMenu`); the sheet is
`world.openSheet`, so `main.js` hands `bindHud` an `onBeforeOverlay` hook
that closes it, and opens sheets through `showSheet()` (which calls
`ui.closeOverlays()` first). `onMapClick` only dismisses an open overlay
before it would ever walk. A new incoming projectile id (tracked in
`main.js:seenIncoming`) calls `ui.closeMenu()` once, nothing else.

**Defend strip DOM** is built once when the strip first appears and then
only patched (title, "+N more", reason, ring offset, seconds, the button's
`data-proj`/disabled state); the Counter click is delegated. Rebuilding it
every 250ms swallowed taps, same reason as the self sheet above.

**Shop / Inventory / Character (full screens, not sheets).** Added
2026-10-09, replacing the old "💎 Crystal Shop" docked sheet and "🔮 Runes &
Powers" bottom panel. `#screen-shop`, `#screen-inventory` and
`#screen-character` are siblings of `#screen-create`/`#screen-game` (same
`.screen`/`.active` toggle, driven by `ui.showScreen(id)`). As of
2026-10-10 they're reached via the persistent bottom tab bar (see "Top
level: `#screens` + the bottom tab bar" above) instead of 3 ☰ menu entries,
and left by tapping the bar's 🗺️ Map tab instead of a per-screen "← Back to
Map" button (both removed). They render real `world`
data via `ui.renderShopScreen`/`renderInventoryScreen`/`renderCharacterScreen`,
called from `main.js:render()` every tick exactly like the map/HUD —
unconditionally, regardless of which screen is actually active, so there's
never a stale frame on switching screens (see "The game loop" below).
Rationale for 3 screens instead of 3 more bottom sheets: this is a
product/IA decision (more systems — gear, Runes & Powers, future potions —
needed real room instead of stacking more cramped sheets over the live
map), not a game-logic change; no `world`/wizard field changed shape, only
where existing data renders. The Shop screen reuses the old sheet's
`shopRowHtml`/`upgradeHtml` markup and two-tap "tap again to buy/upgrade"
confirm flow (`main.js`'s `shopConfirm`/`shopFlash`, now gated by a plain
module-level `shopSlot` instead of `world.openSheet.slot`) verbatim, since
that confirm timing is the one thing on these 3 screens that still needs
the render-every-250ms-without-rebuilding-the-DOM guard the old sheets used
(`shopScreenKey` in `ui.js`); the Character/Inventory screens don't have an
equivalent timing-sensitive interaction, so they just rebuild their
`innerHTML` unconditionally every render, same as the old Runes & Powers
panel always did.

**Spells keep traveling while off the map.** `combat.tick()` runs on the
same `setInterval` regardless of which screen is active (screens only ever
toggle DOM visibility, never pause the loop — see "The game loop"), so an
incoming curse's travel timer keeps counting down even while the player is
browsing Shop/Inventory/Character/Missions. To avoid a defenseless
surprise, each of those 4 screens carries an `.offmap-alert` element in its
header (`ui.renderOffMapAlert`, fed the same `incoming` array
`main.js:render()` already builds for `ui.renderDefendPrompts`) that shows
the soonest incoming spell's caster/name/countdown and is itself a tappable
button; tapping it (wired in `ui.initSubscreens`) returns to the map, where
the real defend strip and Counterspell are reachable — the same place the
bar's own 🗺️ Map tab goes. There's no Counterspell button on the 4 screens
themselves — by design, since casting still needs the sign-pad flow that
only makes sense once you can see the map/HUD underneath it.

**Map sizing.** `#map` fills `#stage`. `map.js` observes it with a
`ResizeObserver` (sheet/strip appearing, window or mobile-toolbar changes) ->
`invalidateSize` and `keepInView()`, which pans just enough that the player
marker (and the tapped wizard) stay fully visible. `main.js` calls
`map.reveal(pos|null)` when a sheet opens/closes to re-measure immediately and
focus the tapped wizard.

## The game loop

`main.js` runs `combat.tick(world, now)` every 250ms, then re-renders. A
tick, in order (`combat.js:tick`):

1. **Regen** — mana/HP trickle for every living wizard, gated by
   per-wizard `nextManaRegen`/`nextHpRegen` timestamps.
2. **NPC aggression** — for each NPC off its own `nextAiCheck` cooldown,
   roll temperament-weighted odds; if it hits and an attack spell is
   affordable/in-range/off-cooldown, cast it at the player.
3. **Projectile resolution** — any projectile past its `impactTime` gets
   resolved (damage computed, an active Ward Shield's absorb pool weighed
   against it, defeat handled) and removed.
4. **NPC respawns** — defeated NPCs past their `respawnAt` come back at a
   fresh random point.
5. **Player respawn** — if down and past `playerRespawnAt`, restore to
   60% HP/mana.

Rendering (`main.js:render()`) is a full re-derive from `world` on every
tick: recompute which NPCs are within sense range, update every map
marker, rebuild the HUD bars, rebuild the wizard sheet's HTML if one is
open, patch the defend strip if a projectile targets the player. There's no diffing — `ui.js`/`map.js` functions are cheap enough
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

## Economy and gear

`economy.js` owns it. `wizard.power/maxHP/defense` hold the **effective**
values (element + level + gear) so `combat.js` needs no gear awareness;
`gearApplied` records the gear share so `syncGear` can swap bonuses
idempotently, and `growLevel` keeps working because it just adds to the same
fields. Never edit those three fields for gear any other way.

Income is timestamp-based: `main.js:gameTick` calls `economy.accrue(player,
now, timeScale)` each tick. The Fast multiplier applies only to the first 2s
of a tick gap (a live foreground tick is 250ms); longer gaps (closed page,
sleep, throttled tab) accrue at 1x. Negative gaps earn nothing. `combat.js`
imports `economy.awardKillBonus` for the kill reward; `main.js` notices the
balance rise and shows the "+N 💎" pop. Gear is a flat catalog (`GEAR`) with
`slot`, `tier`, `price`, `mods` (base) and `upgrade` (per-level bonus); adding
tiers or slots is adding rows. Upgrades: `gearLevels[slot]` is the level of the
equipped item (reset to 0 when a new tier is bought); `gearBonus(equipment,
levels)` = mods + level x upgrade, still applied only through `syncGear`.
`upgradeGear`/`upgradeState`/`upgradeCost` and the `upgrade*` keys of `ECONOMY`
hold the rules and numbers; `normalizeEconomy` clamps `gearLevels` to
0..`upgradeMaxLevel` (missing/corrupt -> 0), so old saves load unchanged. The
upgrade confirm uses `shopConfirm` with id `up:<slot>`. `combat.js` clamps a
shielded hit to at least 1 damage so no gear stack makes a wizard immune.

**Sheet/screen re-rendering:** `render()` runs every 250ms, and replacing
`innerHTML` that often swallows taps. `ui.js` rebuilds the self sheet and
the Shop screen only when their structure changes (a key string), and
patches live numbers (pot, HP, mana, ward timer) in place. The shop's "tap
again to buy/upgrade" state lives in `main.js` (`shopConfirm`/`shopFlash`),
not the DOM. The Inventory and Character screens have no equivalent
timing-sensitive confirm flow, so they rebuild unconditionally every tick
(see "Screen layout and layering" above).

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

## Dev/testing tooling: `?qa=1`

A `?qa=1` query param on `index.html` (e.g.
`https://.../wizards-fight/?qa=1`) unlocks a "🧪 QA Tools" entry in the ☰
menu, for the project owner to set up test states without grinding NPC
kills. It is a developer tool, not a player-facing feature:

- Checked once at boot in `main.js` (`new URLSearchParams(location.search).has('qa')`)
  and never written to `localStorage` — it only applies to the page load it
  was requested on, so it can't accidentally linger after testing.
- When the flag is absent, none of the QA DOM is ever created (no menu
  button, no panel element) — `js/ui.js:initQaTools`/`renderQaPanel` are
  simply never called, rather than being created-then-hidden.
- The panel (`js/ui.js:initQaTools`) lets you set the player's Rune balance
  to an exact number (plus +100/+1000/♾️ Infinite quick-sets — Infinite sets
  a plain large number, `QA_INFINITE_RUNES` in `main.js`, not literal
  `Infinity`, so every existing cost/affordability check keeps working
  unchanged) and set `spellPowerLevel`/`spellRecoveryLevel` directly via
  +/- steppers,
  clamped to each upgrade's existing `maxLevel` (`js/wizard.js:setUpgradeLevel`)
  — it can jump straight to the max/"Maxed" state but never past it, since
  the cap itself needs to stay testable as a real boundary.
- A second, identical section lets you set the player's Mana Crystal (💎)
  balance the same way (`qa-gems-*` ids, `onSetGems`/`onAddGems`/
  `onSetInfiniteGems` in `main.js`, `QA_INFINITE_GEMS`) — new wizards start
  at 0 💎 by design (`economy.js`'s grind economy), so this is the only way
  to reach the Shop's higher gear tiers without grinding kills first, for
  testing.
- Every QA action goes through the same `saveState`/`render` path as a
  normal purchase (`js/wizard.js:buyUpgrade`) — no separate storage
  mechanism, no bypass of the persistence layer.
- The Inventory screen (see "Screen layout and layering") is still only an
  equipped-loadout view, not an owned-items system — there's nothing to
  grant there beyond what buying gear in the Shop already equips — so QA
  mode has nothing to grant beyond Runes and the two existing upgrade
  levels (see `proj-status.md` Decisions Log on Runes & Powers).

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

## PR previews

`.github/workflows/pr-preview.yml` (`rossjrw/pr-preview-action`) gives
every open pull request its own live URL for review before merge:
`https://eyalzur.github.io/wizards-fight/pr-preview/pr-<number>/`. It
redeploys on every push to the PR and posts/updates a sticky comment with
the link. Mechanically, this works by having the action commit the PR's
files into a `pr-preview/pr-<number>/` folder **on `main` itself** (not a
separate `gh-pages` branch) — the simplest option given Pages already
serves the whole `main` tree and this project has no build step to keep
a preview folder in sync with. The action removes that folder (another
bot commit to `main`) when the PR closes. Practical effect: `main`'s
history includes bot commits for preview deploy/teardown alongside real
feature commits — expected, not a mistake if you see them in `git log`.
