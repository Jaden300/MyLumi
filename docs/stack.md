# Stack & Architecture - MyLumi

## Decisions (locked)

| Area | Choice | Notes |
|---|---|---|
| Frontend | **React + Vite** | static-hostable, fast dev |
| Styling | Plain CSS + CSS custom properties | tokens in `docs/design-system.md`; no heavy UI kit |
| Routing | React Router | |
| State / storage | **Local-first** - browser `localStorage`, no account required | schema: `docs/data-schema.md` |
| Tests | **Vitest** - `npm test` | `lib/` is pure and fully covered; components not yet |
| Charts | Hand-rolled SVG so far (heat strip). Revisit if trajectory charts need more | |
| Backend | **Python + FastAPI** on Render, stateless | `backend/` - inference only, stores nothing |
| ML | **numpy + scipy only** | pandas/scikit-learn/statsmodels dropped - ridge is a closed-form solve, Spearman and MAD are scipy/numpy one-liners. Three fewer heavy wheels means a materially faster cold start, which is the main demo risk |
| Fonts | League Spartan (display) + Inter (body), Google Fonts | |
| Repo | git initialised | |

## Data flow / privacy

- All check-in data lives in the browser. No identifiers stored.
- Backend inference calls send **de-identified** payloads only. No name, no device id, no persistent user id.
  - `/v1/insights` - numeric scores + derived features. **Never journal text.**
  - `/v1/nlp` - journal text only, and only after an explicit opt-in stored in
    `prefs`. Off by default, revocable from the Your Data page.
  - Two separate builders (`toFeatureRow`, `buildJournalTexts`) with structurally
    incompatible outputs, so neither payload can carry the other's content.
- Exactly what crosses the wire is documented in `docs/responsible-ai.md`.
- Frontend static-hosted on Vercel; FastAPI service on Render does the real work.

## Backend layout

```
backend/
  app/
    main.py      app, CORS, the never-log-payloads rule
    schemas.py   wire contract - mirrors toFeatureRow
    routers/     thin HTTP layer
    models/      the ML - pure, no FastAPI imports, unit-testable
  tests/         pytest - 105 tests
```

Run: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
Test: `cd backend && .venv/bin/python -m pytest`

See `backend/README.md` and `docs/responsible-ai.md`.

## Deployment

Two services, two hosts. The split is deliberate: a Vite build is static files
and belongs on a CDN, while the inference service needs a Python runtime.

| Piece | Host | Config |
|---|---|---|
| `mylumi-api` (FastAPI) | Render, free tier | `render.yaml` at repo root |
| frontend (Vite static) | Vercel | `frontend/vercel.json` |

`render.yaml` lives at the **repo root**, not in `backend/`, because that is
where Render's blueprint auto-discovery looks. It still builds from `backend/`
via `rootDir`.

### The CORS handshake

The backend allows only localhost by default, so a deployed frontend is blocked
until `FRONTEND_ORIGINS` is set. This is the most likely post-deploy failure,
and the order matters:

1. Deploy the API on Render. Note its URL.
2. Set `VITE_API_URL` to that URL in Vercel, then deploy the frontend.
3. Set `FRONTEND_ORIGINS` on the Render service to the Vercel URL, including
   any preview domains you intend to demo from. Render restarts.

`FRONTEND_ORIGINS` is `sync: false` in the blueprint, so it is set in the
dashboard and never committed.

### Notes

- Free tier sleeps after ~15 min idle (~50s cold start). The frontend pings
  `/health` on mount and shows honest "waking up" copy rather than a spinner.
- The blueprint pins Python 3.11.9. The local venv is 3.10.15; the code uses
  builtin generics that work on both, but the deploy target is not what runs
  locally.
- Postgres only if accounts get built (optional extension). Nothing to persist
  today.

## Frontend → backend

- `src/lib/api.js` is the **only** file that makes network calls.
- The NLP call additionally requires consent. `api.js` does not enforce that -
  `useJournalInsights` does, and the docstring says so rather than claiming a
  guarantee the transport layer doesn't provide.
- Set `VITE_API_URL` (see `frontend/.env.example`). Unset = no network calls at
  all and the model-backed cards simply do not render. Everything computed
  locally - weekly summary, trajectory chart, daily report, streaks, history,
  red-flag rules - keeps working.

## Open / to decide later

- Chart library, if the hand-rolled SVG stops being enough
- Whether to self-host fonts
