---
name: check-proj
description: Reads proj-status.md, the docs/ folder, and open GitHub issues for Wizards Fight, then suggests what to work on next. Use when the user runs /check-proj or asks "what should we work on".
---

# /check-proj

Give the user a quick, honest status read and a concrete recommendation
for what to do next — not an exhaustive report. This should take one pass
through the docs plus one GitHub query, not a deep investigation.

## Steps

1. Read `proj-status.md` in full (Snapshot, What's live now, Known gaps,
   Roadmap, Decisions log).
2. Skim `docs/FEATURES.md` and `docs/ARCHITECTURE.md` only as needed to
   sanity-check that proj-status.md's "What's live now" isn't stale
   (spot-check a couple of claims against `js/spells.js` or `js/wizard.js`
   if something looks off — don't do a full audit every time).
3. Check open GitHub issues on this repo (`mcp__github__list_issues` or
   `search_issues`, state=open). If the issue tools aren't available or
   the repo has none, say so plainly rather than skipping the mention.
4. Check whether there are uncommitted changes or commits on the working
   branch not yet reflected in `proj-status.md` (`git status`, `git log`
   vs. the "Last updated" date) — flag drift if found, don't silently fix
   it.

## Output format

Keep it short. Structure:

**Status** — one or two sentences: what's live, anything broken or
notably stale in the docs.

**Open issues** — list them if any exist (title + number), or state there
are none.

**Suggested next task** — exactly one clear recommendation, with:
- What it is (one line).
- Why this one over the other roadmap items (impact, or it unblocks
  something, or it's a known gap someone hit).
- Which role to start with per `docs/WORKFLOW.md` (product-designer for
  a scoping question, ui-designer for a visual/interaction change,
  tech-lead for a technical change or bug, qa-tester if something just
  shipped and needs verification before it's "done").

**Also worth knowing** — up to 2 more candidates worth a mention (from
the Roadmap or open issues), one line each. Don't list more than that —
the point is a recommendation, not a re-print of the whole backlog.

## Rules

- Don't propose anything not already in `proj-status.md`'s Roadmap or an
  open issue, unless you're flagging a Known gap as newly worth
  addressing — in that case say explicitly that it's a reframe, not an
  existing backlog item.
- Don't start implementing. This command's job is the recommendation; the
  user decides whether to act on it and how (directly, or by spawning the
  suggested agent).
- If `proj-status.md` doesn't exist or looks unrelated to this repo, say
  so and stop — don't fabricate a status report.
