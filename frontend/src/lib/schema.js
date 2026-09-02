/* Shape of the stored record + validation. See docs/data-schema.md.

   Entries are keyed by `nightOf` - the local date the night BEGAN. One record is
   one sleep episode: the `night` block describes that day and the intention to
   sleep, the `morning` block describes waking the next day. Keying this way makes
   sleep duration a pure function of a single record and makes each entry exactly
   one future ML training row. */

import { getLocalTimezone } from './dates.js';
import { ROLLOVER_HOUR, SYMPTOM_KEYS, AWAKENING_OPTIONS } from './constants.js';

export const SCHEMA_VERSION = 1;

export function createDefaultData(now = new Date()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now.toISOString(),
    profile: {
      injuryDate: null,
      timezone: getLocalTimezone(),
      dayRolloverHour: ROLLOVER_HOUR,
      onboardedAt: null,
    },
    entries: {},
    streak: {
      current: 0,
      longest: 0,
      lastCompletedNightOf: null,
      rescue: { monthKey: null, available: true, usedOn: null },
      rescueHistory: [],
    },
    meta: {
      lastOpenedAt: now.toISOString(),
      exportCount: 0,
      isDemoData: false,
      timezoneChanges: [],
    },
  };
}

export function createEmptyEntry(nightOf) {
  return { nightOf, night: null, morning: null };
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Repair a parsed blob into something the app can safely render.
 *
 * Deliberately lenient: a missing or malformed sub-object is replaced with its
 * default rather than rejected. Refusing to boot over one bad field would be a
 * worse outcome than quietly healing it, and the raw original is preserved by
 * the caller before this runs.
 */
export function normalizeData(raw, now = new Date()) {
  const base = createDefaultData(now);
  if (!isObject(raw)) return base;

  const profile = isObject(raw.profile) ? raw.profile : {};
  const streak = isObject(raw.streak) ? raw.streak : {};
  const rescue = isObject(streak.rescue) ? streak.rescue : {};
  const meta = isObject(raw.meta) ? raw.meta : {};

  return {
    schemaVersion: Number.isInteger(raw.schemaVersion) ? raw.schemaVersion : SCHEMA_VERSION,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    profile: {
      injuryDate: typeof profile.injuryDate === 'string' ? profile.injuryDate : null,
      timezone: typeof profile.timezone === 'string' ? profile.timezone : base.profile.timezone,
      dayRolloverHour: Number.isInteger(profile.dayRolloverHour)
        ? profile.dayRolloverHour
        : ROLLOVER_HOUR,
      onboardedAt: typeof profile.onboardedAt === 'string' ? profile.onboardedAt : null,
    },
    entries: normalizeEntries(raw.entries),
    streak: {
      current: Number.isFinite(streak.current) ? streak.current : 0,
      longest: Number.isFinite(streak.longest) ? streak.longest : 0,
      lastCompletedNightOf:
        typeof streak.lastCompletedNightOf === 'string' ? streak.lastCompletedNightOf : null,
      rescue: {
        monthKey: typeof rescue.monthKey === 'string' ? rescue.monthKey : null,
        available: typeof rescue.available === 'boolean' ? rescue.available : true,
        usedOn: typeof rescue.usedOn === 'string' ? rescue.usedOn : null,
      },
      rescueHistory: Array.isArray(streak.rescueHistory) ? streak.rescueHistory : [],
    },
    meta: {
      lastOpenedAt: typeof meta.lastOpenedAt === 'string' ? meta.lastOpenedAt : base.meta.lastOpenedAt,
      exportCount: Number.isFinite(meta.exportCount) ? meta.exportCount : 0,
      isDemoData: meta.isDemoData === true,
      timezoneChanges: Array.isArray(meta.timezoneChanges) ? meta.timezoneChanges : [],
    },
  };
}

function normalizeEntries(rawEntries) {
  if (!isObject(rawEntries)) return {};
  const out = {};
  for (const [nightOf, entry] of Object.entries(rawEntries)) {
    if (!isObject(entry)) continue;
    out[nightOf] = {
      nightOf,
      night: isObject(entry.night) ? entry.night : null,
      morning: isObject(entry.morning) ? entry.morning : null,
    };
  }
  return out;
}

/* --- check-in payload validation ------------------------------------------
   Guards the boundary between UI state and stored data. Out-of-range or missing
   values become null rather than being coerced to a number - a fabricated score
   would silently enter the clinical record and, later, the training data. */

const clampInt = (value, min, max) => {
  if (!Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < min || n > max) return null;
  return n;
};

export function sanitizeSymptoms(raw) {
  const out = {};
  for (const key of SYMPTOM_KEYS) {
    out[key] = clampInt(isObject(raw) ? raw[key] : null, 0, 6);
  }
  return out;
}

export function sanitizeAwakenings(value) {
  return AWAKENING_OPTIONS.includes(value) ? value : null;
}

export { clampInt, isObject };
