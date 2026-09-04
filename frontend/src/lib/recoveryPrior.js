/* A generic post-concussion recovery shape, used as a shrinkage target.

   ## What this is, and the much larger thing it is not

   This module answers one narrow question: before a user has enough of their
   own data for a per-region trend to mean anything, what should the projection
   lean on? The answer here is a single curve - rise to an early peak, then a
   slow decay - built from the only two population figures this project is
   willing to state, and applied IDENTICALLY to every body region.

   It is deliberately NOT a per-region model. There is no curve here for a hip
   that differs from the curve for a neck, and that is the honest position
   rather than a gap to fill later. Published data on concussion symptom course
   at body-region resolution does not appear to exist; what exists is coarse and
   general. Writing a hip-specific decay constant would produce a number that
   looks like a citation and is not one - the same move this project refused
   when it declined to lower a p-value threshold to make a demo look fuller.

   So: one shape, every region, and every consumer of it says so in its copy.

   ## Where the two numbers come from

   Both are already in the product, in the cold-start copy on the About page and
   in docs/responsible-ai.md, labelled there as general population data rather
   than a prediction about the user:

     - symptoms often peak around days 3-5 after injury
     - most people improve substantially within about four weeks

   PEAK_DAY is the midpoint of the first. HALF_LIFE_DAYS is fitted to the second
   rather than asserted: "substantially improved by about 28 days" is read as
   the curve having fallen to a quarter of its peak by then, which is two half
   lives, giving a half life of about 10.5 days. That reading is an assumption
   and is stated as one; it is the only free parameter here and it is written
   where a reader can argue with it.

   ## What it must never be used for

   Not a comparison line on a chart. lib/trajectory.js declines to plot a
   population curve beside the user's own, because a second line invites "am I
   ahead or behind?" and stages someone's recovery against a norm. Nothing here
   changes that. This curve is a PRIOR - it moves a projection when data is
   thin and vanishes as data arrives - and it is never drawn as a series of its
   own.

   Not a duration estimate either. There is no function here that answers "how
   many more days", and there should not be: that is a recovery date with a
   different noun on it, and this app refuses those outright. */

import { PAIN_MAX } from './painRegions.js';

/* Midpoint of "often peak around days 3-5". */
export const PEAK_DAY = 4;

/* See the header: derived from "substantially improved by about four weeks",
   read as two half lives by day 28. */
export const HALF_LIFE_DAYS = 10.5;

/* How steeply the curve climbs to its peak. Recovery from a concussion is not
   instantaneous at hour zero - symptoms build over the first days, which is
   what the "peak around days 3-5" figure is describing. A linear ramp to the
   peak is the simplest thing that produces that shape and does not pretend to
   model a mechanism. */
function riseFraction(day) {
  if (day <= 0) return 0;
  return Math.min(1, day / PEAK_DAY);
}

function decayFraction(day) {
  if (day <= PEAK_DAY) return 1;
  return Math.pow(0.5, (day - PEAK_DAY) / HALF_LIFE_DAYS);
}

/**
 * Relative severity at a given day since injury, on a 0-1 scale where 1 is the
 * peak. Shape only - it carries no units and says nothing about how bad any
 * particular person's peak was.
 *
 * Returns null for a non-finite or negative day rather than clamping, because
 * a missing injury date is a real state in this app (the profile field is
 * optional) and it must not silently become "day 0, at peak".
 */
export function priorShape(daysSinceInjury) {
  if (!Number.isFinite(daysSinceInjury) || daysSinceInjury < 0) return null;
  return riseFraction(daysSinceInjury) * decayFraction(daysSinceInjury);
}

/**
 * The prior's expected rating at `daysSinceInjury`, scaled so that its peak
 * sits at `peakScore`.
 *
 * `peakScore` is the user's OWN observed worst rating for that region, not a
 * population figure. That is what keeps this a shape rather than a claim: the
 * literature contributes the curve, the user contributes the magnitude, and no
 * number here asserts how badly a stranger's neck hurts.
 */
export function priorRating(daysSinceInjury, peakScore) {
  const shape = priorShape(daysSinceInjury);
  if (shape === null || !Number.isFinite(peakScore)) return null;
  const scaled = shape * peakScore;
  return Math.min(PAIN_MAX, Math.max(0, scaled));
}

/* Observations at which the prior and the user's own fit carry equal weight.

   Set to the app's insight floor rather than tuned. The prior only exists to
   stop a 7-night fit swinging on noise, and by the time a region has ~14
   ratings its own slope is the better estimate; an equal-weight point at 7
   puts the crossover exactly where the app already draws the line between "not
   enough to speak" and "enough to speak quietly". A tuned value would need a
   dataset to tune against, and inventing one to justify a constant is the
   thing this file exists to avoid. */
export const PRIOR_EQUAL_WEIGHT_N = 7;

/**
 * Weight to give the prior against a fit with `n` observations.
 *
 * Standard shrinkage: k / (k + n). At n = 0 the prior is everything, at
 * n = PRIOR_EQUAL_WEIGHT_N the two are even, and it decays toward zero from
 * there without ever quite reaching it - which is correct, since a personal
 * fit on 30 noisy self-reports is better than the prior but not so good that
 * the prior should be discarded outright.
 */
export function priorWeight(n) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return PRIOR_EQUAL_WEIGHT_N / (PRIOR_EQUAL_WEIGHT_N + n);
}
