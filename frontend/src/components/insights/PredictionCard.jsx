/* Tomorrow's forecast: value + confidence + why.

   The design system requires all three, together, every time. A number without
   its reasoning is exactly the black box this project competes against.

   The range is presented BEFORE the point estimate in the visual hierarchy on
   purpose. The interval is the honest answer; the single number is a convenience
   inside it, and a patient should not read it as a promise. */

import { Link } from 'react-router-dom';
import { Card } from '../ui/Card.jsx';
import { ConfidenceBadge } from './ConfidenceBadge.jsx';
import { MAX_SYMPTOM_BURDEN as MAX_BURDEN } from '../../lib/constants.js';

/** Plain-language band. Never a diagnosis, never a recovery date. */
function bandFor(value) {
  const fraction = value / MAX_BURDEN;
  if (fraction < 0.15) return 'a light day';
  if (fraction < 0.35) return 'a moderate day';
  if (fraction < 0.6) return 'a heavier day';
  return 'a difficult day';
}

/**
 * `compact` drops the drivers list and links to /insights for the reasoning.
 *
 * The number, its interval and its confidence stay together even in compact form
 * - those three are the design system's floor for showing a prediction at all,
 * and a compact variant is not a licence to drop one of them.
 */
export function PredictionCard({ forecast, compact = false }) {
  if (!forecast?.available) return null;

  const { predictedBurden, interval, drivers, confidence, nDays } = forecast;
  const [low, high] = interval ?? [null, null];

  return (
    <Card title="Tomorrow's outlook">
      <div className="stack">
        <div className="row row--between" style={{ alignItems: 'flex-start' }}>
          <div className="stack stack--tight">
            <span className="text-muted text-xs">Estimated symptom burden</span>
            <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)' }}>
              <strong className="display-number">
                {low}-{high}
              </strong>
              <span className="text-muted text-sm">of {MAX_BURDEN}</span>
            </div>
            <span className="text-muted text-xs">
              Most likely around {predictedBurden} - {bandFor(predictedBurden)} for you.
            </span>
          </div>
          <ConfidenceBadge confidence={confidence} nDays={nDays} />
        </div>

        {confidence === 'low' && (
          <p className="insight-caveat text-xs">
            This is an early estimate from a small number of nights. Treat it as a
            rough signal, not a forecast.
          </p>
        )}

        {!compact && drivers?.length > 0 && (
          <div className="stack stack--tight">
            <span className="text-muted text-xs">What's driving this</span>
            <ul className="driver-list">
              {drivers.map((driver) => (
                <li key={driver.feature} className="driver">
                  <span className={`driver__arrow driver__arrow--${driver.direction}`} aria-hidden="true">
                    {driver.direction === 'increases' ? '↑' : '↓'}
                  </span>
                  <span>
                    Your recent <strong>{driver.label}</strong>{' '}
                    {driver.direction === 'increases' ? 'pushes this up' : 'pulls this down'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-muted text-xs">
          Based on patterns in your own check-ins. This is an estimate of how you
          may feel, not a medical prediction.
          {compact && (
            <>
              {' '}
              <Link to="/insights">See what's driving this</Link>
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
