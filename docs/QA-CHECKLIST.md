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

## Speed toggle & menu

- [ ] ☰ opens the menu; each item (Fullscreen, Speed, Spell Log, New
      Wizard) is present and clickable.
- [ ] Speed toggle flips the label (⚡ Fast ↔ 🐢 Real) and visibly changes
      new casts' travel time; in-flight projectiles keep their original
      timing (only new casts are affected).
- [ ] Spell Log opens/closes via the menu item and its own ✕.
- [ ] New Wizard asks for confirmation, then clears `localStorage` and
      reloads to the creation screen.

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
- [ ] `docs/FEATURES.md` numbers still match `js/spells.js`/`js/wizard.js`
      after any balance change.
