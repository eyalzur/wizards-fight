# Architecture

How the game is built. Read this before touching `js/`.

## Stack

Plain HTML/CSS/JS, ES modules, **no build step, no framework, no
backend**. This is deliberate: it deploys as-is to GitHub Pages, anyone
can open `index.html` through a static file server and see exactly what
ships, and there's no toolchain to keep working. Don't introduce a
bundler, TypeScript, or a framework without a product/tech-design
conversation first — it's a real cost against the project's "static site,
no build step" constraint (see `proj-status.md` Roadmap: multiplayer is
the one item that would actually force this constraint to be revisited).

External dependencies, both loaded via CDN, no local copies:
- **Leaflet** 1.9.4 (`cdnjs`) — the map engine.
- **CartoDB Dark Matter tiles** (`basemaps.cartocdn.com`) — the actual
  map imagery (real OpenStreetMap data).
- Google Fonts: Cinzel (headings), Nunito (body).

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
  ui.js            All non-map DOM: HUD, wizard sheet, defend alert, menu,
                   log, toasts. Also pure rendering — takes data, wires
                   callbacks, no game logic
  state.js         localStorage save/load (trimmed subset of world state)
  main.js          The only module that owns game state (`world`). Wires
                   input (map clicks, sheet buttons) to combat.js, and
                   drives map.js/ui.js from the result
```

The dependency direction is one-way: `main.js` imports and orchestrates
everything else; `combat.js`, `wizard.js`, `npc.js`, `geo.js`, `spells.js`, `economy.js`
never import `map.js` or `ui.js` (game logic doesn't know about the DOM).
`map.js` and `ui.js` never import `combat.js` (rendering doesn't know
game rules, only the shapes of data it's handed). Keep it that way — it's
what makes the combat logic testable without a browser (see
`docs/QA-CHECKLIST.md`).

## Data shapes

**`world`** (owned by `main.js`, not persisted as a whole — see State):
```js
{
  player,               // a wizard (see below), isNPC: false
  npcs: [wizard, ...],  // isNPC: true
  projectiles: [...],   // in-flight spells, see below
  log: [string, ...],   // newest first, capped at 60
  openSheet: null | { kind: 'self' } | { kind: 'npc', id } | { kind: 'shop', slot },
  playerDown: bool, playerRespawnAt: timestamp | null,
  spawnCenter: {lat, lng},  // original spawn point, used for NPC respawns
  maxWalkMeters: 250,
  timeScale: 1 | 30,    // see combat.js TIME_SCALES
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
  // Player only (economy.js:normalizeEconomy fills these for old saves):
  gems,                                // Mana Crystal balance (integer)
  pot, lastAccrualAt,                  // Treasury (float) + epoch ms of last accrual
  equipment: { wand: id|null, robe: id|null },
  gearApplied: { power, maxHP, defense }, // how much of the fields above is gear
  seenPotHint,                         // one-time "crystals are gathering" toast shown
  // NPC only:
  temperament, nextAiCheck, defeated, respawnAt,
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
`slot`, `tier`, `price`, `mods`; adding tiers or slots is adding rows.

**Sheet re-rendering:** `render()` runs every 250ms, and replacing `innerHTML`
that often swallows taps. `ui.js` rebuilds the self and shop sheets only when
their structure changes (a key string), and patches live numbers (pot, HP,
mana, ward timer) in place. The shop's "tap again to buy" state lives in
`main.js`, not the DOM.

## State persistence

`state.js` saves/loads a **trimmed** subset of `world` — `player`, `npcs`,
`spawnCenter`, `timeScale` — not the whole object. `projectiles`, `log`,
and `openSheet` are intentionally transient: a projectile in flight when
the tab closes simply doesn't exist on reload (the attacker doesn't get
their mana refunded, but nothing crashes — `resolveImpact` only ever
looks up wizards, never assumes a specific projectile history). This is
a known simplification, not a bug; revisit it only if it becomes a real
player complaint (real-minutes travel times make "close the tab mid-cast"
plausible).

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
