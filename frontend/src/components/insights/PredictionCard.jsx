/* Tomorrow's forecast: value + why.

   A number without its reasoning is exactly the black box this project competes
   against, so the drivers are not optional.

   The range is presented BEFORE the point estimate in the visual hierarchy on
   purpose. The interval is the honest answer; the single number is a convenience
   inside it, and a patient should not read it as a promise. The interval is now
   the only thing carrying uncertainty on this card - the confidence pill was
   removed, see docs/design-system.md, "No caption layer". The refusal rule
   below is untouched and still enforced on both sides. */

import { Link } from 'react-router-dom';
import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { MAX_SYMPTOM_BURDEN as MAX_BURDEN, MIN_NIGHTS_FOR_INSIGHT } from '../../lib/constants.js';

/** Plain-language band. Never a diagnosis, never a recovery date. */
function bandFor(value) {
  const fraction = value / MAX_BURDEN;
  if (fraction < 0.15) return 'a light day';
  if (fraction < 0.35) return 'a moderate day';
  if (fraction < 0.6) return 'a heavier day';
  return 'a difficult day';
}

const isFinitePair = (value) =>
  Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n));

/**
 * `compact` drops the drivers list and links to /insights for the reasoning.
 *
 * The number and its interval stay together even in compact form - a point
 * estimate without its range reads as a promise, and a compact variant is not a
 * licence to drop the range.
 */
export function PredictionCard({ forecast, compact = false }) {
  if (!forecast?.available) return null;

  const { predictedBurden, interval, drivers, nDays } = forecast;

  /* Refuse to render regardless of what the server said.
     `available: true` is the server's opinion; these are the app's own rules,
     and the under-7-nights refusal is too important to hold in one place. A
     partial body previously rendered the literal headline "null-null of 54 -
     most likely around undefined, a difficult day" at three nights of data. */
  if (!Number.isFinite(nDays) || nDays < MIN_NIGHTS_FOR_INSIGHT) return null;
  if (!Number.isFinite(predictedBurden) || !isFinitePair(interval)) return null;

  const [low, high] = interval;

  return (
    <Card title="Tomorrow's outlook" variant={compact ? undefined : 'feature'}>
      {/* Only on the full Insights card. The compact form sits on the dashboard
          beside a card that already carries a decorative Lumi, and two of them
          in one column is clutter. */}
      {!compact && <Lumi size={180} state="thinking" className="lumi-deco lumi-deco--br" />}
      <div className="stack">
        <div className="stack stack--tight">
          <span className="stat__label">Estimated symptom burden</span>
          <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)' }}>
            <strong className="display-number">
              {low}-{high}
            </strong>
            <span className="text-muted text-sm">of {MAX_BURDEN}</span>
          </div>
          <span className="text-sm text-muted">
            Most likely around {predictedBurden} - {bandFor(predictedBurden)} for you.
          </span>
        </div>

        {!compact && drivers?.length > 0 && (
          <div className="stack stack--tight">
            <span className="stat__label">What's driving this</span>
            <ul className="driver-list">
              {drivers.map((driver) => (
                <li key={driver.feature} className="driver">
                  <span className={`driver__arrow driver__arrow--${driver.direction}`} aria-hidden="true">
                    {driver.direction === 'increases' ? '↑' : '↓'}
                  </span>
                  <span className="driver__text">
                    Your recent <strong>{driver.label}</strong>{' '}
                    {driver.direction === 'increases' ? 'pushes this up' : 'pulls this down'}
                    {/* Relative magnitude, which the model has always sent and
                        the card used to drop. Drivers arrive ranked, so scaling
                        against the strongest shows how much of the story the
                        second and third actually account for - "these three
                        matter" and "one of these matters" look identical
                        without it. Decorative only: the sentence above already
                        carries the meaning. */}
                    {Number.isFinite(driver.weight) && drivers[0]?.weight > 0 && (
                      <span className="driver__weight" aria-hidden="true">
                        <span
                          className={`driver__weight-fill driver__weight-fill--${driver.direction}`}
                          style={{
                            width: `${Math.max(
                              8,
                              Math.round((driver.weight / drivers[0].weight) * 100),
                            )}%`,
                          }}
                        />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {compact && (
          <div>
            <Link to="/insights" className="btn btn--secondary">
              See what's driving this
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
