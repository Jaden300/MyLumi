# MyLumi — Project Plan

> **For the Claude Code agent reading this:** This is a planning and context document, not a spec to execute literally. Read the whole thing before writing code. The build plan at the bottom is **TENTATIVE** — see the warning there.

---

## 1. Competition Context

**Hack for Humanity 2026** — a one-month hackathon where teams build software (app, website, or game) that improves **mental or physical well-being**, with an optional focus on AI. The stated goal is to use technology to make meaningful changes in humanity by addressing health concerns.

### Tracks we are deliberately targeting

| Track | How MyLumi qualifies |
|---|---|
| **Best Mental Health Tool** ($100) | Core product is mood + symptom journaling for post-concussion mental health |
| **Best Physical Health Tool** | Sleep tracking and physical symptom burden (headache, nausea, dizziness, fatigue) |
| **Best Tech for Concussion Recovery** | The entire product is concussion-specific |
| **Responsible AI** | Local-first data, transparent models, no black boxes, explicit non-diagnostic framing — see §4 |
| **Best Use of Render** | Backend API + ML inference deployed on Render |
| **Best Use of AI / ML** | Multivariate time-series forecasting + NLP on journal text + personal correlation discovery + anomaly detection |
| **Best Design** ($500) | Purple, simplistic, clinical-grade UI — see §6 |
| **GWC Future Innovator** | Student-led team |
| **Best Innovation & Creativity** | Novel angle: nobody is doing sleep-linked journaling for post-concussion recovery |

### Tracks we are NOT optimizing for
- **Public Voting** — this is a social-mobilization game, not a product-quality game. Ignore it.

**Strategic doctrine:** one well-executed project that is *genuinely* eligible across many tracks beats a project laser-focused on one. Every feature decision should be checked against "does this strengthen our claim on a track?"

---

## 2. The Product in One Paragraph

**MyLumi** is a web app for people recovering from a concussion. Twice a day — once before bed, once after waking — the user completes a short (~2 minute) structured check-in covering their symptoms, mood, and sleep. Over time, MyLumi's models learn the user's *personal* relationship between sleep and symptom burden, forecast tomorrow's symptom severity, surface correlations the user would never notice manually, and flag anomalous days that may signal a setback. **Lumi**, the mascot, guides the user through the experience and makes a clinical process feel warm and sustainable.

**The core insight:** sleep is one of the strongest modifiable factors in concussion recovery, and post-concussion mental health (irritability, low mood, anxiety, brain fog) is badly underserved. MyLumi sits exactly at that intersection.

---

## 3. Core Feature Set

### 3.1 Night Check-In (~2 minutes)

**Symptom ratings — 0–6 scale (PCSS clinical standard):**
1. Headache intensity
2. Light sensitivity (photophobia)
3. Noise sensitivity (phonophobia)
4. Brain fog / mental clouding
5. Nausea
6. Dizziness
7. Fatigue
8. Mood disturbance (irritability / sadness)
9. Concentration difficulty

**Additional inputs:**
- Mood on a validated-style visual analog scale
- Free text: *"Describe your day."*
- Free text: *"Anything that made your symptoms better or worse today?"*
- Sleep intention: planned bedtime
- Pre-sleep stress level (1–5)
- Sleep aid used (yes/no)

### 3.2 Morning Check-In (~2 minutes)

- Sleep duration (derived from bedtime + wake time)
- Wake time
- Number of nighttime awakenings (0 / 1 / 2 / 3+)
- Sleep quality (0–6)
- Dream recall (yes/no)
- Morning mood (0–6)
- Morning energy (0–6)
- Readiness for the day (0–6)
- Free text: *"How do you feel waking up?"*

### 3.3 The Intelligence Layer (AI/ML)

This is a headline track. It must be real, not decorative.

**a) Symptom burden forecasting**
A multivariate time-series model — **not** a naive single-variable regression. Inputs: all 9 symptom scores, sleep duration, sleep quality, awakenings, stress, mood, energy, readiness. Output: predicted aggregate symptom burden for tomorrow, with a confidence band.

**b) NLP on journal text**
Sentiment analysis and linguistic feature extraction across free-text entries over time, used as a **secondary recovery signal** alongside the numeric data. Track sentiment trajectory across days.

**c) Personal sleep–symptom correlation engine**
Learns *this specific user's* thresholds. The output should read like: *"Your symptom burden rises sharply on days following under 6.5 hours of sleep."* This is the most quotable, demo-able feature in the product — prioritize it.

**d) Anomaly detection**
Flags days where the user's pattern breaks unexpectedly, surfaced gently as a possible setback signal worth noting.

**e) Cold-start handling**
Before ~7 days of data, models cannot say anything meaningful. Show an explicit **"Building your baseline"** state. Seed against published concussion recovery baselines (symptom severity typically peaks around days 3–5; most cases resolve within ~28 days) so day-one users still see useful context. **Never fabricate a prediction to fill space.**

### 3.4 Insights & Reporting

- **Daily recovery report** shown each morning after check-in
- **Weekly insight summary** — worst symptom this week, best/worst sleep nights, notable correlations
- **Recovery trajectory chart** — symptom burden over time vs. typical recovery curve
- **Recovery milestones** — e.g. *"14 days logged — your model is now personalized."*

### 3.5 Engagement

- **Streaks** — reset on a missed day
- **Streak Rescue** — one free rescue per month, so a single bad day doesn't destroy motivation. Concussion patients have genuinely bad days; punishing them is both cruel and bad retention design.
- **Milestone celebrations** — recovery is invisible and demoralizing; make progress feel real

---

## 4. RESPONSIBLE AI — **THIS IS A PRIORITY, NOT A FOOTNOTE**

We are competing directly for the **Responsible AI** track. This must be visible in the product itself, not buried in a README. Judges need to *see* it while using the app.

### Hard requirements

**Privacy & data safety**
- **Local-first by default.** All check-in data lives in browser local storage. No account required to use the app.
- **No third-party analytics. No trackers. No ad tech.** None.
- Any data sent to the backend for inference is sent **without personal identifiers**.
- A visible, plain-language **"Your Data" page** explaining exactly what is stored, where, and for how long.
- A working **Export My Data** button (JSON download).
- A working **Delete All My Data** button that actually wipes everything, with confirmation.

**Model transparency**
- Every prediction shows **why** — which inputs drove it. No unexplained numbers.
- Every prediction shows a **confidence level**. Low-confidence predictions must say so.
- The app must clearly state when it does **not** have enough data to say anything.

**Clinical safety framing**
- **MyLumi is not a diagnostic tool and must never present itself as one.** This needs to be stated clearly and repeatedly — onboarding, the insights page, and the footer.
- Persistent guidance to consult a healthcare professional.
- **Red-flag escalation:** if the user reports severe or worsening symptoms (e.g. escalating headache, repeated vomiting, worsening confusion), the app should surface clear, non-alarmist guidance to seek medical attention. This is a genuine safety obligation, and it is also exactly the kind of thing Responsible AI judges look for.
- Never predict a specific recovery date. Trends and ranges only. Overpromising a recovery timeline is both clinically irresponsible and a credibility risk.

**Bias & limitation honesty**
- A short, honest **Limitations** section in-app: the model learns from one user's self-reported data, self-reporting is noisy, and the app cannot see anything it isn't told.

---

## 5. Render Deployment

We are competing for **Best Use of Render**, so Render should be doing real work, not just hosting a static page.

- **Backend API on Render** — check-in submission, model inference endpoints, insight generation
- **ML inference on Render** — forecasting, NLP, correlation, anomaly detection
- Frontend can be static-hosted; the intelligence lives on Render
- If accounts get built (optional extension), a Render Postgres instance handles persistence
- Document the Render architecture in the README for the judges

---

## 6. Design Direction

### Visual identity
- **Primary colour: purple.** Calm, clinical-but-warm, not corporate-blue and not wellness-app-pastel.
- **Simplistic.** Generous whitespace, few elements per screen, one clear action at a time.
- This matters practically: the users are concussion patients with **light sensitivity and cognitive fatigue**. A busy, high-contrast, cluttered UI is literally painful for them. Restraint here is a *clinical* design decision, not just an aesthetic one — and that story is worth telling in the submission.
- Dark mode is close to a hard requirement for this user group, not a nice-to-have.
- Large tap targets, readable type, minimal animation, no flashing.

### Lumi (mascot)
- Lumi guides the user through check-ins and delivers insights
- Warm, encouraging, never patronizing, never falsely cheerful about bad days
- Lumi is the thing that makes a clinical product feel human — this is a real differentiator for **Best Design** and **Innovation**

### **REMINDER: Use proper clinical terminology throughout**
Use the real medical vocabulary where it is accurate — *photophobia*, *phonophobia*, *symptom burden*, *post-concussion syndrome*, *cognitive load*, *recovery trajectory*, *PCSS (Post-Concussion Symptom Scale)*. This makes the product read as credible and clinical-grade rather than as a generic wellness app.

**Important:** use these terms *correctly* and pair them with plain-language explanations. Terminology used accurately builds credibility with judges; terminology sprinkled in as decoration reads as hollow to anyone with a medical background — and health hackathons often have clinical judges. Accuracy is the whole point.

### **REMINDER: The UI needs to be genuinely good**
Best Design is a $500 cross-track prize. Polish is not optional. Every screen should look finished.

---

## 7. Component List (what ships in the final product)

**Pages / Views**
- Onboarding + injury date entry
- Home / dashboard (today's status, Lumi, streak, next check-in prompt)
- Night check-in flow
- Morning check-in flow
- Daily recovery report
- Insights page (correlations, trends, weekly summary)
- Recovery trajectory chart view
- History / past entries
- "Your Data" privacy & control page
- Limitations / about page

**Components**
- Symptom slider (0–6, accessible)
- Visual analog mood scale
- Free-text journal input
- Sleep time pickers
- Check-in progress indicator
- Lumi character component (multiple states/expressions)
- Streak display + streak rescue UI
- Prediction card (value + confidence + explanation)
- Correlation insight card
- Anomaly / setback flag card
- Red-flag medical escalation banner
- Recovery trajectory chart
- Symptom heat-strip / history visualization
- Milestone celebration
- Export data button
- Delete all data button (with confirmation)
- Non-diagnostic disclaimer (persistent footer)
- Dark mode toggle

**Backend (Render)**
- Check-in ingest endpoint
- Forecasting inference endpoint
- NLP sentiment/linguistic analysis endpoint
- Correlation discovery endpoint
- Anomaly detection endpoint
- Weekly insight generation

**Data**
- Local storage schema for check-ins
- Export/import serialization
- Seeded recovery baseline reference data

---

## 8. TENTATIVE Build Plan

> ⚠️ **THIS IS TENTATIVE — DO NOT FOLLOW IT STRICTLY.**
> This is a rough ordering to prevent aimless building. Reorder, merge, split, or skip steps freely as the project evolves. If something here turns out to be wrong or a better path appears, take the better path. Do not treat this as a checklist to grind through.

**Phase 1 — Foundation**
1. Project scaffold, routing, purple design system + tokens, dark mode
2. Local storage data layer + check-in schema
3. Lumi component with basic states

**Phase 2 — Core Loop**
4. Night check-in flow, end to end
5. Morning check-in flow, end to end
6. Home dashboard showing today's state
7. Streaks + streak rescue
8. History view

**Phase 3 — Intelligence**
9. Render backend scaffold + deploy early (deploy on day one of this phase, not at the end — deployment surprises are the classic hackathon killer)
10. Symptom burden forecasting model
11. Personal sleep–symptom correlation engine
12. NLP sentiment/linguistic analysis on journal text
13. Anomaly detection
14. Cold-start / baseline-building state

**Phase 4 — Insights & Responsible AI**
15. Daily recovery report
16. Insights page + weekly summary
17. Recovery trajectory chart
18. Prediction explanations + confidence display
19. "Your Data" page, export, delete
20. Red-flag escalation logic
21. Limitations page + disclaimers throughout

**Phase 5 — Polish**
22. Full design pass — every screen finished
23. Empty states, loading states, error states
24. Accessibility pass (light sensitivity, contrast, motion, tap targets)
25. Milestone celebrations
26. Mobile responsiveness

**Phase 6 — Submission**
27. README with Render architecture + Responsible AI writeup
28. Demo video
29. Devpost submission targeting each track explicitly
30. Seed demo data so judges see a populated, working app immediately — **do not let a judge open the app to an empty cold-start state**

---

## 9. Optional Extensions (only if time allows)

These are **stretch goals**. Do not start any of them until the core product is complete and polished. A finished small product beats an unfinished ambitious one.

- **User accounts + cloud sync** — enables multi-device use and longitudinal data
- **Doctor export** — clean PDF/report of recovery data to bring to an appointment
- **3D body model** — interactive body visualization for localized ache tracking and prediction *(details deferred — revisit only if core is done)*
- **Caregiver view** — parent/partner visibility into recovery progress
- **Return-to-learn / return-to-sport pacing guidance**
- **Notification / reminder system** for check-ins

---

## 10. Guiding Principles

1. **Finish the core loop first.** A polished night/morning check-in with real insights beats a half-built platform.
2. **Every ML feature must be explainable.** If we can't explain why it said something, it doesn't ship.
3. **Deploy to Render early**, not at the end.
4. **Design is a prize category.** Treat polish as a feature, not cleanup.
5. **Responsible AI is a prize category.** Make it visible in the product.
6. **Never overclaim.** No diagnoses, no recovery dates, no fake confidence. Credibility is the whole product.
