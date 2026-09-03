/* How MyLumi's forecast scored against its own history.

   Deliberately the plainest card in the app: no feature variant, no decorative
   Lumi, no accent colour. It is an audit panel, not a finding, and it should
   read like one.

   The number that matters is the comparison against "tomorrow will be like
   today". That is the thing a personal model has to beat to be worth running at
   all, and this card shows the answer whichever way it goes. The losing copy is
   written and rendered exactly like the winning copy - if it only ever appeared
   when the news was good, this would be marketing rather than validation.

   Every figure here is out-of-sample: to score a night, the model was refit on
   only the nights before it. */

import { Card } from '../ui/Card.jsx';

/* Bar lengths are relative to the worse of the two errors, so the comparison
   fills the width whichever way it goes. */
function scaled(value, worst) {
  if (!Number.isFinite(value) || !Number.isFinite(worst) || worst <= 0) return 0;
  return Math.max(2, Math.round((value / worst) * 100));
}

export function ModelHonestyCard({ validation }) {
  if (!validation?.available) return null;

  const {
    folds,
    modelError,
    naiveError,
    skillScore,
    beatsNaive,
    coverage,
    targetCoverage,
    statement,
  } = validation;

  if (!Number.isFinite(modelError) || !Number.isFinite(folds) || folds < 1) return null;

  const comparable = Number.isFinite(naiveError);
  const worst = comparable ? Math.max(modelError, naiveError) : modelError;

  return (
    <Card title="How MyLumi checks itself">
      <div className="stack">
        {statement && <p className="finding__statement">{statement}</p>}

        {comparable && (
          <div className="stack stack--tight">
            <span className="stat__label">
              Average miss, on nights it had not seen
            </span>
            <ul className="audit-bars">
              <li className="audit-bar">
                <span className="audit-bar__label">MyLumi</span>
                <span className="audit-bar__track" aria-hidden="true">
                  <span
                    className={`audit-bar__fill audit-bar__fill--${
                      beatsNaive ? 'better' : 'worse'
                    }`}
                    style={{ width: `${scaled(modelError, worst)}%` }}
                  />
                </span>
                <span className="audit-bar__value">{modelError.toFixed(1)}</span>
              </li>
              <li className="audit-bar">
                <span className="audit-bar__label">Tomorrow = today</span>
                <span className="audit-bar__track" aria-hidden="true">
                  <span
                    className="audit-bar__fill audit-bar__fill--baseline"
                    style={{ width: `${scaled(naiveError, worst)}%` }}
                  />
                </span>
                <span className="audit-bar__value">{naiveError.toFixed(1)}</span>
              </li>
            </ul>
            {/* The sentence above already gives the comparison in words, so
                this only explains the units. Repeating the percentage here
                would say the same thing twice in two different registers. */}
            <p className="text-muted text-xs">
              Symptom burden points, out of {validation.maxBurden ?? 54}. Lower is
              better.
            </p>
          </div>
        )}

        {Number.isFinite(coverage) && (
          <div className="stack stack--tight">
            <span className="stat__label">Does its range mean anything?</span>
            <p className="text-sm">
              MyLumi aims for the range it shows to contain the real answer about{' '}
              {Math.round((targetCoverage ?? 0.8) * 100)}% of the time. Across{' '}
              {folds} checks on your own nights, it did{' '}
              <strong>{Math.round(coverage * 100)}%</strong> of the time.
            </p>
          </div>
        )}

        <p className="text-muted text-xs">
          Each check refits the model on only the nights before the one it is
          predicting, so nothing here is scored on data it already saw.
        </p>
      </div>
    </Card>
  );
}
