# QA checklist

Manual (or Playwright-scripted) checks. Not every item applies to every
change — pick the sections relevant to what changed. Numbers referenced
here should match `docs/FEATURES.md`; if they don't, one of the two is
stale.

## Setup / creation

- [ ] Name field: empty submits as "Wizard"; 16-char limit enforced.
- [ ] Each of the 5 avatars and 5 elements is selectable and submits.
- [ ] Geolocation allowed → wizard spawns at real location.
- [ ] Geolocation denied/unavailable → falls back to the demo location
      with a toast explaining why, and the game still starts.
- [ ] Fullscreen is requested on submit (won't be grantable in every test
      environment — verify no error is thrown either way).

## Map & movement

- [ ] Real streets/labels render (verify on the actual deployed site —
      map tiles don't load in a Claude Artifact preview sandbox).
- [ ] Sense-range circle is drawn around the player and updates if
      senseRange changes (e.g. after a level-up, if that ever changes it).
- [ ] NPCs outside sense range are not rendered as markers at all.
- [ ] Tapping within 250m walks the player there (animated); tapping
      further shows the "too far" toast with the actual distance.
- [ ] Tapping a wizard marker does **not** also move the player (marker
      clicks must stop propagation to the map's click handler).
- [ ] Tapping empty map while a wizard sheet is open closes the sheet
      instead of moving.
- [ ] 📍 button re-centers on real location and shows a confirmation
      toast, or a failure toast if location can't be read.

## Wizard sheet (tap-to-act)

- [ ] Tapping your own marker opens the self sheet: correct HP/mana,
      shield status text, Raise/Refresh Shield button.
- [ ] Tapping an NPC opens their sheet: correct name/level/HP/distance,
      Attack button.
- [ ] Attack button is disabled with the correct reason when: NPC
      defeated, out of range, on cooldown, insufficient mana — check each
      independently.
- [ ] Successful attack closes the sheet and logs a "hurls" message.
- [ ] ✕ closes the sheet without side effects.

## Spells & combat

- [ ] Spark Bolt: mana deducted, cooldown set, projectile appears on the
      map and visibly travels from caster to target.
- [ ] Travel time roughly matches `distance ÷ 1.0 m/s ÷ timeScale` (spot
      check, not exact-to-the-ms).
- [ ] Impact applies damage, logs a "strikes ... for N damage" message,
      and reduces target HP (marker HP bar for NPCs, HUD bar for player).
- [ ] Ward Shield: casting sets `shieldBuff`, sheet shows "active — Ns
      left", and a hit landing during that window shows the "Softened by
      ward" note with reduced damage. Damage is still reduced on a
      *second* hit within the window (shield is not consumed by one hit).
- [ ] Shield expires after 2 real minutes (or scaled equivalent under
      Fast) — a hit after expiry takes full damage.
- [ ] Counterspell: when an NPC attacks the player, the defend-overlay
      appears with the correct incoming spell name/icon and a live
      countdown. Casting Counterspell in time removes the projectile,
      logs a "shatters" message, and the player takes zero damage from
      it. Missing the window (letting it resolve) applies full/shielded
      damage as normal.
- [ ] Counterspell/Shield buttons in the overlay/sheet correctly disable
      when on cooldown or unaffordable.
- [ ] NPCs occasionally initiate attacks on their own (aggression roll) —
      verify by waiting under Fast speed; frequency should roughly match
      the temperament rates in `docs/FEATURES.md`.
- [ ] NPCs occasionally react to being attacked with their own Shield or
      Counterspell (visible via a mitigated/negated hit in the log).

## Progression & defeat

- [ ] Defeating an NPC logs XP gain matching `15 + npcLevel × 5`.
- [ ] Leveling up logs a level-up message, fully restores HP/mana, and
      the HUD level/xp bar update.
- [ ] Defeated NPCs disappear and reappear 30–50s later at a new position
      with full HP/mana and no stale cooldowns/shield.
- [ ] Player defeat shows the "Defeated!" overlay, blocks movement and
      casting for ~4s, then respawns at 60% HP/mana with a log message.

## Runes & Powers

- [ ] Defeating an NPC logs a `🔮 You gain {n} Runes.` line right after the
      existing `⭐ You gain {n} XP.` line, with matching `n` (`15 +
      npcLevel × 5`).
- [ ] ☰ menu's `🔮 Runes: {n}` button always shows the live balance and
      updates immediately after a kill.
- [ ] Clicking it opens the `#powers-panel` bottom sheet (dark skin, gold
      top border — not the log's parchment theme) showing the balance and
      two power-cards (Spell Power, Spell Recovery).
- [ ] Each card shows the correct level (`Lv.N/3`), effect text (`+N%
      damage` / `N.Ns cooldown`), and either an enabled "⬆ Upgrade {cost}🔮"
      button or a disabled one with "Need {shortfall} more Runes" — check
      both affordable and unaffordable states.
- [ ] Buying an upgrade debits the exact cost, increments the level, and
      updates the displayed effect and next cost (costs follow `round(base
      × 1.5^purchasesSoFar)` — see `docs/FEATURES.md` for the exact
      numbers).
- [ ] After 3 purchases, a card shows "✨ Maxed" with no upgrade button —
      verify there's no way to buy a 4th.
- [ ] A purchased Spell Power level visibly changes Spark Bolt's logged
      damage number; a purchased Spell Recovery level visibly changes the
      time between casts, not just the sheet's displayed cooldown text.
- [ ] Reload mid-game preserves `runes`/`spellPowerLevel`/
      `spellRecoveryLevel` (they're part of the player's persisted wizard).
- [ ] NPCs never show a Runes balance or gain Runes on anything.

## Speed toggle & menu

- [ ] ☰ opens the menu; each item (Fullscreen, Speed, Spell Log, New
      Wizard) is present and clickable.
- [ ] Speed toggle flips the label (⚡ Fast ↔ 🐢 Real) and visibly changes
      new casts' travel time; in-flight projectiles keep their original
      timing (only new casts are affected).
- [ ] Spell Log opens/closes via the menu item and its own ✕.
- [ ] New Wizard asks for confirmation, then clears `localStorage` and
      reloads to the creation screen.

## Mana Crystals economy

- [ ] HUD chip shows "💎 N"; gold dot appears when the pot has at least 1;
      ⚡ appears on the chip only while Fast is on. Tapping the chip opens
      your wizard sheet.
- [ ] First time the pot reaches 1: one toast "Mana Crystals are gathering!"
      (never again, including after reload).
- [ ] Treasury card: pot number ticks up live; rate line reads
      "+X 💎/min" at Real, pink "⚡ ×30 Fast · +X 💎/min" at Fast
      (X = (8 + 1.5 × level) × scale). Collect is disabled and says
      "Filling…" at 0; otherwise Collect moves the whole number to your
      balance, a "+N 💎" pop floats from the chip, and the chip bumps.
- [ ] Taps on Collect and on shop price buttons register reliably while the
      game ticks (tap 10 times; none lost).
- [ ] Shop opens from the sheet button and from ☰ → 💎 Shop. Intro line shows
      until the first purchase. Wand/Robe tabs switch lists.
- [ ] Row states: unaffordable (muted button, progress bar, "Need N more 💎"),
      affordable (gold button), locked tier 2 ("Buy Willow Wand first", 🔒),
      equipped (gold border, "Equipped"), lower tier owned ("Owned", dimmed).
      Buyable rows show "+X over your <item>".
- [ ] Buy: first tap turns the button to "Tap again to buy" and it stays that
      way for 3s despite re-renders, then reverts; second tap inside 3s buys,
      deducts the full price, auto-equips, flashes the row, toasts
      "<icon> <name> equipped · +N stat". Switching tabs cancels a pending
      confirm.
- [ ] Derived stats: after buying, HP/Power on the sheet and in combat reflect
      the gear (wand +power; robe +max HP, +1 def). Level up afterwards and
      confirm gear bonus is still included.
- [ ] Saves: reload keeps gems, pot, equipment. An OLD save with none of the
      new fields (delete gems/pot/lastAccrualAt/equipment in localStorage)
      loads with 0 💎, no gear, and unchanged stats.
- [ ] Closed-page time accrues at 1x only: set `lastAccrualAt` 10 minutes back
      in the save, reload at Fast: the pot gains about 10 × (8 + 1.5 × level),
      not ×30.
- [ ] Clock going backwards (e.g. set system time 1h back while playing):
      pot does not drop, no console errors, saving still happens.
- [ ] Fast on/off: switching changes income going forward only; the existing
      pot does not jump when toggling.
- [ ] Kill bonus: defeating an NPC adds `3 + npcLevel` 💎 to the balance (not
      the pot), shows the pop, and logs "You find N Mana Crystals".

## Multiplayer (only if a Firebase project is configured — see docs/ARCHITECTURE.md "Multiplayer")

Skip this whole section if `js/firebase-config.js` doesn't exist or still
has placeholder values — the item below ("multiplayer absent") is the one
that matters in that case.

- [ ] **Multiplayer absent (no/placeholder `js/firebase-config.js`):**
      the game plays exactly as single-player, no console errors, no
      visible sign multiplayer code even ran (this is the most important
      check — it's the state most clones/forks of this repo will be in).
- [ ] Open the site in **two separate browser contexts** (e.g. a normal
      window + an incognito/private window, or two different browsers) so
      each gets its own Firebase anonymous identity, and create a wizard
      in each with real (or spoofed, via devtools) locations close enough
      to be within each other's sense range.
- [ ] Within ~15-20s of both being up, each player's marker appears on
      the other's map: purple accent border + small badge dot, distinct
      from the gold self-marker and pink NPC markers.
- [ ] Tapping the other player's marker opens a sheet with: name, level,
      distance, HP bar, a "synced Xm ago" line, the "A real player — they
      may be offline. Spark Bolt still travels in real time." note, and a
      Cast Spark Bolt button — NOT an "NPC" label anywhere.
- [ ] Cast Spark Bolt at the other player from Player A. Confirm: mana
      deducted, cooldown set, a projectile animates from A toward B's
      last-known position, and a log line on A's side says the spell is
      headed toward B (not a damage number — A never learns the exact
      damage dealt).
- [ ] Close Player B's tab/browser entirely before the cast would have
      landed (real time, not Fast — this is the point of the feature).
      Wait past the real travel time, then reopen Player B and reload.
      Confirm: a single toast on load summarizes the hit ("While you were
      away, `<A's name>` hit you for N damage..."), B's HP is reduced by
      the expected amount (`spell.power × A's power − B's defense`,
      halved-ish if B had Ward Shield active — check `docs/FEATURES.md`
      numbers), and the Spell Log has the matching detail line.
- [ ] If B had Ward Shield raised *before* reopening (i.e. it was already
      active and hadn't expired), confirm the away-hit damage reflects
      the shield's mitigation — Ward Shield still applies to a remote hit
      even though Counterspell does not (no reactive window exists for a
      real player's incoming attack in v1 — verify no "Incoming..."
      defend-overlay ever appears for it, unlike an NPC attack).
- [ ] With both players' tabs open and active the whole time (no reload),
      confirm the hit still lands automatically within ~15s of its real
      impact time via the periodic poll, logged normally, with no toast
      (toasts are reserved for the "while you were away" load-time case).
- [ ] Move one player out of the other's sense range (or close enough
      that distance exceeds `senseRange`); confirm their marker disappears
      and an open sheet for them auto-closes, same as an NPC leaving
      range.
- [ ] Defeat a real player via Spark Bolt (repeat casts/away-hits until
      their HP hits 0 on their own device); confirm the normal "Defeated!"
      overlay/respawn flow runs on their side, unaffected by the fact the
      hit came from a real player rather than an NPC.
- [ ] Confirm NPCs are still fully present and functional on both devices
      throughout all of the above — multiplayer should visibly coexist
      with, not replace, the NPC roster.

## Persistence

- [ ] Reload mid-game restores the same wizard, NPCs, and spawn point.
- [ ] Reload while a projectile is in flight doesn't crash (it's expected
      to simply not exist after reload — that's not a bug, see
      `docs/ARCHITECTURE.md` State persistence).
- [ ] Reload after being defeated correctly resumes into the down/
      recovering state rather than a broken half-state.

## Cross-cutting

- [ ] No console/page errors during a full create → move → attack →
      get-attacked → counter/shield → defeat/respawn cycle.
- [ ] Works at phone width (~400px) — no horizontal scroll, sheet and
      overlays stay usable.
- [ ] Short viewports (360x560 and 360x480): tap your wizard; the self
      sheet stays under ~45% of the screen height, your marker is not
      hidden behind it, and Collect, the 🛍️ Shop icon and Ward Shield are
      each one tap (44px targets, none clipped). The NPC and Shop sheets
      still render. At 480px tall the idle rate line is hidden by design.
- [ ] `docs/FEATURES.md` numbers still match `js/spells.js`/`js/wizard.js`
      after any balance change.
