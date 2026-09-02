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
  it('identifies the rescued night', () => {
    const rescue = { monthKey: '2026-01', available: false, usedOn: '2026-01-09' };
    expect(wasRescued('2026-01-09', rescue)).toBe(true);
    expect(wasRescued('2026-01-08', rescue)).toBe(false);
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
