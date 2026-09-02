/* The weekly summary and the daily comparison.

   What these tests are really protecting: the app must not describe a week it
   barely observed. A "summary" built from two check-ins would present the noise
   of when someone remembered to log as though it were a pattern in their
   recovery, and it would look identical to a summary built from seven. */

import { describe, it, expect } from 'vitest';
import { buildWeeklySummary, compareToRecent, median, MIN_NIGHTS } from '../weekly.js';

const SYMPTOM_KEYS = [
  'headache',
  'photophobia',
  'phonophobia',
  'brainFog',
  'nausea',
  'dizziness',
  'fatigue',
  'moodDisturbance',
  'concentration',
];

function night(nightOf, { base = 1, overrides = {}, sleepQuality = null } = {}) {
  const symptoms = Object.fromEntries(SYMPTOM_KEYS.map((k) => [k, base]));
  Object.assign(symptoms, overrides);
  const values = SYMPTOM_KEYS.map((k) => symptoms[k]);
  const symptomBurden = values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;
  return {
    nightOf,
    night: { symptoms, symptomBurden },
    morning: sleepQuality === null ? null : { sleepQuality },
  };
}

const NOW = new Date(2026, 0, 20, 21, 0); // Jan 20; this week is Jan 14-20.

/* n consecutive nights ending on `end`, oldest first. */
function run(end, n, optsFor = () => ({})) {
  const out = [];
  const [y, m, d] = end.split('-').map(Number);
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date(y, m - 1, d - i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    out.push(night(iso, optsFor(n - 1 - i)));
  }
  return out;
}

describe('median', () => {
  it('takes the middle value of an odd-length set', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('averages the two middle values of an even-length set', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('is null for an empty set rather than 0', () => {
    expect(median([])).toBeNull();
  });
});

describe('buildWeeklySummary', () => {
  it('summarises a full week', () => {
    const result = buildWeeklySummary(run('2026-01-20', 7), { now: NOW });
    expect(result.available).toBe(true);
    expect(result.nComplete).toBe(7);
    expect(result.meanBurden).toBe(9); // base 1 across 9 symptoms
  });

  it(`refuses to summarise fewer than ${MIN_NIGHTS} nights`, () => {
    const result = buildWeeklySummary(run('2026-01-20', 3), { now: NOW });
    expect(result.available).toBe(false);
    expect(result.nComplete).toBe(3);
    expect(result.meanBurden).toBeNull();
  });

  it('excludes a night missing one symptom from the mean', () => {
    // Its symptomBurden is already null, so a partial sum can never reach here.
    const entries = run('2026-01-20', 7);
    entries[0] = night(entries[0].nightOf, { overrides: { headache: null } });
    const result = buildWeeklySummary(entries, { now: NOW });
    expect(result.nComplete).toBe(6);
    expect(result.meanBurden).toBe(9);
  });

  it('reports a delta when both weeks clear the bar', () => {
    const entries = [...run('2026-01-13', 7, () => ({ base: 1 })), ...run('2026-01-20', 7, () => ({ base: 3 }))];
    const result = buildWeeklySummary(entries, { now: NOW });
    expect(result.deltaVsPriorWeek).toBe(18); // 27 - 9
  });

  it('gives NO delta when the prior week is too thin to compare against', () => {
    // Two nights last week is not a week. A delta here would present the
    // irregularity of someone's logging as a change in their symptoms.
    const entries = [...run('2026-01-13', 2, () => ({ base: 1 })), ...run('2026-01-20', 7, () => ({ base: 3 }))];
    expect(buildWeeklySummary(entries, { now: NOW }).deltaVsPriorWeek).toBeNull();
  });

  it('ignores nights outside the window', () => {
    const entries = [...run('2026-01-05', 7, () => ({ base: 6 })), ...run('2026-01-20', 7, () => ({ base: 1 }))];
    expect(buildWeeklySummary(entries, { now: NOW }).meanBurden).toBe(9);
  });

  it('names the worst symptom by its mean across the week', () => {
    const entries = run('2026-01-20', 7, () => ({ base: 1, overrides: { nausea: 5 } }));
    expect(buildWeeklySummary(entries, { now: NOW }).worstSymptom.key).toBe('nausea');
  });

  it('resolves worst-symptom ties deterministically', () => {
    // All equal. A summary that reshuffles between renders reads as instability
    // in the user's recovery rather than in our sort.
    const entries = run('2026-01-20', 7, () => ({ base: 2 }));
    const a = buildWeeklySummary(entries, { now: NOW }).worstSymptom;
    const b = buildWeeklySummary(entries, { now: NOW }).worstSymptom;
    expect(a.key).toBe(b.key);
    expect(a.key).toBe('headache'); // first in SYMPTOM_KEYS order
  });

  it('gives no worst symptom when the week was symptom-free', () => {
    const entries = run('2026-01-20', 7, () => ({ base: 0 }));
    expect(buildWeeklySummary(entries, { now: NOW }).worstSymptom).toBeNull();
  });

  it('finds the best and worst nights by burden', () => {
    const entries = run('2026-01-20', 7, (i) => ({ base: i === 0 ? 0 : i === 6 ? 6 : 2 }));
    const result = buildWeeklySummary(entries, { now: NOW });
    expect(result.bestNight.value).toBe(0);
    expect(result.worstNight.value).toBe(54);
  });

  it('reports sleep extremes only from nights with a morning check-in', () => {
    const entries = run('2026-01-20', 7).map((e, i) =>
      i < 3 ? { ...e, morning: { sleepQuality: i } } : e,
    );
    const result = buildWeeklySummary(entries, { now: NOW });
    expect(result.worstSleep.value).toBe(0);
    expect(result.bestSleep.value).toBe(2);
  });

  it('leaves sleep extremes null when no morning check-ins exist', () => {
    const result = buildWeeklySummary(run('2026-01-20', 7), { now: NOW });
    expect(result.bestSleep).toBeNull();
    expect(result.worstSleep).toBeNull();
  });
});

describe('compareToRecent', () => {
  const history = (base) => run('2026-01-19', 7, () => ({ base }));

  it('calls a much lower burden lighter than usual', () => {
    const today = night('2026-01-20', { base: 0 });
    const result = compareToRecent(today, [...history(3), today], { now: NOW });
    expect(result.direction).toBe('lighter');
  });

  it('calls a much higher burden heavier than usual', () => {
    const today = night('2026-01-20', { base: 6 });
    const result = compareToRecent(today, [...history(1), today], { now: NOW });
    expect(result.direction).toBe('heavier');
  });

  it('calls a small difference similar rather than manufacturing a change', () => {
    const today = night('2026-01-20', { base: 3 });
    const result = compareToRecent(today, [...history(3), today], { now: NOW });
    expect(result.direction).toBe('similar');
  });

  it(`returns null under ${MIN_NIGHTS} prior nights - there is no "usual" yet`, () => {
    const today = night('2026-01-20', { base: 6 });
    const prior = run('2026-01-19', 2, () => ({ base: 1 }));
    expect(compareToRecent(today, [...prior, today], { now: NOW })).toBeNull();
  });

  it('returns null when the night itself has no burden', () => {
    const today = night('2026-01-20', { overrides: { headache: null } });
    expect(compareToRecent(today, [...history(3), today], { now: NOW })).toBeNull();
  });

  it('uses a median so one catastrophic night does not shift the baseline', () => {
    // Six quiet nights and one terrible one. A mean baseline would be dragged up
    // and make an ordinary day look like an improvement.
    const prior = run('2026-01-19', 7, (i) => ({ base: i === 3 ? 6 : 1 }));
    const today = night('2026-01-20', { base: 1 });
    const result = compareToRecent(today, [...prior, today], { now: NOW });
    expect(result.baseline).toBe(9);
    expect(result.direction).toBe('similar');
  });
});
