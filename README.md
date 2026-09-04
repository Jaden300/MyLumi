<p align="center">
  <img src="docs/assets/wordmark.svg" alt="MyLumi" width="340">
</p>

<p align="center">
  <strong>A concussion-recovery journal that learns your own sleep-symptom pattern, and refuses to guess.</strong>
</p>

<p align="center">
  <a href="#running-it"><img alt="React 19" src="https://img.shields.io/badge/React-19-4C1D95?style=flat-square&logo=react&logoColor=white"></a>
  <a href="#running-it"><img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-stateless-D6249F?style=flat-square&logo=fastapi&logoColor=white"></a>
  <img alt="Tests" src="https://img.shields.io/badge/tests-831%20passing-4ADE80?style=flat-square">
  <img alt="Local first" src="https://img.shields.io/badge/data-local%20first-4C1D95?style=flat-square">
</p>

<p align="center">
  <em>Hack for Humanity 2026</em>
</p>

---

Twice a day, once before bed and once after waking, MyLumi asks about symptoms,
mood, pain and sleep. Over a few weeks it learns *this person's* relationship
between sleep and symptom burden, forecasts tomorrow, grades its own forecast
against history, and surfaces correlations nobody would notice by hand. Every
check-in stays in the browser.

---

## Why this exists

Sleep is one of the few genuinely modifiable factors in concussion recovery, and
post-concussion mental health - irritability, low mood, brain fog - is badly
underserved. Recovery is also invisible: symptoms fluctuate day to day, so
progress over weeks is almost impossible to feel. MyLumi sits at that
intersection.

The users have photophobia and cognitive fatigue. That is a design constraint,
not a persona detail: restrained visuals, one action per screen, no flashing, no
idle motion, and a dark mode that is the primary experience rather than an
afterthought.

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
- An unmarked pain region is not a `0` either. It is **absent from that region's
  series**, because the record cannot distinguish "my neck was fine" from "I did
  not mark my neck", and reading the absence as zero would manufacture
  recoveries nobody reported.
- The trajectory chart **breaks its line across unlogged nights** rather than
  interpolating. Drawing a smooth curve over a gap invents a value and shows it
  back to the user as part of their own record.
- Correlations are Holm-Bonferroni corrected across the seven candidate
  features, and the per-symptom models correct across all nine PCSS items.
  Uncorrected testing at p<0.05 produced a "finding" on roughly **half** of
  pure-noise datasets in testing; correction cuts that to about 20% while still
  catching 100% of planted effects.
- **The forecast grades itself.** A walk-forward backtest refits the real model
  on nights `0..t-1` to score night `t`, compares it against "tomorrow will be
  like today", and shows the result whichever way it goes. That is also how the
  prediction interval got fixed: the old per-tier multipliers advertised ~80%
  coverage and delivered ~51%, and were replaced with a conformal width built
  from the model's own out-of-sample errors.
- Some models need more than the app's 7-night floor before they will speak at
  all - the latent-state model waits for 10 nights, the backtest for 12, the
  writing-change model for 18. Asking for more is allowed; the 7 is a minimum
  for the app, not a licence for every model to speak at it.
- No recovery dates, ever. No diagnoses. No population curve to measure yourself
  against.

`docs/responsible-ai.md` is the full account, written alongside the API rather
than reconstructed afterwards.

---

## Architecture

```
Browser (React + Vite)                    Render (FastAPI, stateless)
├── localStorage ....... the clinical     ├── POST /v1/insights   every numeric
│                        record. Never    │                       model, batched
│                        leaves.          ├── POST /v1/forecast   ─┐
├── lib/derive.js ...... numeric          ├── POST /v1/correlation │
│                        chokepoint  ──►  ├── POST /v1/anomaly     │ the same
├── lib/journal.js ..... text             ├── POST /v1/symptoms    │ models,
│                        chokepoint  ──►  ├── POST /v1/validation  │ individually
│                                         ├── POST /v1/state      ─┘
├── lib/redFlags.js .... safety rules ─┐  ├── POST /v1/nlp        journal text
├── lib/painTrajectory.js per-region   ├─ never a network call     (consent-gated)
└── lib/agreement.js ... text vs numbers┘  └── GET  /health
```

**Two chokepoints, on purpose.** `toFeatureRow` builds numbers and has no field
that could carry text; `buildJournalTexts` builds text and has no field that
could carry a score. Neither can produce the other's shape, so "journal text
never rides along on a numeric call" is a structural property rather than a
convention. Tests assert both directions.

**Render does real work.** Per request, on data it then throws away, the service
fits a ridge regression, runs Spearman correlations with threshold search,
computes robust median/MAD outlier detection, tests per-symptom composition
shifts and Theil-Sen recovery rates across all nine PCSS items, runs a
walk-forward backtest of its own forecast, and estimates a latent recovery state
with a hand-rolled Kalman filter and RTS smoother. No database exists. Request
bodies are never logged, and `app/main.py` says so at the top in capitals.

`/v1/insights` batches all six numeric models into one request - a cold free-tier
instance is then woken once rather than six times, and every card on a screen
describes the same snapshot. Each model is called through a wrapper that turns an
unexpected failure into that model's own "unavailable" envelope, so one broken
model cannot blank the five that worked. The individual endpoints remain for
debugging and for the API docs at `/docs`.

**Three things run in the browser precisely because they could not run on the
server honestly.** `lib/painTrajectory.js` models each body region, because
region names never cross the wire. `lib/agreement.js` compares what someone
*wrote* against what they *rated*, because the server must never hold text and
scores in the same request. `lib/redFlags.js` is safety-critical and imports no
API client, no storage and no React - a safety prompt must not depend on a
free-tier service that might be asleep.

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
daily report, streaks, history, the whole pain-insights page and the red-flag
rules are all computed locally. Only the model-backed cards go quiet, and they
say so honestly rather than rendering nothing.

```bash
cd frontend && npm test                    # 608 tests
cd backend && .venv/bin/python -m pytest   # 223 tests
```

The frontend also carries `npm run verify` - lint, a typographic style guard, the
test suite, a production build, and a bundle check asserting three.js has not
leaked out of its dynamic import into the entry chunk.

The suites include the privacy assertions: that journal text never enters a
numeric payload, that numeric data never enters a text payload, that body region
names never leave the device, that `lib/api.js` is still the only `fetch` in the
app, and that no generated copy uses causal vocabulary.

### The check-in loop

Night is seven steps and about two minutes: nine PCSS symptoms split three to a
screen (nine sliders at once is a wall of input for someone with cognitive
fatigue), then the pain map, mood, an always-optional journal, and sleep intent.
Morning is three steps - waking, sleep quality, and how the day is starting -
deliberately shorter, because it runs at the worst possible moment to ask for
sustained attention.

Neither flow takes a date parameter. The target night is always derived, so there
is no route through the app that backfills a past night.

### The 3D body model

`frontend/public/models/body.glb` is a Mixamo mannequin (Adobe, free with an
account), converted from FBX with `FBX2glTF` and checked in at 1.8MB. It is
gender-neutral and untextured by design - the app tints it to one flat colour,
because a body diagram someone taps while symptomatic should not also be a
character.

Body regions are resolved from the model's **rig**, not from separate per-part
meshes. A raycast hit carries the three vertex indices of the triangle it struck,
every vertex is weighted to the bones that move it, and summing those weights
names the body part. That matters because no pre-segmented body-*region* model
exists to download: the open anatomical datasets are carved into individual
femurs and organs, which is not how a person points at where they hurt.

Three small tables in `lib/painRegions.js` do the mapping and are worth reading
together: exact bone names for the obvious cases, longest-prefix rules that fold
a hand's twenty finger bones into one region, and **joint pairs** - because a
knee has no bone of its own. A knee *is* the boundary between two bones, so a hit
with two strong influences is a hit on the joint between them, and the pair
identifies which.

The same weights drive the hover highlight. Resolving a region per vertex is the
identical computation, so it is done once when the model loads and cached as a
region index per vertex; hovering then only rewrites a colour buffer. Pointing
at the body lights the region a tap would take and names it, so a mis-aimed tap
is visible before it becomes an entry rather than after. Marked regions stay
shaded in a deeper violet - a different direction from the hover lift, not a
second brightness step, because "what a tap would take" and "what is already
recorded" are different statements and are usually on screen together. Neither
uses a severity colour: shading a region red would be the app asserting how bad
it is before the user has rated it.

Swapping the model is therefore just replacing the file - any standard humanoid
skeleton works. If a replacement's bones are named differently, a dev-mode
warning on the canvas names the rig's bones and points at the table to extend,
because a rig this app does not recognise otherwise produces a body that
silently ignores every tap.

**Everything works without the file.** The model is a faster way to reach the
regions, not the only way. The region list below it carries the whole feature,
is what renders when WebGL is missing or the file fails to load, and is the only
way to reach a few regions at all - this model's joints are rigid ball spheres
with no weight blending, so its elbows, knees and hips are not distinguishable
by tapping. It is also the accessibility path, since a WebGL canvas has no
keyboard interaction of its own; the canvas is `aria-hidden` for exactly that
reason.

### What the pain map says back

`/pain` is the other half of the pain feature: a timeline of the body over the
last 60 days, per-region trends, a table, and a chart of what the model projected
against what the user went on to report.

All of it computes on the device. Each region gets a Theil-Sen slope with a
confidence interval, so a region whose trend cannot be told apart from flat
reports exactly that instead of being handed a direction it has not earned. With
too little of a user's own data, the projection shrinks toward a single generic
recovery curve - one shape, applied identically to every body region, built from
the only two population figures this project is willing to state. There is no
hip-specific decay constant, because publishing one would produce a number that
looks like a citation and is not one.

There is no function anywhere in that file that returns a number of days. "Your
hip pain will last about nine more days" is a recovery date with a different noun
on it.

### Seeing it with data

There is a **Load demo data** button at the foot of the dashboard - about three
weeks of generated check-ins, from a seeded PRNG so the demo is identical on
every machine and every reload. It is never loaded automatically: silently
writing fabricated clinical entries into someone's storage is the same act as
imputing a missing score, only larger. While it is loaded, every screen says so.

The demo's sleep-symptom relationship is planted in the *inputs*, not asserted in
the output. The correlation engine discovers it by the same Holm-corrected path
it uses on real data, and a test pins the rank correlation so the demo can't
silently degrade into one where MyLumi's headline feature finds nothing.

---

## Deployment status

`render.yaml` in the **repository root** defines both services - `mylumi-api`
(FastAPI, free tier, health check at `/health`) and `mylumi-web` (the Vite build
as a static site, with the SPA rewrite and the security headers). It has to live
at the root - that is where Render looks for a Blueprint - and each service
points at its own subdirectory via `rootDir`.

**It is not yet deployed** - that needs an account action. In order:

1. Create the Blueprint from the root `render.yaml`. Both services come up.
2. Set **`VITE_API_URL`** on `mylumi-web` to the `mylumi-api` URL, then redeploy
   it. Vite inlines this at build time, so setting it without a rebuild changes
   nothing.
3. **Set `FRONTEND_ORIGINS`** on `mylumi-api` to the `mylumi-web` URL, comma
   separated for more than one. It is `sync: false`, so it starts unset - and
   because an unset allowlist would leave CORS at localhost only, **the API now
   refuses to start** on Render rather than coming up and having every browser
   request blocked. A config mistake wearing a network outage's clothes used to
   be the single easiest way to arrive at a demo with a backend that is up and
   an app that looks broken; now it fails loudly at boot instead.
4. Record both URLs in `docs/stack.md`.

Note the API pins Python 3.11 while local development may be on 3.10; run the
backend suite under 3.11 before relying on a green local run.

The static site never sleeps, so the app itself always loads instantly. The API
does sleep after ~15 minutes and takes ~50s to wake, so the frontend pings
`/health` on mount and shows honest "waking up the model service" copy rather
than a spinner that looks broken. During the event, an external cron job
(cron-job.org) hits `/health` every 10 minutes so it never sleeps at all.

---

## Tracks

| Track | Where to look |
|---|---|
| Responsible AI | `docs/responsible-ai.md`; the About page's limitations; the 7-night refusal; the self-grading backtest |
| Best Use of Render | `render.yaml` - both services, one blueprint; six real models, stateless, no database |
| Best Use of AI/ML | Ridge forecast, Spearman + Holm correlation, MAD anomaly, per-symptom Theil-Sen rates, walk-forward validation, Kalman + RTS latent state, lexicon NLP |
| Mental Health | Mood VAS, irritability and brain-fog tracking, journal sentiment |
| Physical Health | 9 PCSS items, sleep duration and quality, awakenings, the 3D pain map |
| Concussion Recovery | The entire product |
| Best Design | `docs/design-system.md`; dark-first, built for photophobia |

## Docs

Read the relevant one - they are not meant to be loaded all at once.

| File | Contents |
|---|---|
| `docs/responsible-ai.md` | What crosses the wire, what the models refuse to do |
| `docs/data-schema.md` | Storage shape, the `nightOf` model, rollover, streaks |
| `docs/design-system.md` | Colour, type, spacing, component conventions |
| `docs/stack.md` | Stack decisions and the Render setup |
| `docs/workflow.md` | How we work, and the writing conventions the style guard enforces |
| `docs/lumi-brief.md` | Lumi, the mascot |
| `docs/tasks.md` | Build progress, and a running log of what running the code caught that reading it did not |

`backend/README.md` and `frontend/README.md` go a level deeper into each half.

---

**MyLumi is not a diagnostic tool.** It does not diagnose, does not stage
recovery, and does not replace a clinician.
