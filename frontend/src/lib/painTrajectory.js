/* Per-region pain trends and projections. Pure - no React, no storage, no
   network.

   ## Why this model runs in the browser

   The wire contract sends three pain aggregates and no region names, for two
   reasons set out in docs/responsible-ai.md: 29 sparse columns are separable by
   chance on a design matrix of 7-30 rows, and a stable map of where a
   particular person aches week after week is closer to a fingerprint than to a
   measurement.

   Per-region modelling does not need to break that. The data is already on the
   device, so the model runs where the data is - the same argument lib/agreement.js
   makes for joining journal text to ratings locally rather than shipping both
   to a server. Nothing here imports lib/api.js, and a test asserts it, so this
   file cannot acquire a way to transmit its inputs.

   ## Why Theil-Sen and not least squares

   Same reason the backend's per-symptom model uses it. Median of pairwise
   slopes: rank-based, so one catastrophic night cannot swing it, and it carries
   a confidence interval - which is what lets a region whose trend cannot be
   told apart from flat report exactly that, instead of being handed a direction
   it has not earned.

   Implemented here rather than imported because scipy does not run in a
   browser, and pulling a stats library in for one estimator would be the
   largest dependency in the project after three.js. The pairwise-slope median
   is a dozen lines; the interval is the fiddly part and is documented where it
   happens.

   ## The rule that matters most in this file: an unmarked region is not a zero

   If a user marks their neck on Monday and not on Tuesday, Tuesday is NOT a
   neck rating of 0. The stored record cannot distinguish "my neck was fine" from
   "I did not mark my neck", and treating the absence as a zero would fabricate
   the single most consequential number in the series - it would drag every
   trend downward and manufacture recoveries that nobody reported.

   So a region's series contains only the nights that region was actually rated.
   Gaps break the line, exactly as lib/trajectory.js breaks the burden line
   across unlogged nights.

   ## What this model will not do

   No duration estimates. "Your hip pain will last about nine more days" is a
   recovery date with a different noun on it, and this app refuses those
   outright. There is no function here that returns a number of days, and adding
   one would be a change of policy rather than a feature. */

import { MIN_NIGHTS_FOR_INSIGHT } from './constants.js';
import { PAIN_MAX, PAIN_REGION_BY_ID } from './painRegions.js';
import { priorRating, priorWeight } from './recoveryPrior.js';
import { daysBetween } from './dates.js';

/* Slope small enough that reporting a direction would be over-reading. In
   points per week, on a 0-10 scale: a fifth of a point a week is under half a
   rating step over a month, and the scale's own resolution is half a point. */
export const MIN_WEEKLY_SLOPE = 0.2;

/* Fewest rated nights before a region gets a trend at all.

   Deliberately the app's own floor rather than a new number. A region rated
   six times is in exactly the position the whole app already refuses to speak
   from, and inventing a separate threshold here would let the pain feature
   speak earlier than the forecast does on the same evidence. */
export const MIN_NIGHTS_FOR_REGION = MIN_NIGHTS_FOR_INSIGHT;

/**
 * Pull one region's rated nights out of a dense entry range.
 *
 * Returns `[{ nightOf, score, day }]`, ascending, containing ONLY nights where
 * this region carries a finite rating. `day` is days since injury when an
 * injury date is known, and otherwise days since the first rated night - never
 * a mix of the two, because a half-populated axis makes every slope meaningless.
 */
export function regionSeries(entries, regionId, injuryDate = null) {
  const points = [];
  for (const entry of entries ?? []) {
    const pain = entry?.night?.pain;
    if (pain?.answered !== true) continue;
    const score = pain.regions?.[regionId];
    if (!Number.isFinite(score)) continue;
    points.push({ nightOf: entry.nightOf, score });
  }
  if (points.length === 0) return [];

  const origin = injuryDate ?? points[0].nightOf;
  return points.map((p) => ({ ...p, day: daysBetween(origin, p.nightOf) }));
}

/** Every region with at least one rating in this range, in taxonomy order. */
export function ratedRegions(entries) {
  const seen = new Set();
  for (const entry of entries ?? []) {
    const pain = entry?.night?.pain;
    if (pain?.answered !== true) continue;
    for (const [id, score] of Object.entries(pain.regions ?? {})) {
      if (Number.isFinite(score)) seen.add(id);
    }
  }
  return Object.keys(PAIN_REGION_BY_ID).filter((id) => seen.has(id));
}

/**
 * Theil-Sen slope and intercept: the median of all pairwise slopes.
 *
 * Returns null when fewer than two distinct x values exist - every pair would
 * divide by zero, and a "slope" over a single day is not a trend.
 */
export function theilSen(xs, ys) {
  const slopes = [];
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      const dx = xs[j] - xs[i];
      if (dx === 0) continue;
      slopes.push((ys[j] - ys[i]) / dx);
    }
  }
  if (slopes.length === 0) return null;

  const slope = median(slopes);
  /* Intercept as median(y) - slope * median(x), matching scipy's default
     'separate' method, so this estimator and the backend's agree on the same
     data. */
  const intercept = median(ys) - slope * median(xs);
  return { slope, intercept, slopes };
}

/**
 * Confidence interval for a Theil-Sen slope, by the Kendall rank method.
 *
 * The interval is a pair of order statistics of the sorted pairwise slopes,
 * offset from the centre by a quantity derived from the variance of Kendall's
 * tau. This is what scipy's `theilslopes` does, and it is reproduced rather
 * than imported because scipy does not run in a browser.
 *
 * The tie correction is deliberately omitted, which makes the interval
 * slightly CONSERVATIVE (wider) on data with many tied ratings - and half-step
 * pain scores tie constantly. Erring wide means this model refuses to call a
 * direction slightly more often than it strictly must, which is the right
 * direction for the error to run in.
 */
export function theilSenInterval(xs, ys, slopes, confidence = 0.95) {
  const n = xs.length;
  if (n < 3 || slopes.length === 0) return null;

  // Variance of Kendall's tau statistic under the null.
  const variance = (n * (n - 1) * (2 * n + 5)) / 18;
  if (!(variance > 0)) return null;

  const z = zForConfidence(confidence);
  const delta = z * Math.sqrt(variance);

  const sorted = [...slopes].sort((a, b) => a - b);
  const m = sorted.length;
  const lowerIndex = Math.round((m - delta) / 2) - 1;
  const upperIndex = Math.round((m + delta) / 2);

  const lo = sorted[Math.min(Math.max(lowerIndex, 0), m - 1)];
  const hi = sorted[Math.min(Math.max(upperIndex, 0), m - 1)];
  return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}

/* Two-sided normal quantile, for the handful of confidence levels this file
   uses. A general inverse-normal is not worth carrying for one call site. */
function zForConfidence(confidence) {
  if (confidence >= 0.99) return 2.576;
  if (confidence >= 0.95) return 1.96;
  return 1.645;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Trend for one region: direction, weekly rate, and an interval.
 *
 * `status` is one of `easing`, `worsening` or `unclear`, and `unclear` is a
 * real answer rather than a failure - most regions on most datasets should land
 * there, and a model that always picks a side is not measuring anything.
 *
 * Returns null below the region floor. Null means no trend, not a hedged one.
 */
export function regionTrend(series) {
  if (!Array.isArray(series) || series.length < MIN_NIGHTS_FOR_REGION) return null;

  const xs = series.map((p) => p.day);
  const ys = series.map((p) => p.score);

  const fit = theilSen(xs, ys);
  if (fit === null || !Number.isFinite(fit.slope)) return null;

  const weekly = fit.slope * 7;
  const interval = theilSenInterval(xs, ys, fit.slopes);

  /* "Straddles zero" rather than "excludes zero", and this is not a detail.

     Pain ratings move in half steps, so the pairwise slopes come from a
     discrete lattice and an interval bound very often lands EXACTLY on 0.
     Requiring strict exclusion would report "not clear yet" for regions with an
     obvious, consistent trend, purely because a bound was 0 rather than -0.01.
     The backend's per-symptom model learned this on integer 0-6 ratings - it is
     recorded as bug 3 in the Phase 3b notes in docs/tasks.md - and half-step
     data is an even coarser lattice, so the same correction applies with more
     force. An interval with one end positive and the other negative still
     refuses, which is the case that genuinely means "we cannot tell". */
  const straddlesZero = interval !== null && interval.lo < 0 && interval.hi > 0;
  const decided = !straddlesZero && Math.abs(weekly) >= MIN_WEEKLY_SLOPE;

  return {
    slopePerDay: fit.slope,
    weeklyChange: round2(weekly),
    ciLow: interval ? round2(interval.lo * 7) : null,
    ciHigh: interval ? round2(interval.hi * 7) : null,
    status: decided ? (weekly < 0 ? 'easing' : 'worsening') : 'unclear',
    n: series.length,
  };
}

/**
 * Projected rating for a region on a given day, blending its own fitted line
 * with the generic recovery prior.
 *
 * The blend is the point of this function. A fit on seven noisy self-reports
 * can have an absurd slope; the prior pulls it toward a shape the literature
 * supports. As ratings accumulate the prior's weight falls away and the user's
 * own data takes over - see priorWeight in recoveryPrior.js.
 *
 * The prior contributes a SHAPE only. Its magnitude comes from the user's own
 * observed worst rating for this region, so no number here asserts anything
 * about how badly a stranger's neck hurts.
 */
export function projectRegion(fit, day, { peakScore, n, daysSinceInjury = null }) {
  if (!fit || !Number.isFinite(day)) return null;

  const own = fit.intercept + fit.slope * day;
  const priorDay = daysSinceInjury === null ? day : daysSinceInjury;
  const prior = priorRating(priorDay, peakScore);

  const blended = prior === null ? own : mix(own, prior, priorWeight(n));
  if (!Number.isFinite(blended)) return null;
  return clampToScale(blended);
}

function mix(own, prior, weight) {
  return own * (1 - weight) + prior * weight;
}

function clampToScale(value) {
  return Math.min(PAIN_MAX, Math.max(0, round2(value)));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Walk-forward backtest for one region: at each night, fit on ONLY the nights
 * before it, project that night, and compare to what was actually rated.
 *
 * This is what makes a "projected vs actual" chart honest. Fitting on the whole
 * series and then drawing the fitted line beside the observations would show a
 * model grading its own homework - the line is guaranteed to look good because
 * it has already seen every point it is being compared against. Every value in
 * the returned `projected` field was produced without that night's rating.
 *
 * Mirrors backend/app/models/validation.py, including the naive baseline:
 * "today's rating is tomorrow's rating". A model that cannot beat that is not
 * earning its place, and the comparison is reported whichever way it comes out.
 */
export function backtestRegion(series, { injuryDate = null } = {}) {
  if (!Array.isArray(series) || series.length < MIN_NIGHTS_FOR_REGION + 1) {
    return { points: [], modelError: null, naiveError: null, beatsNaive: null, n: 0 };
  }

  const points = [];
  const errors = [];
  const naiveErrors = [];

  for (let i = MIN_NIGHTS_FOR_REGION; i < series.length; i += 1) {
    const train = series.slice(0, i);
    const target = series[i];

    const fit = theilSen(train.map((p) => p.day), train.map((p) => p.score));
    if (fit === null) continue;

    const peakScore = Math.max(...train.map((p) => p.score));
    const projected = projectRegion(fit, target.day, {
      peakScore,
      n: train.length,
      daysSinceInjury: injuryDate ? target.day : null,
    });
    if (projected === null) continue;

    const naive = train[train.length - 1].score;

    points.push({
      nightOf: target.nightOf,
      day: target.day,
      actual: target.score,
      projected,
      error: round2(projected - target.score),
      trainSize: train.length,
    });
    errors.push(Math.abs(projected - target.score));
    naiveErrors.push(Math.abs(naive - target.score));
  }

  if (points.length === 0) {
    return { points: [], modelError: null, naiveError: null, beatsNaive: null, n: 0 };
  }

  const modelError = round2(mean(errors));
  const naiveError = round2(mean(naiveErrors));

  return {
    points,
    modelError,
    naiveError,
    /* Reported whichever way it goes. A validation layer that only appears when
       the news is good is marketing, not validation - the honesty card in the
       insights page makes the same commitment and a test pins it there. */
    beatsNaive: modelError < naiveError,
    n: points.length,
  };
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Everything the pain insights page needs, for every region with data.
 *
 * One pass so the page cannot end up with a trend computed from one window and
 * a backtest computed from another.
 */
export function buildRegionModels(entries, { injuryDate = null } = {}) {
  return ratedRegions(entries).map((regionId) => {
    const series = regionSeries(entries, regionId, injuryDate);
    const trend = regionTrend(series);
    const scores = series.map((p) => p.score);

    return {
      regionId,
      label: PAIN_REGION_BY_ID[regionId]?.label ?? regionId,
      series,
      trend,
      backtest: backtestRegion(series, { injuryDate }),
      n: series.length,
      worst: scores.length ? Math.max(...scores) : null,
      latest: scores.length ? scores[scores.length - 1] : null,
    };
  });
}

/**
 * Per-night region scores across a range, for the timeline.
 *
 * `answered` is carried through deliberately. A night nobody logged and a night
 * the user said nothing hurt are different states, and the timeline must render
 * them differently - an unlit body captioned "not logged" is not the same claim
 * as an unlit body captioned "nothing hurt". Collapsing them here would make
 * that distinction unavailable to every caller.
 */
export function buildTimelineFrames(entries) {
  return (entries ?? []).map((entry) => {
    const pain = entry?.night?.pain;
    const answered = pain?.answered === true;
    const regions = {};
    if (answered) {
      for (const [id, score] of Object.entries(pain.regions ?? {})) {
        if (Number.isFinite(score)) regions[id] = score;
      }
    }
    return { nightOf: entry.nightOf, answered, regions };
  });
}
