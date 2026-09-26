# Features

What the game does today, from a player's perspective, with the exact
numbers that are live right now. When you change a number in code, update
it here too — this is the reference planning and QA both work from.

## Wizard creation

Screen: `#screen-create` (`index.html`, `js/ui.js:initCreateScreen`).

- **Name** — free text, max 16 characters, defaults to "Wizard" if blank.
- **Avatar** — one of 🧙‍♂️ 🧙‍♀️ 🧙 🧝‍♂️ 🧝‍♀️. Cosmetic only.
- **Element** — one of Fire, Ice, Lightning, Nature, Arcane. Sets base
  stats (below); does **not** change which spells you start with — every
  wizard, player or NPC, knows the same 3 spells (see Spells).

Base stats (`js/wizard.js`): `maxHP 100, maxMana 60, power 1.0, defense 0,
senseRange 170m, manaRegenMs 2000`. Element modifiers, applied on top:

| Element   | Modifier |
|-----------|----------|
| Fire      | power ×1.15, maxMana −10 |
| Ice       | maxHP +20, defense +3 |
| Lightning | senseRange +40m, maxHP −10 |
| Nature    | maxMana +15, manaRegenMs −500 (regens faster) |
| Arcane    | castTimeMult ×0.85 (casts ~15% faster) |

## Sense range

The radius (in meters) within which you can perceive other wizards at
all. It's drawn as a dotted circle on the map (`js/map.js:updateSenseCircle`).
NPCs outside it are not rendered, not selectable, and not attackable —
this is the single gate for both "can I see them" and "can I target them"
(`js/combat.js:castAttack` clamps attack range to
`min(spell.range, casterSenseRange)`).

## The map

`js/map.js`, Leaflet + CartoDB Dark Matter tiles (real OpenStreetMap
street/city data, styled dark to match the theme — see
[`../proj-status.md`](../proj-status.md) Decisions Log for why not Google Maps or stock OSM).

- On wizard creation, the browser is asked for geolocation; if denied or
  unavailable, the game starts at a fixed demo location (Times Square)
  instead and says so.
- Tap anywhere within 250m to walk there (animated over up to 1.6s). Tap
  further away and it's rejected with the distance shown.
- 📍 button re-syncs to your current real location.
- Tapping a wizard marker (yours or an NPC's) does **not** also trigger a
  walk — click events on markers stop propagation before reaching the
  map's click handler.

## Spells

`js/spells.js` is the single source of truth for numbers. All three are
known by every wizard from creation.

### Spark Bolt (attack) ✨
`manaCost 5, castTime 0.4s, speed 1.0 m/s (real), power 10, range 260m,
cooldown 1.5s`

Casting has two phases: a short cast time (the windup, unaffected by
distance), then a travel time of `distance ÷ speed`, divided by the
active time-scale multiplier (see Speed setting). At "Real" speed this
means a cast can take real minutes to land — the whole point being that
the **target has that entire window to react** with a defend spell.

### Ward Shield (defend — proactive stance) 🛡️
`manaCost 18, buffDuration 120000ms (2 min), mitigation 0.5, cooldown 25s`

Cast any time, on yourself, from your own wizard sheet. Unlike a
single-use buff, it is **not consumed** by a hit — it reduces damage from
every hit that lands while it's active, and only goes away when its
2-minute timer runs out (`js/combat.js:isShieldActive`). Re-casting while
already active refreshes the timer.

### Counterspell (defend — reactive) 🌀
`manaCost 14, cooldown 20s`

Only offered when a specific incoming spell is announced (the
"⚠️ Incoming..." alert with a live countdown). Casting it doesn't reduce
damage — it negates that exact projectile outright, resolved immediately
rather than waiting for the spell's scheduled impact
(`js/combat.js:castCounterspell`).

## Speed setting (Fast / Real)

☰ menu → ⚡/🐢 toggle. Multiplies Spark Bolt's travel speed by 30x when
"Fast" (default), 1x when "Real". Only travel time is scaled — cast time,
cooldowns, mana regen, and NPC aggression timing are unaffected. Persisted
to `localStorage` (`world.timeScale`).

## Combat UX: the wizard sheet

Tapping any wizard on the map opens a bottom sheet (`js/ui.js:renderWizardSheet`)
instead of the old always-on spellbook:

- **Your own wizard** → HP/mana, whether Ward Shield is active and its
  remaining time, and a Raise/Refresh Ward Shield button (disabled with a
  reason — not enough mana, still recharging — when it can't be cast).
- **An NPC** → their HP, distance, and a Cast Spark Bolt button, disabled
  with a reason (out of range, recharging, not enough mana, already
  defeated) when it can't fire.

Tapping empty map closes an open sheet before it tries to move you there.

## NPCs

`js/npc.js`. 9 spawned per game session, scattered in an annulus from
60m to `2 × player's senseRange` around the spawn point — meaning roughly
half spawn outside your initial sense range, so moving around to find
more is meaningful. Each NPC gets:

- A random element (affecting their stats the same as the player).
- A level within ±1 of the player's level.
- A random name from a first-name + title generator (e.g. "Dash
  Sunforge").
- A **temperament** — passive / neutral / aggressive — weighted
  passive-heavy — which drives:
  - How often they initiate an attack when the player is in range
    (`TEMPERAMENT_AGGRO`: passive 6%, neutral 16%, aggressive 32%, rolled
    every 2.5–5s).
  - How readily they react to being attacked with Counterspell or Ward
    Shield (`TEMPERAMENT_DEFEND`: passive 70%, neutral 45%, aggressive
    20% — passive NPCs are the most defensive, aggressive ones favor
    offense over self-protection).

Defeated NPCs respawn 30–50s later at a fresh random point, full HP/mana,
cooldowns and shield cleared.

## Progression

- Defeating an NPC grants `15 + npcLevel × 5` XP.
- Leveling (`js/wizard.js:growLevel`) adds `+12 maxHP, +6 maxMana, +0.05
  power`, fully heals, and scales the next level's XP requirement by
  1.35x.
- Player defeat is not punishing: 4 seconds of "recovering" (movement and
  actions blocked), then respawn at 60% of max HP/mana. No stat loss, no
  item loss — there's nothing to lose.

## Persistence

`js/state.js`. On every meaningful action (cast, walk finished) and every
2 seconds during play, the player's wizard, the NPC roster, the original
spawn point, and the time-scale setting are written to
`localStorage['wizardsfight_save_v1']`. Projectiles in flight, the log,
and which sheet is open are **not** persisted — they reset on reload,
which is a deliberate simplification (see `docs/ARCHITECTURE.md` for
what that means for reload-mid-fight edge cases).

## Fullscreen

Requested synchronously inside the "Begin Your Journey" click (so the
browser still counts it as a user gesture even after the async
geolocation lookup that follows), plus a manual toggle in the ☰ menu.
