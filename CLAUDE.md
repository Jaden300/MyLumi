# MyLumi

Concussion-recovery journaling app. Hack for Humanity 2026.

`frontend/` - React + Vite. `npm run dev` · `npm test` · `npm run build`.
`backend/` - FastAPI inference on Render, **stateless**. `.venv/bin/python -m pytest`.

## Non-negotiables

- **Local-first.** No account, no analytics, no trackers. All data in localStorage.
  The backend stores nothing and never logs payloads.
- **Never present as diagnostic.** No diagnoses, no recovery dates, no fabricated confidence.
- **Never invent data.** An unanswered field stays null - a fabricated 0 enters the clinical record.
  This holds across the network too: rows missing a feature are dropped from a fit, never imputed.
  An unmarked pain region is not a 0 either - it is absent from that region's series.
- **No backfilling.** Check-ins only for the current night.
- **Under 7 complete nights, emit no prediction at all.** Not a hedged one - none.
- **Journal text only ever goes to `/v1/nlp`**, never as part of a numeric call.

## Docs

Read the relevant one before working in that area - don't load them all.

- `@docs/data-schema.md` - storage shape, the `nightOf` model, rollover, streak rules
- `@docs/design-system.md` - colour, type, spacing, component conventions
- `@docs/responsible-ai.md` - what crosses the wire, what the models refuse to do
- `@docs/stack.md` - stack decisions
- `@docs/workflow.md` - how we work, doc conventions
- `@docs/tasks.md` - checkbox task list
- `@MyLumi_Plan.md` - full project plan (build order is tentative)
