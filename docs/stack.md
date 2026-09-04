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
- Frontend static-hosted on Render; the FastAPI service alongside it does the real work.

## Backend layout

```
backend/
  app/
    main.py      app, CORS, the never-log-payloads rule
    schemas.py   wire contract - mirrors toFeatureRow
    routers/     thin HTTP layer
    models/      the ML - pure, no FastAPI imports, unit-testable
  tests/         pytest - 223 tests
```

Run: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
Test: `cd backend && .venv/bin/python -m pytest`

See `backend/README.md` and `docs/responsible-ai.md`.

## Deployment

Two services, one host, one blueprint. A Vite build is static files and a
Python inference service needs a runtime, so they stay separate services - but
both are Render, applied together from one file.

| Piece | Type | Sleeps? |
|---|---|---|
| `mylumi-api` (FastAPI) | Render web service, free | Yes - ~15 min idle |
| `mylumi-web` (Vite build) | Render static site, free | No |

Both are defined in `render.yaml` at the **repo root**, not in `backend/`,
because that is where Render's blueprint auto-discovery looks. Each service
builds from its own subdirectory via `rootDir`.

The static site carries the SPA rewrite (so a refresh on `/journal` does not
404) and the security headers. Those are service config, not app code - if the
site is ever moved to another host, they have to be ported, not assumed.

### The CORS handshake

The backend allows only localhost by default, so a deployed frontend is blocked
until `FRONTEND_ORIGINS` is set. This is the most likely post-deploy failure.

The two services depend on each other's URLs in opposite directions, which is
what fixes the order:

- `mylumi-web` needs the API URL at **build** time - Vite inlines
  `VITE_API_URL` into the bundle, so changing it needs a redeploy, not a
  restart.
- `mylumi-api` needs the site URL at **run** time - `FRONTEND_ORIGINS` is read
  per request, so changing it only needs a restart.

So: deploy both, set `VITE_API_URL` on the web service and redeploy it, then
set `FRONTEND_ORIGINS` on the API to the web URL. Neither value is committed -
both are `sync: false` and live in the dashboard.

Origins must match exactly: scheme included, no trailing slash.

### Notes

- Free tier sleeps after ~15 min idle (~50s cold start). Three things blunt
  this, in order of who does the work: the static site never sleeps, so the app
  always loads instantly; the frontend pings `/health` on mount and shows
  honest "waking up" copy rather than a spinner; and an external cron service
  (cron-job.org) hits `/health` every 10 minutes during the event so the
  instance never sleeps in the first place. The pinger is dashboard config,
  not code - there is nothing in this repo to configure for it.
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
