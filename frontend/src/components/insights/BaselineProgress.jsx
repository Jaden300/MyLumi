/* The cold-start state.

   Most users spend their first week here, so this is not an edge case to
   apologise for - it is a real screen that should feel like progress rather than
   a locked door.

   The population recovery context that used to sit here now lives on the About
   page, with the rest of the limitations, rather than being repeated on every
   screen that could carry it. */

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
            className="text-muted text-sm"
            style={{ marginTop: 'var(--space-2)' }}
            role="status"
          >
            {done} of {NIGHTS_NEEDED} complete nights logged
          </p>
        </div>
      </div>
    </Card>
  );
}
