/* Pure date logic. No React, no storage - unit-testable in isolation.
   Every date string in MyLumi is a LOCAL ISO date: "YYYY-MM-DD". */

import { ROLLOVER_HOUR } from './constants.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Date -> "YYYY-MM-DD" using LOCAL calendar parts.
 *
 * Never use `toISOString().slice(0, 10)` here. That returns the UTC date, so a
 * user west of UTC checking in at 6pm would be filed under tomorrow. This is the
 * single most common bug in an app like this - build the string from the local
 * getters instead.
 */
export function toLocalISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "YYYY-MM-DD" -> Date at LOCAL midnight. */
export function fromLocalISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d); // month is 0-indexed; this constructor is local-time
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const date = fromLocalISODate(value);
  // Rejects impossible dates like "2026-02-30", which the constructor rolls over.
  return !Number.isNaN(date.getTime()) && toLocalISODate(date) === value;
}

/**
 * Which sleep episode "now" belongs to.
 *
 * Before the rollover hour you are still in yesterday's night. A patient doing
 * their night check-in at 1:15am means "the night of yesterday" - a midnight
 * rollover would file it on the wrong day and break their streak for exactly the
 * insomnia this app exists to track.
 */
export function currentNightOf(now = new Date(), rolloverHour = ROLLOVER_HOUR) {
  const d = new Date(now.getTime());
  if (d.getHours() < rolloverHour) d.setDate(d.getDate() - 1);
  return toLocalISODate(d);
}

/** The morning of a sleep episode falls on the day AFTER the night began. */
export function morningDateOf(nightOf) {
  return nextDay(nightOf);
}

function shiftDays(iso, delta) {
  const d = fromLocalISODate(iso);
  d.setDate(d.getDate() + delta); // handles month/year boundaries and DST
  return toLocalISODate(d);
}

export function prevDay(iso) {
  return shiftDays(iso, -1);
}

export function nextDay(iso) {
  return shiftDays(iso, 1);
}

/**
 * Whole calendar days from isoA to isoB (negative if isoB is earlier).
 * Uses UTC midnights purely as a counting device so a DST transition inside the
 * range can't produce a 23- or 25-hour day and round the wrong way.
 */
export function daysBetween(isoA, isoB) {
  const [ya, ma, da] = isoA.split('-').map(Number);
  const [yb, mb, db] = isoB.split('-').map(Number);
  const utcA = Date.UTC(ya, ma - 1, da);
  const utcB = Date.UTC(yb, mb - 1, db);
  return Math.round((utcB - utcA) / 86400000);
}

/** Inclusive list of local ISO dates from startIso to endIso. Empty if reversed. */
export function eachDate(startIso, endIso) {
  const out = [];
  if (daysBetween(startIso, endIso) < 0) return out;
  let cursor = startIso;
  // Guard against a pathological range locking the UI up.
  for (let i = 0; i <= 20000; i += 1) {
    out.push(cursor);
    if (cursor === endIso) break;
    cursor = nextDay(cursor);
  }
  return out;
}

/** "2026-01-05" -> "2026-01". Used to scope the monthly streak-rescue allowance. */
export function monthKey(iso) {
  return iso.slice(0, 7);
}

export function formatNightLabel(nightOf) {
  const d = fromLocalISODate(nightOf);
  return `Night of ${d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`;
}

export function formatShortDate(iso) {
  return fromLocalISODate(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Day 0 is the day of injury itself. */
export function daysSinceInjury(injuryDate, now = new Date()) {
  if (!isValidISODate(injuryDate)) return null;
  return daysBetween(injuryDate, toLocalISODate(now));
}

/* --- wall-clock times ------------------------------------------------------
   Bedtime and wake time are self-reported wall-clock strings ("23:30"), not
   instants. The user means "half eleven" - storing an instant would over-claim
   precision we don't have and render badly after export. */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function timeToMinutes(value) {
  if (!isValidTime(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime12h(value) {
  if (!isValidTime(value)) return null;
  const [h, m] = value.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(m)}${suffix}`;
}

/** e.g. 465 -> "7h 45m" */
export function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Minutes the local UTC offset shifts across a sleep episode (DST transition).
 * Spring forward -> -60, fall back -> +60, otherwise 0.
 *
 * Sleep duration is computed from wall-clock times, which is wrong on exactly
 * two nights a year. Rather than pull in a timezone library for a hackathon, we
 * detect those nights and let the insights layer annotate or exclude them -
 * two honestly-labelled anomalies beat a subtle year-round bug.
 */
export function dstShiftMinutes(nightOf) {
  if (!isValidISODate(nightOf)) return 0;
  const start = fromLocalISODate(nightOf);
  const end = fromLocalISODate(nextDay(nightOf));
  // getTimezoneOffset is minutes BEHIND UTC, so the sign is inverted.
  return start.getTimezoneOffset() - end.getTimezoneOffset();
}

export function getLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}
