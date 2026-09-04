/* One region's rated nights as a sparkline, for the small-multiples grid.

   Deliberately plainer than ProjectedVsActualChart: no gridlines, no axis
   labels, no projected line. This is the overview - the thing that lets someone
   scan ten regions and see which ones are moving - and a grid of ten fully
   dressed charts is unreadable. The detail view is a click away.

   Severity is encoded by colour AND by dot radius, per docs/design-system.md,
   so the chart survives being read by someone whose light sensitivity has them
   at minimum brightness. */

import { PAIN_MAX } from '../../lib/painRegions.js';
import { painSeverityToken } from '../../lib/severity.js';
import { formatShortDate } from '../../lib/dates.js';

const W = 200;
const H = 52;
const PAD = 5;

export function RegionTrendChart({ label, series }) {
  if (!series || series.length < 2) return null;

  const days = series.map((p) => p.day);
  const minDay = Math.min(...days);
  const span = Math.max(1, Math.max(...days) - minDay);

  const sx = (day) => PAD + ((day - minDay) / span) * (W - PAD * 2);
  const sy = (score) => PAD + (1 - score / PAIN_MAX) * (H - PAD * 2);

  const runs = splitRuns(series);

  return (
    <svg
      className="pain-spark"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={describe(label, series)}
    >
      {runs.map((run) => (
        <polyline
          key={run[0].day}
          className="pain-spark__line"
          points={run.map((p) => `${sx(p.day)},${sy(p.score)}`).join(' ')}
        />
      ))}
      {series.map((p) => (
        <circle
          key={p.nightOf}
          cx={sx(p.day)}
          cy={sy(p.score)}
          r={p.score >= 7 ? 3 : 2}
          fill={painSeverityToken(p.score)}
          className="pain-spark__point"
        >
          <title>
            {formatShortDate(p.nightOf)}: {p.score} of {PAIN_MAX}
          </title>
        </circle>
      ))}
    </svg>
  );
}

function splitRuns(series) {
  const runs = [];
  let current = [];
  for (const point of series) {
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

function describe(label, series) {
  const first = series[0];
  const last = series[series.length - 1];
  return (
    `${label}: ${series.length} rated nights, ` +
    `from ${first.score} to ${last.score} out of ${PAIN_MAX}.`
  );
}
