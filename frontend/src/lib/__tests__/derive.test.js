import { describe, it, expect } from 'vitest';
import {
  computeSymptomBurden,
  deriveSleepDuration,
  awakeningsToOrdinal,
  isDayComplete,
  worstSymptom,
  toFeatureRow,
} from '../derive.js';
import { SYMPTOM_KEYS } from '../constants.js';

const symptoms = (overrides = {}) =>
  Object.fromEntries(SYMPTOM_KEYS.map((k) => [k, overrides[k] ?? 0]));

const entryWith = ({ bedtime = '23:30', wakeTime = '07:15', ...rest } = {}) => ({
  nightOf: '2026-01-05',
  night: {
    symptoms: symptoms(rest.symptoms),
    symptomBurden: computeSymptomBurden(symptoms(rest.symptoms)),
    mood: 50,
    sleep: { plannedBedtime: bedtime, preSleepStress: 3, sleepAidUsed: false },
  },
  morning: wakeTime ? { wakeTime, sleepQuality: 4, awakenings: '1' } : null,
});

describe('computeSymptomBurden', () => {
  it('sums all nine items', () => {
    expect(computeSymptomBurden(symptoms({ headache: 3, fatigue: 5, nausea: 1 }))).toBe(9);
  });

  it('returns 0 when every item is 0', () => {
    expect(computeSymptomBurden(symptoms())).toBe(0);
  });

  it('returns null if ANY item is missing', () => {
    // A partial sum would understate burden and read as a real, lower score.
    const partial = symptoms({ headache: 4 });
    delete partial.fatigue;
    expect(computeSymptomBurden(partial)).toBe(null);
  });

  it('returns null for missing input', () => {
    expect(computeSymptomBurden(null)).toBe(null);
  });
});

describe('deriveSleepDuration', () => {
  it('handles a normal overnight sleep', () => {
    expect(deriveSleepDuration(entryWith({ bedtime: '23:30', wakeTime: '07:15' }))).toBe(465);
  });

  it('handles a bedtime after midnight', () => {
    expect(deriveSleepDuration(entryWith({ bedtime: '01:00', wakeTime: '08:00' }))).toBe(420);
  });

  it('treats an equal bedtime and wake time as a full 24h wrap', () => {
    expect(deriveSleepDuration(entryWith({ bedtime: '23:00', wakeTime: '23:00' }))).toBe(1440);
  });

  it('returns null when the morning half is missing', () => {
    expect(deriveSleepDuration(entryWith({ wakeTime: null }))).toBe(null);
  });
});

describe('awakeningsToOrdinal', () => {
  it('maps "3+" to 3, documenting the lost "or more"', () => {
    expect(awakeningsToOrdinal('3+')).toBe(3);
  });

  it('maps numeric strings', () => {
    expect(awakeningsToOrdinal('0')).toBe(0);
    expect(awakeningsToOrdinal('2')).toBe(2);
  });

  it('rejects nonsense', () => {
    expect(awakeningsToOrdinal('many')).toBe(null);
    expect(awakeningsToOrdinal(null)).toBe(null);
  });
});

describe('isDayComplete', () => {
  it('requires BOTH halves', () => {
    expect(isDayComplete(entryWith())).toBe(true);
    expect(isDayComplete(entryWith({ wakeTime: null }))).toBe(false);
    expect(isDayComplete({ nightOf: '2026-01-05', night: null, morning: { wakeTime: '07:00' } })).toBe(false);
    expect(isDayComplete(null)).toBe(false);
  });
});

describe('worstSymptom', () => {
  it('finds the highest-scoring symptom', () => {
    const entry = entryWith({ symptoms: { headache: 3, fatigue: 5 } });
    expect(worstSymptom(entry)).toEqual({ key: 'fatigue', value: 5 });
  });

  it('returns null on a symptom-free day rather than naming a zero', () => {
    expect(worstSymptom(entryWith())).toBe(null);
  });
});

describe('toFeatureRow', () => {
  it('flattens an episode and pulls the target from the next one', () => {
    const today = entryWith({ symptoms: { headache: 4 } });
    const tomorrow = { nightOf: '2026-01-06', night: { symptomBurden: 12 }, morning: null };
    const row = toFeatureRow(today, tomorrow, '2026-01-01');

    expect(row.symptomBurden).toBe(4);
    expect(row.nextSymptomBurden).toBe(12);
    expect(row.sleepDurationMinutes).toBe(465);
    expect(row.daysSinceInjury).toBe(4);
    expect(row.symptom_headache).toBe(4);
  });

  it('never includes journal text', () => {
    const entry = entryWith();
    entry.night.journal = { day: 'private content', factors: 'more private content' };
    const row = toFeatureRow(entry);
    expect(JSON.stringify(row)).not.toContain('private content');
  });

  it('returns null without a night block', () => {
    expect(toFeatureRow({ nightOf: '2026-01-05', night: null, morning: null })).toBe(null);
  });

  /* A real "no" and an unanswered question are different observations, and the
     no-fabrication rule does not stop applying at the network boundary. These
     two fields used to collapse both to 0. */
  it('sends null, not 0, for an unanswered boolean', () => {
    const entry = entryWith();
    delete entry.night.sleep.sleepAidUsed;
    delete entry.morning.dreamRecall;

    const row = toFeatureRow(entry);
    expect(row.sleepAidUsed).toBe(null);
    expect(row.dreamRecall).toBe(null);
  });

  it('still distinguishes an explicit false from a missing answer', () => {
    const entry = entryWith();
    entry.night.sleep.sleepAidUsed = false;
    entry.morning.dreamRecall = true;

    const row = toFeatureRow(entry);
    expect(row.sleepAidUsed).toBe(0);
    expect(row.dreamRecall).toBe(1);
  });

  describe('pain aggregates', () => {
    const withPain = (pain) => {
      const entry = entryWith();
      entry.night.pain = pain;
      return toFeatureRow(entry);
    };

    it('sends nothing at all when the pain step never ran', () => {
      const row = withPain(undefined);
      expect(row.painRegionCount).toBeNull();
      expect(row.painMax).toBeNull();
      expect(row.painMean).toBeNull();
    });

    /* The fabrication guard, and the reason it is named this way: a later
       simplification will want to make these three consistent, and consistency
       is exactly the wrong answer. A count over an empty set is a real 0. A
       maximum over an empty set is undefined, and sending 0 would assert the
       worst pain measured zero - which is not what "nothing hurt" means. */
    it('sends a real 0 count for no pain, but leaves max and mean undefined', () => {
      const row = withPain({ answered: true, regions: {} });
      expect(row.painRegionCount).toBe(0);
      expect(row.painMax).toBeNull();
      expect(row.painMean).toBeNull();
    });

    it('summarises marked regions', () => {
      const row = withPain({ answered: true, regions: { thigh_r: 6.5, neck_c: 4, knee_l: 2 } });
      expect(row.painRegionCount).toBe(3);
      expect(row.painMax).toBe(6.5);
      expect(row.painMean).toBeCloseTo(4.17, 2);
    });

    it('ignores a marked but unrated region in the ratings', () => {
      // Marked-without-a-score says where, not how much. It counts as an area
      // but must not be averaged in as though it were a rating.
      const row = withPain({ answered: true, regions: { thigh_r: 6, neck_c: null } });
      expect(row.painRegionCount).toBe(1);
      expect(row.painMax).toBe(6);
    });

    it('keeps the mean short rather than sending full float precision', () => {
      const row = withPain({ answered: true, regions: { thigh_r: 5, neck_c: 6, knee_l: 8 } });
      expect(String(row.painMean).length).toBeLessThanOrEqual(5);
    });

    it('stays flat, with no nested pain object leaking through', () => {
      const row = withPain({ answered: true, regions: { thigh_r: 6.5 } });
      expect(row.pain).toBeUndefined();
      // Scalars only. null is expected and everywhere - it is how this payload
      // says "not answered" - so it is the one object-typed value allowed.
      for (const [key, value] of Object.entries(row)) {
        expect(value === null || typeof value !== 'object', `${key} is not a scalar`).toBe(true);
      }
    });
  });
});
