# Tasks - MyLumi

Phases follow [MyLumi_Plan.md](../MyLumi_Plan.md) §8 (tentative - reorder freely).

## Phase 1 - Foundation ✅

- [x] Vite + React scaffold, routing
- [x] Purple design system + tokens, dark/light mode
- [x] Local storage data layer + check-in schema
- [x] Lumi component with basic states (SVG placeholder)

## Phase 2 - Core Loop ✅

- [x] Night check-in flow, end to end (6 stepped screens)
- [x] Morning check-in flow, end to end (3 stepped screens)
- [x] Draft persistence - survives refresh mid-flow
- [x] Home dashboard showing today's state
- [x] Streaks + streak rescue
- [x] History view + entry detail
- [x] Symptom heat strip
- [x] ~~"Your Data" page - export + delete~~ (built, then removed in the design
      pass - see the deviation note in `MyLumi_Plan.md`. Demo data moved to the
      dashboard; consent moved to the journal tone card)
- [x] Limitations / about page (pulled forward from Phase 4)
- [x] Unit + integration tests (71 passing)
- [x] Design pass: mesh background, grid layouts, decorative Lumi, caption removal

## Phase 3 - Intelligence ✅ (code complete - deploy outstanding)

- [x] FastAPI backend scaffold - stateless, `backend/`, 68 tests
- [x] Symptom burden forecasting model (ridge, explainable coefficients)
- [x] Personal sleep-symptom correlation engine ← Holm-corrected, quotable output
- [x] NLP sentiment analysis on journal text (separate endpoint + payload)
- [x] Anomaly detection (robust median/MAD)
- [x] Cold-start / "building your baseline" state
- [x] Frontend integration - `lib/api.js`, `useInsights`, insight cards
- [x] `docs/responsible-ai.md` (pulled forward from Phase 4)
- [ ] **Deploy to Render** - `render.yaml` ready, needs an account action.
      Then set `FRONTEND_ORIGINS` on the service and `VITE_API_URL` for the
      frontend build, and record the URL in `docs/stack.md`.

## Phase 3b - Depth pass on the models

The intelligence layer was real but narrow: five features, one aggregate target,
and no measurement of whether any of it worked. Three models added, all
numpy/scipy, all explainable.

- [x] **Per-symptom model** (`models/symptoms.py`) - the nine PCSS items were
      crossing the wire on every request and no model read them; `to_episodes`
      did not even copy them into `Episode.values`. Now: which symptoms take a
      larger share of the burden after a short night (Mann-Whitney on
      composition shares), and which are actually resolving (Theil-Sen with an
      interval that has to not straddle zero). Holm-corrected across all nine.
- [x] **Validation layer** (`models/validation.py`) - walk-forward one-step-ahead
      backtesting against the naive "tomorrow = today" baseline, reported to the
      user whichever way it goes.
- [x] **Latent recovery state** (`models/state.py`) - local-linear-trend Kalman
      filter with an RTS smoother, separating the underlying level from
      day-to-day self-report noise.
- [x] Three cards, hand-rolled SVG. Per-model confidence floors that scale their
      own tiers. Per-section try/except in the batched router.
- [ ] Stronger NLP - lexicon expansion, linguistic complexity as a cognitive-load
      proxy, symptom-term extraction with the text-vs-numbers agreement check
      done client-side. Deferred, not cut.

**On measuring before building.** Each model was prototyped against the
project's own data-generating process before being planned, and two candidates
were rejected on the evidence: PCA over the nine symptoms (one component
explains ~80% of the variance and the second is not distinguishable from noise
by parallel analysis at these sample sizes), and fitting the Kalman noise
parameters by EM (collapses at n=26 and loses to the raw self-reports in two of
three trials; the fixed-ratio prior wins 24 of 24).

**Three bugs this found, all measured rather than guessed at:**

1. The forecast interval was in-sample residual spread times a per-tier
   multiplier. The `good` tier's 1.28, documented as "~80%", delivered **51%**
   real coverage - the most-confident tier giving the least honest band.
   Split-conformal on out-of-sample errors takes held-out coverage from 68% to
   87% against an 80% target.
2. The state model estimated observation noise from night-to-night differences,
   which double-counts an oscillating series. On the demo data that came out
   2.2x the true residual spread and made a clear 6 points a week of recovery
   report as "steady".
3. The per-symptom rates required a confidence interval strictly excluding zero.
   On integer 0-6 ratings Theil-Sen's bound lands exactly on zero constantly:
   all nine symptoms survived Holm at p<0.01 with negative slopes and eight read
   "not clear yet".

Both 2 and 3 were false negatives found by running the models against the actual
demo seed rather than only against fixtures - worth doing before every demo.

## Phase 4 - Insights & Responsible AI ✅

- [x] Daily recovery report - shown on completing a morning check-in, not a route
- [x] Insights page + weekly summary - `/insights`, both computed locally
- [x] Recovery trajectory chart - hand-rolled SVG, no chart library
- [x] Wire the NLP endpoint into the UI + its consent gate
- [x] Red-flag escalation logic - **rule-based and local**, never a network call
- [x] Document what crosses the wire → `docs/responsible-ai.md`

**On the consent gate:** off by default and stored *off by absence* - the pref is
either `{granted: true}` or the key is missing, so no malformed blob can read as
consent. It lives in `prefs`, not `data`, so it never appears in a clinical
export (same rule as red-flag dismissals). The canonical control is the journal
tone card itself, which carries both the opt-in prompt and the off switch - the
off switch renders on every branch of that card, including the offline and
empty ones, so it is never reachable only when there are results to show. The gate is
enforced in `useJournalInsights`, not in `api.js` - and `analyseJournal`'s
docstring now says so, replacing a comment that claimed a guarantee that layer
never provided.

**On the sentiment card:** deliberately the quietest card in the app - a small
sparkline with no gridlines or axis labels, below the sentence rather than above
it. `responsible-ai.md` calls sentiment a secondary signal, so it must not look
as authoritative as the PCSS burden chart.

**On the trajectory chart:** `MyLumi_Plan.md` §3.4 asks for burden "vs. typical
recovery curve". We plot the user's line only. A second population line invites
"am I ahead or behind?", which stages recovery against a norm - and there is no
honest population curve at 0-54 PCSS resolution to draw. Population context is
text beneath the chart, matching how `BaselineProgress` already frames it.

## Phase 5 - Polish

- [x] Empty / loading / error states - plus a React error boundary, and a retry
      button wired to the `useInsights.reload` that was exported but unused
- [x] Accessibility pass (contrast, motion, tap targets, keyboard)
- [x] Milestone celebrations - `lib/milestones.js`, shown on the dashboard until
      acknowledged, not only in the post-check-in report
- [ ] Full design pass - every screen finished
- [ ] Mobile responsiveness verification on real devices

**What the a11y pass changed.** Motion and tap targets were already done; the
keyboard axis was the weak one:

- `RatingScale` and `SegmentedControl` were seven/four independent
  `aria-pressed` toggles - wrong semantics for a single-select, and up to seven
  tab stops per symptom. Now `role="radiogroup"` with `aria-checked`, roving
  tabindex (one tab stop per group) and arrow/Home/End navigation. The CSS
  selectors moved from `[aria-pressed]` to `[aria-checked]` with them.
- Skip link, using the `.sr-only` class that was defined but never used.
- Focus moves to `<main>` on route change and to the step region on check-in step
  change - React Router does neither, so a screen-reader user previously got no
  signal that anything had happened.
- Heat-strip cells are now links to that night's detail. The `title` attribute
  they relied on is the one tooltip mechanism that is neither keyboard-reachable
  nor shown on touch. `role="img"` moved off the container in the process -
  it makes an element a leaf, which would have hidden the new links.
- Inline `style={{fontSize}}` on seven headings replaced with `.h-size-*` classes.
  Heading *level* stays a structure decision; *size* is now a CSS one.

## Phase 6 - Submission

- [x] README with Render architecture + Responsible AI writeup
- [x] **Demo seed data** (`lib/demoSeed.js`) - dates relative to `now`, marked
      `meta.isDemoData`, one-click clearable, banner on every screen while loaded
- [ ] Demo video
- [ ] Devpost submission targeting each track explicitly

**On the demo seed:** deliberately not auto-loaded - silently writing fabricated
clinical entries into someone's storage is the same act as imputing a missing
score, only larger. The sleep-symptom effect is planted in the generated
*inputs*; nothing hardcodes a finding. This mattered: the first version produced
rho = -0.54 at p = 0.018, which the Holm correction correctly rejected across
four candidate features (needing p < 0.0125), leaving the demo's headline card
empty. Fixed by putting more signal in the data - six short nights instead of
three - never by lowering the statistical bar. Now rho = -0.63 at p = 0.004, and
a test pins it so it cannot silently regress.

## Known gaps / deferred

- [ ] Real Lumi art - placeholder SVG in `components/lumi/Lumi.jsx` is one
      self-contained file, swap it when the Claude Design logo exists
- [ ] Self-host fonts instead of Google Fonts CDN
- [ ] Component tests (only lib/ is covered so far). This is the real risk in the
      a11y work above: the radiogroup conversion changed the most-used input in
      the app and is verified only by a manual keyboard pass. Adding
      `@testing-library/react` + jsdom is the fix.
- [x] Chart library decision - settled: hand-rolled SVG throughout (heat strip,
      trajectory, sentiment sparkline). A library would be the largest dependency
      in the project, and its palette, tooltips and a11y output would all have to
      be fought.
