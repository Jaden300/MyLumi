# Tasks — MyLumi

Phases follow [MyLumi_Plan.md](../MyLumi_Plan.md) §8 (tentative — reorder freely).

## Phase 1 — Foundation ✅

- [x] Vite + React scaffold, routing
- [x] Purple design system + tokens, dark/light mode
- [x] Local storage data layer + check-in schema
- [x] Lumi component with basic states (SVG placeholder)

## Phase 2 — Core Loop ✅

- [x] Night check-in flow, end to end (6 stepped screens)
- [x] Morning check-in flow, end to end (3 stepped screens)
- [x] Draft persistence — survives refresh mid-flow
- [x] Home dashboard showing today's state
- [x] Streaks + streak rescue
- [x] History view + entry detail
- [x] Symptom heat strip
- [x] "Your Data" page — export + delete (pulled forward from Phase 4)
- [x] Limitations / about page (pulled forward from Phase 4)
- [x] Unit + integration tests (71 passing)

## Phase 3 — Intelligence (next)

- [ ] Render backend scaffold + **deploy on day one of this phase**
- [ ] Symptom burden forecasting model
- [ ] Personal sleep–symptom correlation engine ← most demo-able, prioritize
- [ ] NLP sentiment analysis on journal text
- [ ] Anomaly detection
- [ ] Cold-start / "building your baseline" state

## Phase 4 — Insights & Responsible AI

- [ ] Daily recovery report
- [ ] Insights page + weekly summary
- [ ] Recovery trajectory chart
- [ ] Prediction explanations + confidence display
- [ ] Red-flag escalation logic
- [ ] Document what crosses the wire → `docs/responsible-ai.md` (seed: `toFeatureRow`)

## Phase 5 — Polish

- [ ] Full design pass — every screen finished
- [ ] Empty / loading / error states
- [ ] Accessibility pass (contrast, motion, tap targets, keyboard)
- [ ] Milestone celebrations
- [ ] Mobile responsiveness verification on real devices

## Phase 6 — Submission

- [ ] README with Render architecture + Responsible AI writeup
- [ ] Demo video
- [ ] Devpost submission targeting each track explicitly
- [ ] **Demo seed data** (`lib/demoSeed.js`) — dates relative to `now`, marked
      `meta.isDemoData`, one-click clearable. Judges must never see an empty app.

## Known gaps / deferred

- [ ] Real Lumi art — placeholder SVG in `components/lumi/Lumi.jsx` is one
      self-contained file, swap it when the Claude Design logo exists
- [ ] Chart library decision (currently hand-rolled heat strip)
- [ ] Self-host fonts instead of Google Fonts CDN
- [ ] Component tests (only lib/ is covered so far)
