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

/* A viewBox in abstract units; CSS scales it to the card. */
const W = 320;
const H = 140;
const PAD = { top: 8, right: 8, bottom: 20, left: 26 };

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
        <svg
          className="trajectory"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={describeTrajectory(series)}
        >
          {/* Gridlines at 0, half, and max, so the vertical scale is readable. */}
          {[0, MAX_SYMPTOM_BURDEN / 2, MAX_SYMPTOM_BURDEN].map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                y1={sy(value)}
                x2={W - PAD.right}
                y2={sy(value)}
                className="trajectory__grid"
              />
              <text x={0} y={sy(value) + 3} className="trajectory__axis">
                {value}
              </text>
            </g>
          ))}

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
                r={level >= 4 ? 4 : 2.5}
                fill={severityToken(point.burden)}
                className={level >= 4 ? 'trajectory__point trajectory__point--high' : 'trajectory__point'}
              >
                <title>
                  {formatShortDate(point.nightOf)}: {point.burden} of {MAX_SYMPTOM_BURDEN}
                </title>
              </circle>
            );
          })}

          <text x={PAD.left} y={H - 4} className="trajectory__axis">
            {formatShortDate(domain.start)}
          </text>
          <text x={W - PAD.right} y={H - 4} textAnchor="end" className="trajectory__axis">
            {formatShortDate(domain.end)}
          </text>
        </svg>

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
