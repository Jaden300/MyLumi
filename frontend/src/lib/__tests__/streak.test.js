import { describe, it, expect } from 'vitest';
import {
  computeStreak,
  refreshRescue,
  getRescueOffer,
  applyRescue,
  recomputeStreakState,
  wasRescued,
} from '../streak.js';

/* Build an entries map from a list of nightOf dates, each fully logged. */
const complete = (...dates) =>
  Object.fromEntries(
    dates.map((d) => [d, { nightOf: d, night: { symptomBurden: 10 }, morning: { wakeTime: '07:00' } }]),
  );

const nightOnly = (date) => ({ [date]: { nightOf: date, night: { symptomBurden: 10 }, morning: null } });

const defaultStreak = (overrides = {}) => ({
  current: 0,
  longest: 0,
  lastCompletedNightOf: null,
  rescue: { monthKey: '2026-01', available: true, usedOn: null },
  rescueHistory: [],
  ...overrides,
});

// Evening of Jan 10 - so evaluation ends at Jan 9.
const NOW = new Date(2026, 0, 10, 21, 0);

describe('computeStreak', () => {
  it('counts an unbroken run ending last night', () => {
    expect(computeStreak(complete('2026-01-07', '2026-01-08', '2026-01-09'), NOW)).toBe(3);
  });

  it('does NOT count tonight - it cannot be complete yet', () => {
    // Jan 10 is in progress. Counting it would show every user a broken streak
    // all evening; the current night is a grace period, not a failure.
    const entries = { ...complete('2026-01-08', '2026-01-09'), ...nightOnly('2026-01-10') };
    expect(computeStreak(entries, NOW)).toBe(2);
  });

  it('requires both halves - a night-only entry breaks the run', () => {
    const entries = { ...complete('2026-01-07', '2026-01-08'), ...nightOnly('2026-01-09') };
    expect(computeStreak(entries, NOW)).toBe(0);
  });

  it('stops at a gap rather than counting older runs', () => {
    const entries = complete('2026-01-05', '2026-01-06', '2026-01-08', '2026-01-09');
    expect(computeStreak(entries, NOW)).toBe(2);
  });

  it('is 0 with no entries at all', () => {
    expect(computeStreak({}, NOW)).toBe(0);
  });

  it('self-heals after a long absence', () => {
    const entries = complete('2025-12-01', '2025-12-02');
    expect(computeStreak(entries, NOW)).toBe(0);
  });
});

describe('refreshRescue', () => {
  /* Resetting `usedOn` here is correct - this object is the monthly ALLOWANCE.
     The permanent record of which nights were rescued lives in `rescueHistory`,
     which is what `wasRescued` reads; see 'rescue survives a month boundary'. */
  it('grants a fresh allowance in a new month', () => {
    const stale = { monthKey: '2025-12', available: false, usedOn: '2025-12-20' };
    expect(refreshRescue(stale, NOW)).toEqual({ monthKey: '2026-01', available: true, usedOn: null });
  });

  it('leaves the current month untouched', () => {
    const current = { monthKey: '2026-01', available: false, usedOn: '2026-01-03' };
    expect(refreshRescue(current, NOW)).toBe(current);
  });

  it('does not roll unused rescues over', () => {
    const unused = { monthKey: '2025-12', available: true, usedOn: null };
    expect(refreshRescue(unused, NOW).monthKey).toBe('2026-01');
  });
});

describe('getRescueOffer', () => {
  it('offers a rescue for last night when a real run is at stake', () => {
    const entries = complete('2026-01-06', '2026-01-07', '2026-01-08'); // Jan 9 missed
    const offer = getRescueOffer(entries, defaultStreak(), NOW);
    expect(offer.canRescue).toBe(true);
    expect(offer.nightOf).toBe('2026-01-09');
    expect(offer.priorStreak).toBe(3);
  });

  it('does not offer when last night is already complete', () => {
    const offer = getRescueOffer(complete('2026-01-08', '2026-01-09'), defaultStreak(), NOW);
    expect(offer.canRescue).toBe(false);
    expect(offer.reason).toBe('not-needed');
  });

  it('does not waste the allowance on a one-day streak', () => {
    const entries = complete('2026-01-08'); // Jan 9 missed, only 1 day at stake
    const offer = getRescueOffer(entries, defaultStreak(), NOW);
    expect(offer.canRescue).toBe(false);
    expect(offer.reason).toBe('streak-too-short');
  });

  it('does not offer twice in one month', () => {
    const entries = complete('2026-01-06', '2026-01-07', '2026-01-08');
    const used = defaultStreak({ rescue: { monthKey: '2026-01', available: false, usedOn: '2026-01-03' } });
    const offer = getRescueOffer(entries, used, NOW);
    expect(offer.canRescue).toBe(false);
    expect(offer.reason).toBe('used');
  });
});

describe('applyRescue', () => {
  const entries = complete('2026-01-06', '2026-01-07', '2026-01-08'); // Jan 9 missed

  it('preserves the streak across the rescued night', () => {
    const result = applyRescue(defaultStreak(), entries, '2026-01-09', NOW);
    expect(result.ok).toBe(true);
    expect(result.streak.current).toBe(4); // Jan 6,7,8 + rescued Jan 9
    expect(result.streak.rescue.available).toBe(false);
    expect(result.streak.rescue.usedOn).toBe('2026-01-09');
  });

  it('writes NO entry data for the rescued night', () => {
    // The streak is a motivation feature; it must never put invented scores into
    // the clinical record.
    const result = applyRescue(defaultStreak(), entries, '2026-01-09', NOW);
    expect(result.ok).toBe(true);
    expect(entries['2026-01-09']).toBeUndefined();
  });

  it('records the rescue in history so the UI can label it honestly', () => {
    const result = applyRescue(defaultStreak(), entries, '2026-01-09', NOW);
    expect(result.streak.rescueHistory).toHaveLength(1);
    expect(result.streak.rescueHistory[0].nightOf).toBe('2026-01-09');
  });

  it('refuses a night that is not last night', () => {
    const result = applyRescue(defaultStreak(), entries, '2026-01-04', NOW);
    expect(result.ok).toBe(false);
  });

  it('refuses a second rescue in the same month', () => {
    const first = applyRescue(defaultStreak(), entries, '2026-01-09', NOW);
    const second = applyRescue(first.streak, entries, '2026-01-09', NOW);
    expect(second.ok).toBe(false);
  });
});

describe('wasRescued', () => {
  it('identifies the rescued night from the durable history', () => {
    const state = defaultStreak({
      rescue: { monthKey: '2026-01', available: false, usedOn: '2026-01-09' },
      rescueHistory: [{ monthKey: '2026-01', nightOf: '2026-01-09', usedAt: 'x' }],
    });
    expect(wasRescued('2026-01-09', state)).toBe(true);
    expect(wasRescued('2026-01-08', state)).toBe(false);
  });

  /* The bug this guards: `refreshRescue` resets the monthly ALLOWANCE on the 1st
     and nulls `usedOn`. Reading the rescued night off that object meant a
     rescued night silently stopped counting the moment the month ticked over. */
  it('still identifies a rescued night after the monthly allowance resets', () => {
    const state = defaultStreak({
      rescue: { monthKey: '2026-02', available: true, usedOn: null },
      rescueHistory: [{ monthKey: '2026-01', nightOf: '2026-01-30', usedAt: 'x' }],
    });
    expect(wasRescued('2026-01-30', state)).toBe(true);
  });
});

describe('rescue survives a month boundary', () => {
  /* Regression: a 5-night streak rescued on Jan 31 collapsed to 1 on Feb 1 and
     0 on Feb 2, purely because the calendar flipped. */
  it('keeps counting a night rescued in the previous month', () => {
    const entries = complete('2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29');
    const jan31 = new Date(2026, 0, 31, 21, 0);

    const rescued = applyRescue(
      defaultStreak({ rescue: { monthKey: '2026-01', available: true, usedOn: null } }),
      entries,
      '2026-01-30',
      jan31,
    );
    expect(rescued.ok).toBe(true);
    expect(rescued.streak.current).toBe(5); // Jan 26-29 + rescued Jan 30

    Object.assign(entries, complete('2026-01-31'));

    const feb1 = recomputeStreakState(rescued.streak, entries, new Date(2026, 1, 1, 9, 0));
    expect(feb1.current).toBe(6);
    expect(feb1.rescue.available).toBe(true); // February's allowance is fresh
    expect(feb1.rescueHistory).toHaveLength(1); // ...but January's record survives

    Object.assign(entries, complete('2026-02-01'));
    const feb2 = recomputeStreakState(feb1, entries, new Date(2026, 1, 2, 21, 0));
    expect(feb2.current).toBe(7);
  });

  it('still grants a fresh rescue in the new month', () => {
    const entries = complete('2026-01-28', '2026-01-29');
    const jan31 = new Date(2026, 0, 31, 21, 0);
    let state = applyRescue(defaultStreak(), entries, '2026-01-30', jan31).streak;
    Object.assign(entries, complete('2026-01-31', '2026-02-01')); // Feb 2 missed

    const feb3 = new Date(2026, 1, 3, 21, 0);
    state = recomputeStreakState(state, entries, feb3);
    const second = applyRescue(state, entries, '2026-02-02', feb3);

    expect(second.ok).toBe(true);
    expect(second.streak.rescueHistory).toHaveLength(2);
    expect(second.streak.current).toBe(6); // Jan 28,29 + rescued 30, 31, Feb 1 + rescued 2
  });
});

describe('recomputeStreakState', () => {
  it('raises longest but never lowers it', () => {
    const entries = complete('2026-01-08', '2026-01-09');
    const state = recomputeStreakState(defaultStreak({ longest: 10 }), entries, NOW);
    expect(state.current).toBe(2);
    expect(state.longest).toBe(10);
  });

  it('tracks a new record', () => {
    const entries = complete('2026-01-07', '2026-01-08', '2026-01-09');
    const state = recomputeStreakState(defaultStreak({ longest: 1 }), entries, NOW);
    expect(state.longest).toBe(3);
  });

  it('overrides a stale cached value - computed always wins', () => {
    const state = recomputeStreakState(defaultStreak({ current: 99 }), {}, NOW);
    expect(state.current).toBe(0);
  });
});
