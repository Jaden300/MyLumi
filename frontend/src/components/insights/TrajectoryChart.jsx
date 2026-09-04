/* Symptom burden over time. Hand-rolled SVG, no chart library.

   A library would be the largest dependency in the project for one chart, and it
   would fight every constraint that matters here: its palette is not the severity
   ramp, its tooltips are hover-only (useless on touch, and this app's users are
   often on a phone in a dark room), and its accessibility output would not match
   the role="img" pattern the heat strip already established.

   Two accessibility decisions worth keeping:

   - Severity is encoded by radius AND colour, never colour alone. The design
     system requires this generally; here it also means the chart survives being
     viewed by someone whose light sensitivity has them at minimum brightness.
   - Each point carries a real <title> child, which touch devices surface on tap.
     A CSS tooltip would be invisible to exactly the users most likely to be on a
     phone.

   No population curve is drawn - see the comment in lib/trajectory.js. */

import { Link } from 'react-router-dom';
import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { useLumiData } from '../../hooks/useLumiData.jsx';
import { buildTrajectorySeries, describeTrajectory } from '../../lib/trajectory.js';
import { severityToken, severityLevel } from '../../lib/severity.js';
import { formatShortDate, prevDay, toLocalISODate } from '../../lib/dates.js';
import { MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';

const RANGE_DAYS = 30;

/* A viewBox in abstract units; CSS scales it to the card.

   Taller than it was, and with far more left padding. The old 26 units held
   three bare numbers with no room to say what they measured, and 8px type at
   this scale was unreadable on the phone-in-a-dark-room this app is built for.
   The extra height is what lets the axis labels grow without the plot area
   collapsing. */
const W = 320;
const H = 190;
const PAD = { top: 14, right: 10, bottom: 34, left: 52 };

/* The y axis is a fixed clinical scale, not a data range - so it gets named
   ticks rather than only numbers. Someone reading "54" has no way to know it is
   the ceiling of PCSS rather than this user's worst night. */
const Y_TICKS = [
  { value: 0, label: 'None' },
  { value: MAX_SYMPTOM_BURDEN / 2, label: 'Moderate' },
  { value: MAX_SYMPTOM_BURDEN, label: 'Severe' },
];

export function TrajectoryChart() {
  const { getEntryRange, profile } = useLumiData();

  const end = toLocalISODate(new Date());
  let start = end;
  for (let i = 0; i < RANGE_DAYS - 1; i += 1) start = prevDay(start);

  const series = buildTrajectorySeries(getEntryRange(start, end));
  const { points, segments, domain } = series;

  if (points.length === 0) {
    return (
      <Card title="Recovery trajectory">
        <p className="text-muted text-sm">
          Your symptom burden over time will appear here once you've logged a few nights.
        </p>
      </Card>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const spanDays = Math.max(1, domain.days);

  const sx = (x) => PAD.left + (x / spanDays) * plotW;
  const sy = (burden) => PAD.top + plotH - (burden / MAX_SYMPTOM_BURDEN) * plotH;

  const injuryX =
    profile?.injuryDate && profile.injuryDate >= domain.start && profile.injuryDate <= domain.end
      ? sx(daysFrom(domain.start, profile.injuryDate))
      : null;

  return (
    <Card title="Recovery trajectory" variant="feature">
      <Lumi size={150} state="thinking" className="lumi-deco lumi-deco--tr" />
      <div className="stack">
        {/* States the scale in words before the reader meets it as numbers.
            Not a caption under the chart - it is above it, and it is what the
            chart is of, which the title alone does not say. "0 to 54" is the
            sum of nine symptoms rated 0 to 6, and nothing on the old chart
            said where 54 came from or that it was a fixed ceiling. */}
        <p className="text-muted">
          Each night's nine symptom ratings added together, from 0 to{' '}
          {MAX_SYMPTOM_BURDEN}. Lower is a lighter day.
        </p>
        <svg
          className="trajectory"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={describeTrajectory(series)}
        >
          {/* Gridlines at 0, half, and max, each labelled with the number AND
              what that number means on the scale. */}
          {Y_TICKS.map(({ value, label }) => (
            <g key={value}>
              <line
                x1={PAD.left}
                y1={sy(value)}
                x2={W - PAD.right}
                y2={sy(value)}
                className="trajectory__grid"
              />
              <text x={PAD.left - 6} y={sy(value) - 1} textAnchor="end" className="trajectory__axis">
                {value}
              </text>
              <text x={PAD.left - 6} y={sy(value) + 9} textAnchor="end" className="trajectory__axis">
                {label}
              </text>
            </g>
          ))}

          {/* What the numbers count, said once on each axis. */}
          <text
            className="trajectory__axis-title"
            textAnchor="middle"
            transform={`rotate(-90) translate(${-(PAD.top + plotH / 2)}, 11)`}
          >
            Symptom burden
          </text>
          <text
            x={PAD.left + plotW / 2}
            y={H - 3}
            textAnchor="middle"
            className="trajectory__axis-title"
          >
            One dot per night logged
          </text>

          {injuryX !== null && (
            <g>
              <line
                x1={injuryX}
                y1={PAD.top}
                x2={injuryX}
                y2={PAD.top + plotH}
                className="trajectory__injury"
              />
              <text x={injuryX + 3} y={PAD.top + 8} className="trajectory__axis">
                injury
              </text>
            </g>
          )}

          {/* One polyline per unbroken run. A gap is a genuine break in the line,
              not a straight segment drawn through days nobody logged. */}
          {segments.map((segment) => (
            <polyline
              key={segment[0].x}
              className="trajectory__mean"
              points={segment.map((p) => `${sx(p.x)},${sy(p.value)}`).join(' ')}
            />
          ))}

          {points.map((point) => {
            const level = severityLevel(point.burden);
            return (
              <circle
                key={point.nightOf}
                cx={sx(point.x)}
                cy={sy(point.burden)}
                r={level >= 4 ? 5 : 3.5}
                fill={severityToken(point.burden)}
                className={level >= 4 ? 'trajectory__point trajectory__point--high' : 'trajectory__point'}
              >
                <title>
                  {formatShortDate(point.nightOf)}: symptom burden {point.burden} out of{' '}
                  {MAX_SYMPTOM_BURDEN}
                </title>
              </circle>
            );
          })}

          <text x={PAD.left} y={PAD.top + plotH + 14} className="trajectory__axis">
            {formatShortDate(domain.start)}
          </text>
          <text
            x={W - PAD.right}
            y={PAD.top + plotH + 14}
            textAnchor="end"
            className="trajectory__axis"
          >
            {formatShortDate(domain.end)}
          </text>
        </svg>

        {/* The key. Every mark on the chart above appears here with a name.

            This is the "two-word chart key" the no-caption-layer rule
            explicitly allows, and it is the exception that rule was written
            around: a legend naming what a colour means is not restating what
            the mark already shows, because an unlabelled colour shows nothing.
            Before this, the accessible description was better than the visual
            one - a screen reader got the full sentence and a sighted reader got
            unexplained circles. */}
        <ul className="trajectory__legend">
          <li className="trajectory__key">
            <span className="trajectory__line-key" aria-hidden="true" />
            Your nights, in order
          </li>
          <li className="trajectory__key">
            <span className="trajectory__ramp" aria-hidden="true" />
            Lighter to heavier day
          </li>
          <li className="trajectory__key">
            <span
              className="trajectory__swatch"
              aria-hidden="true"
              style={{
                background: 'var(--sev-6)',
                boxShadow: '0 0 0 2px var(--text)',
              }}
            />
            Ringed: your heaviest
          </li>
          {injuryX !== null && (
            <li className="trajectory__key">
              <span className="trajectory__dash-key" aria-hidden="true" />
              Injury date
            </li>
          )}
        </ul>

        <div>
          <Link to="/history" className="btn btn--secondary">
            See all history
          </Link>
        </div>
      </div>
    </Card>
  );
}

function daysFrom(start, iso) {
  const [ya, ma, da] = start.split('-').map(Number);
  const [yb, mb, db] = iso.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}
