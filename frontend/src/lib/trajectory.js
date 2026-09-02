/* Shape of the recovery trajectory chart. Pure - no SVG, no React.

   The component that draws this is a renderer with no logic of its own, which is
   what makes the interesting decisions testable in a node-only test setup.

   ## The rule that matters: gaps stay gaps

   The trailing-mean line is broken wherever the user missed a night. Drawing a
   smooth line across a gap would be imputation - inventing a value for a night
   nobody logged and then showing it to them as part of their own record. That is
   the same thing the models refuse to do when they drop an incomplete row from a
   fit rather than filling it in, and a chart is not exempt because the fabricated
   value happens to be made of pixels.

   ## What is deliberately NOT plotted

   No population "typical recovery" curve. MyLumi_Plan.md 3.4 suggests one, but a
   second line invites exactly one reading - am I ahead or behind? - which is
   staging someone's recovery against a norm. That is a claim this app does not
   make anywhere else, and there is no honest population curve at 0-54 PCSS
   resolution to draw even if it did. The population context ships as text beneath
   the chart instead, which is where BaselineProgress already puts it. */

import { MAX_SYMPTOM_BURDEN } from './constants.js';
import { daysBetween, eachDate } from './dates.js';

const TRAILING_WINDOW = 7;

/* A mean over one or two nights is not a trend, it is the nights themselves. */
const MIN_FOR_MEAN = 3;

/**
 * Build plottable series from a dense entry range.
 *
 * Returns:
 *   points - one per logged night: { nightOf, x, burden }
 *   segments - runs of consecutive logged days as [{ x, value }], each a
 *              separately-drawn polyline so gaps break the line
 *   domain - { start, end, days, maxBurden }
 *
 * `x` is a day offset from `domain.start`, so the axis is calendar time and a
 * missed week shows as a visible span rather than being closed up.
 */
export function buildTrajectorySeries(entries, { windowDays = TRAILING_WINDOW } = {}) {
  const dense = entries ?? [];
  if (dense.length === 0) {
    return { points: [], segments: [], domain: null };
  }

  const start = dense[0].nightOf;
  const end = dense[dense.length - 1].nightOf;
  const days = daysBetween(start, end);

  const byDate = new Map();
  for (const entry of dense) {
    const burden = entry?.night?.symptomBurden;
    if (Number.isFinite(burden)) byDate.set(entry.nightOf, burden);
  }

  const points = [];
  for (const iso of eachDate(start, end)) {
    if (!byDate.has(iso)) continue;
    points.push({ nightOf: iso, x: daysBetween(start, iso), burden: byDate.get(iso) });
  }

  return {
    points,
    segments: buildSegments(start, end, byDate, windowDays),
    domain: { start, end, days, maxBurden: MAX_SYMPTOM_BURDEN },
  };
}

/** Trailing mean, split into runs of consecutive logged days. */
function buildSegments(start, end, byDate, windowDays) {
  const segments = [];
  let current = [];
  const recent = [];

  for (const iso of eachDate(start, end)) {
    if (!byDate.has(iso)) {
      // A gap ends the run AND clears the window: a mean spanning a break would
      // average across days the user never reported.
      if (current.length >= 2) segments.push(current);
      current = [];
      recent.length = 0;
      continue;
    }

    recent.push(byDate.get(iso));
    if (recent.length > windowDays) recent.shift();

    if (recent.length >= MIN_FOR_MEAN) {
      current.push({
        x: daysBetween(start, iso),
        value: recent.reduce((a, b) => a + b, 0) / recent.length,
      });
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

/** Sentence describing the chart, for the aria-label on a role="img" element. */
export function describeTrajectory(series) {
  const { points, domain } = series;
  if (!domain || points.length === 0) {
    return 'Symptom burden over time - no entries yet.';
  }

  const first = points[0];
  const last = points[points.length - 1];
  const direction =
    points.length < 2
      ? null
      : last.burden < first.burden
        ? 'lower than'
        : last.burden > first.burden
          ? 'higher than'
          : 'about the same as';

  const span = domain.days + 1;
  const missed = span - points.length;

  const parts = [
    `Symptom burden over ${span} days, from ${points.length} logged nights.`,
    ` Most recent is ${last.burden} of ${domain.maxBurden}`,
    direction ? `, ${direction} the ${first.burden} at the start of this period.` : '.',
    missed > 0 ? ` ${missed} ${missed === 1 ? 'day was' : 'days were'} not logged.` : '',
  ];
  return parts.join('');
}
