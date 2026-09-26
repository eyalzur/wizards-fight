# 🧙 Wizards Fight

A browser wizard-duel game on a real street map. Create a wizard, feel other
wizards nearby, and cast spells that take real time to travel — giving your
target a window to defend before the spell lands.

Everything runs client-side (plain HTML/CSS/JS, no build step, no backend, no
accounts). Your wizard is saved to your browser's `localStorage` only.

**Live:** https://eyalzur.github.io/wizards-fight/

## Play it

Open `index.html` through a local web server (ES modules need `http://`, not
`file://`):

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit the printed URL. Allow location access to place your wizard near
you on the map (or skip it — you'll drop into a demo location instead).

## How it works right now (v1)

- **Create a wizard**: pick a name, a look, and an element (Fire, Ice,
  Lightning, Nature, Arcane). Each element shapes your stats and starting
  spells.
- **Sense range**: a stat on your wizard. Only wizards within that radius
  (shown as a dotted circle on the map) show up at all — this is deliberately
  the same gate for both "seeing" and "targeting" someone.
- **The map**: real streets and city names via OpenStreetMap/Leaflet. Tap
  anywhere nearby to walk your wizard there; tap 📍 to sync to your real
  location.
- **NPC wizards**: since it's just us testing for now, the map is populated
  with randomly generated NPC wizards (name, element, level, and a
  temperament — passive/neutral/aggressive — that governs how often they
  pick fights and how readily they raise a defense).
- **Combat**: tap an NPC to target them, then tap an attack spell. The spell
  has a cast time plus a travel time based on distance and the spell's
  speed — you'll see it fly across the map. If someone targets *you*, a
  defend prompt pops up with a countdown for the incoming spell; cast a
  defend spell (Ward Shield, Swift Step) before it lands to mitigate or dodge
  it entirely.
- **Progression**: defeating NPCs grants XP, leveling raises your stats and
  fully restores you. Getting defeated isn't punishing — you recover after a
  few seconds at partial health/mana.

## Project layout

```
index.html        entry point / screens
css/style.css      theme + layout
js/
  wizard.js        stats, elements, starting spells, leveling
  spells.js        spell definitions (attack/defend/heal)
  npc.js           NPC generation, names, respawning
  geo.js           distance + random-point-nearby math
  combat.js        cast/resolve/tick — the actual duel logic
  map.js           Leaflet rendering (player, NPCs, flying spells)
  ui.js            all other DOM (HUD, spellbook, log, prompts)
  state.js         localStorage save/load
  main.js          wires it all together, owns the game loop
```

## Deploying to GitHub Pages

A workflow at `.github/workflows/deploy-pages.yml` deploys the site on every
push to `main`. One-time setup: in the repo, go to **Settings → Pages** and
set **Source** to **GitHub Actions**. After that, every push to `main`
auto-publishes.

## Roadmap ideas (not built yet — pick and we'll iterate)

- Point-buy stat allocation at wizard creation
- More spells per element, spell unlocks at higher levels
- Elemental strengths/weaknesses (fire beats nature, etc.)
- A proper duel/target panel with spell descriptions and tooltips
- Sound effects and hit animations
- Guilds/covens, or simple leaderboards
- A "beacon" other real players could scan to actually multiplayer (would
  need a backend — currently this is fully static/serverless)
- PWA install support for a more app-like feel on phones

This is meant to grow through fast iteration — nothing here is locked in.
