/* Derived features. Pure functions of an entry - no storage, no React.

   This file is also the ML feature contract: when Phase 3 sends data to Render
   for inference, `toFeatureRow` is the single chokepoint describing exactly what
   crosses the wire. Keeping it here from day one means the Responsible AI
   writeup can point at one readable function. */

import { SYMPTOM_KEYS, MAX_SYMPTOM_BURDEN } from './constants.js';
import { timeToMinutes, dstShiftMinutes, daysBetween } from './dates.js';

/**
 * Sum of the 9 PCSS items (0-54).
 * Returns null if ANY item is missing - a partial sum would understate burden
 * and read as a real, lower score.
 */
export function computeSymptomBurden(symptoms) {
  if (!symptoms) return null;
  let total = 0;
  for (const key of SYMPTOM_KEYS) {
    const v = symptoms[key];
    if (!Number.isFinite(v)) return null;
    total += v;
  }
  return total;
}

/** Burden as a 0-1 fraction, for bars and charts. */
export function burdenFraction(burden) {
  if (!Number.isFinite(burden)) return null;
  return Math.min(1, Math.max(0, burden / MAX_SYMPTOM_BURDEN));
}

/**
 * Sleep duration in minutes, from planned bedtime + wake time.
 *
 * Both times live in the SAME record (that is the payoff of keying by sleep
 * episode), so this needs no neighbour lookup. Wake at or before bedtime means
 * the clock wrapped past midnight.
 *
 * Wall-clock arithmetic is off by an hour across a DST transition; those nights
 * are flagged via `dstShift` rather than silently corrected.
 */
export function deriveSleepDuration(entry) {
  const bedtime = entry?.night?.sleep?.plannedBedtime;
  const wakeTime = entry?.morning?.wakeTime;
  const bedMin = timeToMinutes(bedtime);
  const wakeMin = timeToMinutes(wakeTime);
  if (bedMin == null || wakeMin == null) return null;
  return wakeMin <= bedMin ? wakeMin + 1440 - bedMin : wakeMin - bedMin;
}

export function sleepDurationHours(entry) {
  const minutes = deriveSleepDuration(entry);
  return minutes == null ? null : minutes / 60;
}

/** True when this episode spans a DST change and its duration is ±60m out. */
export function hasDstShift(entry) {
  return entry?.nightOf ? dstShiftMinutes(entry.nightOf) !== 0 : false;
}

/**
 * "3+" -> 3, with the meaning "three or more".
 * Storage keeps the string; only the feature layer flattens it, and the loss of
 * information is documented here rather than hidden at the input.
 */
export function awakeningsToOrdinal(value) {
  if (value === '3+') return 3;
  // Must be a string: Number(null) and Number('') are both 0, which would turn
  // a missing answer into a confident "slept through the night".
  if (typeof value !== 'string' || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

export function isNightComplete(entry) {
  return Boolean(entry?.night);
}

export function isMorningComplete(entry) {
  return Boolean(entry?.morning);
}

/** A sleep episode counts as logged only when BOTH halves are present. */
export function isDayComplete(entry) {
  return isNightComplete(entry) && isMorningComplete(entry);
}

/**
 * Flatten one sleep episode into a numeric row for inference.
 *
 * `nextEntry` supplies the prediction target (tomorrow's symptom burden), which
 * is why forecasting is framed as "this episode -> next episode" rather than
 * anything requiring a join across the whole dataset.
 *
 * Journal text is deliberately NOT included here. It is the most sensitive
 * content in the app; when NLP lands it gets its own explicit payload so no
 * free text is ever sent as an incidental side effect of a numeric call.
 */
export function toFeatureRow(entry, nextEntry = null, injuryDate = null) {
  if (!entry?.night) return null;
  const symptoms = entry.night.symptoms ?? {};
  const row = {
    nightOf: entry.nightOf,
    daysSinceInjury: injuryDate ? daysBetween(injuryDate, entry.nightOf) : null,
    symptomBurden: entry.night.symptomBurden ?? computeSymptomBurden(symptoms),
    mood: entry.night.mood ?? null,
    preSleepStress: entry.night.sleep?.preSleepStress ?? null,
    sleepAidUsed: boolToFlag(entry.night.sleep?.sleepAidUsed),
    sleepDurationMinutes: deriveSleepDuration(entry),
    sleepQuality: entry.morning?.sleepQuality ?? null,
    awakenings: awakeningsToOrdinal(entry.morning?.awakenings),
    dreamRecall: boolToFlag(entry.morning?.dreamRecall),
    moodMorning: entry.morning?.moodMorning ?? null,
    energy: entry.morning?.energy ?? null,
    readiness: entry.morning?.readiness ?? null,
    dstAffected: hasDstShift(entry) ? 1 : 0,
    // Prediction target: the FOLLOWING episode's daytime symptom burden.
    nextSymptomBurden: nextEntry?.night?.symptomBurden ?? null,
    ...painFeatures(entry.night.pain),
  };
  for (const key of SYMPTOM_KEYS) {
    row[`symptom_${key}`] = Number.isFinite(symptoms[key]) ? symptoms[key] : null;
  }
  return row;
}

/**
 * Pain regions -> three aggregate numbers.
 *
 * Aggregates rather than one column per region, for three reasons. The backend
 * fits on somewhere between 7 and 30 rows, and 29 extra columns on a design
 * matrix that small are separable by chance alone. They would also be almost
 * entirely null - a person with one sore knee produces one number and 28
 * blanks every night - and this project drops rows missing a feature rather
 * than imputing them, so any model touching a region column would discard
 * nearly the whole dataset. And a stable map of where someone hurts, week after
 * week, is closer to an identifier than a measurement; the payload deliberately
 * carries none.
 *
 * The null handling is the part that matters:
 *
 *   never asked   -> all three null
 *   asked, none   -> count 0, max and mean null
 *   asked, marked -> all three real
 *
 * The middle row is the interesting one. A count over an empty set is defined
 * and it is genuinely 0 - the one place in this app where a zero is not a
 * fabrication, and only because `answered` proves the question was actually put
 * to the user. A max and a mean over an empty set are undefined, so they stay
 * null: sending painMax 0 would assert "the worst pain measured zero", which is
 * a different claim from "no pain was reported", and it would drag any average
 * the backend later took toward zero.
 */
function painFeatures(pain) {
  if (pain?.answered !== true) {
    return { painRegionCount: null, painMax: null, painMean: null };
  }
  const scores = Object.values(pain.regions ?? {}).filter(Number.isFinite);
  if (scores.length === 0) {
    return { painRegionCount: 0, painMax: null, painMean: null };
  }
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return {
    painRegionCount: scores.length,
    painMax: Math.max(...scores),
    // Rounded because the rest of the row is clean, and an unrounded mean would
    // put 6.833333333333333 on the wire for no gain.
    painMean: Math.round(mean * 100) / 100,
  };
}

/**
 * Boolean answer -> 1/0, but a MISSING answer stays null.
 *
 * `x === true ? 1 : 0` would send 0 for an unanswered question, which the model
 * reads as a real "no" rather than as an absence - the fabricated-zero this
 * project refuses everywhere else. Both flows currently initialise these fields
 * to `false`, so this is a guard on the contract rather than a live leak; the
 * backend already accepts null for both.
 */
function boolToFlag(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

/** Highest-scoring symptom in an entry, for the daily summary. */
export function worstSymptom(entry) {
  const symptoms = entry?.night?.symptoms;
  if (!symptoms) return null;
  let best = null;
  for (const key of SYMPTOM_KEYS) {
    const v = symptoms[key];
    if (Number.isFinite(v) && (best === null || v > best.value)) best = { key, value: v };
  }
  return best && best.value > 0 ? best : null;
}
