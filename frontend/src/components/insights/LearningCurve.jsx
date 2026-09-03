/* Every out-of-sample check the model has run on itself, plotted.

   The honesty card's headline is an average. This is the record it averages:
   one point per genuine forecast, made using only the nights before it, against
   the naive "tomorrow = today" baseline on the same night.

   Two things it shows that the average cannot:

   - Whether the model is LEARNING. Error falling as the training set grows is
     the argument for the seven-night floor made from the user's own data rather
     than asserted in a docstring.
   - Whether it wins CONSISTENTLY or on average. A model that is usually worse
     but occasionally spectacular has the same mean as one that is reliably a
     little better, and those deserve very different amounts of trust. The
     shaded region shows where MyLumi beat the baseline, so the balance is
     visible rather than computed.

   The band is drawn between the two lines and coloured by which is on top, so
   "better" is a position in the chart and not only a colour. */

const W = 320;
const H = 96;
const PAD = { top: 8, right: 6, bottom: 16, left: 22 };

export function LearningCurve({ curve }) {
  const points = (curve ?? []).filter(
    (p) => Number.isFinite(p?.error) && Number.isFinite(p?.trainSize),
  );
  if (points.length < 4) return null;

  const comparable = points.every((p) => Number.isFinite(p.naiveError));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxError = Math.max(
    ...points.map((p) => Math.max(p.error, comparable ? p.naiveError : 0)),
    1,
  );
  const first = points[0].trainSize;
  const span = Math.max(1, points[points.length - 1].trainSize - first);

  const sx = (trainSize) => PAD.left + ((trainSize - first) / span) * plotW;
  const sy = (error) => PAD.top + plotH - (error / maxError) * plotH;

  const modelLine = points.map((p) => `${sx(p.trainSize)},${sy(p.error)}`).join(' ');
  const naiveLine = comparable
    ? points.map((p) => `${sx(p.trainSize)},${sy(p.naiveError)}`).join(' ')
    : null;

  /* One closed polygon per run of nights where the same side was ahead, so the
     shading changes colour exactly where the lines cross. */
  const regions = comparable ? buildRegions(points, sx, sy) : [];

  const wins = comparable ? points.filter((p) => p.error < p.naiveError).length : 0;

  return (
    <div className="stack stack--tight">
      <span className="stat__label">Every check, as it happened</span>
      <svg
        className="learning-curve"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          comparable
            ? `Forecast error across ${points.length} checks, against the "tomorrow matches today" baseline. ` +
              `MyLumi was closer on ${wins} of ${points.length}. ` +
              `Error is plotted against how many nights the model had learned from, from ${first} to ${
                points[points.length - 1].trainSize
              }.`
            : `Forecast error across ${points.length} out-of-sample checks.`
        }
      >
        {[0, maxError / 2, maxError].map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              y1={sy(value)}
              x2={W - PAD.right}
              y2={sy(value)}
              className="trajectory__grid"
            />
            <text x={0} y={sy(value) + 3} className="trajectory__axis">
              {Math.round(value)}
            </text>
          </g>
        ))}

        {regions.map((region) => (
          <polygon
            key={region.key}
            points={region.points}
            className={`curve__region curve__region--${region.side}`}
          />
        ))}

        {naiveLine && <polyline className="curve__naive" points={naiveLine} />}
        <polyline className="curve__model" points={modelLine} />

        {points.map((p) => (
          <circle key={p.trainSize} cx={sx(p.trainSize)} cy={sy(p.error)} r={1.8} className="curve__dot">
            <title>
              After {p.trainSize} nights: MyLumi was {p.error.toFixed(1)} off
              {Number.isFinite(p.naiveError) ? `, the baseline ${p.naiveError.toFixed(1)}` : ''}
            </title>
          </circle>
        ))}

        <text x={PAD.left} y={H - 4} className="trajectory__axis">
          {first} nights learned from
        </text>
        <text x={W - PAD.right} y={H - 4} className="trajectory__axis" textAnchor="end">
          {points[points.length - 1].trainSize}
        </text>
      </svg>

      {comparable && (
        <p className="text-muted text-xs">
          <span className="curve__swatch curve__swatch--model" aria-hidden="true" /> MyLumi
          <span className="curve__swatch curve__swatch--naive" aria-hidden="true" /> tomorrow = today.
          {' '}Green shading is where MyLumi was closer - {wins} of {points.length} checks.
        </p>
      )}
    </div>
  );
}

/* Runs of consecutive points where the same line is lower, each closed into its
   own polygon so the fill colour can change at a crossing. */
function buildRegions(points, sx, sy) {
  const regions = [];
  let run = [points[0]];
  const sideOf = (p) => (p.error <= p.naiveError ? 'better' : 'worse');
  let side = sideOf(points[0]);

  const flush = () => {
    if (run.length < 2) return;
    regions.push({
      key: `${side}-${run[0].trainSize}`,
      side,
      points: [
        ...run.map((p) => `${sx(p.trainSize)},${sy(p.error)}`),
        ...[...run].reverse().map((p) => `${sx(p.trainSize)},${sy(p.naiveError)}`),
      ].join(' '),
    });
  };

  for (const point of points.slice(1)) {
    const next = sideOf(point);
    if (next === side) {
      run.push(point);
      continue;
    }
    // Include the crossing point in both runs so the regions meet rather than
    // leaving a wedge of unshaded space at every crossover.
    run.push(point);
    flush();
    side = next;
    run = [run[run.length - 2], point].filter(Boolean);
  }
  flush();
  return regions;
}
