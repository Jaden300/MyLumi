/* Descriptive statistics over the user's own week. Pure, local, no network.

   There is no endpoint for this and there should not be. Everything here is
   arithmetic over data the browser already holds, which means the weekly summary
   works when the model service is asleep or was never deployed at all. Sending
   data to Render to compute a mean would be a worse product AND a worse privacy
   story.

   ## Thresholds

   `MIN_NIGHTS` is 4, deliberately LOWER than the 7-night gate on predictions.
   That is not an inconsistency: describing what you logged is a much weaker claim
   than predicting what comes next, so it earns a lower bar. But it is still a bar
 - "your worst symptom this week" computed from two entries is noise wearing the
   costume of a finding.

   ## Language

   Every statement here is descriptive and never causal. "Your heaviest night was
   Tuesday" is a fact about the data. "Tuesday set you back" is a claim about
   cause that this app cannot support, and the correlation engine already refuses
   to make it - the weekly summary must not sneak it in through the side door. */

import { SYMPTOM_KEYS } from './constants.js';
import { daysBetween, prevDay, toLocalISODate } from './dates.js';

const DAYS_PER_WEEK = 7;

/* Below this, the window describes too little to characterise a week. */
export const MIN_NIGHTS = 4;

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

/** Median - robust to one catastrophic night, matching the choice the anomaly
 *  model already made for the same reason. */
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Entries with a night block whose nightOf falls in [start, end]. */
function nightsInRange(entries, start, end) {
  return entries.filter(
    (entry) =>
      entry?.night &&
      entry.nightOf >= start &&
      entry.nightOf <= end,
  );
}

const burdensOf = (nights) =>
  nights.map((e) => e.night?.symptomBurden).filter((v) => Number.isFinite(v));

/** Mean burden for a window, or null when too few nights carry a burden.
 *
 * A night missing even one symptom already has a null `symptomBurden` (see
 * `computeSymptomBurden`), so it drops out here automatically rather than
 * contributing a partial sum that would read as a genuinely lighter day. */
function windowMeanBurden(nights) {
  const burdens = burdensOf(nights);
  return burdens.length >= MIN_NIGHTS ? mean(burdens) : null;
}

/**
 * Summarise the last `weeks` week(s) of check-ins.
 *
 * `entries` may be sparse or dense - only nights with a `night` block count.
 * Every field is null rather than a fallback when its input is missing.
 */
export function buildWeeklySummary(entries, { now = new Date(), weeks = 1 } = {}) {
  const end = toLocalISODate(now);
  let start = end;
  for (let i = 0; i < DAYS_PER_WEEK * weeks - 1; i += 1) start = prevDay(start);

  let priorEnd = prevDay(start);
  let priorStart = priorEnd;
  for (let i = 0; i < DAYS_PER_WEEK * weeks - 1; i += 1) priorStart = prevDay(priorStart);

  const nights = nightsInRange(entries ?? [], start, end);
  const burdens = burdensOf(nights);

  if (burdens.length < MIN_NIGHTS) {
    return {
      available: false,
      reason: `${burdens.length} of ${MIN_NIGHTS} nights needed for a weekly summary.`,
      nComplete: burdens.length,
      nLogged: nights.length,
      start,
      end,
      meanBurden: null,
      deltaVsPriorWeek: null,
      worstSymptom: null,
      bestNight: null,
      worstNight: null,
      bestSleep: null,
      worstSleep: null,
    };
  }

  /* A delta is only honest when BOTH windows clear the bar. Comparing a full
     week against a two-night week produces a number that looks like a trend and
     is really an artefact of how often someone remembered to check in. */
  const priorMean = windowMeanBurden(nightsInRange(entries ?? [], priorStart, priorEnd));
  const meanBurden = mean(burdens);
  const deltaVsPriorWeek = priorMean === null ? null : meanBurden - priorMean;

  return {
    available: true,
    reason: null,
    nComplete: burdens.length,
    nLogged: nights.length,
    start,
    end,
    meanBurden,
    deltaVsPriorWeek,
    worstSymptom: worstSymptomOf(nights),
    bestNight: extremeBurden(nights, 'min'),
    worstNight: extremeBurden(nights, 'max'),
    bestSleep: extremeSleep(nights, 'max'),
    worstSleep: extremeSleep(nights, 'min'),
  };
}

/** The symptom with the highest mean rating across the window.
 *
 * Ties resolve by SYMPTOM_KEYS order so the answer is stable across renders -
 * a summary that reshuffles its "worst symptom" between two equal values reads
 * as instability in the user's recovery rather than in our sort. */
function worstSymptomOf(nights) {
  let best = null;
  for (const key of SYMPTOM_KEYS) {
    const values = nights
      .map((e) => e.night?.symptoms?.[key])
      .filter((v) => Number.isFinite(v));
    if (values.length < MIN_NIGHTS) continue;
    const meanValue = mean(values);
    if (best === null || meanValue > best.meanValue) best = { key, meanValue };
  }
  return best && best.meanValue > 0 ? best : null;
}

function extremeBurden(nights, mode) {
  let found = null;
  for (const entry of nights) {
    const value = entry.night?.symptomBurden;
    if (!Number.isFinite(value)) continue;
    if (found === null || (mode === 'min' ? value < found.value : value > found.value)) {
      found = { nightOf: entry.nightOf, value };
    }
  }
  return found;
}

function extremeSleep(nights, mode) {
  let found = null;
  for (const entry of nights) {
    const value = entry.morning?.sleepQuality;
    if (!Number.isFinite(value)) continue;
    if (found === null || (mode === 'min' ? value < found.value : value > found.value)) {
      found = { nightOf: entry.nightOf, value };
    }
  }
  return found;
}

/* --- daily report ---------------------------------------------------------- */

/** How much a burden must differ from the recent median to be worth naming. */
const NOTABLE_DELTA = 4;
const RECENT_WINDOW = 7;

/**
 * One night against the user's own recent typical day.
 *
 * Compared against a MEDIAN, not a mean: a single catastrophic night should not
 * drag the baseline up and make the next few days look artificially good.
 *
 * Returns null under `MIN_NIGHTS` of history - with three nights logged there is
 * no "usual" to compare against, and inventing one would be the same mistake as
 * emitting a prediction at day three.
 */
export function compareToRecent(entry, entries, { now = new Date() } = {}) {
  const burden = entry?.night?.symptomBurden;
  if (!Number.isFinite(burden)) return null;

  const today = toLocalISODate(now);
  const prior = (entries ?? []).filter(
    (e) =>
      e?.night &&
      e.nightOf !== entry.nightOf &&
      e.nightOf < entry.nightOf &&
      daysBetween(e.nightOf, today) <= RECENT_WINDOW * 2,
  );

  const burdens = burdensOf(prior).slice(-RECENT_WINDOW);
  if (burdens.length < MIN_NIGHTS) return null;

  const baseline = median(burdens);
  const delta = burden - baseline;
  const direction = delta <= -NOTABLE_DELTA ? 'lighter' : delta >= NOTABLE_DELTA ? 'heavier' : 'similar';

  return { direction, delta, baseline, n: burdens.length };
}
