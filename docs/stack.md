# Stack & Architecture — MyLumi

## Decisions (locked)

| Area | Choice | Notes |
|---|---|---|
| Frontend | **React + Vite** | static-hostable, fast dev |
| Styling | Plain CSS + CSS custom properties | tokens in `docs/design-system.md`; no heavy UI kit |
| Routing | React Router | |
| State / storage | **Local-first** — browser `localStorage`, no account required | schema: `docs/data-schema.md` |
| Tests | **Vitest** — `npm test` | `lib/` is pure and fully covered; components not yet |
| Charts | Hand-rolled SVG so far (heat strip). Revisit if trajectory charts need more | |
| Backend | **Python + FastAPI** on Render | inference + insight generation |
| ML | numpy / pandas / scikit-learn / statsmodels; simple, explainable models | forecasting may reduce to explainable regression — that's fine |
| Fonts | League Spartan (display) + Inter (body), Google Fonts | |
| Repo | git initialised | |

## Data flow / privacy

- All check-in data lives in the browser. No identifiers stored.
- Backend inference calls send **de-identified** feature payloads only (numeric scores + derived features + journal text for NLP). No name, no device id, no persistent user id.
- Write down exactly what crosses the wire in `docs/responsible-ai.md` once the API contract exists.
- Frontend static-hosted (Render static site or similar); FastAPI service on Render does the real work.

## Render

- Account exists; the service for this project not created yet — will do at start of Phase 3 (deploy early).
- Target: one FastAPI web service. Postgres only if accounts get built (optional extension).

## Open / to decide later

- Chart library, if the hand-rolled SVG stops being enough
- Whether to self-host fonts
- Backend test setup (pytest, likely)
