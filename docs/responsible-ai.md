# Responsible AI - MyLumi

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
runs on Render - genuine regression, correlation and outlier detection, fit per
request - while the data at rest stays on the user's own device.

## Exactly what crosses the wire

Two endpoints send data, and they are kept separate on purpose.

### 1. Numeric insights - `POST /v1/insights`

Built by `toFeatureRow` in [`frontend/src/lib/derive.js`](../frontend/src/lib/derive.js),
the single documented chokepoint for outbound data. One row per sleep episode:

| Sent | Not sent |
|---|---|
| `nightOf` (a local date) | Name, email, any identifier |
| 9 PCSS symptom scores (0-6) | Device or session id |
| Aggregate symptom burden | IP-derived location |
| Mood, pre-sleep stress, sleep-aid flag | **All journal text** |
| Sleep duration, quality, awakenings, dream recall | Timezone history |
| Morning mood, energy, readiness | Streak or rescue history |
| Days since injury | Anything from `meta` or `profile` |

There is no field in the request schema that could carry free text; a backend
test (`test_numeric_endpoints_reject_journal_text`) and a frontend test
(`buildRows › carries no journal text into the payload`) both assert it.

**Nothing new was added to this table when the per-symptom, latent-state and
validation models were built.** Those models are built entirely on data that was
already being sent - in particular the nine PCSS items, which crossed the wire on
every request and which, until then, no model read. Sending nine per-symptom
clinical scores that nothing consumed was the sharpest inconsistency in a
privacy-first design. The app now does substantially more modelling while
transmitting *strictly less unused data*, which is the right direction for both
arguments at once.

`nightOf` is a date, and dates are the one quasi-identifying field here. It is
required because the models are time-series: ordering, gaps and adjacency all
depend on it. It is not paired with anything that identifies a person.

### 2. Journal sentiment - `POST /v1/nlp`

**Off by default. Nothing here is sent unless the user explicitly turns it on.**

Free text is the most sensitive content in the app, so it has its own endpoint,
its own request shape, and its own function in the API client. Built by
`buildJournalTexts` in [`frontend/src/lib/journal.js`](../frontend/src/lib/journal.js),
the second documented chokepoint - the mirror of `toFeatureRow`:

| Sent | Not sent |
|---|---|
| `nightOf` (a local date) | All 9 PCSS symptom scores |
| `day` - "describe your day" | Symptom burden, mood, stress |
| `factors` - what made it better or worse | Sleep duration, quality, awakenings |
| `wakeFeeling` - "how do you feel waking up" | Days since injury |
| | Name, email, any identifier |
| | Anything from `meta`, `profile`, or streaks |

The two builders cannot produce each other's shape: `toFeatureRow` has no field
that could carry text, and `buildJournalTexts` constructs its output key by key
and never spreads the entry. That is what makes "text never rides along on a
numeric call" a structural property rather than a convention. Tests assert both
directions - `journal › carries no numeric or clinical data into the payload` is
the exact inverse of `buildRows › carries no journal text into the payload`.

Text is scored in-process by an inspectable lexicon and discarded with the
request. It is never stored, never logged, and never used to train anything.

#### Consent

- **Off by default**, and stored *off by absence*: the pref is either
  `{granted: true, grantedAt}` or the key is not there. Revoking deletes it. A
  corrupted or partially-migrated prefs blob can never be misread as consent -
  every malformed shape falls through to "off".
- **Stored in `prefs`, not `data`**, exactly like red-flag dismissals. `data` is
  the clinical record and the export payload; a user handing an export to a
  clinician should not find their privacy settings in it.
- **The gate is in the hook, not the transport.** `lib/api.js` will send whatever
  it is handed - `useJournalInsights` is what refuses to call it without consent,
  and the docstring on `analyseJournal` says so plainly rather than claiming a
  guarantee that layer does not provide.
- **Revocable from the journal tone card at any time.** Consent is granted and
  revoked from the same place: the card on the insights page. The off switch
  renders on every branch of that card - including the offline and
  nothing-to-show states - so it is never reachable only when there happen to be
  results to show. Keeping it next to the feature it governs, rather than on a
  separate settings page, means the control is wherever the user notices the
  thing they want to stop.
- **Revocation is complete by construction.** Results live in React state and are
  never written to localStorage, so there is no derived-from-text data on disk to
  clean up. Turning it off clears the card and stops all further sending.
- **An in-flight request cannot be recalled**, and the copy does not pretend
  otherwise - it says "stops any further sending", not "recalls what was sent". A
  response arriving after revocation is discarded rather than displayed.
- **There is nothing server-side to delete**, because nothing was stored. The UI
  says that rather than offering a reassuring button that does nothing.

### 3. Nothing else

The only other outbound request in the entire app is the Google Fonts stylesheet.
No analytics, no trackers, no error reporting, no ad tech.

## What the models do

| Model | Method | Why this method |
|---|---|---|
| Forecast | Ridge regression on a lagged target, with a split-conformal interval | Standardised coefficients *are* the explanation - read off the fitted model, not reconstructed by a separate method that might disagree with the number it explains |
| Correlation | Spearman + threshold search, Holm-Bonferroni corrected | Rank-based, so robust to ordinal self-reports and to one catastrophic night |
| Anomaly | Robust z-score (median/MAD) | One very bad day must not inflate the threshold and hide the next one |
| Per-symptom | Mann-Whitney on composition shares + Theil-Sen trends, both Holm-corrected | Composition asks "bad in what way", not "how bad" - raw scores on a heavy day are all high, so comparing them only rediscovers that bad days are bad |
| Recovery state | Local-linear-trend Kalman filter with an RTS smoother | A self-report is a noisy reading of something unobservable; this estimates the thing rather than treating the reading as the truth |
| Validation | Rolling-origin (walk-forward) backtesting against a naive baseline | The only honest way to answer "is any of this better than guessing" |
| Sentiment | Weighted lexicon with negation and intensifiers | Fully auditable; every score decomposes into the words that produced it |

Deliberately *not* used: gradient boosting, neural networks, or any model whose
output cannot be explained to a patient in one sentence. A better score is not
worth an unexplainable number (`MyLumi_Plan.md` §10.2).

Also deliberately not used, and worth naming because each was built or costed
before being rejected:

- **PCA over the nine symptoms.** One component (overall severity) explains
  around 80% of the variance and the second is not distinguishable from noise by
  parallel analysis at the sample sizes this app has. Reporting a second axis
  anyway would be inventing a pattern.
- **Fitting the Kalman noise parameters by EM.** The textbook move, and at 10-40
  nights it collapses: it drove the process noise to its floor, over-smoothed,
  and produced an estimate *worse than the raw self-reports* in two of three
  trials. The signal-to-noise ratio is a stated clinical prior instead, and only
  the scale is estimated from the data. That version beat the raw reports in 24
  of 24 trials. A stated assumption that works beats a fitted parameter that
  does not, and it is far easier to explain.
- **Clustering nights into "phenotypes".** At these sample sizes the clusters
  are not stable across random seeds. A demo that shows different groupings on
  reload is not a finding.
- **Exponential recovery-curve fitting.** The only interesting thing to do with
  the fitted time constant is extrapolate it, and that is a recovery date.

### What the models measure about themselves

The forecast's interval used to be its in-sample residual spread times a
per-tier multiplier. Simulation showed that band did not mean what it said: the
`good` tier's 1.28, documented as "~80%", delivered about **51%** real coverage.
The most-confident tier was handing out the least honest interval.

It is now a split-conformal width taken from the model's own one-step-ahead
errors on the user's history. Measured the same way, held-out coverage went from
68% to 87% against an 80% target. The same errors produce the coverage figure
shown on the honesty card, so the band a user sees and the accuracy claimed
beside it can never disagree.

The honesty card reports the comparison against "tomorrow will be like today"
**whichever way it goes**. The losing copy is written and rendered exactly like
the winning copy, and a component test pins that. A validation layer that only
appears when the news is good is marketing, not validation.

## What the models refuse to do

**Refuse to speak too early.** Under 7 complete episodes, no number is emitted at
all - not a low-confidence estimate, nothing. A prediction from four nights looks
exactly as authoritative as one from forty and the user cannot tell them apart,
so withholding is the only honest option. The UI shows "Building your baseline"
with progress toward the threshold.

| Complete episodes | Tier | Behaviour |
|---|---|---|
| 0-6 | `none` | No prediction |
| 7-13 | `low` | Shown, explicitly labelled an early estimate, wide interval |
| 14-20 | `moderate` | Normal |
| 21+ | `good` | Full confidence |

The same threshold gates journal sentiment, counted in journal entries rather
than sleep episodes. A lexicon score over one entry is noise with a number
attached, and `available: true` beside `confidence: "none"` is a self-
contradictory answer - `none` means no number at all.

**Some models need more than seven, and ask for it.** Seven is the app's
minimum, not a licence for every model to speak at it. A model that needs more
data says so rather than answering thinly:

| Model | Floor | Why higher |
|---|---|---|
| Per-symptom rates | 10 nights with all 9 items rated | Nine simultaneous trend tests need more data than one |
| Recovery state | 10 logged nights | A slope from seven points has an error bar so wide the model would always say "steady" - a card that can never say anything is worse than no card |
| Validation | 12 usable pairs | Two out-of-sample errors do not establish an error rate |

Their confidence tiers scale with their own floor rather than reusing 14 and 21.
Otherwise a model needing 14 nights would advertise the top tier on only seven
more than its own minimum, on data with far more dimensions than the forecast
works in.

The per-symptom model also counts a stricter thing than the others - nights with
**all nine** items rated - and says so in its own words. Reusing the generic
copy would tell a user to log more nights when what they actually need is to
finish the symptom section.

**The rule is enforced on both sides.** The server decides what to compute; the
client refuses to render a prediction regardless of what a server sends. A rule
this important should not have a single point of failure, and a malformed or
unexpected response must never be able to put a number in front of a patient
that the data does not support.

**Refuse to invent data.** A missing answer stays `null` from the input through
storage to the feature row to the model. Rows lacking a needed feature are
*dropped* from a fit, never imputed, and each model reports the `n` it actually
used. A fabricated `0` would enter the clinical record as a real observation.

The state-space model is the one place this rule had to be expressed
differently, and it ends up making the point better than dropping a row does. It
runs over a continuous timeline, so a missed night is handled by advancing the
model's prediction with **no observation to correct it against**: the estimate
carries forward and its uncertainty *grows*. No reading is invented, and the
band on the chart visibly widens over the gap. The card says so in as many
words - "it is wider where nights are missing, because MyLumi knows less about
those days rather than filling them in" - and a test asserts the band after a
gap is strictly wider than before it.

That is the same rule the trajectory chart follows when it breaks its line
across unlogged nights, expressed the other way round: there, missing data means
no line; here, it means a visibly less certain one.

That `n` is the count actually **fitted**, not the number of episodes on file.
The forecast learns a night-to-next-night transition, so it can only train on
episodes that have a following night; reporting the episode count instead let a
model fit on a handful of pairs advertise the top confidence tier - and collect
the narrowest interval while doing it. The interval also carries a floor, so a
perfectly flat history reports a band rather than collapsing to a single number
that would read as certainty.

**Refuse to claim causation.** Findings are phrased "on days following…", never
"because of". A backend test asserts the causal vocabulary (`causes`, `due to`,
`makes your`) never appears in generated text.

**Refuse to over-report.** Testing four candidate features at p<0.05 produced a
finding on roughly **half** of pure-noise datasets in testing. Holm-Bonferroni
correction cuts that to about 20% while still catching 100% of genuine planted
effects. A patient told "your stress predicts your symptoms" on the strength of
noise is a real harm, not a cosmetic one.

**Refuse to alarm.** An unusual day is surfaced as "worth noting", never as a
setback or a relapse. A statistical outlier in nine self-reported numbers is not
a clinical event. Better-than-usual days are not flagged at all - telling someone
in recovery that their good day was "unusual" is a miserable thing to do.

**Refuse to predict a recovery date.** Ever. Trends and ranges only.

## Cold-start honesty

Before the threshold, the app shows general population context from the
concussion literature (symptoms often peak around days 3-5; most people improve
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
  presented alongside the numbers, never a substitute for them - and it only runs
  at all if the user explicitly turns it on. The card is deliberately the
  quietest in the app: a smaller sparkline with no gridlines or axis labels,
  placed below the sentence rather than above it, so a word-list score never
  looks as authoritative as the PCSS burden chart. The limits of a lexicon
  scorer are stated on the About page rather than under the card - see the note
  on consolidated caveats below.
- **Wall-clock sleep maths.** Durations spanning a daylight-saving change are an
  hour out; those nights are flagged and excluded from model fits rather than
  silently corrected.
- **Not a diagnostic tool.** MyLumi does not diagnose, does not stage recovery,
  and does not replace a clinician.

## Red-flag escalation stays local

Escalation guidance is rule-based and runs entirely in the browser
([`frontend/src/lib/redFlags.js`](../frontend/src/lib/redFlags.js)). That file
imports no API client, no storage and no React - a safety-critical prompt must
never depend on a network call to a service that may be asleep, unreachable, or
slow.

### What the app cannot see

MyLumi collects nine PCSS items, a mood VAS, and sleep ratings. It **cannot see**
the flags that matter clinically: vomiting, seizure, loss of consciousness,
unequal pupils, slurred speech, focal weakness, or someone who cannot be woken.
No rule over self-reported scores detects any of those.

So escalation is deliberately two separate things:

- **Passive guidance** - the real red-flag list, on the About page, always
  present and never gated on a rule firing. This matters more than the rules do:
  a rule that never fires must never read as an all-clear.
- **The rules below** - a calm prompt drawn from trajectory in the data we do
  have. The banner states the app's blindness in its own copy, and the action is
  always "mention this to someone", never "go to the ER". The app has no basis to
  triage anyone.

### The rules

| Rule | Fires on | Severity |
|---|---|---|
| `severe-headache-sustained` | headache ≥ 5 on 2 of the last 3 logged nights | prompt |
| `headache-escalating` | 4 logged nights, monotonically rising, +3 overall, ending ≥ 4 | prompt |
| `neuro-cluster` | nausea ≥ 4 **and** dizziness ≥ 4 **and** brain fog or concentration ≥ 4, same night | prompt |
| `burden-sustained-worsening` | last 7 nights average ≥ 9 points above the prior 7, and ≥ 20 | discuss |
| `no-improvement-late` | day ≥ 28, ≥ 10 nights logged, last 7 averaging ≥ 18 | discuss |

`prompt` means raise it promptly; it does **not** mean emergency, and the
severity is named `prompt` rather than `urgent` precisely so the copy is never
escalated to match a scarier label.

### What is deliberately not a rule

- **Low mood as a suicidality proxy.** A 0-100 slider is not a risk assessment.
  A false positive - telling someone the app thinks they are in crisis because a
  slider went low - is a serious harm, and a false negative is worse. Mood
  reaches the rules only through aggregate burden.
- **Anything firing on a single moderate reading.** A banner people learn to
  ignore protects nobody.
- **Anything firing on missing data.** A gap means nothing was reported, not that
  things got worse. A rule whose window contains a null does not fire at all
  rather than firing on partial evidence - the same discipline as dropping an
  incomplete row from a model fit instead of imputing it.

### Non-diagnostic by construction

No rule names a condition, and `no-improvement-late` in particular never says
"post-concussion syndrome" - that is a diagnosis. Generated copy describes the
observed data ("your headache ratings have been high"), never a conclusion
("your headache is worsening"). A test asserts the absence of that vocabulary.

Dismissal is stored in `prefs`, not in the clinical record, so it never appears
in an export. It is keyed to a signature of the firing condition, so a dismissed
banner returns as soon as a new check-in arrives that keeps the condition true.
There is no way to permanently silence a rule.

## Local-only insights

The weekly summary, the recovery trajectory chart and the daily report are
computed in the browser from the user's own entries. They need no endpoint, and
they keep working when the model service is asleep or was never deployed.

The trajectory chart draws the user's own line and a 7-night trailing mean, and
**breaks that line across nights that were not logged**. Interpolating a smooth
curve over a gap would invent values and show them back to the user as part of
their own record. `MyLumi_Plan.md` §3.4 suggests plotting burden against a
typical recovery curve; we deliberately do not. A second line invites "am I ahead
or behind?", which stages a person's recovery against a norm, and no honest
population curve exists at 0-54 PCSS resolution to draw. The population context
is stated on the About page, labelled as general population data, rather than
beside the chart.

## Where the caveats live

Every limitation in this document is still stated in the product, but in one
place rather than repeated under each card. The About page carries them:
self-report bias, association-not-causation, the seven-night floor, the limits
of a lexicon sentiment score, population context, and the fact that estimates
are estimates rather than medical predictions.

The reasoning is that a caveat under every chart stops being read. Fine print
repeated on six screens is scenery; a page someone can actually be pointed to is
a claim the product stands behind. What did **not** move:

- **The red-flag banner** and the emergency symptom list at `/about#red-flags`.
  Safety-critical copy is not consolidated anywhere - it appears at the moment it
  is relevant, on every screen.
- **Confidence badges and sample sizes** on each finding. Those are data about
  the finding, not prose about the product, and they belong next to the number
  they qualify.
- **Daylight-saving notes** on affected durations, which flag a specific number
  as possibly wrong rather than explaining the feature.
- **The refusal rules themselves.** Nothing about which findings render changed:
  under seven nights the app still emits no prediction at all.

## Verifying these claims

```bash
cd backend && .venv/bin/python -m pytest    # includes the privacy assertions
cd frontend && npm test                     # includes the payload assertions
```

Or read the three files that define the boundary:
[`frontend/src/lib/derive.js`](../frontend/src/lib/derive.js) (numeric payloads),
[`frontend/src/lib/journal.js`](../frontend/src/lib/journal.js) (text payloads and
the consent rule), and
[`frontend/src/lib/api.js`](../frontend/src/lib/api.js) (the only file that sends
anything anywhere).

## Demo data

The dashboard can load about three weeks of generated check-ins so the app can be
seen with data in it. Three things keep that honest:

- **Never automatic.** Silently writing fabricated clinical entries into someone's
  storage is the same act as imputing a missing symptom score, only larger. It
  takes a click, and it warns before replacing real entries.
- **Always labelled.** `meta.isDemoData` drives a banner on every screen while it
  is loaded. Nobody should be able to mistake generated data for their own.
- **The models still have to find the pattern.** The sleep-symptom relationship
  is planted in the generated *inputs*; no finding, forecast or p-value is
  hardcoded. The correlation engine discovers it through the same Holm-corrected
  path it uses on real data, or it reports nothing. A test pins the rank
  correlation so the demo cannot silently degrade into one where the headline
  feature finds nothing.
