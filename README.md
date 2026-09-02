<p align="center">
  <img src="docs/assets/wordmark.svg" alt="MyLumi" width="340">
</p>

<p align="center">
  <strong>A concussion-recovery journal that learns your own sleep-symptom pattern, and refuses to guess.</strong>
</p>

<p align="center">
  <a href="#run-it-locally"><img alt="React 19" src="https://img.shields.io/badge/React-19-4C1D95?style=flat-square&logo=react&logoColor=white"></a>
  <a href="#run-it-locally"><img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-stateless-D6249F?style=flat-square&logo=fastapi&logoColor=white"></a>
  <img alt="Tests" src="https://img.shields.io/badge/tests-412%20passing-4ADE80?style=flat-square">
  <img alt="Local first" src="https://img.shields.io/badge/data-local%20first-4C1D95?style=flat-square">
</p>

<p align="center">
  <em>Hack for Humanity 2026</em>
</p>

---

Twice a day, once before bed and once after waking, MyLumi asks about symptoms,
mood and sleep. Over a few weeks it learns *this person's* relationship between
sleep and symptom burden, forecasts tomorrow, and surfaces correlations nobody
would notice by hand. Every check-in stays in the browser.

---

## Why this exists

Sleep is one of the few genuinely modifiable factors in concussion recovery, and
post-concussion mental health - irritability, low mood, brain fog - is badly
underserved. Recovery is also invisible: symptoms fluctuate day to day, so
progress over weeks is almost impossible to feel. MyLumi sits at that
intersection.

The users have photophobia and cognitive fatigue. That is a design constraint,
not a persona detail: restrained visuals, one action per screen, no flashing, and
a dark mode that is the primary experience rather than an afterthought.

---

## The thing we would most like you to check

**MyLumi refuses to speak when it doesn't know.**

Under 7 complete nights it emits *no* forecast - not a hedged one, not a wide
interval, nothing. A prediction from four nights looks exactly as authoritative
as one from forty and the user cannot tell them apart.

That discipline runs the whole way down:

- A missing answer stays `null` from the input, through storage, through the
  feature row, to the model. Rows lacking a feature are **dropped from the fit,
  never imputed** - a fabricated `0` would enter the clinical record as a real
  observation.
- The trajectory chart **breaks its line across unlogged nights** rather than
  interpolating. Drawing a smooth curve over a gap invents a value and shows it
  back to the user as part of their own record.
- Correlations are Holm-Bonferroni corrected. Testing four candidate features at
  p<0.05 produced a "finding" on roughly **half** of pure-noise datasets in
  testing; correction cuts that to about 20% while still catching 100% of
  planted effects.
- No recovery dates, ever. No diagnoses. No population curve to measure yourself
  against.

`docs/responsible-ai.md` is the full account, written alongside the API rather
than reconstructed afterwards.

---

## Architecture

```
Browser (React + Vite)                    Render (FastAPI, stateless)
├── localStorage ....... the clinical     ├── POST /v1/insights   forecast +
│                        record. Never    │                       correlation +
│                        leaves.          │                       anomaly, batched
├── lib/derive.js ...... numeric          ├── POST /v1/nlp        journal sentiment
│                        chokepoint  ──►  │                       (consent-gated)
├── lib/journal.js ..... text             └── GET  /health
│                        chokepoint  ──►
└── lib/redFlags.js .... safety rules, never a network call
```

**Two chokepoints, on purpose.** `toFeatureRow` builds numbers and has no field
that could carry text; `buildJournalTexts` builds text and has no field that
could carry a score. Neither can produce the other's shape, so "journal text
never rides along on a numeric call" is a structural property rather than a
convention. Tests assert both directions.

**Render does real work.** The service fits a ridge regression, runs Spearman
correlations with threshold search, and computes robust median/MAD outlier
detection - per request, on data it then throws away. No database exists. Request
bodies are never logged, and `app/main.py` says so at the top in capitals.

**Red-flag escalation never touches the network.** `lib/redFlags.js` imports no
API client, no storage and no React. A safety-critical prompt must not depend on
a free-tier service that might be asleep.

---

## Running it

```bash
# Frontend - works fully without a backend
cd frontend && npm install && npm run dev

# Backend
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Point the frontend at the API with `VITE_API_URL` (see `frontend/.env.example`).
**Unset it and the app still works** - the weekly summary, trajectory chart,
daily report, streaks, history and red-flag rules are all computed locally. Only
the four model-backed cards go quiet, and they say so honestly.

```bash
cd frontend && npm test                    # 221 tests
cd backend && .venv/bin/python -m pytest   # 68 tests
```

The suites include the privacy assertions: that journal text never enters a
numeric payload, that numeric data never enters a text payload, and that no
generated copy uses causal vocabulary.

### Seeing it with data

There is a **Load demo data** button on the Your data page - about three weeks of
generated check-ins. It is never loaded automatically: silently writing fabricated
clinical entries into someone's storage is the same act as imputing a missing
score, only larger. While it is loaded, every screen says so.

The demo's sleep-symptom relationship is planted in the *inputs*, not asserted in
the output. The correlation engine discovers it by the same Holm-corrected path
it uses on real data, and a test pins the rank correlation so the demo can't
silently degrade into one where MyLumi's headline feature finds nothing.

---

## Deployment status

`backend/render.yaml` defines the service (free tier, health check at `/health`).
**It is not yet deployed** - that needs an account action. After deploying: set
`FRONTEND_ORIGINS` on the service, set `VITE_API_URL` for the frontend build, and
record the URL in `docs/stack.md`.

The free tier sleeps after ~15 minutes and takes ~50s to wake, so the frontend
pings `/health` on mount and shows honest "waking up the model service" copy
rather than a spinner that looks broken.

---

## Tracks

| Track | Where to look |
|---|---|
| Responsible AI | `docs/responsible-ai.md`; the Your data page; the 7-night refusal |
| Best Use of Render | `backend/` - real inference, stateless, no database |
| Best Use of AI/ML | Ridge forecast, Spearman + Holm correlation, MAD anomaly, lexicon NLP |
| Mental Health | Mood VAS, irritability and brain-fog tracking, journal sentiment |
| Physical Health | 9 PCSS items, sleep duration and quality, awakenings |
| Concussion Recovery | The entire product |
| Best Design | `docs/design-system.md`; dark-first, built for photophobia |

## Docs

| File | Contents |
|---|---|
| `docs/responsible-ai.md` | What crosses the wire, what the models refuse to do |
| `docs/data-schema.md` | Storage shape, the `nightOf` model, rollover, streaks |
| `docs/design-system.md` | Colour, type, spacing, component conventions |
| `docs/stack.md` | Stack decisions and the Render setup |
| `docs/tasks.md` | Build progress |
| `MyLumi_Plan.md` | The original project plan |

---

**MyLumi is not a diagnostic tool.** It does not diagnose, does not stage
recovery, and does not replace a clinician.
