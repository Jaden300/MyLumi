import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MIN_NIGHTS_FOR_REGION,
  MIN_WEEKLY_SLOPE,
  backtestRegion,
  buildRegionModels,
  buildTimelineFrames,
  projectRegion,
  ratedRegions,
  regionSeries,
  regionTrend,
  theilSen,
  theilSenInterval,
} from '../painTrajectory.js';
import { PAIN_MAX } from '../painRegions.js';

/* Dense range helper, matching what getEntryRange returns: every date present,
   unlogged nights as empty entries. */
function range(specs) {
  return specs.map((spec, i) => {
    const nightOf = `2026-01-${String(i + 1).padStart(2, '0')}`;
    if (spec === null) return { nightOf, night: null, morning: null };
    return { nightOf, night: { pain: spec }, morning: null };
  });
}

const marked = (regions) => ({ answered: true, regions });
const nothingHurt = () => ({ answered: true, regions: {} });

describe('regionSeries', () => {
  /* The single most consequential rule in this file.

     If Tuesday's absence became a neck rating of 0, every trend would be
     dragged toward zero and the model would manufacture recoveries nobody
     reported. The stored record genuinely cannot tell "my neck was fine" from
     "I did not mark my neck", so the only honest move is to carry neither. */
  it('omits nights the region was not marked rather than scoring them zero', () => {
    const entries = range([
      marked({ neck_c: 6 }),
      marked({ knee_l: 3 }),
      marked({ neck_c: 5 }),
    ]);
    const series = regionSeries(entries, 'neck_c');

    expect(series.map((p) => p.score)).toEqual([6, 5]);
    expect(series.map((p) => p.nightOf)).toEqual(['2026-01-01', '2026-01-03']);
    expect(series.some((p) => p.score === 0)).toBe(false);
  });

  /* "Nothing hurt" is an answered question and a real clinical fact, but it is
     not a rating of this region. It stays out of the series for the same
     reason: the user said nothing hurt, not that their neck was a zero. */
  it('omits explicit nothing-hurt nights from a region series', () => {
    const entries = range([marked({ neck_c: 6 }), nothingHurt(), marked({ neck_c: 4 })]);
    expect(regionSeries(entries, 'neck_c').map((p) => p.score)).toEqual([6, 4]);
  });

  it('skips nights where the pain step never ran', () => {
    const entries = range([marked({ neck_c: 6 }), null, marked({ neck_c: 4 })]);
    expect(regionSeries(entries, 'neck_c')).toHaveLength(2);
  });

  it('measures days from the injury date when there is one', () => {
    const entries = range([marked({ neck_c: 6 }), marked({ neck_c: 5 })]);
    const series = regionSeries(entries, 'neck_c', '2025-12-30');
    expect(series.map((p) => p.day)).toEqual([2, 3]);
  });

  /* Never a mix of the two axes. A half-populated injury date would make some
     days measured from injury and others from the first entry, and every slope
     computed across that boundary would be meaningless. */
  it('falls back to days from the first rated night when there is no injury date', () => {
    const entries = range([marked({ neck_c: 6 }), null, marked({ neck_c: 5 })]);
    expect(regionSeries(entries, 'neck_c').map((p) => p.day)).toEqual([0, 2]);
  });
});

describe('ratedRegions', () => {
  it('returns every region rated at least once, in taxonomy order', () => {
    const entries = range([marked({ knee_l: 3 }), marked({ neck_c: 6, knee_l: 2 })]);
    expect(ratedRegions(entries)).toEqual(['neck_c', 'knee_l']);
  });

  it('is empty when nothing was ever rated', () => {
    expect(ratedRegions(range([nothingHurt(), null]))).toEqual([]);
    expect(ratedRegions([])).toEqual([]);
  });
});

describe('theilSen', () => {
  it('recovers an exact line', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => 2 + 0.5 * x);
    const fit = theilSen(xs, ys);
    expect(fit.slope).toBeCloseTo(0.5, 10);
    expect(fit.intercept).toBeCloseTo(2, 10);
  });

  /* The reason this estimator was chosen over least squares. One catastrophic
     night is exactly what a pain diary produces. */
  it('is unmoved by a single outlier that would swing least squares', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6];
    const ys = [6, 5.5, 5, 4.5, 4, 3.5, 10];
    expect(theilSen(xs, ys).slope).toBeLessThan(0);
  });

  it('returns null when every x is identical', () => {
    expect(theilSen([3, 3, 3], [1, 2, 3])).toBeNull();
  });
});

describe('theilSenInterval', () => {
  it('brackets the slope of a clean trend and excludes zero', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7];
    const ys = xs.map((x) => 8 - 0.5 * x);
    const fit = theilSen(xs, ys);
    const interval = theilSenInterval(xs, ys, fit.slopes);

    expect(interval.lo).toBeLessThanOrEqual(fit.slope);
    expect(interval.hi).toBeGreaterThanOrEqual(fit.slope);
    expect(interval.hi).toBeLessThan(0);
  });

  it('straddles zero on pure noise', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7];
    const ys = [5, 5.5, 4.5, 5, 5.5, 4.5, 5, 5.5];
    const fit = theilSen(xs, ys);
    const interval = theilSenInterval(xs, ys, fit.slopes);
    expect(interval.lo).toBeLessThanOrEqual(0);
    expect(interval.hi).toBeGreaterThanOrEqual(0);
  });

  it('returns null below three points', () => {
    expect(theilSenInterval([0, 1], [1, 2], [1])).toBeNull();
  });
});

describe('regionTrend', () => {
  const steady = (scores) => scores.map((score, day) => ({ nightOf: `d${day}`, score, day }));

  it('emits nothing at all below the region floor', () => {
    const series = steady([8, 7.5, 7, 6.5, 6, 5.5]);
    expect(series).toHaveLength(MIN_NIGHTS_FOR_REGION - 1);
    expect(regionTrend(series)).toBeNull();
  });

  it('reports easing on a clear downward trend', () => {
    const trend = regionTrend(steady([8, 7.5, 7, 6.5, 6, 5.5, 5]));
    expect(trend.status).toBe('easing');
    expect(trend.weeklyChange).toBeLessThan(0);
    expect(trend.n).toBe(7);
  });

  it('reports worsening on a clear upward trend', () => {
    expect(regionTrend(steady([2, 2.5, 3, 3.5, 4, 4.5, 5])).status).toBe('worsening');
  });

  /* Most regions on most real datasets should land here. A model that always
     picks a side is not measuring anything. */
  it('reports unclear on noise', () => {
    const trend = regionTrend(steady([5, 5.5, 4.5, 5, 5.5, 4.5, 5, 5.5, 5]));
    expect(trend.status).toBe('unclear');
  });

  it('reports unclear when the slope is real but too small to be worth a direction', () => {
    const tiny = Array.from({ length: 20 }, (_, day) => ({
      nightOf: `d${day}`,
      score: 5 - day * (MIN_WEEKLY_SLOPE / 7) * 0.4,
      day,
    }));
    const trend = regionTrend(tiny);
    expect(Math.abs(trend.weeklyChange)).toBeLessThan(MIN_WEEKLY_SLOPE);
    expect(trend.status).toBe('unclear');
  });

  /* The lattice trap, recorded as bug 3 in the Phase 3b notes in
     docs/tasks.md and rediscovered here on a coarser scale.

     Half-step ratings make the pairwise slopes a discrete set, so an interval
     bound lands exactly on 0 constantly. Requiring strict exclusion of zero
     would report "not clear yet" for a region with an obvious, consistent
     trend. A bound AT zero still decides; a bound either side of zero does not. */
  it('still decides when an interval bound lands exactly on zero', () => {
    const series = steady([6, 6, 5.5, 5.5, 5, 5, 4.5, 4.5, 4]);
    const trend = regionTrend(series);
    expect(trend.status).toBe('easing');
    expect(trend.ciHigh === 0 || trend.ciLow === 0 || trend.ciHigh < 0).toBe(true);
  });

  it('refuses a direction when the interval has one end each side of zero', () => {
    const series = steady([5, 7, 3, 6, 4, 7, 3, 6, 4]);
    const trend = regionTrend(series);
    expect(trend.ciLow).toBeLessThan(0);
    expect(trend.ciHigh).toBeGreaterThan(0);
    expect(trend.status).toBe('unclear');
  });
});

describe('projectRegion', () => {
  const fit = { slope: -0.2, intercept: 8 };

  it('stays inside the pain scale however the line runs', () => {
    for (let day = 0; day < 200; day += 1) {
      const value = projectRegion(fit, day, { peakScore: 8, n: 20 });
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(PAIN_MAX);
    }
  });

  /* The prior earns its place here: with thin data the projection should lean
     on the generic shape, and with plenty it should be the user's own line. */
  it('leans on the prior when data is thin and on the fit when it is not', () => {
    const wild = { slope: -3, intercept: 9 };
    const thin = projectRegion(wild, 10, { peakScore: 9, n: 2, daysSinceInjury: 10 });
    const thick = projectRegion(wild, 10, { peakScore: 9, n: 200, daysSinceInjury: 10 });

    const ownLine = Math.max(0, 9 - 3 * 10);
    expect(Math.abs(thick - ownLine)).toBeLessThan(Math.abs(thin - ownLine));
  });

  it('returns null without a usable fit or day', () => {
    expect(projectRegion(null, 3, { peakScore: 5, n: 9 })).toBeNull();
    expect(projectRegion(fit, NaN, { peakScore: 5, n: 9 })).toBeNull();
  });
});

describe('backtestRegion', () => {
  const descending = Array.from({ length: 20 }, (_, day) => ({
    nightOf: `2026-02-${String(day + 1).padStart(2, '0')}`,
    score: Math.max(0.5, 9 - day * 0.4),
    day,
  }));

  it('produces nothing until there is a night beyond the training floor', () => {
    const short = descending.slice(0, MIN_NIGHTS_FOR_REGION);
    const result = backtestRegion(short);
    expect(result.points).toEqual([]);
    expect(result.beatsNaive).toBeNull();
  });

  /* The property that makes a projected-vs-actual chart honest. Every
     projection must have been produced without seeing the night it is compared
     against - otherwise the line is graded on homework it has already read. */
  it('never lets a night inform its own projection', () => {
    const result = backtestRegion(descending);
    expect(result.points.length).toBeGreaterThan(0);
    for (const point of result.points) {
      expect(point.trainSize).toBeLessThanOrEqual(
        descending.findIndex((p) => p.nightOf === point.nightOf),
      );
    }
  });

  it('reports both errors and the comparison between them', () => {
    const result = backtestRegion(descending);
    expect(result.modelError).toBeGreaterThanOrEqual(0);
    expect(result.naiveError).toBeGreaterThanOrEqual(0);
    expect(typeof result.beatsNaive).toBe('boolean');
  });

  /* The losing branch has to be reachable, or "reported whichever way it goes"
     is an empty claim.

     A random walk is the shape that beats a trend line: each night is close to
     the one before, so "today's rating again" is an excellent predictor, while
     a straight fit through a wandering history is a poor one. Note that a
     strict alternation does NOT produce this - there the naive baseline is
     wrong by the full swing every single night and the fitted line, sitting
     near the mean, wins comfortably. */
  it('can report losing to the naive baseline', () => {
    const steps = [0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
                   0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
                   0.5, 0.5, 0.5];
    let score = 5;
    const walk = [{ nightOf: 'n0', score, day: 0 }];
    steps.forEach((step, i) => {
      score = Math.min(PAIN_MAX, Math.max(0, score + step));
      walk.push({ nightOf: `n${i + 1}`, score, day: i + 1 });
    });

    const result = backtestRegion(walk);
    expect(result.beatsNaive).toBe(false);
    expect(result.naiveError).toBeLessThan(result.modelError);
  });
});

describe('buildRegionModels', () => {
  it('summarises every rated region', () => {
    const entries = range([
      marked({ neck_c: 6, knee_l: 2 }),
      marked({ neck_c: 5 }),
      marked({ knee_l: 3 }),
    ]);
    const models = buildRegionModels(entries);

    expect(models.map((m) => m.regionId)).toEqual(['neck_c', 'knee_l']);
    const neck = models[0];
    expect(neck.label).toBe('Neck');
    expect(neck.n).toBe(2);
    expect(neck.worst).toBe(6);
    expect(neck.latest).toBe(5);
    expect(neck.trend).toBeNull();
  });
});

describe('buildTimelineFrames', () => {
  /* These two states must stay distinguishable all the way to the renderer. An
     unlit body captioned "not logged" is a different claim from one captioned
     "nothing hurt", and collapsing them here would make the distinction
     unavailable to every caller downstream. */
  it('keeps not-logged and nothing-hurt distinct', () => {
    const frames = buildTimelineFrames(range([null, nothingHurt(), marked({ neck_c: 6 })]));

    expect(frames[0].answered).toBe(false);
    expect(frames[0].regions).toEqual({});

    expect(frames[1].answered).toBe(true);
    expect(frames[1].regions).toEqual({});

    expect(frames[2].answered).toBe(true);
    expect(frames[2].regions).toEqual({ neck_c: 6 });
  });

  it('returns one frame per night in range, including gaps', () => {
    expect(buildTimelineFrames(range([marked({ neck_c: 6 }), null, null]))).toHaveLength(3);
  });
});

/* The structural half of the local-first claim, asserted the same way
   lib/agreement.js asserts it. A comment saying "this never sends anything" is
   a convention; a test that greps the source is a property. */
describe('the module cannot transmit anything', () => {
  it('contains no network call and no import of the api client', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../painTrajectory.js', import.meta.url)),
      'utf8',
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/navigator\.sendBeacon/);
    expect(source).not.toMatch(/from\s+['"].*api\.js['"]/);
  });
});
