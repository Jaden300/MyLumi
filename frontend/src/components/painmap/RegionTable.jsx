/* The projected-vs-actual table for one region, plus the baseline comparison
   that says whether any of it beat guessing.

   ## The baseline sentence is the point of this component

   A table of projections is easy to be impressed by and hard to evaluate. The
   line under it - did this do better than "tomorrow will be like today"? - is
   the only thing that makes the numbers above it meaningful, and it is written
   to read the same whichever way it came out.

   That symmetry is deliberate and is copied from the honesty card on the
   insights page: the losing copy is the same length, the same tone and in the
   same place as the winning copy. A validation layer that only appears when the
   news is good is marketing, not validation. */

import { formatShortDate } from '../../lib/dates.js';
import { PAIN_MAX } from '../../lib/painRegions.js';

export function RegionTable({ backtest }) {
  if (!backtest || backtest.n === 0) return null;

  const { points, modelError, naiveError, beatsNaive } = backtest;

  return (
    <div className="stack">
      <div className="pain-table__scroll">
        <table className="pain-table">
          <caption className="sr-only">
            Projected against actual pain rating for each night the model could be
            tested on.
          </caption>
          <thead>
            <tr>
              <th scope="col">Night</th>
              <th scope="col">Day</th>
              <th scope="col">Projected</th>
              <th scope="col">Actual</th>
              <th scope="col">Off by</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.nightOf}>
                <td>{formatShortDate(point.nightOf)}</td>
                <td>{point.day}</td>
                <td>{point.projected}</td>
                <td>{point.actual}</td>
                {/* Signed, not absolute. Whether the model runs high or low is
                    the useful half of the information, and an absolute value
                    throws it away. */}
                <td>{point.error > 0 ? `+${point.error}` : point.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm">{baselineSentence(modelError, naiveError, beatsNaive)}</p>
      <p className="text-muted text-sm">
        Each projection was made from only the nights before it, on a 0 to {PAIN_MAX} scale.
      </p>
    </div>
  );
}

/* Both branches written out in full rather than assembled from fragments, so
   the losing sentence cannot end up shorter or more hedged than the winning one
   by accident. */
function baselineSentence(modelError, naiveError, beatsNaive) {
  const model = modelError.toFixed(1);
  const naive = naiveError.toFixed(1);
  if (beatsNaive) {
    return `Projections were off by ${model} points on average. Simply assuming this area would feel the same as the night before would have been off by ${naive}.`;
  }
  return `Projections were off by ${model} points on average. Simply assuming this area would feel the same as the night before would have been off by ${naive}, so the model did not do better than that here.`;
}
