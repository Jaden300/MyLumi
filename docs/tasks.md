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

## Phase 3 — Intelligence ✅ (code complete — deploy outstanding)

- [x] FastAPI backend scaffold — stateless, `backend/`, 68 tests
- [x] Symptom burden forecasting model (ridge, explainable coefficients)
- [x] Personal sleep–symptom correlation engine ← Holm-corrected, quotable output
- [x] NLP sentiment analysis on journal text (separate endpoint + payload)
- [x] Anomaly detection (robust median/MAD)
- [x] Cold-start / "building your baseline" state
- [x] Frontend integration — `lib/api.js`, `useInsights`, insight cards
- [x] `docs/responsible-ai.md` (pulled forward from Phase 4)
- [ ] **Deploy to Render** — `render.yaml` ready, needs an account action.
      Then set `FRONTEND_ORIGINS` on the service and `VITE_API_URL` for the
      frontend build, and record the URL in `docs/stack.md`.

## Phase 4 — Insights & Responsible AI

- [ ] Daily recovery report
- [ ] Insights page + weekly summary
- [ ] Recovery trajectory chart
- [ ] Wire the NLP endpoint into the UI + its consent gate (backend + client done)
- [ ] Red-flag escalation logic — **rule-based and local**, never a network call
- [x] Document what crosses the wire → `docs/responsible-ai.md`

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
