/* Derived features. Pure functions of an entry — no storage, no React.

   This file is also the ML feature contract: when Phase 3 sends data to Render
   for inference, `toFeatureRow` is the single chokepoint describing exactly what
   crosses the wire. Keeping it here from day one means the Responsible AI
   writeup can point at one readable function. */

import { SYMPTOM_KEYS, MAX_SYMPTOM_BURDEN } from './constants.js';
import { timeToMinutes, dstShiftMinutes, daysBetween } from './dates.js';

/**
 * Sum of the 9 PCSS items (0-54).
 * Returns null if ANY item is missing — a partial sum would understate burden
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
    sleepAidUsed: entry.night.sleep?.sleepAidUsed === true ? 1 : 0,
    sleepDurationMinutes: deriveSleepDuration(entry),
    sleepQuality: entry.morning?.sleepQuality ?? null,
    awakenings: awakeningsToOrdinal(entry.morning?.awakenings),
    dreamRecall: entry.morning?.dreamRecall === true ? 1 : 0,
    moodMorning: entry.morning?.moodMorning ?? null,
    energy: entry.morning?.energy ?? null,
    readiness: entry.morning?.readiness ?? null,
    dstAffected: hasDstShift(entry) ? 1 : 0,
    // Prediction target: the FOLLOWING episode's daytime symptom burden.
    nextSymptomBurden: nextEntry?.night?.symptomBurden ?? null,
  };
  for (const key of SYMPTOM_KEYS) {
    row[`symptom_${key}`] = Number.isFinite(symptoms[key]) ? symptoms[key] : null;
  }
  return row;
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
