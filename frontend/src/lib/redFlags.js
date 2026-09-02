/* Red-flag escalation. Rule-based, local, and deliberately modest.

   THIS FILE MAKES NO NETWORK CALL AND MUST NEVER MAKE ONE. It imports no api.js,
   no storage, no React. A safety-critical prompt that depends on a Render service
   which may be asleep, unreachable, or slow is not a safety feature. Everything
   here is a pure function of entries the user already has on their device.

   ## What this can and cannot see

   MyLumi collects 9 PCSS items (0-6), a mood VAS, pre-sleep stress, and morning
   ratings. It CANNOT see the flags that actually matter clinically: vomiting,
   seizure, loss of consciousness, unequal pupils, slurred speech, focal weakness,
   or someone who cannot be woken. No rule over self-reported PCSS scores detects
   any of those.

   So escalation in this app is two separate things, and conflating them would be
   dangerous:

     A. PASSIVE guidance - the real red-flag list, always available, never gated
        on a rule firing. It lives on the About page under "When to seek medical
        help". A rule that never fires must NEVER read as an all-clear, which is
        exactly what happens if A is missing and B is the only signal.

     B. This module - a calm prompt drawn from trajectory in the data we DO have.
        It is a nudge to mention something to a clinician. It is not a detector,
        and the banner copy says so in as many words.

   Getting A prominent matters more than getting B clever.

   ## What is deliberately NOT a rule

   - **Low mood VAS as a suicidality proxy. Do not build this.** A 0-100 slider is
     not a risk assessment. A false positive here - telling someone the app thinks
     they are in crisis because they dragged a slider low - is a serious harm, and
     a false negative is worse. `moodDisturbance` reaches these rules only through
     aggregate burden, and that is as far as it should go.
   - Any rule firing on a single moderate reading. Guaranteed alarm fatigue, and a
     banner people learn to ignore protects nobody.
   - Any rule firing on MISSING data. Silence means nothing was reported, not that
     things got worse. Inferring deterioration from a gap would be inventing data,
     which this project does not do anywhere else either.

   ## Never diagnostic

   No rule names a condition. In particular nothing here may ever say "post-
   concussion syndrome" - that is a diagnosis, and the app does not make them. The
   generated copy describes observed data ("your headache ratings have been high"),
   never a conclusion ("your headache is worsening"). */

import { SYMPTOMS, MAX_SYMPTOM_BURDEN } from './constants.js';
import { daysBetween } from './dates.js';

/* Severity is 'prompt' or 'discuss' - NOT 'urgent'. A future contributor reading
   `urgent` will escalate the copy to match it, and this app has no basis to
   triage anyone to an emergency room. 'prompt' means "raise this promptly". */
export const SEVERITY_ORDER = { prompt: 2, discuss: 1 };

/* A user returning after two months must not trigger a trend rule on nights three
   weeks apart. Every rule evaluates only within this window. */
const LOOKBACK_DAYS = 21;

/* Thresholds live here rather than in constants.js. They are clinical decisions
   carrying rationale, and filing them among scale anchors loses the reasoning
   that makes them reviewable. */
const SEVERE_HEADACHE = 5;
const SEVERE_HEADACHE_OF_LAST = 3;
const SEVERE_HEADACHE_HITS = 2;

const ESCALATION_WINDOW = 4;
const ESCALATION_RISE = 3;
const ESCALATION_FLOOR = 4;

const CLUSTER_LEVEL = 4;

const TREND_WINDOW = 7;
const TREND_RISE = Math.round(MAX_SYMPTOM_BURDEN / 6); // 9 of 54
const TREND_FLOOR = 20;

const LATE_DAY = 28;
const LATE_MIN_NIGHTS = 10;
const LATE_BURDEN = 18;

const labelFor = (key) => SYMPTOMS.find((s) => s.key === key)?.label ?? key;

/** Complete night blocks inside the lookback, oldest first.
 *
 * Gaps simply do not appear. That is the point: a missing night is not a low
 * reading, and no rule may treat it as one. */
function loggedNights(entries, { now }) {
  const today = toIso(now);
  return entries
    .filter((entry) => entry?.night && daysBetween(entry.nightOf, today) <= LOOKBACK_DAYS)
    .sort((a, b) => a.nightOf.localeCompare(b.nightOf));
}

function toIso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Symptom values for one key, only where genuinely present.
 *
 * Returns null if ANY night in the window is missing the value. A rule with an
 * incomplete window does not fire and does not partially fire - same discipline
 * as dropping a row from a model fit rather than imputing it. */
function symptomSeries(nights, key) {
  const out = [];
  for (const entry of nights) {
    const value = entry.night?.symptoms?.[key];
    if (!Number.isFinite(value)) return null;
    out.push(value);
  }
  return out;
}

function burdenSeries(nights) {
  const out = [];
  for (const entry of nights) {
    const value = entry.night?.symptomBurden;
    if (!Number.isFinite(value)) return null;
    out.push(value);
  }
  return out;
}

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

/* Each rule returns a finding or null. `since` is the earliest night the finding
   draws on, so the UI can say how long a pattern has held. */

/** Persistent severe headache is the most-cited concussion red flag.
 *
 * One bad day is ordinary recovery; two of the last three is a pattern. Requiring
 * three logged nights means a user with a single entry cannot trigger it. */
function severeHeadacheSustained(nights) {
  const window = nights.slice(-SEVERE_HEADACHE_OF_LAST);
  if (window.length < SEVERE_HEADACHE_OF_LAST) return null;
  const values = symptomSeries(window, 'headache');
  if (!values) return null;
  const hits = values.filter((v) => v >= SEVERE_HEADACHE).length;
  if (hits < SEVERE_HEADACHE_HITS) return null;
  return {
    id: 'severe-headache-sustained',
    severity: 'prompt',
    title: 'Worth checking in with someone',
    detail: `Your headache ratings have been high on ${hits} of your last ${window.length} logged nights. That's worth mentioning to a doctor or nurse.`,
    since: window[0].nightOf,
  };
}

/** The "worsening headache" flag is about DIRECTION, not level.
 *
 * Monotonic rather than a slope fit keeps it specific - a jagged bad week should
 * not read as escalation. The ending floor stops 0->3 firing, which is a rough
 * few days rather than a trajectory worth acting on. */
function headacheEscalating(nights) {
  const window = nights.slice(-ESCALATION_WINDOW);
  if (window.length < ESCALATION_WINDOW) return null;
  const values = symptomSeries(window, 'headache');
  if (!values) return null;

  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) return null;
  }
  const rise = values[values.length - 1] - values[0];
  if (rise < ESCALATION_RISE) return null;
  if (values[values.length - 1] < ESCALATION_FLOOR) return null;

  return {
    id: 'headache-escalating',
    severity: 'prompt',
    title: 'Worth checking in with someone',
    detail: `Your headache ratings have gone up on each of your last ${window.length} logged nights. A headache that keeps building is worth raising with a doctor or nurse promptly.`,
    since: window[0].nightOf,
  };
}

/** The closest observable proxy for a cluster this app cannot actually see.
 *
 * MyLumi has no way to know about vomiting or confusion. Sustained high nausea
 * plus vestibular symptoms plus cognitive clouding, all on the same night, is the
 * nearest thing in the data. Requiring three concurrent domains is what keeps it
 * specific - a bad headache day on its own will not fire this. */
function neuroCluster(nights) {
  const latest = nights[nights.length - 1];
  if (!latest) return null;
  const symptoms = latest.night?.symptoms ?? {};
  const at = (key) => (Number.isFinite(symptoms[key]) ? symptoms[key] : null);

  const nausea = at('nausea');
  const dizziness = at('dizziness');
  const brainFog = at('brainFog');
  const concentration = at('concentration');
  if (nausea === null || dizziness === null) return null;
  if (brainFog === null && concentration === null) return null;

  const cognitive = Math.max(brainFog ?? -1, concentration ?? -1);
  if (nausea < CLUSTER_LEVEL || dizziness < CLUSTER_LEVEL || cognitive < CLUSTER_LEVEL) return null;

  return {
    id: 'neuro-cluster',
    severity: 'prompt',
    title: 'Worth checking in with someone',
    detail:
      'You rated nausea, dizziness and feeling mentally clouded all high on the same night. Several of those together is worth raising with a doctor or nurse promptly.',
    since: latest.nightOf,
  };
}

/** Recovery should trend down, so a sustained rise is worth a conversation.
 *
 * The floor stops a nearly-resolved user's 2 -> 11 reading as deterioration when
 * it is noise at the bottom of the scale. Deliberately 'discuss': a rising
 * average over two weeks is a thing to mention, not a thing to act on tonight. */
function burdenSustainedWorsening(nights) {
  if (nights.length < TREND_WINDOW * 2) return null;
  const window = nights.slice(-TREND_WINDOW * 2);
  const values = burdenSeries(window);
  if (!values) return null;

  const prior = mean(values.slice(0, TREND_WINDOW));
  const recent = mean(values.slice(TREND_WINDOW));
  if (recent - prior < TREND_RISE) return null;
  if (recent < TREND_FLOOR) return null;

  return {
    id: 'burden-sustained-worsening',
    severity: 'discuss',
    title: 'Something worth mentioning',
    detail: `Your overall symptom ratings have averaged higher over your last ${TREND_WINDOW} logged nights than the ${TREND_WINDOW} before them. That's worth bringing up at your next appointment.`,
    since: window[0].nightOf,
  };
}

/** Four weeks is the standard threshold for "this warrants follow-up".
 *
 * It matches the population context the app already shows during cold start.
 * The copy must not name a condition - symptoms lasting this long are common
 * enough to be worth a conversation, and that is the whole claim. */
function noImprovementLate(nights, { daysSinceInjury }) {
  if (!Number.isFinite(daysSinceInjury) || daysSinceInjury < LATE_DAY) return null;
  if (nights.length < LATE_MIN_NIGHTS) return null;

  const window = nights.slice(-TREND_WINDOW);
  if (window.length < TREND_WINDOW) return null;
  const values = burdenSeries(window);
  if (!values) return null;
  if (mean(values) < LATE_BURDEN) return null;

  return {
    id: 'no-improvement-late',
    severity: 'discuss',
    title: 'Something worth mentioning',
    detail: `You're ${daysSinceInjury} days in and still rating symptoms at a similar level. Symptoms lasting this long are common, and they're a good reason to check in with a healthcare professional.`,
    since: window[0].nightOf,
  };
}

const RULES = [
  severeHeadacheSustained,
  headacheEscalating,
  neuroCluster,
  burdenSustainedWorsening,
  noImprovementLate,
];

/**
 * Evaluate every rule against the user's own entries.
 *
 * `entries` is the DENSE range from `getEntryRange` - gaps must be visible so a
 * missing night is never mistaken for a logged one.
 *
 * Each finding carries a `signature` of the form `<id>:<latest night in window>`.
 * The UI stores a dismissal against that signature, so dismissing a banner hides
 * it only until a new check-in arrives that keeps the condition true - at which
 * point the signature changes and the banner returns. That satisfies "dismissible
 * but reappears while the condition holds" with no timer, and leaves no way to
 * permanently silence a rule.
 */
export function evaluateRedFlags(entries, { now = new Date(), daysSinceInjury = null } = {}) {
  const nights = loggedNights(entries ?? [], { now });
  const latestNightOf = nights[nights.length - 1]?.nightOf ?? null;

  const rules = [];
  for (const rule of RULES) {
    const finding = rule(nights, { daysSinceInjury });
    if (finding) rules.push({ ...finding, signature: `${finding.id}:${latestNightOf}` });
  }

  rules.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  return { active: rules.length > 0, rules };
}

export { labelFor };
