/* The underlying trend, separated from day-to-day self-report noise.

   A symptom score is a noisy reading of something that cannot be observed
   directly. Every other view in the app plots the readings; this one plots an
   estimate of the thing behind them, with a band showing how sure the model is.

   ## The gap is the point

   Where a night was never logged, the band gets visibly wider. The model does
   not invent a reading for a night nobody recorded - it carries the estimate
   forward and becomes less certain, and that uncertainty is drawn rather than
   hidden. This is the same rule the trajectory chart follows when it breaks its
   line across a gap, expressed the other way round: there, missing data means
   no line; here, it means a wider one.

   ## Why the raw dots stay

   The smoothed line is an ESTIMATE, and it must never be mistaken for what the
   user actually entered. Their own readings stay on the chart as dots, and the
   estimate is drawn as a distinct line over them - never instead of them. */

import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';

const W = 320;
const H = 140;
const PAD = { top: 8, right: 8, bottom: 20, left: 26 };

function daysApart(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export function RecoveryStateCard({ recoveryState }) {
  if (!recoveryState?.available) return null;

  const { points = [], statement, maxBurden = 54 } = recoveryState;
  if (points.length < 2) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  /* X is calendar time, not point index, so a missed week shows as a visible
     span. Closing gaps up would hide exactly the thing this chart is here to
     show. */
  const first = points[0].nightOf;
  const span = Math.max(1, daysApart(first, points[points.length - 1].nightOf));

  const sx = (nightOf) => PAD.left + (daysApart(first, nightOf) / span) * plotW;
  const sy = (burden) => PAD.top + plotH - (burden / maxBurden) * plotH;

  // Forward along the upper edge, back along the lower one, closed.
  const band = [
    ...points.map((p) => `${sx(p.nightOf)},${sy(p.upper)}`),
    ...[...points].reverse().map((p) => `${sx(p.nightOf)},${sy(p.lower)}`),
  ].join(' ');

  const line = points.map((p) => `${sx(p.nightOf)},${sy(p.level)}`).join(' ');

  return (
    <Card title="Underlying trend" variant="feature">
      <Lumi size={150} state="thinking" className="lumi-deco lumi-deco--br" />
      <div className="stack">
        <span className="stat__label">Your reports, and the level behind them</span>

        <svg
          className="trajectory"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={statement ?? 'Estimated underlying symptom level over time.'}
        >
          {[0, maxBurden / 2, maxBurden].map((value) => (
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

          {/* The uncertainty band. Widens wherever nights were missed. */}
          <polygon className="state__band" points={band} />

          {/* The user's own readings. Small and quiet - they are the input, and
              the estimate is what this card is about - but never removed. */}
          {points.map((point) => (
            <circle
              key={point.nightOf}
              cx={sx(point.nightOf)}
              cy={sy(point.observed)}
              r={2}
              className="state__observed"
            >
              <title>
                {point.nightOf}: you rated {point.observed} of {maxBurden}
              </title>
            </circle>
          ))}

          <polyline className="state__level" points={line} />
        </svg>

        {statement && <p className="text-sm">{statement}</p>}
      </div>
    </Card>
  );
}
