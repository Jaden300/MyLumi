/* Streak + streak-rescue rules. Pure functions - no storage, no React.

   A streak is DERIVED on read by walking backwards from last night, never
   incremented by a timer or a background job. The stored values are a cache; if
   the two ever disagree, the computed value wins. This makes the streak
   self-healing: a user who disappears for a week gets a correct 0 with no
   catch-up logic anywhere. */

import { currentNightOf, prevDay, monthKey } from './dates.js';
import { isDayComplete } from './derive.js';

/** Rescued nights count toward the streak but hold no fabricated data. */
export function wasRescued(nightOf, rescue) {
  return Boolean(rescue?.usedOn && rescue.usedOn === nightOf);
}

function countsToward(nightOf, entries, rescue) {
  return isDayComplete(entries?.[nightOf]) || wasRescued(nightOf, rescue);
}

/**
 * Length of the unbroken run ending last night.
 *
 * Evaluation stops at `prevDay(currentNightOf)`: tonight can't be complete yet,
 * so counting it would show every user a broken streak all evening. The current
 * night is in a grace period, not a failure.
 */
export function computeStreak(entries, now = new Date(), rescue = null, rolloverHour) {
  const endDate = prevDay(currentNightOf(now, rolloverHour));
  let count = 0;
  let cursor = endDate;
  // Bounded so a corrupt entries map can't spin forever.
  while (count < 20000 && countsToward(cursor, entries, rescue)) {
    count += 1;
    cursor = prevDay(cursor);
  }
  return count;
}

/** The most recent night that counted, or null. */
export function lastCompletedNightOf(entries, now = new Date(), rescue = null, rolloverHour) {
  let cursor = prevDay(currentNightOf(now, rolloverHour));
  for (let i = 0; i < 20000; i += 1) {
    if (countsToward(cursor, entries, rescue)) return cursor;
    if (!entries?.[cursor] && i > 400) return null; // far past any plausible history
    cursor = prevDay(cursor);
  }
  return null;
}

/**
 * Refresh the monthly rescue allowance if we've rolled into a new month.
 *
 * Granted lazily on read rather than by a scheduled job - the allowance simply
 * refreshes the first time the user opens the app in a new month. Unused
 * rescues do NOT roll over.
 */
export function refreshRescue(rescue, now = new Date(), rolloverHour) {
  const currentMonth = monthKey(currentNightOf(now, rolloverHour));
  if (rescue?.monthKey === currentMonth) return rescue;
  return { monthKey: currentMonth, available: true, usedOn: null };
}

/* A rescue is only worth spending on a streak with something to lose. */
const MIN_STREAK_TO_RESCUE = 2;

/**
 * Whether to offer a rescue right now, and for which night.
 *
 * Only ever LAST NIGHT - never an arbitrary past gap. Allowing retroactive
 * rescue of any historical miss would make the streak meaningless. This is an
 * "I had a rough night, don't reset me" button, offered in the moment.
 */
export function getRescueOffer(entries, streakState, now = new Date(), rolloverHour) {
  const rescue = refreshRescue(streakState?.rescue, now, rolloverHour);
  const target = prevDay(currentNightOf(now, rolloverHour));

  if (!rescue.available) return { canRescue: false, reason: 'used', rescue, nightOf: null };
  if (isDayComplete(entries?.[target])) {
    return { canRescue: false, reason: 'not-needed', rescue, nightOf: null };
  }

  // The run that last night interrupted - i.e. what is actually at stake.
  const priorStreak = streakEndingBefore(entries, target, rescue);

  if (priorStreak < MIN_STREAK_TO_RESCUE) {
    return { canRescue: false, reason: 'streak-too-short', rescue, nightOf: null };
  }
  return { canRescue: true, reason: null, rescue, nightOf: target, priorStreak };
}

/** Unbroken run ending the day before `nightOf`. */
function streakEndingBefore(entries, nightOf, rescue) {
  let count = 0;
  let cursor = prevDay(nightOf);
  while (count < 20000 && countsToward(cursor, entries, rescue)) {
    count += 1;
    cursor = prevDay(cursor);
  }
  return count;
}

/**
 * Spend the monthly rescue on `nightOf`.
 *
 * Writes NO entry data. The night stays honestly empty and history labels it as
 * rescued - the streak is a motivation feature and must never put invented
 * scores into the clinical record.
 *
 * Scoped to the CURRENT month rather than the rescued night's month: rescuing
 * Jan 31 on Feb 1 spends February's allowance. Marginally generous, and it
 * avoids a rule nobody could explain.
 */
export function applyRescue(streakState, entries, nightOf, now = new Date(), rolloverHour) {
  const offer = getRescueOffer(entries, streakState, now, rolloverHour);
  if (!offer.canRescue || offer.nightOf !== nightOf) {
    return { ok: false, reason: offer.reason ?? 'invalid', streak: streakState };
  }

  const rescue = { ...offer.rescue, available: false, usedOn: nightOf };
  const history = [
    ...(streakState.rescueHistory ?? []),
    { monthKey: rescue.monthKey, nightOf, usedAt: now.toISOString() },
  ];
  return {
    ok: true,
    streak: recomputeStreakState({ ...streakState, rescue, rescueHistory: history }, entries, now, rolloverHour),
  };
}

/** Recompute the cached streak fields from the authoritative entries map. */
export function recomputeStreakState(streakState, entries, now = new Date(), rolloverHour) {
  const rescue = refreshRescue(streakState?.rescue, now, rolloverHour);
  const current = computeStreak(entries, now, rescue, rolloverHour);
  return {
    ...streakState,
    rescue,
    current,
    longest: Math.max(streakState?.longest ?? 0, current),
    lastCompletedNightOf: lastCompletedNightOf(entries, now, rescue, rolloverHour),
  };
}
