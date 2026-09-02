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
});
