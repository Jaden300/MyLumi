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
import { buildDemoData, DEMO_LONG_NIGHTS } from '../demoSeed.js';
import { buildRegionModels, MIN_NIGHTS_FOR_REGION } from '../painTrajectory.js';
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

  /* The demo is what a judge sees, so what the journal cards will actually show
     on it is worth pinning - the same reasoning as the rho test above, and the
     same lesson: two of the three bugs in the Phase 3b depth pass were found by
     running models against this seed rather than against fixtures.

     This uses a stand-in for the backend's extractor (the real one is Python),
     matching how the demo's clinical text pairs symptom words with ratings. It
     asserts the SHAPE of what the card will say, not a specific finding. */
  it('produces enough symptom-word nights for the agreement check to run', () => {
    const entries = entriesOf(buildDemoData(NOW));
    // Words the backend vocabulary matches, drawn from the demo's own strings.
    const TERMS = {
      headache: ['headache'],
      fatigue: ['tired', 'exhausted', 'drained'],
      brainFog: ['foggy', 'fog'],
      photophobia: ['screens', 'bright'],
      phonophobia: ['loud', 'noisy'],
    };
    const analysed = entries.filter(
      (e) => (e.night.journal.day || e.night.journal.factors || e.morning.journal.wakeFeeling),
    );

    // Enough analysed nights to clear MIN_NIGHTS_FOR_AGREEMENT in agreement.js.
    expect(analysed.length).toBeGreaterThanOrEqual(12);

    // And at least one symptom is written about often enough to have four
    // nights on each side of the mentioned/silent split.
    const counts = Object.entries(TERMS).map(([key, words]) => {
      const mentioned = analysed.filter((e) => {
        const text = [
          e.night.journal.day, e.night.journal.factors, e.morning.journal.wakeFeeling,
        ].join(' ').toLowerCase();
        return words.some((w) => text.includes(w));
      }).length;
      return { key, mentioned, silent: analysed.length - mentioned };
    });
    expect(counts.some((c) => c.mentioned >= 4 && c.silent >= 4)).toBe(true);
  });

  it('sets an injury date before the first entry', () => {
    const data = buildDemoData(NOW);
    const first = Object.keys(data.entries).sort()[0];
    expect(data.profile.injuryDate < first).toBe(true);
    expect(data.profile.onboardedAt).toBeTruthy();
  });

  /* The pain courses, held to the same standard as the sleep-symptom effect:
     the structure is planted in the inputs and the real model has to find it.
     Nothing here asserts a specific slope - only that the demo exercises every
     answer the trend model can give, at BOTH lengths.

     Without this the demo can silently degrade into one where the pain page
     shows a wall of "not clear yet", or - worse, and this actually happened -
     one where a region planted flat reports a confident direction because the
     generator coupled it to a burden that was itself trending. */
  describe('pain courses', () => {
    const modelsFor = (nights) => {
      const data = buildDemoData(NOW, { nights });
      const entries = entriesOf(data);
      return buildRegionModels(entries, { injuryDate: data.profile.injuryDate });
    };

    for (const nights of [24, DEMO_LONG_NIGHTS]) {
      it(`shows every trend status at ${nights} nights`, () => {
        const models = modelsFor(nights);
        const statuses = models.map((m) => m.trend?.status ?? 'below-floor');

        expect(statuses).toContain('easing');
        expect(statuses).toContain('unclear');
        expect(statuses).toContain('below-floor');
      });

      it(`keeps the flat region genuinely undecidable at ${nights} nights`, () => {
        const lowerBack = modelsFor(nights).find((m) => m.regionId === 'lowerback_c');
        expect(lowerBack.n).toBeGreaterThanOrEqual(MIN_NIGHTS_FOR_REGION);
        expect(lowerBack.trend.status).toBe('unclear');
      });

      it(`gives the headline region a backtest to show at ${nights} nights`, () => {
        const neck = modelsFor(nights).find((m) => m.regionId === 'neck_c');
        expect(neck.trend.status).toBe('easing');
        expect(neck.backtest.n).toBeGreaterThan(0);
        expect(typeof neck.backtest.beatsNaive).toBe('boolean');
      });
    }

    /* The demo must not be one where the model wins everywhere - that would
       make the honesty card unreachable and leave "reported whichever way it
       goes" untested by eye. On this seed at least one region loses to the
       naive baseline, and that is a feature. */
    it('contains at least one region the model does not beat the baseline on', () => {
      const scored = modelsFor(DEMO_LONG_NIGHTS).filter((m) => m.backtest.n > 0);
      expect(scored.length).toBeGreaterThan(1);
      expect(scored.some((m) => m.backtest.beatsNaive === false)).toBe(true);
    });

    /* Gaps are the input the trajectory model has to handle honestly. A demo
       where every region is rated every night would never exercise the rule
       that an unmarked night is not a zero. */
    it('leaves gaps in every region series', () => {
      const data = buildDemoData(NOW, { nights: DEMO_LONG_NIGHTS });
      const entries = entriesOf(data);
      const answered = entries.filter((e) => e.night.pain?.answered).length;

      for (const model of modelsFor(DEMO_LONG_NIGHTS)) {
        expect(model.n).toBeLessThan(answered);
      }
    });
  });
});
