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
| Backend | **Python + FastAPI** on Render, stateless | `backend/` — inference only, stores nothing |
| ML | **numpy + scipy only** | pandas/scikit-learn/statsmodels dropped — ridge is a closed-form solve, Spearman and MAD are scipy/numpy one-liners. Three fewer heavy wheels means a materially faster cold start, which is the main demo risk |
| Fonts | League Spartan (display) + Inter (body), Google Fonts | |
| Repo | git initialised | |

## Data flow / privacy

- All check-in data lives in the browser. No identifiers stored.
- Backend inference calls send **de-identified** feature payloads only (numeric scores + derived features + journal text for NLP). No name, no device id, no persistent user id.
- Write down exactly what crosses the wire in `docs/responsible-ai.md` once the API contract exists.
- Frontend static-hosted (Render static site or similar); FastAPI service on Render does the real work.

## Backend layout

```
backend/
  app/
    main.py      app, CORS, the never-log-payloads rule
    schemas.py   wire contract — mirrors toFeatureRow
    routers/     thin HTTP layer
    models/      the ML — pure, no FastAPI imports, unit-testable
  tests/         pytest — 68 tests
```

Run: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
Test: `cd backend && .venv/bin/python -m pytest`

See `backend/README.md` and `docs/responsible-ai.md`.

## Render

- `backend/render.yaml` defines one free-tier web service (health check `/health`).
- **Not yet deployed** — needs an account action. After deploying:
  1. set `FRONTEND_ORIGINS` on the service to the frontend URL,
  2. set `VITE_API_URL` for the frontend build,
  3. record the live URL here.
- Free tier sleeps after ~15 min idle (~50s cold start). The frontend pings
  `/health` on mount and shows honest "waking up" copy rather than a spinner.
- Postgres only if accounts get built (optional extension). Nothing to persist today.

## Frontend → backend

- `src/lib/api.js` is the **only** file that makes network calls.
- Set `VITE_API_URL` (see `frontend/.env.example`). Unset = no network calls at
  all and the insights section simply does not render.

## Open / to decide later

- Chart library, if the hand-rolled SVG stops being enough
- Whether to self-host fonts
