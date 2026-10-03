# Features

What the game does today, from a player's perspective, with the exact
numbers that are live right now. When you change a number in code, update
it here too — this is the reference planning and QA both work from.

## Wizard creation

Screen: `#screen-create` (`index.html`, `js/ui.js:initCreateScreen`).

- **Name** — free text, max 16 characters, defaults to "Wizard" if blank.
- **Avatar** — one of 5 distinct hooded-figure portraits (SVG, no facial
  features by design), tinted by your chosen element. Cosmetic only.
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
- **Identity + HP ring** — every avatar (map marker, HUD, wizard sheet) is
  wrapped in a ring (`js/portraits.js:avatarWithRing`) that does two jobs at
  once: its color is identity (self = mana blue, NPC = pink/garnet, selected
  NPC = gold) and its arc length is `hp/maxHP` — it visibly depletes as a
  wizard takes damage, readable at a glance without opening their sheet.

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

While active, a soft pulsing bubble renders behind the wizard's ring on the
map, HUD, and sheet (`js/portraits.js:avatarWithRing`'s `shieldActive`
option, pure CSS animation) — visible to anyone who can see that wizard,
not just to the shielded player.

### Counterspell (defend — reactive) 🌀
`manaCost 14, cooldown 20s`

Only offered when a specific incoming spell is announced (the
defend strip's "<spell> incoming!" card with a live countdown ring). Casting it doesn't reduce
damage — it negates that exact projectile outright, resolved immediately
rather than waiting for the spell's scheduled impact
(`js/combat.js:castCounterspell`).

## Speed setting (Fast / Real)

☰ menu → ⚡/🐢 toggle. Multiplies Spark Bolt's travel speed by 30x when
"Fast", 1x when "Real" (**Real is the default for new wizards**; existing
saves keep their stored setting). Only travel time is scaled — cast time,
cooldowns, mana regen, and NPC aggression timing are unaffected. Persisted
to `localStorage` (`world.timeScale`).

## Combat UX: the wizard sheet

Tapping any wizard on the map opens a docked bottom sheet (`js/ui.js:renderWizardSheet`)
instead of the old always-on spellbook. The sheet sits under the map and
shrinks it (max height `min(46dvh, 380px)`, shop up to ~58dvh with only its
item list scrolling) — it never covers the map, your wizard marker or the
map attribution. The map pans just enough to keep your wizard (and the
tapped one) in view. Your own sheet's 🛍️ Shop button carries a text label.

- **Your own wizard** → HP/mana, whether Ward Shield is active and its
  remaining time, and a Raise/Refresh Ward Shield button (disabled with a
  reason — not enough mana, still recharging — when it can't be cast).
- **An NPC** → their HP, distance, and a Cast Spark Bolt button, disabled
  with a reason (out of range, recharging, not enough mana, already
  defeated) when it can't fire.

Tapping empty map closes an open sheet before it tries to move you there.

### Screen layout and layering

The game screen is a vertical stack, top to bottom: **HUD** (avatar with Lv
badge, name, HP and MP side by side, thin XP line; 💎 chip that glows gold
when crystals are ready to collect, 📍, ☰ — all 44px targets), the
**defend strip** (only while attacked), the **map stage**, the **docked
sheet** (self / NPC / shop), and the phone's safe-area gap. Nothing urgent
floats over the HUD, and all text is at least 12px.

- **Defend strip:** its own lane directly under the HUD. One compact card
  for the spell that lands soonest: countdown ring, "<spell> incoming!",
  "+N more incoming", and a 44px Counter button (with mana cost). When it
  can't be cast the reason ("Not enough mana" / "Recharging") shows next to
  the "+N more" text. The map just gets shorter while it is shown.
- **One overlay at a time:** the ☰ menu, Spell Log, Runes & Powers panel
  and the docked sheet are mutually exclusive — opening one closes the
  others. Tapping the map or the dimmed scrim while the menu or a panel is
  open only dismisses it (it never walks your wizard); Esc closes the
  menu. A *new* incoming attack closes the ☰ menu once (so the strip is
  reachable) but leaves an open sheet or shop alone.
- **☰ menu:** a popover inside the map area, width `min(260px, 100% - 16px)`,
  48px rows with spelled-out labels (Fullscreen, Crystal Shop, "Speed:
  Real/Fast", Runes & Powers · N, Spell Log, and QA Tools under `?qa=1`),
  and a separated red "New Wizard" last.
- Toasts appear at the top of the map area so they are never hidden behind
  the bottom panels.

## Multiplayer (real players)

`js/multiplayer.js`, backed by Firebase Realtime Database + Anonymous
Auth. **Optional and off by default** — it only activates if the repo
owner has set up their own Firebase project and filled in
`js/firebase-config.js` (see `docs/ARCHITECTURE.md` "Multiplayer" and
"Setup"); without that, the game is exactly the single-player experience
described everywhere else in this document.

When active, other real players' wizards appear on the map the same way
NPCs do — inside your sense-range circle, with an HP bar and name label —
positioned by wherever their device last synced its location, which can
be a little stale (each device pushes its own position roughly every 6s
while playing, and refreshes the list of nearby players roughly every
15s). They're visually distinct from both you and NPCs: a purple accent
(reusing the Ward Shield color) plus a small persistent badge dot on the
marker, so you can tell a real player apart from an NPC before tapping.

Tapping a real player's marker opens the same wizard sheet as an NPC —
name, level, distance, HP bar, Cast Spark Bolt button with the same
disabled-reasons — plus two additions:
- A second line reading "synced Xm ago", so it's clear how fresh their
  position/HP is.
- A permanent note: *"A real player — they may be offline. Spark Bolt
  still travels in real time."*

Casting Spark Bolt at a real player costs the same mana, has the same
cooldown, and travels at the same real-world speed as casting at an NPC —
**always at real speed**, regardless of your own ⚡ Fast/🐢 Real toggle,
so you can't use your own testing setting to shortcut another player's
travel-time window. Unlike an NPC hit, a hit on a real player doesn't
resolve on your screen — it's recorded for their device to apply next
time it's running (even if that's minutes or hours later), using *their*
current HP/defense/Ward Shield state at that moment, not a guess made on
your end. Ward Shield still reduces a hit like this normally; there is
currently no live "incoming spell" warning (and therefore no
Counterspell option) for an attack from another real player, since that
would need always-on live syncing this v1 deliberately doesn't do.

**Attacked while away.** If one or more real players' Spark Bolts landed
on you while the game wasn't open, the next time you open it you'll see
one toast summarizing it (e.g. "While you were away, Ari the Bold hit you
for 9 damage total. See the Spell Log for details.") rather than one
toast per hit, with the full detail in the Spell Log as usual.

## NPCs

`js/npc.js`. 9 spawned per game session, scattered in an annulus from
60m to `2 × player's senseRange` around the spawn point — meaning roughly
half spawn outside your initial sense range, so moving around to find
more is meaningful. Each NPC gets:

- A random element (affecting their stats the same as the player).
- A random avatar portrait (independent of element — one of the same 5
  looks the create screen offers, not tied to the NPC's element).
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

- Defeating an NPC grants `15 + npcLevel × 5` XP, and the same amount in
  🔮 Runes (see Runes & Powers below) — a separate, permanent-purchase
  currency track alongside level-up XP, not a replacement for it.
- Leveling (`js/wizard.js:growLevel`) adds `+12 maxHP, +6 maxMana, +0.05
  power`, fully heals, and scales the next level's XP requirement by
  1.35x.
- Player defeat is not punishing: 4 seconds of "recovering" (movement and
  actions blocked), then respawn at 60% of max HP/mana. No stat loss, no
  item loss — there's nothing to lose.

## Mana Crystals, Treasury and Shop (Phase 1, 5-tier ladder + upgrades)

`js/economy.js` holds every number below. **All numbers are first guesses,
not tuned from play data.**

- **Currency:** Mana Crystals 💎. HUD chip "💎 N" next to your name (gold dot
  when the Treasury has crystals to collect, ⚡ while Fast is on); tapping it
  opens your own wizard sheet.
- **Treasury (passive income):** crystals accrue into a pot at
  `8 + 1.5 × wizard level` per real minute at Real (1x) speed. The pot has
  **no cap**. Collect it with the gold Collect button on your wizard sheet
  (disabled and labelled "Filling…" while the pot is under 1).
- **Fast scales income:** while the page is open and ⚡ Fast is on, income is
  multiplied by 30 (the multiplier is applied as time passes, never at
  collect time, so toggling Fast cannot retroactively change the pot). **New
  wizards start at Real (1x)**: about 9.5 💎/min at level 1, so the first
  wand (100 💎) takes roughly 10 minutes. Fast stays a toggle (about 285
  💎/min at level 1); the Treasury card says so in pink. Time the
  page was closed (or a tab was throttled/asleep: any tick gap over 2s)
  accrues at the Real rate only. A clock set backwards earns nothing for
  that gap. The pot is saved with a timestamp so income continues across
  reloads.
- **Kill bonus:** defeating an NPC adds `3 + npcLevel` 💎 straight to your
  balance (not the pot, not scaled by Fast).
- **Shop** (wizard sheet → 🛍️ Shop button, or ☰ → 💎 Crystal Shop): one equipped
  item per slot, strict tier order within a slot (5 tiers per slot), no
  downgrades, full price, no refunds, no level gates. Buying is two taps
  ("Tap again to buy" for 3s) and the item is equipped immediately (at +0).
  Gear modifiers are added on top of element and level stats and survive
  level-ups. When a lower tier is equipped, higher-tier rows show the stat
  difference "vs your <item> +n" (it can be negative if you heavily upgraded
  the lower tier).

| Item | Slot | Tier | Price | Base effect (+0) | Per upgrade level | At +10 |
|------|------|------|-------|------------------|-------------------|--------|
| Willow Wand | 🪄 wand | 1 | 100 💎 | +0.08 power | +0.02 power | +0.28 power |
| Moonstone Wand | 🪄 wand | 2 | 350 💎 | +0.18 power | +0.05 power | +0.68 power |
| Starwood Wand | 🪄 wand | 3 | 900 💎 | +0.40 power | +0.15 power | +1.90 power |
| Aurora Wand | 🪄 wand | 4 | 2200 💎 | +0.80 power | +0.50 power | +5.80 power |
| Archmage's Scepter | 🪄 wand | 5 | 5000 💎 | +1.50 power | +1.40 power | +15.50 power |
| Apprentice Robe | 🧥 robe | 1 | 100 💎 | +15 max HP, +1 def | +1 max HP | +25 HP, +1 def |
| Moonweave Robe | 🧥 robe | 2 | 350 💎 | +30 max HP, +1 def | +2 max HP | +50 HP, +1 def |
| Starsilk Robe | 🧥 robe | 3 | 900 💎 | +60 max HP, +2 def | +6 max HP, +0.1 def | +120 HP, +3 def |
| Aurora Mantle | 🧥 robe | 4 | 2200 💎 | +110 max HP, +3 def | +15 max HP, +0.25 def | +260 HP, +5.5 def |
| Archmage Vestments | 🧥 robe | 5 | 5000 💎 | +180 max HP, +4 def | +40 max HP, +0.5 def | +580 HP, +9 def |

A tier's bonus replaces the previous tier's (not added to it). Base player
power is about 4.5 (so a +1 power is about +22% damage).

### Item upgrades ("enhancing", +1 to +10)

The equipped item of each slot can be upgraded from +0 up to **+10** with 💎
from its Shop row (an Upgrade strip appears on the equipped row: level, what
the next level adds, price, and a button). **Fully deterministic: no failure
chance, no randomness, no downgrade.** Same two-tap confirm as buying ("Tap
again to upgrade" for 3s). Each level adds the item's per-level bonus (table
above) on top of its base and applies immediately (HP rises by the extra max
HP too). The step from +n to +n+1 costs
`round(price × 0.06 × 1.4^n)` 💎:

| Item (tier) | Steps +1..+10 | Total to +10 |
|-------------|---------------|--------------|
| T1 (100) | 6, 8, 12, 16, 23, 32, 45, 63, 89, 124 | 418 |
| T2 (350) | 21, 29, 41, 58, 81, 113, 158, 221, 310, 434 | 1,466 |
| T3 (900) | 54, 76, 106, 148, 207, 290, 407, 569, 797, 1,116 | 3,770 |
| T4 (2200) | 132, 185, 259, 362, 507, 710, 994, 1,391, 1,948, 2,727 | 9,215 |
| T5 (5000) | 300, 420, 588, 823, 1,152, 1,613, 2,259, 3,162, 4,427, 6,198 | 20,942 |

Upgrade levels belong to the equipped item: buying the next tier equips it at
+0 and the old item's upgrades are lost (no refund), so the cheap low-tier
upgrades are the only "wasted" spend. The self sheet shows levels ("Aurora Wand
+4"); a maxed row shows "MAX". Upgrade levels are saved with the player
(`gearLevels`), clamped to 0..10 on load; old saves load at +0.

Max gear (T5 wand +10 and T5 robe +10) adds +15.5 power, +580 max HP and +9
defense: about 21 total power (about 200 damage per Spark Bolt at a perfect
sign), 680+ max HP at level 1. Every hit, even through Ward Shield, still does
at least 1 damage (the shield rounding no longer drops a hit to 0).

Balance reasoning: damage is `round(10 × power − defense)` (min 1), so
defense is kept small next to max HP, but T5 +10 (9 def, plus 3 for Ice)
cuts a level-1 NPC bolt from about 10 to about 1-2. In a duel Monte Carlo
(real wizards, random NPC element/temperament, +/-1 level), even ungeared
the player already wins about 100% of same-level fights (player damage has a
4.5x multiplier), so win rate is not the discriminator; bolts-to-kill and
damage taken are. T5/T5 +10: every NPC at Lv.1-20 dies in at most 2 bolts at
a perfect sign (all at Lv.1-5, 38% in one bolt at Lv.10), and the player
takes about 0-3 HP per fight. All numbers are first guesses.

**Multiplayer interaction:** gear and upgrades feed `wizard.power` /
`maxHP` / `defense`, and these are what the Firebase sync sends and what a
remote Spark Bolt uses. See the PvP note in `proj-status.md` (a maxed avatar
hits a real player for far more than they can currently survive).

## Runes & Powers

`js/wizard.js` owns the numbers; `js/combat.js` applies them at cast time;
`js/ui.js`/`js/main.js` render the ☰ menu → 🔮 Runes & Powers · {n} entry and the
"🔮 Runes & Powers" panel it opens.

- **Earning Runes** — every NPC kill grants `15 + npcLevel × 5` Runes
  (`npcLevel` = the *defeated NPC's* level), the exact same formula and
  input as XP. Logged right after the XP line: `🔮 You gain {n} Runes.`
  Player-only: NPCs never earn or spend Runes.
- **Spell Power 💥** — permanently multiplies Spark Bolt's (and any future
  attack spell's) damage via the caster's own `power` stat, the same way
  `spell.power` is already multiplied by it. **+5% per level, cap Lv.3
  (+15% total)** — chosen to land in the same ballpark as one normal
  level-up's `+0.05 power` (≈5% relative gain on the base 1.0 power stat),
  without being an order of magnitude bigger.
- **Spell Recovery ⏳** — permanently reduces Spark Bolt's cooldown.
  **−0.1s per level, cap Lv.3 (1.5s → 1.2s, a 20% reduction)**, with a
  defensive floor of 0.5s baked into the formula (not reachable at the
  current cap, but guards future tuning from ever hitting 0 or negative).
- **Cost** — `cost = round(base × 1.5^purchasesSoFar)`, the same
  exponential shape as the level-up XP curve (`xpToNext × 1.35`), just its
  own base/rate per attribute:
  - Spell Power: base 40 → costs 40, 60, 90 (190 total to max).
  - Spell Recovery: base 35 → costs 35, 53, 79 (167 total to max).
- **Permanent, no sell-back** — purchases only ever go up; there is no
  respec/refund path, by design (see `proj-status.md` Decisions Log).
- Each attribute is capped independently (a "per-attribute cap," not a
  shared pool) — maxing Spell Power doesn't affect what Spell Recovery
  costs or how far it can go, and vice versa.

## Persistence

`js/state.js`. On every meaningful action (cast, walk finished) and every
2 seconds during play, the player's wizard, the NPC roster, the original
spawn point, and the time-scale setting (the player's record includes
crystals, pot, `lastAccrualAt` and equipment) are written to
`localStorage['wizardsfight_save_v1']`. Projectiles in flight, the log,
and which sheet is open are **not** persisted — they reset on reload,
which is a deliberate simplification (see `docs/ARCHITECTURE.md` for
what that means for reload-mid-fight edge cases).

If multiplayer is set up (see above), your device's Firebase anonymous
identity and the list of nearby real players are **not** part of this
`localStorage` save either — identity comes from Firebase's own
persistence, and the nearby-players list is always re-fetched fresh.
Nothing multiplayer-related is lost by clearing this game's own save,
and "New Wizard" doesn't change your Firebase identity.

## Fullscreen

Requested synchronously inside the "Begin Your Journey" click (so the
browser still counts it as a user gesture even after the async
geolocation lookup that follows), plus a manual toggle in the ☰ menu.
