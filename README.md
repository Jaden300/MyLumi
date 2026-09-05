<p align="center">
  <img src="docs/assets/wordmark.svg" alt="MyLumi" width="340">
</p>

<p align="center">
  <strong>A concussion-recovery journal that learns your own sleep-symptom pattern, and refuses to guess.</strong>
</p>

<p align="center">
  <a href="#running-it"><img alt="React 19" src="https://img.shields.io/badge/React-19-4C1D95?style=flat-square&logo=react&logoColor=white"></a>
  <a href="#running-it"><img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-stateless-D6249F?style=flat-square&logo=fastapi&logoColor=white"></a>
  <img alt="Tests" src="https://img.shields.io/badge/tests-844%20passing-4ADE80?style=flat-square">
  <img alt="Local first" src="https://img.shields.io/badge/data-local%20first-4C1D95?style=flat-square">
</p>

<p align="center"><em>Hack for Humanity 2026</em></p>

---

Twice a day, before bed and after waking, MyLumi asks about symptoms, mood, pain
and sleep. Over a few weeks it learns *this person's* relationship between sleep
and symptom burden, forecasts tomorrow, grades that forecast against history, and
surfaces correlations nobody would notice by hand. Every check-in stays in the
browser: no account, no analytics, no trackers.

Sleep is one of the few genuinely modifiable factors in concussion recovery, and
recovery is invisible - symptoms swing day to day, so progress over weeks is hard
to feel. The users have photophobia and cognitive fatigue, which is a design
constraint rather than a persona detail: restrained visuals, one action per
screen, no idle motion, dark mode first.

## The thing we would most like you to check

**MyLumi refuses to speak when it doesn't know.** Under 7 complete nights it
emits *no* forecast - not a hedged one, not a wide interval, nothing. A
prediction from four nights looks exactly as authoritative as one from forty and
the user cannot tell them apart.

That runs the whole way down:

- A missing answer stays `null` from input to model. Rows lacking a feature are
  **dropped from the fit, never imputed** - a fabricated `0` would enter the
  clinical record as a real observation.
- An unmarked pain region is not a `0` either. The record cannot distinguish "my
  neck was fine" from "I did not mark my neck", so it is absent from that
  region's series rather than counted as recovery.
- Charts **break their line across unlogged nights** instead of interpolating.
- Correlations are Holm-Bonferroni corrected. Uncorrected, **30%** of pure-noise
  datasets produced a "finding" in testing; corrected, 6%.
- **The forecast grades itself** against "tomorrow will be like today", reported
  whichever way it goes. That is how the interval got fixed: it advertised 80%
  coverage and delivered 51%.
- No recovery dates, ever. No diagnoses. No population curve to measure against.

`docs/responsible-ai.md` is the full account, written alongside the API rather
than reconstructed afterwards.

## Architecture

```
Browser (React + Vite)                 Render (FastAPI, stateless)
├── localStorage ..... the clinical    ├── POST /v1/insights  all six numeric
│                      record. Never   │                      models, batched
│                      leaves.         ├── /forecast /correlation /anomaly
├── lib/derive.js .... numeric    ──►  │   /symptoms /validation /state
│                      chokepoint      │   the same models, individually
├── lib/journal.js ... text       ──►  ├── POST /v1/nlp       journal text,
│                      chokepoint      │                      consent-gated
├── lib/redFlags.js ...... safety    ─┐└── GET  /health
├── lib/painTrajectory.js per-region  ├─ never a network call
└── lib/agreement.js ..... text+nums ─┘
```

**Two chokepoints, on purpose.** `toFeatureRow` builds numbers and has no field
that could carry text; `buildJournalTexts` builds text and has no field that
could carry a score. Neither can produce the other's shape, so "journal text
never rides along on a numeric call" is structural rather than a convention.

**Render does real work** - ridge regression, Spearman correlation with threshold
search, median/MAD outlier detection, Theil-Sen per-symptom rates, a walk-forward
backtest, and a hand-rolled Kalman filter with RTS smoother. Per request, on data
it then discards. No database exists, and request bodies are never logged.

**Three things run in the browser** because they could not run on the server
honestly: per-region pain models (region names never cross the wire), the
comparison of what someone *wrote* against what they *rated* (the server must
never hold both), and red-flag rules (a safety prompt must not depend on a
free-tier service that might be asleep).

## Running it

```bash
cd frontend && npm install && npm run dev    # works fully without a backend
cd backend  && python -m venv .venv && .venv/bin/pip install -r requirements.txt
             .venv/bin/uvicorn app.main:app --reload --port 8000
```

Point the frontend at the API with `VITE_API_URL` (see `frontend/.env.example`).
**Unset it and the app still works** - summaries, charts, streaks, history, the
pain page and the red-flag rules are all local. Only the model-backed cards go
quiet, and they say so.

```bash
cd frontend && npm test                    # 621 tests
cd backend && .venv/bin/python -m pytest   # 223 tests
```

`npm run verify` adds lint, a style guard, a build, and a check that three.js has
not leaked out of its dynamic import. The suites include the privacy assertions:
text never enters a numeric payload, numbers never enter a text payload, region
names never leave the device, and `lib/api.js` is still the only `fetch`.

A **Load demo data** button on the dashboard seeds three weeks of check-ins,
never automatically, with the sleep-symptom effect planted in the *inputs* - the
correlation engine has to discover it the same way it would on real data.

## Deployment

`render.yaml` at the repo root defines both services and is applied: the
stateless API and the static frontend come up from one blueprint. Set
`VITE_API_URL` on the web service (Vite inlines it at build time, so it needs a
redeploy), then `FRONTEND_ORIGINS` on the API,
which refuses to boot without it rather than coming up with a localhost-only CORS
allowlist. `docs/stack.md` has the ordering and the reasoning.

## Docs

Read the relevant one rather than all of them. **`responsible-ai`** (what crosses
the wire, what the models refuse to do) · **`data-schema`** (storage, the
`nightOf` model, streaks) · **`design-system`** · **`stack`** · **`workflow`** ·
**`lumi-brief`** · **`tasks`** (progress, and what running the code caught that
reading it did not), all under `docs/`.

`backend/README.md` and `frontend/README.md` go deeper into each half - including
the 3D pain map, whose regions are resolved from the model's rig rather than from
per-part meshes.

---

<p align="center">
  <img src="docs/assets/lumi-mark.svg" alt="" width="72">
</p>

<p align="center">
  <strong>MyLumi is not a diagnostic tool.</strong><br>
  It does not diagnose, does not stage recovery, and does not replace a clinician.
</p>
