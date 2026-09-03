/* The cold-start state.

   Most users spend their first week here, so this is not an edge case to
   apologise for - it is a real screen that should feel like progress rather than
   a locked door.

   The general recovery context comes from MyLumi_Plan.md 3.3e. It is labelled as
   population data, not a personal prediction, because that distinction has to be
   visible in the copy rather than merely implied. */

import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { MIN_NIGHTS_FOR_INSIGHT as NIGHTS_NEEDED } from '../../lib/constants.js';

export function BaselineProgress({ nDays = 0, reason }) {
  const done = Math.min(nDays, NIGHTS_NEEDED);
  const pct = Math.round((done / NIGHTS_NEEDED) * 100);

  return (
    <Card title="Building your baseline">
      <div className="stack">
        <div className="lumi-row">
          <Lumi size={48} state="empty" />
          <p className="text-sm">
            {reason ?? `${NIGHTS_NEEDED - done} more complete nights and MyLumi can start looking for patterns.`}
          </p>
        </div>

        <div>
          <div className="progress__bar" aria-hidden="true">
            <div className="progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <p
            className="text-muted text-xs"
            style={{ marginTop: 'var(--space-2)' }}
            role="status"
          >
            {done} of {NIGHTS_NEEDED} complete nights logged
          </p>
        </div>

        <p className="text-muted text-xs">
          A night counts once both check-ins are done. MyLumi will not guess at a
          pattern before it has enough of your data to see one - an estimate from
          three nights would look just as confident as one from thirty.
        </p>

        <div className="insight-context">
          <p className="text-xs" style={{ margin: 0 }}>
            <strong>While you build your baseline</strong> - in published research on
            concussion recovery, symptoms often peak around days 3-5, and most
            people improve substantially within about four weeks.{' '}
            <em>This is general population data, not a prediction about you.</em>{' '}
            Recovery varies widely between individuals.
          </p>
        </div>
      </div>
    </Card>
  );
}
