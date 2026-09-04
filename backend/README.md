# MyLumi Inference API

Stateless FastAPI service. Fits explainable models on de-identified feature rows
sent by the browser and returns predictions with their reasoning. **No database,
no disk writes, no session state, no payload logging.**

The clinical record never leaves the user's device. This service sees a numeric
snapshot for the duration of one request and forgets it.

## Run locally

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

## Test

```bash
.venv/bin/python -m pytest        # 223 tests
```

Tests are statistically seeded - no flaky assertions. `tests/fixtures.py` plants
a *lagged* sleep→symptom relationship (night `i` sleep drives day `i+1` burden),
which is the relationship the product actually claims to find.

## Layout

```
app/
  main.py          app, CORS, the no-logging rule
  schemas.py       the wire contract - mirrors toFeatureRow in the frontend
  routers/         thin HTTP layer
  models/          the ML - pure functions, no FastAPI imports, unit-testable
tests/
```

`models/` importing nothing from FastAPI is deliberate: every model is testable
without a server, mirroring how `frontend/src/lib/` is pure and fully covered.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check, and the frontend's wake-up ping |
| `POST /v1/insights` | **The one the app calls** - forecast + correlation + anomaly in a single request |
| `POST /v1/forecast` | Ridge regression, conformal interval |
| `POST /v1/correlation` | Spearman + threshold search |
| `POST /v1/anomaly` | Robust (median/MAD) outlier detection |
| `POST /v1/symptoms` | Per-symptom composition shifts and recovery rates |
| `POST /v1/validation` | Walk-forward backtest of the forecast |
| `POST /v1/state` | Latent recovery state (Kalman + RTS smoother) |
| `POST /v1/nlp` | Journal sentiment - **separate payload, separate consent** |

`/v1/insights` batches every numeric model so a cold free-tier instance is woken
once rather than six times, and so all the cards on a screen describe the same
snapshot. Each model is called defensively there: one failing model returns its
own "unavailable" envelope rather than 500ing the batch and blanking the five
that worked.

## The response envelope

Every response carries `available`, `reason`, `confidence`, `nDays`.

`available: false` is a **200, not an error**. "We don't have enough data to say
anything yet" is the normal path - most users spend their first week there - so
it is modelled as a valid answer rather than an exception.

| Complete episodes | Tier | Behaviour |
|---|---|---|
| 0-6 | `none` | **No number is emitted at all** |
| 7-13 | `low` | Shown, labelled low confidence, wide interval |
| 14-20 | `moderate` | Normal |
| 21+ | `good` | Full confidence |

The `none` tier matters most. A prediction from four nights would look exactly as
authoritative as one from forty, and the user cannot tell them apart. Withholding
is the only honest option.

## Design rules that are not negotiable

- **Never invent data.** A missing answer stays `None` end to end. Rows missing a
  needed feature are *dropped* from a fit, never imputed, and the model reports
  the `n` it actually used.
- **Never log payloads.** Not in handlers, not in middleware, not temporarily
  while debugging. A log line with symptom scores is clinical data at rest on a
  server, which is exactly what this architecture promises does not exist.
- **Never claim causation.** Findings are phrased "on days following…", and a
  test asserts the causal vocabulary never appears.
- **Correct for multiple comparisons.** Four simultaneous tests at p<0.05 gave a
  false positive on ~50% of pure-noise datasets. Holm-Bonferroni cuts that to
  ~20% while still catching 100% of genuine planted effects. The per-symptom
  model runs nine at once and applies the same correction; measured on trendless
  data its false-positive rate is ~1%.
- **Explain every prediction.** Standardised ridge coefficients *are* the
  explanation, read straight off the fitted model rather than reconstructed by a
  separate method that might disagree with the number it explains. The same
  applies to the newer models: a composition share, a Theil-Sen slope with its
  interval, and a smoothed level with its band are all quantities you can point
  at rather than attributions reconstructed after the fact.
- **Measure the claims, do not assert them.** The forecast is backtested
  walk-forward against a naive "tomorrow = today" baseline, and the result is
  reported to the user whichever way it goes. This is also how the interval got
  fixed: the old per-tier multipliers advertised ~80% coverage and delivered
  ~51%, so they were replaced with a conformal width built from the model's own
  out-of-sample errors.

## Deploy

`render.yaml` at this directory's root defines one free-tier web service.
Set `FRONTEND_ORIGINS` in the Render dashboard to the deployed frontend URL
(comma-separated); localhost origins are always allowed.

Free-tier instances sleep after ~15 minutes idle and take ~50s to wake. The
frontend pings `/health` on mount to start that early and shows honest
"waking up" copy rather than a spinner that looks broken.
