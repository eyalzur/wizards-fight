# 🧙 Wizards Fight

A browser wizard-duel game on a real street map. Create a wizard, feel other
wizards nearby, and cast spells that take real time to travel — giving your
target a window to defend before the spell lands.

Everything runs client-side (plain HTML/CSS/JS, no build step, no backend, no
accounts). Your wizard is saved to your browser's `localStorage` only.

**Live:** https://eyalzur.github.io/wizards-fight/

## Project docs

This README is just "how to run it." Everything else lives in:

- [`proj-status.md`](proj-status.md) — current status, roadmap, and a log
  of the decisions behind the current build. Start here.
- [`docs/FEATURES.md`](docs/FEATURES.md) — what the game does, with exact
  numbers.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how it's built, module
  by module.
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — how features and bugs go from
  idea to deployed.
- [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md) — what to verify before
  calling a change done.

Run `/resume-proj` (a Claude Code skill in this repo) for a status read and
a suggested next task. Four subagents in `.claude/agents/` cover
product design, UI design, tech design/development, and QA — see
`docs/WORKFLOW.md` for when to use which.

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

## Deploying to GitHub Pages

**Live source: `main` branch.** Settings → Pages → Source: **Deploy from a
branch** → Branch: **`main`**, folder **`/ (root)`**. Every push to `main`
is live within a minute or two, no build step.

An alternative Actions-based workflow also exists at
`.github/workflows/deploy-pages.yml`, for if this repo ever switches Pages
Source to **GitHub Actions** instead. It's not the active path right now —
see `docs/ARCHITECTURE.md` Deployment.
