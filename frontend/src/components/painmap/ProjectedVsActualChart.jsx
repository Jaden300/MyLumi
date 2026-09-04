/* Projected against actual, for one region. Hand-rolled SVG, no chart library -
   the reasoning is in TrajectoryChart.jsx and applies unchanged here.

   ## What the projected line is, and what it is not

   Every projected point was produced by a model that had NOT seen the night it
   is being compared against. That is what backtestRegion does: at each night it
   refits on only the nights before it. Drawing a whole-history fit beside the
   observations would show a model grading its own homework, and the line would
   be guaranteed to look good.

   It is also not a population curve. There is no "typical hip" line here to be
   ahead of or behind - both lines are this person's own data, one of them
   observed and one of them predicted from their own earlier nights.

   ## Two lines, two encodings

   Actual is dots plus a solid line, projected is a dashed line with no dots.
   The asymmetry is deliberate and load-bearing: dots are things the user
   reported, and nothing the model produced is allowed to render as a dot. That
   is the same rule the recovery state card follows when it keeps the user's own
   readings visible beneath the estimated line, so an estimate can never be
   mistaken for something they logged. */

import { formatShortDate } from '../../lib/dates.js';
import { PAIN_MAX } from '../../lib/painRegions.js';
import { painSeverityToken } from '../../lib/severity.js';

const W = 320;
const H = 150;
const PAD = { top: 10, right: 10, bottom: 22, left: 26 };

export function ProjectedVsActualChart({ label, points }) {
  if (!points || points.length === 0) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const days = points.map((p) => p.day);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const span = Math.max(1, maxDay - minDay);

  const sx = (day) => PAD.left + ((day - minDay) / span) * plotW;
  const sy = (score) => PAD.top + plotH - (score / PAIN_MAX) * plotH;

  /* Runs of consecutive rated nights, so the line breaks across nights this
     region was not marked. An unmarked night is not a zero and it is not a
     straight segment drawn through it either - the same rule lib/trajectory.js
     applies to the burden line. */
  const runs = splitRuns(points);

  return (
    <svg
      className="pain-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={describe(label, points)}
    >
      {[0, PAIN_MAX / 2, PAIN_MAX].map((value) => (
        <g key={value}>
          <line
            x1={PAD.left}
            y1={sy(value)}
            x2={W - PAD.right}
            y2={sy(value)}
            className="pain-chart__grid"
          />
          <text x={0} y={sy(value) + 3} className="pain-chart__axis">
            {value}
          </text>
        </g>
      ))}

      {runs.map((run) => (
        <polyline
          key={`p${run[0].day}`}
          className="pain-chart__projected"
          points={run.map((p) => `${sx(p.day)},${sy(p.projected)}`).join(' ')}
        />
      ))}

      {runs.map((run) => (
        <polyline
          key={`a${run[0].day}`}
          className="pain-chart__actual"
          points={run.map((p) => `${sx(p.day)},${sy(p.actual)}`).join(' ')}
        />
      ))}

      {/* Dots only on values the user actually reported. */}
      {points.map((p) => (
        <circle
          key={p.nightOf}
          cx={sx(p.day)}
          cy={sy(p.actual)}
          r={2.5}
          fill={painSeverityToken(p.actual)}
          className="pain-chart__point"
        >
          <title>
            {formatShortDate(p.nightOf)}: rated {p.actual}, projected {p.projected}
          </title>
        </circle>
      ))}

      <text x={PAD.left} y={H - 5} className="pain-chart__axis">
        day {minDay}
      </text>
      <text x={W - PAD.right} y={H - 5} textAnchor="end" className="pain-chart__axis">
        day {maxDay}
      </text>
    </svg>
  );
}

/* Consecutive by DAY, not by array position. Two rated nights either side of a
   week-long gap are adjacent in the array and must not be joined by a line. */
function splitRuns(points) {
  const runs = [];
  let current = [];
  for (const point of points) {
    const previous = current[current.length - 1];
    if (previous && point.day - previous.day > 1) {
      if (current.length >= 2) runs.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

/* The chart is aria-hidden by virtue of role="img"; this sentence is the whole
   of what a screen reader gets, so it carries the comparison rather than
   describing the picture. */
function describe(label, points) {
  const last = points[points.length - 1];
  const errors = points.map((p) => Math.abs(p.projected - p.actual));
  const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
  return (
    `${label}: projected against actual pain over ${points.length} rated nights. ` +
    `Most recently rated ${last.actual} out of ${PAIN_MAX}, projected ${last.projected}. ` +
    `Projections were off by ${mean.toFixed(1)} points on average.`
  );
}
