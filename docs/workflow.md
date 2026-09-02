# Working Conventions — MyLumi

> For the Claude Code agent: read this at the start of a session when it's relevant. Keep it current — update it as the project evolves, and keep `CLAUDE.md` minimal by pushing detail down here.

## Usage / context discipline

- **Keep `CLAUDE.md` minimal.** Only what's needed in *every* session. Everything else lives in `docs/` and is pulled in on demand with `@docs/filename.md`.
- **Use `/clear` for new tasks.** Don't use `/compact` unless the context is genuinely needed.
- **Iterate over small changes.** Finish a small unit of work, then `/clear`.
- **Store project knowledge in `docs/`.** Reference specific files with `@docs/filename.md` when needed rather than loading everything.
- **No Memory Bank.** Use `docs/` instead.
- **Track tasks with checkboxes.** Use `[ ]` / `[x]` in markdown files — not complex memory systems.

## How docs/ is organized

- `docs/workflow.md` — this file. Conventions and process.
- `docs/plan.md` — the project plan (source: `MyLumi_Plan.md`). The build plan there is *tentative*.
- Add focused docs as the build grows (e.g. `docs/data-schema.md`, `docs/render-architecture.md`, `docs/design-system.md`, `docs/responsible-ai.md`). One concern per file.
- Keep a running task list with checkboxes — either in the relevant doc or a `docs/tasks.md`.

## Maintenance loop

1. When a decision is made or a piece of the system stabilizes, write it into the right `docs/` file.
2. If something is needed in *every* session, add a one-line pointer in `CLAUDE.md` — not the detail itself.
3. When a task completes, check its box and `/clear`.
