import { describe, it, expect } from 'vitest';
import {
  toLocalISODate,
  fromLocalISODate,
  isValidISODate,
  currentNightOf,
  morningDateOf,
  prevDay,
  nextDay,
  daysBetween,
  eachDate,
  monthKey,
  daysSinceInjury,
  isValidTime,
  timeToMinutes,
  formatDuration,
} from '../dates.js';

describe('toLocalISODate', () => {
  it('uses local calendar parts, not UTC', () => {
    // 6pm local. Under toISOString() any timezone west of UTC would roll this
    // to the following day - the bug this function exists to prevent.
    const evening = new Date(2026, 0, 5, 18, 30);
    expect(toLocalISODate(evening)).toBe('2026-01-05');
  });

  it('handles the last minute of the day', () => {
    expect(toLocalISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(toLocalISODate(new Date(2026, 2, 7, 12, 0))).toBe('2026-03-07');
  });

  it('round-trips through fromLocalISODate', () => {
    expect(toLocalISODate(fromLocalISODate('2026-01-05'))).toBe('2026-01-05');
  });
});

describe('isValidISODate', () => {
  it('accepts real dates', () => {
    expect(isValidISODate('2026-01-05')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects malformed and impossible dates', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2025-02-29')).toBe(false); // not a leap year
    expect(isValidISODate('26-01-05')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });
});

describe('currentNightOf', () => {
  it('returns today for an evening check-in', () => {
    expect(currentNightOf(new Date(2026, 0, 5, 22, 30))).toBe('2026-01-05');
  });

  it('returns YESTERDAY at 2am - the insomnia case', () => {
    // A patient checking in at 2am on Jan 6 means the night of Jan 5. A midnight
    // rollover would file this on Jan 6 and break their streak.
    expect(currentNightOf(new Date(2026, 0, 6, 2, 0))).toBe('2026-01-05');
  });

  it('rolls over at 4am exactly', () => {
    expect(currentNightOf(new Date(2026, 0, 6, 3, 59))).toBe('2026-01-05');
    expect(currentNightOf(new Date(2026, 0, 6, 4, 0))).toBe('2026-01-06');
  });

  it('crosses month and year boundaries backwards', () => {
    expect(currentNightOf(new Date(2026, 0, 1, 1, 0))).toBe('2025-12-31');
  });

  it('respects a custom rollover hour', () => {
    expect(currentNightOf(new Date(2026, 0, 6, 5, 0), 6)).toBe('2026-01-05');
  });
});

describe('day arithmetic', () => {
  it('steps across month boundaries', () => {
    expect(nextDay('2026-01-31')).toBe('2026-02-01');
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
  });

  it('handles leap days', () => {
    expect(nextDay('2024-02-28')).toBe('2024-02-29');
    expect(nextDay('2024-02-29')).toBe('2024-03-01');
  });

  it('maps a night to the following morning', () => {
    expect(morningDateOf('2026-01-05')).toBe('2026-01-06');
  });
});

describe('daysBetween', () => {
  it('counts forward, backward, and same-day', () => {
    expect(daysBetween('2026-01-05', '2026-01-08')).toBe(3);
    expect(daysBetween('2026-01-08', '2026-01-05')).toBe(-3);
    expect(daysBetween('2026-01-05', '2026-01-05')).toBe(0);
  });

  it('counts across a DST transition without rounding error', () => {
    // US spring forward 2026-03-08 - a 23-hour local day.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('counts across a year boundary', () => {
    expect(daysBetween('2025-12-30', '2026-01-02')).toBe(3);
  });
});

describe('eachDate', () => {
  it('is inclusive of both ends', () => {
    expect(eachDate('2026-01-05', '2026-01-08')).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
    ]);
  });

  it('returns a single date when start equals end', () => {
    expect(eachDate('2026-01-05', '2026-01-05')).toEqual(['2026-01-05']);
  });

  it('returns empty for a reversed range', () => {
    expect(eachDate('2026-01-08', '2026-01-05')).toEqual([]);
  });
});

describe('monthKey and daysSinceInjury', () => {
  it('extracts the month', () => {
    expect(monthKey('2026-01-05')).toBe('2026-01');
  });

  it('counts day 0 as the day of injury', () => {
    expect(daysSinceInjury('2026-01-05', new Date(2026, 0, 5, 12, 0))).toBe(0);
    expect(daysSinceInjury('2026-01-05', new Date(2026, 0, 12, 12, 0))).toBe(7);
  });

  it('returns null for a missing injury date', () => {
    expect(daysSinceInjury(null)).toBe(null);
  });
});

describe('wall-clock times', () => {
  it('validates HH:mm', () => {
    expect(isValidTime('23:30')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:15')).toBe(false); // must be zero-padded
    expect(isValidTime('')).toBe(false);
  });

  it('converts to minutes', () => {
    expect(timeToMinutes('23:30')).toBe(1410);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('nonsense')).toBe(null);
  });

  it('formats durations', () => {
    expect(formatDuration(465)).toBe('7h 45m');
    expect(formatDuration(420)).toBe('7h');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(null)).toBe(null);
  });
});
