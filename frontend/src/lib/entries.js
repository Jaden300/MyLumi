/* Domain API. Components call this - never storage.js directly.

   Reads go through loadData(), which heals and migrates. Writes recompute
   derived fields and streak state, then persist once. */

import { KEYS, draftKeyFor, readJSON, writeJSON, removeKey, clearNamespace, quarantine, readRaw } from './storage.js';
import { createDefaultData, createEmptyEntry, normalizeData, sanitizeSymptoms, sanitizeAwakenings, clampInt, SCHEMA_VERSION } from './schema.js';
import { migrate } from './migrations.js';
import { computeSymptomBurden } from './derive.js';
import { recomputeStreakState, refreshRescue, getRescueOffer, applyRescue } from './streak.js';
import {
  currentNightOf,
  prevDay,
  toLocalISODate,
  eachDate,
  isValidISODate,
  isValidTime,
  getLocalTimezone,
  daysBetween,
} from './dates.js';
import { MAX_JOURNAL_CHARS, MOOD_VAS_MIN, MOOD_VAS_MAX, STRESS_MIN, STRESS_MAX } from './constants.js';

/** Set when a corrupt blob was quarantined, so the UI can explain the reset. */
let recoveryNotice = null;
export const getRecoveryNotice = () => recoveryNotice;
export const clearRecoveryNotice = () => {
  recoveryNotice = null;
};

export function loadData(now = new Date()) {
  const raw = readRaw(KEYS.data);
  if (raw == null) return createDefaultData(now);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const moved = quarantine(KEYS.data, now);
    recoveryNotice = { reason: 'corrupt', backupKey: moved.key ?? null };
    return createDefaultData(now);
  }
  return migrate(normalizeData(parsed, now));
}

export function saveData(data) {
  return writeJSON(KEYS.data, data);
}

const rolloverOf = (data) => data?.profile?.dayRolloverHour;

/* --- profile --------------------------------------------------------------- */

export function setProfile(data, patch, now = new Date()) {
  const next = { ...data, profile: { ...data.profile, ...patch } };
  if (patch.injuryDate !== undefined && !data.profile.onboardedAt) {
    next.profile.onboardedAt = now.toISOString();
  }
  return next;
}

/**
 * Note a timezone change without rewriting history.
 *
 * If the user travels, past entries keep the local dates they were recorded
 * with. Re-deriving them under a new zone would silently rewrite the clinical
 * record, which is worse than a documented discontinuity.
 */
export function reconcileTimezone(data, now = new Date()) {
  const actual = getLocalTimezone();
  const stored = data.profile.timezone;
  if (!actual || !stored || actual === stored) return data;
  return {
    ...data,
    profile: { ...data.profile, timezone: actual },
    meta: {
      ...data.meta,
      timezoneChanges: [...(data.meta.timezoneChanges ?? []), { from: stored, to: actual, at: now.toISOString() }],
    },
  };
}

/* --- reading entries ------------------------------------------------------- */

export function getEntry(data, nightOf) {
  return data?.entries?.[nightOf] ?? null;
}

export function getTodayEntry(data, now = new Date()) {
  return getEntry(data, currentNightOf(now, rolloverOf(data)));
}

/**
 * Dense list across a date range - gaps come back as empty entries.
 *
 * History and charts must iterate a RANGE, never Object.keys(entries): a sparse
 * map silently collapses missed days, and missingness is data (for the streak,
 * the heat strip, and later the model's honesty about coverage).
 */
export function getEntryRange(data, startIso, endIso) {
  return eachDate(startIso, endIso).map((iso) => data.entries[iso] ?? createEmptyEntry(iso));
}

/** Sparse, ascending - for feature building, where gaps should be absent. */
export function getAllEntries(data) {
  return Object.keys(data.entries)
    .sort()
    .map((iso) => data.entries[iso]);
}

/* --- writing check-ins ------------------------------------------------------ */

const trimText = (value) =>
  typeof value === 'string' ? value.slice(0, MAX_JOURNAL_CHARS).trim() : '';

function buildNightBlock(values, now) {
  const symptoms = sanitizeSymptoms(values.symptoms);
  return {
    completedAt: now.toISOString(),
    localDate: toLocalISODate(now),
    symptoms,
    // Stored despite being derived: read by dashboard, history, chart and later
    // the forecast. One writer beats recomputing it in six places.
    symptomBurden: computeSymptomBurden(symptoms),
    mood: clampInt(values.mood, MOOD_VAS_MIN, MOOD_VAS_MAX),
    journal: { day: trimText(values.journal?.day), factors: trimText(values.journal?.factors) },
    sleep: {
      plannedBedtime: isValidTime(values.sleep?.plannedBedtime) ? values.sleep.plannedBedtime : null,
      preSleepStress: clampInt(values.sleep?.preSleepStress, STRESS_MIN, STRESS_MAX),
      sleepAidUsed: values.sleep?.sleepAidUsed === true,
    },
  };
}

function buildMorningBlock(values, now) {
  return {
    completedAt: now.toISOString(),
    localDate: toLocalISODate(now),
    wakeTime: isValidTime(values.wakeTime) ? values.wakeTime : null,
    awakenings: sanitizeAwakenings(values.awakenings),
    sleepQuality: clampInt(values.sleepQuality, 0, 6),
    dreamRecall: values.dreamRecall === true,
    moodMorning: clampInt(values.moodMorning, 0, 6),
    energy: clampInt(values.energy, 0, 6),
    readiness: clampInt(values.readiness, 0, 6),
    journal: { wakeFeeling: trimText(values.journal?.wakeFeeling) },
  };
}

function upsert(data, nightOf, block, side, now) {
  const existing = data.entries[nightOf] ?? createEmptyEntry(nightOf);
  const entries = { ...data.entries, [nightOf]: { ...existing, [side]: block } };
  return {
    ...data,
    entries,
    streak: recomputeStreakState(data.streak, entries, now, rolloverOf(data)),
  };
}

/**
 * Both save functions refuse to silently overwrite an existing block. A wrong
 * device clock could otherwise point at a night already logged and quietly
 * replace real data; the UI routes that state to an "already checked in" screen.
 */
export function saveNightCheckIn(data, nightOf, values, { now = new Date(), overwrite = false } = {}) {
  if (!isValidISODate(nightOf)) return { ok: false, reason: 'invalid-date', data };
  if (data.entries[nightOf]?.night && !overwrite) return { ok: false, reason: 'already-exists', data };
  const next = upsert(data, nightOf, buildNightBlock(values, now), 'night', now);
  return { ok: true, data: next, entry: next.entries[nightOf] };
}

export function saveMorningCheckIn(data, nightOf, values, { now = new Date(), overwrite = false } = {}) {
  if (!isValidISODate(nightOf)) return { ok: false, reason: 'invalid-date', data };
  if (data.entries[nightOf]?.morning && !overwrite) return { ok: false, reason: 'already-exists', data };
  const next = upsert(data, nightOf, buildMorningBlock(values, now), 'morning', now);
  return { ok: true, data: next, entry: next.entries[nightOf] };
}

/* --- status ---------------------------------------------------------------- */

/**
 * What the dashboard should ask for right now.
 *
 * The morning check-in always targets the PREVIOUS night's episode - that is the
 * sleep the user just finished. Keying entries by sleep episode is what makes
 * this a one-line lookup instead of an adjacent-day join.
 */
export function getCheckInStatus(data, now = new Date()) {
  const rollover = rolloverOf(data);
  const nightOf = currentNightOf(now, rollover);
  const morningTarget = prevDay(nightOf);
  const today = data.entries[nightOf] ?? null;
  const prev = data.entries[morningTarget] ?? null;
  const hour = now.getHours();

  const nightDone = Boolean(today?.night);
  const morningDone = Boolean(prev?.morning);
  const morningDue = Boolean(prev?.night) && !morningDone;
  const nightDue = !nightDone;

  let primary = 'none';
  if (morningDue && hour < 12) primary = 'morning';
  else if (nightDue) primary = 'night';
  else if (morningDue) primary = 'morning';

  return { nightOf, morningTargetNightOf: morningTarget, nightDone, morningDone, nightDue, morningDue, primary };
}

export function getStreak(data, now = new Date()) {
  const rollover = rolloverOf(data);
  const rescue = refreshRescue(data.streak.rescue, now, rollover);
  const state = recomputeStreakState({ ...data.streak, rescue }, data.entries, now, rollover);
  const offer = getRescueOffer(data.entries, state, now, rollover);
  return { ...state, canRescue: offer.canRescue, rescuableNightOf: offer.nightOf, rescueReason: offer.reason };
}

export function redeemRescue(data, nightOf, now = new Date()) {
  const result = applyRescue(data.streak, data.entries, nightOf, now, rolloverOf(data));
  if (!result.ok) return { ok: false, reason: result.reason, data };
  return { ok: true, data: { ...data, streak: result.streak } };
}

/* --- drafts ---------------------------------------------------------------- */

export function loadDraft(kind) {
  return readJSON(draftKeyFor(kind), null);
}

export function saveDraft(kind, draft) {
  return writeJSON(draftKeyFor(kind), draft);
}

export function clearDraft(kind) {
  return removeKey(draftKeyFor(kind));
}

/* --- prefs ----------------------------------------------------------------- */

export function loadPrefs() {
  return readJSON(KEYS.prefs, {});
}

export function savePrefs(prefs) {
  return writeJSON(KEYS.prefs, prefs);
}

/* --- data rights ------------------------------------------------------------ */

/** The stored shape IS the export shape - no transformation layer to drift. */
export function exportJSON(data, now = new Date()) {
  return JSON.stringify({ ...data, exportedAt: now.toISOString(), appSchemaVersion: SCHEMA_VERSION }, null, 2);
}

export function deleteAllData(now = new Date()) {
  clearNamespace();
  return createDefaultData(now);
}

/** Convenience for the dashboard header. */
export function getDaysSinceInjury(data, now = new Date()) {
  const injury = data?.profile?.injuryDate;
  if (!isValidISODate(injury)) return null;
  return daysBetween(injury, toLocalISODate(now));
}

export function isOnboarded(data) {
  return Boolean(data?.profile?.onboardedAt && isValidISODate(data?.profile?.injuryDate));
}
