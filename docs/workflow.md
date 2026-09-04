# Working Conventions - MyLumi

> For the Claude Code agent: read this at the start of a session when it's relevant. Keep it current - update it as the project evolves, and keep `CLAUDE.md` minimal by pushing detail down here.

## Usage / context discipline

- **Keep `CLAUDE.md` minimal.** Only what's needed in *every* session. Everything else lives in `docs/` and is pulled in on demand with `@docs/filename.md`.
- **Use `/clear` for new tasks.** Don't use `/compact` unless the context is genuinely needed.
- **Iterate over small changes.** Finish a small unit of work, then `/clear`.
- **Store project knowledge in `docs/`.** Reference specific files with `@docs/filename.md` when needed rather than loading everything.
- **No Memory Bank.** Use `docs/` instead.
- **Track tasks with checkboxes.** Use `[ ]` / `[x]` in markdown files - not complex memory systems.

## Writing conventions

These are project-wide and non-negotiable. They apply to **everything**: UI
strings, code comments, docs, test names, and commit messages.

- **No em dashes or en dashes anywhere.** Use a plain hyphen.
  - Prose and parentheticals: `tracked - MyLumi`, spaced on both sides.
  - Numeric ranges: `days 3-5`, `0-6`, no spaces.
  - A "no value" placeholder in the UI is `'-'`, never `'---'`.
- **Straight quotes and apostrophes only.** No curly `'` `'` `"` `"`.
  When a string contains an apostrophe, switch the JS string to double quotes
  rather than escaping it.
- **No Unicode minus sign** (`-`). Use a hyphen.
- Ellipsis `...` is allowed in UI copy (`'Saving...'`); it is a deliberate
  convention, not a dash.

### UI copy

- **No explanatory small print under a chart or a card.** No methodology
  footnotes, no "based on N nights", no legend restating what the chart already
  shows. If a card needs a sentence underneath to make sense, fix the card.
  Limitations belong on the About page, where they can actually be pointed to.
  `--fs-xs` is for labels and data annotations, never for prose.
- The exceptions are safety copy, screen-reader labels, and notes flagging a
  specific displayed number as possibly wrong. Mark those with a
  `{/* caption-ok: why */}` comment and say why.
- The full rule, with the reasoning, is in `docs/design-system.md` under "No
  caption layer". This convention was written once and regressed anyway, which
  is why `check:style` now fails the build over it rather than trusting the doc.

Check before committing, from `frontend/`:

```sh
npm run check:style
```

It scans the whole repo for the banned characters, and every `.jsx` file for
prose at `--fs-xs`, and exits non-zero if it finds either. The character list
lives in `scripts/check-style.mjs` as escape sequences, so no file in the
project has to contain the characters it bans. `npm run verify` runs it
alongside lint, tests and the build.

### Commit messages

- No em or en dashes, same as everywhere else.
- **No AI or Claude co-author attribution.** No `Co-Authored-By: Claude`
  trailer, no "Generated with" footer. Commits are authored by the person who
  made them.
- Present tense, describe what changed and why.

## How docs/ is organized

- `docs/workflow.md` - this file. Conventions and process.
- `docs/plan.md` - the project plan (source: `MyLumi_Plan.md`, which is gitignored and so is not in a fresh clone). The build plan there is *tentative*.
- Add focused docs as the build grows (e.g. `docs/data-schema.md`, `docs/render-architecture.md`, `docs/design-system.md`, `docs/responsible-ai.md`). One concern per file.
- Keep a running task list with checkboxes - either in the relevant doc or a `docs/tasks.md`.

## Maintenance loop

1. When a decision is made or a piece of the system stabilizes, write it into the right `docs/` file.
2. If something is needed in *every* session, add a one-line pointer in `CLAUDE.md` - not the detail itself.
3. When a task completes, check its box and `/clear`.
