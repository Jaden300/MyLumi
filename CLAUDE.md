# MyLumi

Concussion-recovery journaling app. Hack for Humanity 2026.

`frontend/` — React + Vite. `npm run dev` · `npm test` · `npm run build`.

## Non-negotiables

- **Local-first.** No account, no analytics, no trackers. All data in localStorage.
- **Never present as diagnostic.** No diagnoses, no recovery dates, no fabricated confidence.
- **Never invent data.** An unanswered field stays null — a fabricated 0 enters the clinical record.
- **No backfilling.** Check-ins only for the current night.

## Docs

Read the relevant one before working in that area — don't load them all.

- `@docs/data-schema.md` — storage shape, the `nightOf` model, rollover, streak rules
- `@docs/design-system.md` — colour, type, spacing, component conventions
- `@docs/stack.md` — stack decisions
- `@docs/workflow.md` — how we work, doc conventions
- `@docs/tasks.md` — checkbox task list
- `@MyLumi_Plan.md` — full project plan (build order is tentative)
