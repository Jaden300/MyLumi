/* Demo data.

   The tests that matter here are not "does it produce 24 entries" - they are
   the ones asserting the demo is HONEST:

   - it is marked as demo data, so the app can say so on every screen
   - the sleep-symptom effect genuinely exists in the generated inputs, so the
     correlation engine discovers it rather than being told it
   - it contains gaps, so the missing-data handling is visible in a demo
   - every entry is well-formed enough to survive the same code path real
     entries take

   If the planted effect ever stops being detectable, the demo silently becomes
   one where MyLumi's headline feature finds nothing. That is worth a test. */

import { describe, it, expect } from 'vitest';
import { buildDemoData } from '../demoSeed.js';
import { normalizeData } from '../schema.js';
import { computeSymptomBurden, deriveSleepDuration, isDayComplete } from '../derive.js';
import { SYMPTOM_KEYS, MAX_SYMPTOM_BURDEN } from '../constants.js';
import { currentNightOf, prevDay } from '../dates.js';
import { getCheckInStatus } from '../entries.js';

const NOW = new Date('2026-06-15T09:00:00');

const entriesOf = (data) => Object.keys(data.entries).sort().map((k) => data.entries[k]);

/* Spearman's rho: Pearson over ranks. Average ranks for ties, matching
   scipy.stats.spearmanr, which is what the backend actually runs. */
function spearman(xs, ys) {
  const rank = (values) => {
    const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = new Array(values.length);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks[order[k][1]] = avg;
      i = j + 1;
    }
    return ranks;
  };

  const rx = rank(xs);
  const ry = rank(ys);
  const n = rx.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

describe('buildDemoData', () => {
  it('marks itself as demo data', () => {
    // The whole "judges must never mistake this for real data" story hangs on
    // this one flag being set.
    expect(buildDemoData(NOW).meta.isDemoData).toBe(true);
  });

  it('is deterministic', () => {
    // A demo that differs between two machines is worse than no demo.
    const a = JSON.stringify(buildDemoData(NOW));
    const b = JSON.stringify(buildDemoData(NOW));
    expect(a).toBe(b);
  });

  it('produces enough complete nights to clear the 7-night threshold', () => {
    const complete = entriesOf(buildDemoData(NOW)).filter(isDayComplete);
    expect(complete.length).toBeGreaterThanOrEqual(14);
  });

  it('leaves today unlogged, so the dashboard opens with something to do', () => {
    const data = buildDemoData(NOW);
    expect(data.entries['2026-06-15']).toBeUndefined();
    expect(data.entries['2026-06-14']).toBeDefined();
  });

  /* Regression: the seed keyed off the calendar date rather than the current
     night, so loading the demo between midnight and 4am filled in the night
     still in progress and opened on the "all caught up" dead end this feature
     exists to avoid. Demos do get run at 1am. */
  it('leaves the current night unlogged at every hour, including before rollover', () => {
    for (const [h, m] of [[9, 0], [21, 0], [1, 30], [3, 59], [4, 1], [23, 59]]) {
      const now = new Date(2026, 5, 15, h, m);
      const data = buildDemoData(now);
      const tonight = currentNightOf(now);

      expect(data.entries[tonight]).toBeUndefined();
      expect(data.entries[prevDay(tonight)]).toBeDefined();
      expect(getCheckInStatus(data, now).primary).toBe('night');
    }
  });

  it('contains gaps, so missing-data handling is visible', () => {
    const data = buildDemoData(NOW);
    const dates = Object.keys(data.entries).sort();
    const span =
      (Date.parse(dates.at(-1)) - Date.parse(dates[0])) / 86400000 + 1;
    expect(span).toBeGreaterThan(dates.length);
  });

  it('survives normalizeData unchanged', () => {
    // Demo data goes through the same storage path as real data.
    const data = buildDemoData(NOW);
    const normalized = normalizeData(JSON.parse(JSON.stringify(data)), NOW);
    expect(Object.keys(normalized.entries)).toEqual(Object.keys(data.entries));
    expect(normalized.meta.isDemoData).toBe(true);
  });

  it('never fabricates an out-of-range score', () => {
    for (const entry of entriesOf(buildDemoData(NOW))) {
      for (const key of SYMPTOM_KEYS) {
        const v = entry.night.symptoms[key];
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(6);
      }
      expect(entry.night.symptomBurden).toBe(computeSymptomBurden(entry.night.symptoms));
      expect(entry.night.symptomBurden).toBeLessThanOrEqual(MAX_SYMPTOM_BURDEN);
      expect(entry.night.mood).toBeGreaterThanOrEqual(0);
      expect(entry.night.mood).toBeLessThanOrEqual(100);
      expect(entry.morning.sleepQuality).toBeGreaterThanOrEqual(0);
      expect(entry.morning.sleepQuality).toBeLessThanOrEqual(6);
    }
  });

  it('produces plausible sleep durations', () => {
    for (const entry of entriesOf(buildDemoData(NOW))) {
      const minutes = deriveSleepDuration(entry);
      expect(minutes).toBeGreaterThan(4 * 60);
      expect(minutes).toBeLessThan(11 * 60);
    }
  });

  it('plants a REAL lagged sleep-symptom effect for the models to find', () => {
    /* The headline assertion. Nights following short sleep must actually carry a
       heavier symptom burden in the generated data - otherwise the correlation
       engine correctly finds nothing and the demo shows an empty insights page.

       Note this checks the LAGGED direction (last night's sleep -> today's
       symptoms), which is the claim the product actually makes. */
    const entries = entriesOf(buildDemoData(NOW));
    const afterShort = [];
    const afterNormal = [];

    for (let i = 1; i < entries.length; i += 1) {
      const prev = entries[i - 1];
      const curr = entries[i];
      // Only genuinely adjacent nights, matching how buildRows pairs them.
      const adjacent =
        (Date.parse(curr.nightOf) - Date.parse(prev.nightOf)) / 86400000 === 1;
      if (!adjacent) continue;

      const prevSleepHours = deriveSleepDuration(prev) / 60;
      (prevSleepHours < 6.5 ? afterShort : afterNormal).push(curr.night.symptomBurden);
    }

    // Enough short nights for the rank test to have something to work with.
    expect(afterShort.length).toBeGreaterThanOrEqual(5);
    expect(afterNormal.length).toBeGreaterThan(0);

    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(afterShort)).toBeGreaterThan(mean(afterNormal) + 5);
  });

  it('produces a rank correlation strong enough to survive Holm correction', () => {
    /* The mean-difference test above is NOT sufficient, and this test exists
       because that lesson was learned the hard way: an earlier seed passed it
       while the real engine rejected the finding and left the demo's headline
       card empty.

       The backend uses Spearman with MIN_ABS_RHO = 0.4, and Holm-Bonferroni
       across 4 candidate features means the smallest p must beat 0.05/4 =
       0.0125. So assert on the actual statistic the engine computes, with
       margin. See backend/app/models/correlation.py. */
    const entries = entriesOf(buildDemoData(NOW));

    const xs = [];
    const ys = [];
    for (let i = 1; i < entries.length; i += 1) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if ((Date.parse(curr.nightOf) - Date.parse(prev.nightOf)) / 86400000 !== 1) continue;
      xs.push(deriveSleepDuration(prev) / 60);
      ys.push(curr.night.symptomBurden);
    }

    const rho = spearman(xs, ys);
    // Negative: more sleep, lower burden. Comfortably past the 0.4 floor.
    expect(rho).toBeLessThan(-0.6);
  });

  it('shows a downward recovery trend overall', () => {
    const entries = entriesOf(buildDemoData(NOW));
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const half = Math.floor(entries.length / 2);
    const first = mean(entries.slice(0, half).map((e) => e.night.symptomBurden));
    const last = mean(entries.slice(half).map((e) => e.night.symptomBurden));
    expect(last).toBeLessThan(first);
  });

  it('writes journal text on the days that have it, for the NLP demo', () => {
    const entries = entriesOf(buildDemoData(NOW));
    const withText = entries.filter((e) => e.night.journal.day.length > 0);
    // The backend needs 5+ scorable entries before it will state a trend.
    expect(withText.length).toBeGreaterThanOrEqual(10);
  });

  it('sets an injury date before the first entry', () => {
    const data = buildDemoData(NOW);
    const first = Object.keys(data.entries).sort()[0];
    expect(data.profile.injuryDate < first).toBe(true);
    expect(data.profile.onboardedAt).toBeTruthy();
  });
});
