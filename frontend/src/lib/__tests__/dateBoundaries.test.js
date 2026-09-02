import { describe, it, expect } from 'vitest';
import {
  toLocalISODate,
  fromLocalISODate,
  isValidISODate,
  currentNightOf,
  morningDateOf,
  prevDay,
  nextDay,
} from '../dates.js';

/* Calendar edges. The existing dates suite covers ordinary days; these are the
   ones that silently produce an off-by-one in production and never in a demo:
   month ends, leap years, year rollover, and the hours either side of the 4am
   sleep-episode boundary. */

describe('month, year and leap boundaries', () => {
  it.each([
    ['2026-01-31', '2026-02-01'],
    ['2026-02-28', '2026-03-01'],
    ['2026-04-30', '2026-05-01'],
    ['2026-12-31', '2027-01-01'],
  ])('nextDay(%s) is %s', (from, to) => {
    expect(nextDay(from)).toBe(to);
  });

  it.each([
    ['2026-03-01', '2026-02-28'],
    ['2026-01-01', '2025-12-31'],
  ])('prevDay(%s) is %s', (from, to) => {
    expect(prevDay(from)).toBe(to);
  });

  it('handles a leap day in both directions', () => {
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
    expect(nextDay('2028-02-29')).toBe('2028-03-01');
    expect(prevDay('2028-03-01')).toBe('2028-02-29');
  });

  it('rejects a leap day in a non-leap year', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
  });

  it('round-trips every day across a month boundary', () => {
    let iso = '2026-01-28';
    for (let i = 0; i < 8; i += 1) {
      expect(toLocalISODate(fromLocalISODate(iso))).toBe(iso);
      iso = nextDay(iso);
    }
  });
});

describe('rejects malformed dates', () => {
  it.each([
    '2026-13-01', '2026-00-10', '2026-02-30', '2026-1-1',
    '26-01-01', '2026/01/01', '', 'today', null, undefined, 20260101,
  ])('%s is not a valid ISO date', (value) => {
    expect(isValidISODate(value)).toBe(false);
  });
});

describe('the 4am sleep-episode boundary', () => {
  const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);

  it('files a 1:15am check-in under the previous night', () => {
    /* The insomnia case this app exists to track: logging at 1am must not open a
       new night and break the streak. */
    expect(currentNightOf(at(2026, 3, 10, 1, 15))).toBe('2026-03-09');
  });

  it.each([
    [0, 0, '2026-03-09'],
    [3, 59, '2026-03-09'],
    [4, 0, '2026-03-10'],
    [4, 1, '2026-03-10'],
    [23, 59, '2026-03-10'],
  ])('at %s:%s the night is %s', (h, min, expected) => {
    expect(currentNightOf(at(2026, 3, 10, h, min))).toBe(expected);
  });

  it('rolls back across a month boundary before 4am', () => {
    expect(currentNightOf(at(2026, 3, 1, 2, 0))).toBe('2026-02-28');
  });

  it('rolls back across a year boundary before 4am', () => {
    expect(currentNightOf(at(2026, 1, 1, 2, 0))).toBe('2025-12-31');
  });

  it('respects a custom rollover hour', () => {
    expect(currentNightOf(at(2026, 3, 10, 5, 0), 6)).toBe('2026-03-09');
    expect(currentNightOf(at(2026, 3, 10, 6, 0), 6)).toBe('2026-03-10');
  });
});

describe('morning pairing', () => {
  it('is always the day after the night began', () => {
    expect(morningDateOf('2026-03-09')).toBe('2026-03-10');
    expect(morningDateOf('2026-12-31')).toBe('2027-01-01');
    expect(morningDateOf('2028-02-28')).toBe('2028-02-29');
  });
});
