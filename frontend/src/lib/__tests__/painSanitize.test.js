import { describe, it, expect, beforeEach } from 'vitest';
import { clampHalfStep, clampInt, sanitizePain } from '../schema.js';
import { saveNightCheckIn, loadData } from '../entries.js';
import { __resetBackendForTests } from '../storage.js';
import { PAIN_MIN, PAIN_MAX, PAIN_STEP } from '../painRegions.js';
import { SYMPTOM_KEYS } from '../constants.js';

const NOW = new Date(2026, 0, 10, 22, 0);

describe('clampHalfStep', () => {
  it('accepts every valid half step in range', () => {
    for (let v = PAIN_MIN; v <= PAIN_MAX; v += PAIN_STEP) {
      expect(clampHalfStep(v, PAIN_MIN, PAIN_MAX)).toBe(v);
    }
  });

  it('accepts the boundaries', () => {
    expect(clampHalfStep(0, 0, 10)).toBe(0);
    expect(clampHalfStep(10, 0, 10)).toBe(10);
  });

  /* The reason this function exists at all.

     Reusing clampInt for pain would round 7.5 to 8 and store a rating the user
     never gave - the same category of fabrication as writing 0 for an
     unanswered field. Asserting both halves here documents the trap, so that a
     later "why do we have two of these?" cleanup has to read this first. */
  it('rejects an off-step value where clampInt would round it', () => {
    expect(clampHalfStep(7.3, 0, 10)).toBeNull();
    expect(clampInt(7.3, 0, 10)).toBe(7);

    expect(clampHalfStep(7.5, 0, 10)).toBe(7.5);
    expect(clampInt(7.5, 0, 10)).toBe(8);
  });

  it('rejects out of range values rather than clamping them', () => {
    expect(clampHalfStep(-0.5, 0, 10)).toBeNull();
    expect(clampHalfStep(10.5, 0, 10)).toBeNull();
  });

  it('rejects anything that is not a finite number', () => {
    expect(clampHalfStep(NaN, 0, 10)).toBeNull();
    expect(clampHalfStep(Infinity, 0, 10)).toBeNull();
    expect(clampHalfStep(null, 0, 10)).toBeNull();
    expect(clampHalfStep(undefined, 0, 10)).toBeNull();
    expect(clampHalfStep('7.5', 0, 10)).toBeNull();
    expect(clampHalfStep(true, 0, 10)).toBeNull();
  });
});

describe('sanitizePain', () => {
  it('returns null when the step never ran', () => {
    expect(sanitizePain(undefined)).toBeNull();
    expect(sanitizePain(null)).toBeNull();
    expect(sanitizePain('nonsense')).toBeNull();
  });

  it('returns null when answered is not explicitly true', () => {
    // A region map without the flag cannot be trusted to mean the user was
    // asked, so it is discarded rather than promoted to an answer.
    expect(sanitizePain({ regions: { thigh_r: 5 } })).toBeNull();
    expect(sanitizePain({ answered: false, regions: { thigh_r: 5 } })).toBeNull();
    expect(sanitizePain({ answered: 'yes', regions: {} })).toBeNull();
  });

  it('keeps an explicit no-pain-anywhere answer', () => {
    // Distinct from null. The user was asked and said none, which is data.
    expect(sanitizePain({ answered: true, regions: {} })).toEqual({
      answered: true,
      regions: {},
    });
  });

  it('keeps rated regions', () => {
    expect(sanitizePain({ answered: true, regions: { thigh_r: 6.5, neck_c: 4 } })).toEqual({
      answered: true,
      regions: { thigh_r: 6.5, neck_c: 4 },
    });
  });

  it('drops a region that was tapped and then cleared', () => {
    // The check-in's dotted-path setter can only write null, never delete, so
    // clearing arrives here as an explicit null.
    expect(sanitizePain({ answered: true, regions: { thigh_r: 6.5, neck_c: null } })).toEqual({
      answered: true,
      regions: { thigh_r: 6.5 },
    });
  });

  it('drops a region id it does not recognise', () => {
    expect(
      sanitizePain({ answered: true, regions: { thigh_r: 5, left_antenna: 9 } }),
    ).toEqual({ answered: true, regions: { thigh_r: 5 } });
  });

  it('drops an out of range or off-step score', () => {
    expect(
      sanitizePain({ answered: true, regions: { thigh_r: 11, neck_c: 6.3, hand_l: -1 } }),
    ).toEqual({ answered: true, regions: {} });
  });

  it('survives a malformed regions value', () => {
    expect(sanitizePain({ answered: true, regions: 'nope' })).toEqual({
      answered: true,
      regions: {},
    });
    expect(sanitizePain({ answered: true })).toEqual({ answered: true, regions: {} });
  });
});

describe('pain through the storage write path', () => {
  beforeEach(() => {
    __resetBackendForTests();
  });

  const nightValues = (overrides = {}) => ({
    symptoms: Object.fromEntries(SYMPTOM_KEYS.map((k) => [k, 2])),
    mood: 60,
    journal: { day: 'A steady day.', factors: '' },
    sleep: { plannedBedtime: '23:00', preSleepStress: 2, sleepAidUsed: false },
    ...overrides,
  });

  const saved = (values) => {
    const result = saveNightCheckIn(loadData(NOW), '2026-01-10', values, { now: NOW });
    expect(result.ok).toBe(true);
    return result.entry.night;
  };

  it('persists rated regions', () => {
    const night = saved(
      nightValues({ pain: { answered: true, regions: { thigh_r: 6.5, lowerback_c: 3 } } }),
    );
    expect(night.pain).toEqual({ answered: true, regions: { thigh_r: 6.5, lowerback_c: 3 } });
  });

  it('persists a half step without rounding it', () => {
    const night = saved(nightValues({ pain: { answered: true, regions: { knee_l: 7.5 } } }));
    expect(night.pain.regions.knee_l).toBe(7.5);
  });

  it('stores null when the step never ran', () => {
    expect(saved(nightValues()).pain).toBeNull();
  });

  it('stores an answered-but-empty block distinctly from null', () => {
    const night = saved(nightValues({ pain: { answered: true, regions: {} } }));
    expect(night.pain).not.toBeNull();
    expect(night.pain.regions).toEqual({});
  });

  it('drops a field that is not on the whitelist', () => {
    // Guards buildNightBlock's whitelist behaviour itself: anything not named
    // there must not reach storage, however plausible it looks.
    const night = saved(nightValues({ painNotes: 'a private note' }));
    expect(night.painNotes).toBeUndefined();
    expect(JSON.stringify(night)).not.toContain('private');
  });
});
