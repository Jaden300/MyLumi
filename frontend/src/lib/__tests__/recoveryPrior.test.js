import { describe, it, expect } from 'vitest';
import {
  PEAK_DAY,
  HALF_LIFE_DAYS,
  PRIOR_EQUAL_WEIGHT_N,
  priorShape,
  priorRating,
  priorWeight,
} from '../recoveryPrior.js';
import { PAIN_MAX } from '../painRegions.js';

describe('priorShape', () => {
  it('peaks at the day the literature figure names', () => {
    const peak = priorShape(PEAK_DAY);
    expect(peak).toBeCloseTo(1, 10);
    // Strictly higher than either side, so "peak" is a real maximum rather
    // than a plateau the curve happens to touch.
    expect(peak).toBeGreaterThan(priorShape(PEAK_DAY - 1));
    expect(peak).toBeGreaterThan(priorShape(PEAK_DAY + 1));
  });

  it('starts at zero and rises to the peak', () => {
    expect(priorShape(0)).toBe(0);
    for (let day = 1; day <= PEAK_DAY; day += 1) {
      expect(priorShape(day)).toBeGreaterThan(priorShape(day - 1));
    }
  });

  it('decays monotonically after the peak and never reaches zero', () => {
    for (let day = PEAK_DAY + 1; day <= 120; day += 1) {
      expect(priorShape(day)).toBeLessThan(priorShape(day - 1));
      expect(priorShape(day)).toBeGreaterThan(0);
    }
  });

  /* The one free parameter in the file, pinned so it cannot drift without
     someone deciding to change it.

     HALF_LIFE_DAYS is derived from "most people improve substantially within
     about four weeks", read as the curve having fallen to a quarter of its
     peak by day 28. If that reading is ever revised, this test is the thing
     that should fail first. */
  it('has fallen to about a quarter of peak by four weeks, which is what fixes the half life', () => {
    expect(priorShape(PEAK_DAY + 2 * HALF_LIFE_DAYS)).toBeCloseTo(0.25, 10);
    expect(priorShape(28)).toBeGreaterThan(0.2);
    expect(priorShape(28)).toBeLessThan(0.3);
  });

  /* A missing injury date is a real state - the profile field is optional -
     and it must not silently read as "day 0". Day 0 is a legitimate answer
     (zero, pre-peak); an absent date has no answer at all. */
  it('returns null for a missing or nonsense day rather than treating it as day zero', () => {
    expect(priorShape(null)).toBeNull();
    expect(priorShape(undefined)).toBeNull();
    expect(priorShape(NaN)).toBeNull();
    expect(priorShape(-1)).toBeNull();
    expect(priorShape(0)).toBe(0);
  });
});

describe('priorRating', () => {
  it('scales the shape by the user own observed peak', () => {
    expect(priorRating(PEAK_DAY, 8)).toBeCloseTo(8, 10);
    expect(priorRating(PEAK_DAY, 4)).toBeCloseTo(4, 10);
  });

  it('never exceeds the pain scale', () => {
    for (let day = 0; day <= 60; day += 1) {
      const rating = priorRating(day, PAIN_MAX);
      expect(rating).toBeLessThanOrEqual(PAIN_MAX);
      expect(rating).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns null when either input is missing', () => {
    expect(priorRating(null, 8)).toBeNull();
    expect(priorRating(10, null)).toBeNull();
    expect(priorRating(10, NaN)).toBeNull();
  });
});

describe('priorWeight', () => {
  it('is everything with no data and even at the app insight floor', () => {
    expect(priorWeight(0)).toBe(1);
    expect(priorWeight(PRIOR_EQUAL_WEIGHT_N)).toBeCloseTo(0.5, 10);
  });

  it('decays as observations arrive but never reaches zero', () => {
    let previous = priorWeight(1);
    for (let n = 2; n <= 200; n += 1) {
      const weight = priorWeight(n);
      expect(weight).toBeLessThan(previous);
      expect(weight).toBeGreaterThan(0);
      previous = weight;
    }
  });

  /* A negative or missing n means "we know nothing", which is the same
     epistemic state as n = 0 and must give the prior full weight. Returning
     something less would let a malformed count quietly promote a fit that does
     not exist. */
  it('gives the prior full weight for a missing or negative count', () => {
    expect(priorWeight(null)).toBe(1);
    expect(priorWeight(NaN)).toBe(1);
    expect(priorWeight(-5)).toBe(1);
  });
});
