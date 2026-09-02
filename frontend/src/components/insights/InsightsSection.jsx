/* Decides which insight state the dashboard is in.

   Four possible states, and exactly one renders:
     1. not configured      -> nothing (a build with no API URL stays quiet)
     2. loading             -> honest "waking up" copy, not a bare spinner
     3. cold start / offline-> baseline progress, no numbers anywhere
     4. results             -> the cards

   The important collapse is 3: "not enough data" and "can't reach the service"
   arrive in the same envelope from the same code path, so there is one place
   that says "MyLumi can't tell you something right now" instead of two. */

import { useInsights } from '../../hooks/useInsights.js';
import { BaselineProgress } from './BaselineProgress.jsx';
import { PredictionCard } from './PredictionCard.jsx';
import { CorrelationCard } from './CorrelationCard.jsx';
import { AnomalyCard } from './AnomalyCard.jsx';
import { Card } from '../ui/Card.jsx';

export function InsightsSection() {
  const { loading, insights, configured } = useInsights();

  if (!configured) return null;

  if (loading && !insights) {
    return (
      <Card title="Looking at your patterns">
        <p className="text-muted text-sm" role="status">
          Waking up MyLumi's model service. This can take up to a minute if it
          hasn't been used in a while.
        </p>
      </Card>
    );
  }

  if (!insights) return null;

  const { forecast, correlation, anomaly, offline } = insights;

  if (offline) {
    return (
      <Card title="Insights unavailable">
        <p className="text-sm">{forecast.reason}</p>
        <p className="text-muted text-xs" style={{ marginTop: 'var(--space-3)' }}>
          Your check-ins are stored on this device and are unaffected.
        </p>
      </Card>
    );
  }

  // Nothing to say yet. Show the one honest state rather than three empty cards.
  const anyAvailable = forecast.available || correlation.available || anomaly.available;
  if (!anyAvailable) {
    return <BaselineProgress nDays={forecast.nDays} reason={forecast.reason} />;
  }

  return (
    <>
      <PredictionCard forecast={forecast} />
      <CorrelationCard correlation={correlation} />
      <AnomalyCard anomaly={anomaly} />
    </>
  );
}
