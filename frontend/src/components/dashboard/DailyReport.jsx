/* Shown the moment a sleep episode becomes complete - the payoff for coming back
   in the morning.

   It describes YESTERDAY. Nothing here looks forward, and nothing here evaluates
   the user. "You're doing well" and "that's a setback" are both absent on purpose:
   one sets up the next ordinary day to read as a failure, and the other is a
   clinical judgement this app has no standing to make.

   Everything is computed locally, so this renders identically whether or not the
   model service is awake. The one moment in the app that must feel like a reward
   should not depend on a free-tier cold start. */

import { Link } from 'react-router-dom';
import { Card } from '../ui/Card.jsx';
import { Stat } from '../ui/Stat.jsx';
import { Button } from '../ui/Button.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { deriveSleepDuration, worstSymptom, hasDstShift, isDayComplete } from '../../lib/derive.js';
import { compareToRecent } from '../../lib/weekly.js';
import { milestoneFor } from '../../lib/milestones.js';
import { formatDuration, formatNightLabel } from '../../lib/dates.js';
import { SYMPTOMS, MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';

const labelFor = (key) => SYMPTOMS.find((s) => s.key === key)?.label ?? key;

const COMPARISON = {
  lighter: 'Lighter than your recent nights.',
  heavier: 'Heavier than your recent nights.',
  similar: 'About the same as your recent nights.',
};

export function DailyReport({ entry, entries, onDone }) {
  if (!entry?.night) return null;

  const burden = entry.night.symptomBurden;
  const duration = deriveSleepDuration(entry);
  const quality = entry.morning?.sleepQuality;
  const worst = worstSymptom(entry);
  const comparison = compareToRecent(entry, entries);

  /* Counted from complete nights rather than the streak, so a milestone is not
     withheld from someone who missed a day - see lib/milestones.js. Shown here
     the moment it is earned; the dashboard shows it again until acknowledged. */
  const completeNights = (entries ?? []).filter(isDayComplete).length;
  const milestone = milestoneFor(completeNights);
  const justReached = milestone?.nights === completeNights ? milestone : null;

  return (
    <div className="stack stack--loose">
      <Card>
        <div className="lumi-row">
          <Lumi size={56} state={justReached ? 'celebrating' : 'encouraging'} />
          <div className="stack stack--tight">
            <h1 className="h-size-h3">That's both check-ins done</h1>
            <p className="text-muted text-sm">{formatNightLabel(entry.nightOf)}</p>
          </div>
        </div>
      </Card>

      <Card title="Your night">
        <div className="stack">
          <div className="row" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <Stat
              label="Sleep"
              value={formatDuration(duration) ?? '-'}
              note={Number.isFinite(quality) ? `quality ${quality} of 6` : null}
            />
            <Stat
              label="Symptom burden"
              value={Number.isFinite(burden) ? `${burden}` : '-'}
              note={Number.isFinite(burden) ? `of ${MAX_SYMPTOM_BURDEN}` : 'incomplete'}
            />
            {worst && (
              <Stat label="Most severe" value={labelFor(worst.key)} note={`rated ${worst.value} of 6`} />
            )}
          </div>

          {/* Absent entirely under a few nights of history - there is no "usual"
              to compare against yet, and inventing one is the same mistake as
              emitting a prediction on day three. */}
          {comparison && (
            <p className="text-sm">
              {COMPARISON[comparison.direction]}{' '}
              <span className="text-muted">
                Compared with your median of {comparison.baseline} over the last {comparison.n}{' '}
                logged nights.
              </span>
            </p>
          )}

          {duration != null && hasDstShift(entry) && (
            <p className="text-muted text-xs">
              The clocks changed this night, so this duration may be off by an hour.
            </p>
          )}
        </div>
      </Card>

      {justReached && (
        <Card className="milestone">
          <p className="text-sm">
            <strong>{justReached.title}.</strong>{' '}
            <span className="text-muted">{justReached.body}</span>
          </p>
        </Card>
      )}

      <div className="stack stack--tight">
        <Button block onClick={onDone}>
          Back to today
        </Button>
        <p className="text-center text-xs text-muted">
          <Link to="/insights">See your insights</Link>
        </p>
      </div>
    </div>
  );
}
