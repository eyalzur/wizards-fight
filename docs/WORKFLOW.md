# Workflow: features & bugs

This is a fast-iteration solo/duo project (see the project's founding
principle: lots of small iterations, reviewed together, nothing locked in
advance). This workflow is deliberately light — enough structure that
planning is easy and nothing gets lost, not so much that it slows down a
two-person team down to a crawl.

Four roles show up below and map to the four subagents in `.claude/agents/`:
**product design**, **UI design**, **tech design & development**, **QA**.
On a small change, one person (or one Claude session) plays all four
roles in sequence without ceremony. On a bigger or riskier change, it's
worth actually delegating to the matching agent to get a second, focused
pass — see "When to use an agent" below.

## Feature workflow

1. **Capture it.** Add a line to `proj-status.md`'s Roadmap (or a GitHub
   issue if it needs discussion/tracking beyond a one-liner). Don't build
   from a Slack-message-shaped idea that only exists in someone's head.
2. **Product design pass.** What outcome are we after, for which player
   moment, and why now? Write it as a short brief: problem, target
   experience, explicit scope (what's *not* included), success signal.
   For a small, obvious change this can be one sentence in the commit
   message instead of a separate document — use judgment.
3. **UI/UX design pass** (skip if the change has no visible surface).
   How does it fit the existing dark-wizard theme and the tap-to-open-
   sheet interaction pattern? Sketch the flow in words before touching
   CSS. Check `docs/FEATURES.md` for what already exists so the new
   thing doesn't contradict it.
4. **Tech design pass** (skip if genuinely trivial). Which module in
   `docs/ARCHITECTURE.md` owns this? Does it need a new data field on
   `wizard`/`world`? Does it cross the game-logic/rendering boundary in a
   new way? Write this down for anything that touches more than one
   module or changes a persisted data shape — a paragraph is enough.
5. **Build it.** Follow the module boundaries in `docs/ARCHITECTURE.md`.
   Keep `combat.js`/`wizard.js`/`npc.js` free of DOM code and
   `map.js`/`ui.js` free of game rules.
6. **QA pass.** Run through the relevant parts of
   `docs/QA-CHECKLIST.md`, plus anything specific to the new feature.
   For anything touching combat math, timing, or persistence, write a
   throwaway Playwright script (see `docs/ARCHITECTURE.md` Testing) to
   drive it end-to-end rather than eyeballing it — this project's
   history has already caught real bugs (event-propagation double-firing,
   flaky test timing) this way that manual clicking missed.
7. **Update `proj-status.md`.** Move the item from Roadmap into a new
   "What's live now" bullet (and `docs/FEATURES.md` with exact numbers).
   If the change reverses or complicates an earlier decision, add a line
   to the Decisions Log — future planning depends on knowing *why*, not
   just *what*.
8. **Deploy.** Push to `main`. It's live within a minute or two.

## Bug workflow

1. **Reproduce it and write down the exact steps.** "Sometimes it's
   broken" isn't fixable or verifiable later. If it's timing-related
   (very plausible in a tick-based real-time game), note whether it
   reproduces under Fast or Real speed or both.
2. **Root-cause it before patching.** Use `docs/ARCHITECTURE.md`'s module
   map to find where the responsibility actually lives. A bug that
   "just needs an extra `if`" in the wrong module is usually a sign the
   real cause is one layer away (e.g. a rendering bug caused by game
   logic leaking a DOM assumption).
3. **Fix it minimally.** Don't refactor unrelated code in the same
   change — makes the fix harder to verify and to revert if wrong.
4. **Regression-check it.** Re-run the specific repro from step 1, plus
   the general checklist in `docs/QA-CHECKLIST.md` for the affected
   area (a combat fix should re-run the combat section, not just the one
   broken case).
5. **Note it if it's notable.** A user-facing bug that shipped and got
   fixed is worth one line in `proj-status.md`'s Decisions Log if the fix
   changed a documented behavior or number; a pure implementation bug
   (typo, off-by-one) with no behavior change isn't worth logging.
6. **Deploy.** Push to `main`.

## When to use an agent

- **`product-designer`** — before building anything where "should we even
  do this" is a real question, or when the roadmap needs re-prioritizing.
  This is also what `/check-proj` leans on for its recommendation.
- **`ui-designer`** — before any new screen, panel, or interaction
  pattern; also useful as a second opinion on whether a UI change fits
  the established theme before it's built.
- **`tech-lead`** — architecture questions (new data shape, new module,
  anything that changes the game loop or persistence), and general
  implementation. This is the one that actually writes code.
- **`qa-tester`** — before calling any non-trivial feature or bug fix
  done. Give it the specific change and let it decide what to verify
  from `docs/QA-CHECKLIST.md` plus anything change-specific.

## Conventions

- **Branch:** work happens on the branch this Claude Code session is
  bound to; deploys go out from `main`. Sync `main` when a change is
  ready to be live, not before.
- **Commit messages:** explain *why*, not just *what* — the Decisions Log
  in `proj-status.md` is the place for anything that needs more than a
  commit message can hold.
- **Never silently change a number in `spells.js`/`wizard.js` without
  updating `docs/FEATURES.md`** — that file is the numbers reference for
  planning and QA both; a drift between code and docs defeats the point
  of writing this down at all.
