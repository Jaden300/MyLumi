# Responsible AI — MyLumi

> What leaves the device, what the models do, and what they refuse to do.
> Written alongside the API rather than reconstructed afterwards.

## The architecture, in one paragraph

MyLumi is local-first. Every check-in lives in the browser's localStorage; there
is no account, no user id, and no server-side copy of the clinical record. The
inference service on Render is **stateless**: the browser posts a de-identified
numeric snapshot, a model is fit on it, an answer comes back, and the request is
discarded. Nothing is written to disk, no database exists, and payloads are never
logged.

This is deliberately a stronger arrangement than a conventional backend. Real ML
runs on Render — genuine regression, correlation and outlier detection, fit per
request — while the data at rest stays on the user's own device.

## Exactly what crosses the wire

Two endpoints send data, and they are kept separate on purpose.

### 1. Numeric insights — `POST /v1/insights`

Built by `toFeatureRow` in [`frontend/src/lib/derive.js`](../frontend/src/lib/derive.js),
the single documented chokepoint for outbound data. One row per sleep episode:

| Sent | Not sent |
|---|---|
| `nightOf` (a local date) | Name, email, any identifier |
| 9 PCSS symptom scores (0–6) | Device or session id |
| Aggregate symptom burden | IP-derived location |
| Mood, pre-sleep stress, sleep-aid flag | **All journal text** |
| Sleep duration, quality, awakenings, dream recall | Timezone history |
| Morning mood, energy, readiness | Streak or rescue history |
| Days since injury | Anything from `meta` or `profile` |

There is no field in the request schema that could carry free text; a backend
test (`test_numeric_endpoints_reject_journal_text`) and a frontend test
(`buildRows › carries no journal text into the payload`) both assert it.

`nightOf` is a date, and dates are the one quasi-identifying field here. It is
required because the models are time-series: ordering, gaps and adjacency all
depend on it. It is not paired with anything that identifies a person.

### 2. Journal sentiment — `POST /v1/nlp`

Free text is the most sensitive content in the app, so it has its own endpoint,
its own request shape, and its own function in the API client. It can never ride
along as a side effect of a numeric call — the two payload types are structurally
incompatible.

Text is scored in-process by an inspectable lexicon and discarded with the
request. It is never stored, never logged, and never used to train anything.

### 3. Nothing else

The only other outbound request in the entire app is the Google Fonts stylesheet.
No analytics, no trackers, no error reporting, no ad tech.

## What the models do

| Model | Method | Why this method |
|---|---|---|
| Forecast | Ridge regression on lagged features | Standardised coefficients *are* the explanation — read off the fitted model, not reconstructed by a separate method that might disagree with the number it explains |
| Correlation | Spearman + threshold search, Holm–Bonferroni corrected | Rank-based, so robust to ordinal self-reports and to one catastrophic night |
| Anomaly | Robust z-score (median/MAD) | One very bad day must not inflate the threshold and hide the next one |
| Sentiment | Weighted lexicon with negation and intensifiers | Fully auditable; every score decomposes into the words that produced it |

Deliberately *not* used: gradient boosting, neural networks, or any model whose
output cannot be explained to a patient in one sentence. A better score is not
worth an unexplainable number (`MyLumi_Plan.md` §10.2).

## What the models refuse to do

**Refuse to speak too early.** Under 7 complete episodes, no number is emitted at
all — not a low-confidence estimate, nothing. A prediction from four nights looks
exactly as authoritative as one from forty and the user cannot tell them apart,
so withholding is the only honest option. The UI shows "Building your baseline"
with progress toward the threshold.

| Complete episodes | Tier | Behaviour |
|---|---|---|
| 0–6 | `none` | No prediction |
| 7–13 | `low` | Shown, explicitly labelled an early estimate, wide interval |
| 14–20 | `moderate` | Normal |
| 21+ | `good` | Full confidence |

**Refuse to invent data.** A missing answer stays `null` from the input through
storage to the feature row to the model. Rows lacking a needed feature are
*dropped* from a fit, never imputed, and each model reports the `n` it actually
used. A fabricated `0` would enter the clinical record as a real observation.

**Refuse to claim causation.** Findings are phrased "on days following…", never
"because of". A backend test asserts the causal vocabulary (`causes`, `due to`,
`makes your`) never appears in generated text.

**Refuse to over-report.** Testing four candidate features at p<0.05 produced a
finding on roughly **half** of pure-noise datasets in testing. Holm–Bonferroni
correction cuts that to about 20% while still catching 100% of genuine planted
effects. A patient told "your stress predicts your symptoms" on the strength of
noise is a real harm, not a cosmetic one.

**Refuse to alarm.** An unusual day is surfaced as "worth noting", never as a
setback or a relapse. A statistical outlier in nine self-reported numbers is not
a clinical event. Better-than-usual days are not flagged at all — telling someone
in recovery that their good day was "unusual" is a miserable thing to do.

**Refuse to predict a recovery date.** Ever. Trends and ranges only.

## Cold-start honesty

Before the threshold, the app shows general population context from the
concussion literature (symptoms often peak around days 3–5; most people improve
substantially within about four weeks), explicitly labelled *"general population
data, not a prediction about you"*. The distinction is in the visible copy, not
merely implied.

## Failure is honest too

When the Render service is unreachable, the app says so plainly and notes that
the user's data is unaffected. It does not fall back to a locally-computed
estimate presented as though it came from the model, and it does not silently
show stale results. "We can't tell you right now" and "we don't have enough data
yet" use the same envelope and the same UI path.

## Known limitations

State these plainly; they are in the in-app About page too.

- **One user's self-reports.** The model learns only from this person's own data.
  It has no population prior and no clinical measurements.
- **Self-reporting is noisy.** Mood and symptom ratings shift with memory,
  expectation, and how the day happened to end.
- **Correlation is not causation.** Many things affect symptoms, and MyLumi only
  sees what it is told. Sleep and symptoms may both be driven by something the
  app never observes.
- **Small samples.** Even at 30 nights these are small-n statistics. The
  confidence tiers reflect that but cannot eliminate it.
- **Sentiment analysis cannot read context.** A lexicon scorer misses sarcasm,
  negation it wasn't built for, and personal idiom. It is a *secondary* signal
  presented alongside the numbers, never a substitute for them.
- **Wall-clock sleep maths.** Durations spanning a daylight-saving change are an
  hour out; those nights are flagged and excluded from model fits rather than
  silently corrected.
- **Not a diagnostic tool.** MyLumi does not diagnose, does not stage recovery,
  and does not replace a clinician.

## Red-flag escalation (Phase 4) stays local

Escalation guidance for severe or worsening symptoms will be rule-based and run
entirely in the browser. A safety-critical warning must never depend on a network
call to a service that may be asleep, unreachable, or slow.

## Verifying these claims

```bash
cd backend && .venv/bin/python -m pytest    # includes the privacy assertions
cd frontend && npm test                     # includes the payload assertions
```

Or read the two files that define the boundary:
[`frontend/src/lib/derive.js`](../frontend/src/lib/derive.js) (what is built) and
[`frontend/src/lib/api.js`](../frontend/src/lib/api.js) (the only file that sends
anything anywhere).
