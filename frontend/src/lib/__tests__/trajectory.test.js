/* The trajectory chart's shape logic.

   The claim worth defending here: a gap in the data is a gap in the line. Drawing
   a smooth curve across nights nobody logged would invent values and then present
   them back to the user as their own record - the same fabrication the models
   refuse when they drop an incomplete row instead of imputing it. */

import { describe, it, expect } from 'vitest';
import { buildTrajectorySeries, describeTrajectory } from '../trajectory.js';

const night = (nightOf, symptomBurden) => ({
  nightOf,
  night: symptomBurden === null ? { symptomBurden: null } : { symptomBurden },
  morning: null,
});

const gap = (nightOf) => ({ nightOf, night: null, morning: null });

/* A dense range starting Jan 1. `values` may hold null (logged but incomplete)
   or undefined (not logged at all). */
function dense(values) {
  return values.map((value, i) => {
    const iso = `2026-01-${String(i + 1).padStart(2, '0')}`;
    return value === undefined ? gap(iso) : night(iso, value);
  });
}

describe('buildTrajectorySeries', () => {
  it('places points on a calendar axis, not an entry index', () => {
    // Jan 1 and Jan 5 with nothing between: the gap must span 4 days on the
    // axis, not be closed up into adjacent points.
    const series = buildTrajectorySeries(dense([10, undefined, undefined, undefined, 20]));
    expect(series.points.map((p) => p.x)).toEqual([0, 4]);
  });

  it('omits nights with no entry', () => {
    const series = buildTrajectorySeries(dense([10, undefined, 20]));
    expect(series.points).toHaveLength(2);
  });

  it('omits a logged night whose burden is null', () => {
    // An incomplete symptom set yields a null burden; plotting it at 0 would
    // show a severe day as the best day of the week.
    const series = buildTrajectorySeries(dense([10, null, 20]));
    expect(series.points.map((p) => p.burden)).toEqual([10, 20]);
  });

  it('reports the domain in calendar days', () => {
    const series = buildTrajectorySeries(dense([10, undefined, undefined, 20]));
    expect(series.domain.days).toBe(3);
    expect(series.domain.start).toBe('2026-01-01');
    expect(series.domain.end).toBe('2026-01-04');
  });

  it('handles an empty range without throwing', () => {
    const series = buildTrajectorySeries([]);
    expect(series).toEqual({ points: [], segments: [], domain: null });
  });
});

describe('buildTrajectorySeries - the trailing mean', () => {
  it('BREAKS the line across a gap rather than interpolating', () => {
    const series = buildTrajectorySeries(dense([10, 10, 10, 10, undefined, 20, 20, 20, 20]));
    expect(series.segments).toHaveLength(2);
  });

  it('never spans a gap within one segment', () => {
    // Four nights each side: a run needs 3 days before it has a mean at all, and
    // 2 mean points before there is a line to draw.
    const series = buildTrajectorySeries(dense([10, 10, 10, 10, undefined, 20, 20, 20, 20]));
    const [before, after] = series.segments;
    expect(Math.max(...before.map((p) => p.x))).toBeLessThan(4);
    expect(Math.min(...after.map((p) => p.x))).toBeGreaterThan(4);
  });

  it('does not restart the mean using values from before a gap', () => {
    // If the window survived the break, the first point after it would be
    // pulled toward the pre-gap values instead of describing the new run.
    const series = buildTrajectorySeries(dense([54, 54, 54, 54, undefined, 0, 0, 0, 0]));
    const after = series.segments[series.segments.length - 1];
    expect(after[0].value).toBe(0);
  });

  it('emits no line for a run too short to average', () => {
    const series = buildTrajectorySeries(dense([10, 10]));
    expect(series.segments).toEqual([]);
  });

  it('emits no line for a single point', () => {
    expect(buildTrajectorySeries(dense([10])).segments).toEqual([]);
  });

  it('averages only over available days', () => {
    const series = buildTrajectorySeries(dense([0, 0, 9, 9]));
    const [segment] = series.segments;
    expect(segment[0].value).toBe(3); // (0+0+9)/3
    expect(segment[1].value).toBe(4.5); // (0+0+9+9)/4
  });

  it('slides the window rather than growing it without bound', () => {
    const series = buildTrajectorySeries(dense(Array(10).fill(0).concat([54])), {
      windowDays: 3,
    });
    const [segment] = series.segments;
    expect(segment[segment.length - 1].value).toBe(18); // (0+0+54)/3
  });
});

describe('describeTrajectory', () => {
  it('says so plainly when there is nothing to show', () => {
    const text = describeTrajectory(buildTrajectorySeries([]));
    expect(text).toMatch(/no entries yet/i);
  });

  it('reports direction and the count of unlogged days', () => {
    const text = describeTrajectory(buildTrajectorySeries(dense([30, undefined, 10])));
    expect(text).toMatch(/lower than/);
    expect(text).toMatch(/1 day was not logged/);
  });

  it('pluralises unlogged days', () => {
    const text = describeTrajectory(buildTrajectorySeries(dense([30, undefined, undefined, 10])));
    expect(text).toMatch(/2 days were not logged/);
  });

  it('claims no direction from a single point', () => {
    const text = describeTrajectory(buildTrajectorySeries(dense([30])));
    expect(text).not.toMatch(/lower than|higher than|about the same/);
  });
});
