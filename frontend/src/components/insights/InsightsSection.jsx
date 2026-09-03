/* Decides which insight state the user is in.

   Four possible states, and exactly one renders:
     1. not configured      -> nothing (a build with no API URL stays quiet)
     2. loading             -> honest "waking up" copy, not a bare spinner
     3. cold start / offline-> baseline progress, no numbers anywhere
     4. results             -> the cards

   The important collapse is 3: "not enough data" and "can't reach the service"
   arrive in the same envelope from the same code path, so there is one place
   that says "MyLumi can't tell you something right now" instead of two.

   Two variants share this one state machine rather than being forked into two
   components - duplicating the logic is how the offline path quietly stops
   matching between the dashboard and the insights page:

     compact -> the dashboard. Prediction only, no drivers, linking through.
     full    -> /insights. Prediction with drivers, correlation, anomaly. */

import { useInsights } from '../../hooks/useInsights.js';
import { BaselineProgress } from './BaselineProgress.jsx';
import { PredictionCard } from './PredictionCard.jsx';
import { CorrelationCard } from './CorrelationCard.jsx';
import { AnomalyCard } from './AnomalyCard.jsx';
import { SymptomProfileCard } from './SymptomProfileCard.jsx';
import { RecoveryStateCard } from './RecoveryStateCard.jsx';
import { ModelHonestyCard } from './ModelHonestyCard.jsx';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Lumi } from '../lumi/Lumi.jsx';

export function InsightsSection({ variant = 'full' }) {
  const { loading, insights, configured, reload } = useInsights();
  const compact = variant === 'compact';

  if (!configured) return null;

  if (loading && !insights) {
    return (
      <Card title="Looking at your patterns">
        <div className="lumi-row">
          <Lumi size={48} state="thinking" />
          <p className="text-muted text-sm" role="status">
            Waking up MyLumi's model service. This can take up to a minute if it
            hasn't been used in a while.
          </p>
        </div>
      </Card>
    );
  }

  if (!insights) return null;

  const { forecast, correlation, anomaly, symptoms, validation, recoveryState, offline } =
    insights;

  if (offline) {
    /* The dashboard already has plenty to say when the service is down, and a
       second "unavailable" notice there adds noise without adding information.
       The insights page is where a user went specifically for this, so that is
       where the explanation belongs. */
    if (compact) return null;
    return (
      <Card title="Insights unavailable">
        <div className="stack">
          <div className="lumi-row">
            <Lumi size={44} state="offline" />
            <p className="text-sm">{forecast.reason}</p>
          </div>
          {/* The service is usually just asleep, and the first request is what
              wakes it - so the second one often succeeds. Without this the only
              way to retry was a full page reload. */}
          <div>
            <Button variant="secondary" onClick={reload} disabled={loading}>
              {loading ? 'Trying again…' : 'Try again'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Nothing to say yet. Show the one honest state rather than six empty cards.
  const anyAvailable = [forecast, correlation, anomaly, symptoms, validation, recoveryState]
    .some((section) => section?.available);
  if (!anyAvailable) {
    if (compact) return null;
    return <BaselineProgress nDays={forecast.nDays} reason={forecast.reason} />;
  }

  if (compact) return <PredictionCard forecast={forecast} compact />;

  /* Order is an argument, not a layout preference: the findings first, then the
     audit of the findings. Showing "here is how often this is wrong" before
     showing anything it produced would read as a disclaimer; showing it after
     reads as the work being checked. */
  return (
    <>
      <PredictionCard forecast={forecast} />
      <RecoveryStateCard recoveryState={recoveryState} />
      <SymptomProfileCard symptoms={symptoms} />
      <CorrelationCard correlation={correlation} />
      <AnomalyCard anomaly={anomaly} />
      <ModelHonestyCard validation={validation} />
    </>
  );
}
